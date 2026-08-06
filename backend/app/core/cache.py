"""Redis-backed cache with automatic in-memory fallback for testing/local dev."""
import json
from collections.abc import Callable
from typing import Any
import redis as redis_lib
from app.core.config import get_settings

class CacheClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._in_memory: dict[str, Any] = {}
        self._use_redis = False
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

    @property
    def backend(self) -> str:
        return "redis" if self._use_redis else "memory"

    def get(self, key: str) -> str | None:
        if self._use_redis:
            try:
                return self._redis.get(key)
            except Exception:
                pass
        return self._in_memory.get(key)

    def set(self, key: str, value: str, ttl: int) -> None:
        if self._use_redis:
            try:
                self._redis.set(key, value, ex=ttl)
                return
            except Exception:
                pass
        self._in_memory[key] = value

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