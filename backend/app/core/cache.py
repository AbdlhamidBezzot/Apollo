"""Redis-backed cache with automatic in-memory fallback for testing/local dev.

Production note: if REDIS_URL is set but Redis is unreachable, all connection
errors are logged as ERROR. In production the app fails fast (see
CacheClient.require_redis) rather than degrading to per-process in-memory
buckets, which would silently break distributed rate limiting.
"""
import json
import logging
import math
import threading
import time
from collections.abc import Callable
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import redis as redis_lib

from app.core.config import get_settings

logger = logging.getLogger("app.cache")

_LOCALHOST_REDIS_PREFIXES = (
    "redis://localhost",
    "redis://127.0.0.1",
    "rediss://localhost",
    "rediss://127.0.0.1",
)

def _sanitize_redis_url(url: str) -> str:
    """Return a log-safe version of a Redis URL with the password redacted.

    Redis URLs may embed credentials (redis://user:PASSWORD@host:port). Those
    must never appear in logs, error pages, or health responses, so we strip the
    userinfo password before anywhere the URL could be emitted.
    """
    try:
        parts = urlsplit(url)
        if not parts.hostname:
            return url
        host = parts.hostname
        if parts.port:
            host = f"{host}:{parts.port}"
        return urlunsplit((parts.scheme, host, parts.path, parts.query, parts.fragment))
    except ValueError:
        return "<invalid-redis-url>"


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
        self._in_memory: dict[str, tuple[str, float]] = {}
        self._use_redis = False
        self._redis: Any = None
        self._last_redis_check = 0.0
        self._last_redis_error: str | None = None
        self._rl_lock = threading.Lock()
        self._rl_buckets: dict[str, tuple[float, float]] = {}
        self._ensure_redis()

    @property
    def last_redis_error(self) -> str | None:
        """The last Redis connection error message, or None if connected."""
        return self._last_redis_error

    def is_redis_configured(self) -> bool:
        """True if REDIS_URL points to something other than localhost defaults."""
        try:
            url = get_settings().redis_url
            return bool(url) and not any(url.startswith(p) for p in _LOCALHOST_REDIS_PREFIXES)
        except Exception:
            return False

    def _ensure_redis(self) -> bool:
        if self._use_redis and self._redis is not None:
            return True
        now = time.time()
        if now - self._last_redis_check < 5.0:
            return False
        self._last_redis_check = now
        try:
            settings = get_settings()
            client = redis_lib.Redis.from_url(
                settings.redis_url,
                socket_connect_timeout=1,
                socket_timeout=1,
decode_responses=True,
            )
            client.ping()
            if self._last_redis_error is not None:
                # Recovered from a previous failure — log at INFO so it's visible
                logger.info(
                    "Redis connection restored: url='%s'",
                    _sanitize_redis_url(settings.redis_url),
                )
            self._last_redis_error = None
            self._redis = client
            self._use_redis = True
            return True
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            if self._last_redis_error != error_msg:
                # Only log when the error changes — avoids log spam every 5s
                logger.error(
                    "Redis connection failed — falling back to in-memory rate limiting. "
                    "url='%s' error='%s'",
                    _sanitize_redis_url(get_settings().redis_url),
                    error_msg,
                )
            self._last_redis_error = error_msg
            self._use_redis = False
            return False

    def require_redis(self) -> None:
        """Fail fast instead of silently degrading to memory in production.

        Emits a clear error (no URL, no credentials) when Redis is required but
        not configured or unreachable. Called from the app lifespan in production.
        """
        settings = get_settings()
        if not settings.is_production:
            return
        if self._ensure_redis():
            return
        err = self._last_redis_error or "Redis unreachable"
        logger.critical(
            "Redis is REQUIRED in production but is unavailable (%s). "
            "Rate limiting and caching must be shared across instances; "
            "falling back to per-process memory is disabled. "
            "Check the REDIS_URL environment variable (Render Redis connection string).",
            err,
        )
        raise RuntimeError(
            "Redis is REQUIRED in production but is unavailable. "
            "Check REDIS_URL (no localhost) and confirm the Render Redis instance is reachable."
        )

    def rate_limit_take(self, key: str, capacity: int, refill_per_second: float, window: int) -> tuple[bool, int]:
        """Take one token from a Redis-backed token bucket (burst-tolerant).

        Returns (allowed, retry_after_seconds). Falls back to an in-memory
        token bucket when Redis is unavailable (local dev / tests). Because the
        bucket lives in Redis it is shared across all backend instances.
        """
        if self._ensure_redis():
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
            except Exception as exc:
                logger.error(
                    "Redis eval failed during rate_limit_take — falling back to memory. "
                    "key='%s' error='%s'",
                    key,
                    exc,
                )
                self._use_redis = False
        return self._rate_limit_memory(key, capacity, refill_per_second, window)

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
        return "redis" if self._ensure_redis() else "memory"

    def get(self, key: str) -> str | None:
        if self._ensure_redis():
            try:
                return self._redis.get(key)
            except Exception:
                self._use_redis = False
        entry = self._in_memory.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at <= time.monotonic():
            self._in_memory.pop(key, None)
            return None
        return value

    def set(self, key: str, value: str, ttl: int) -> None:
        if self._ensure_redis():
            try:
                self._redis.set(key, value, ex=ttl)
                return
            except Exception:
                self._use_redis = False
        self._in_memory[key] = (value, time.monotonic() + ttl)

    def delete(self, key: str) -> None:
        if self._ensure_redis():
            try:
                self._redis.delete(key)
                return
            except Exception:
                self._use_redis = False
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
