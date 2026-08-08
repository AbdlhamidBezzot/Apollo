"""Redis-backed cache with automatic in-memory fallback for testing/local dev."""
import json
import math
import threading
import time
from collections.abc import Callable
from typing import Any

import redis as redis_lib

from app.core.config import get_settings

# Atomic token-bucket (burst-tolerant) evaluator. Each call returns
# {allowed, retry_after_seconds}. The token store is a {t, l} JSON blob under a
# TTL equal to the window, so idle keys self-cleanse like a sliding window while
# an active client can still burst up to `capacity` requests at once.
_RATE_LIMIT_LUA = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local raw = redis.call("GET", key)
local tokens = capacity
local last = now
if raw then
  local s = cjson.decode(raw)
  if type(s) == "table" and s.t and s.l then
    tokens = tonumber(s.t)
    last = tonumber(s.l)
  end
end

local elapsed = math.max(0, now - last)
tokens = tokens + elapsed * refill
if tokens > capacity then tokens = capacity end

local allowed = 0
local retry_after = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  if refill > 0 then
    retry_after = math.max(1, math.ceil((1 - tokens) / refill))
  else
    retry_after = ttl
  end
end

local rounded = math.floor(tokens * 100000 + 0.5) / 100000
redis.call("SET", key, cjson.encode({ t = rounded, l = now }), "EX", ttl)
return { allowed, retry_after }
"""


class CacheClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._in_memory: dict[str, tuple[str, float]] = {}
        self._use_redis = False
        self._rl_lock = threading.Lock()
        self._rl_buckets: dict[str, tuple[float, float]] = {}
        try:
            self._redis = redis_lib.Redis.from_url(
                settings.redis_url,
                socket_connect_timeout=1,
                socket_timeout=1,
                decode_responses=True,
            )
            self._redis.ping()
            self._use_redis = True
        except Exception:
            self._use_redis = False

    def rate_limit_take(self, key: str, capacity: int, refill_per_second: float, window: int) -> tuple[bool, int]:
        """Take one token from a Redis-backed token bucket (burst-tolerant).

        Returns (allowed, retry_after_seconds). Falls back to an in-memory
        token bucket when Redis is unavailable (local dev / tests). Because the
        bucket lives in Redis it is shared across all backend instances.
        """
        if self._use_redis:
            try:
                result = self._redis.eval(
                    _RATE_LIMIT_LUA,
                    1,
                    key,
                    capacity,
                    refill_per_second,
                    window,
                    time.time(),
                )
                return bool(result[0]), int(result[1])
            except Exception:
                pass
        return self._rate_limit_memory(key, capacity, refill_per_second)

    def _rate_limit_memory(
        self, key: str, capacity: int, refill_per_second: float, window: int = 60
    ) -> tuple[bool, int]:
        now = time.time()
        with self._rl_lock:
            tokens, last = self._rl_buckets.get(key, (float(capacity), now))
            tokens = min(float(capacity), tokens + (now - last) * refill_per_second)
            if tokens >= 1:
                tokens -= 1
                self._rl_buckets[key] = (tokens, now)
                return True, 0
            retry_after = math.ceil((1 - tokens) / refill_per_second) if refill_per_second > 0 else window
            retry_after = max(1, retry_after)
            self._rl_buckets[key] = (tokens, last)
            return False, int(retry_after)

    @property
    def backend(self) -> str:
        return "redis" if self._use_redis else "memory"

    def get(self, key: str) -> str | None:
        if self._use_redis:
            try:
                return self._redis.get(key)
            except Exception:
                pass
        entry = self._in_memory.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at <= time.monotonic():
            self._in_memory.pop(key, None)
            return None
        return value

    def set(self, key: str, value: str, ttl: int) -> None:
        if self._use_redis:
            try:
                self._redis.set(key, value, ex=ttl)
                return
            except Exception:
                pass
        self._in_memory[key] = (value, time.monotonic() + ttl)

    def delete(self, key: str) -> None:
        if self._use_redis:
            try:
                self._redis.delete(key)
                return
            except Exception:
                pass
        self._in_memory.pop(key, None)

    def cached_json(self, key: str, ttl: int, loader: Callable[[], Any]) -> Any:
        raw = self.get(key)
        if raw is not None:
            try:
                return json.loads(raw)
            except (ValueError, TypeError):
                pass
        data = loader()
        try:
            self.set(key, json.dumps(data), ttl)
        except (TypeError, ValueError):
            pass
        return data

_cache: CacheClient | None = None

def get_cache() -> CacheClient:
    global _cache
    if _cache is None:
        _cache = CacheClient()
    return _cache
