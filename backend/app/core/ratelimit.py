"""Rate limiting.

Protects three surfaces: login (brute force), the general API, and the
chatbot/LLM endpoint (which costs money per call). Redis-backed when available,
otherwise an in-memory sliding-window implementation for local dev.

Returns HTTP 429 with a Retry-After header, per the plan.
"""

import re
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.core.cache import get_cache


class MemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = time.time()
        with self._lock:
            window = self._hits[key]
            while window and window[0] <= now - window_seconds:
                window.popleft()
            if len(window) >= limit:
                retry_after = max(1, int(window_seconds - (now - window[0])) + 1)
                return False, retry_after
            window.append(now)
            return True, 0


class RateLimiter:
    def __init__(self) -> None:
        self._memory = MemoryRateLimiter()
        self._cache = get_cache()

    def _backend(self) -> str:
        return getattr(self._cache, "backend", "memory")

    def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        if self._backend() == "redis":
            try:
                client = self._cache._redis
                pipe = client.pipeline()
                pipe.incr(key)
                pipe.expire(key, window_seconds, nx=True)
                count, _ = pipe.execute()
                if int(count) > limit:
                    ttl = client.ttl(key)
                    return False, max(1, int(ttl))
                return True, 0
            except Exception:
                pass
        return self._memory.check(key, limit, window_seconds)


_rate_limiter: RateLimiter | None = None


def get_rate_limiter() -> RateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


def parse_rate_spec(spec: str) -> tuple[int, int]:
    """'5/15minute' -> (5, 900); '120/minute' -> (120, 60); '20/hour' -> (20, 3600)."""
    count_str, _, window_str = spec.partition("/")
    m = re.match(r"^(\d+)?\s*([a-zA-Z]+)$", window_str.strip())
    multiplier = int(m.group(1)) if m and m.group(1) else 1
    unit = (m.group(2).rstrip("s").lower() if m else window_str.replace("s", "")).strip()
    base_seconds = {"minute": 60, "min": 60, "hour": 3600, "hr": 3600, "second": 1, "sec": 1, "day": 86400}.get(unit, 60)
    return int(count_str), multiplier * base_seconds


def rate_limited(key_prefix: str, spec: str):
    """FastAPI dependency factory: rate-limit by the given key prefix.

    Usage:
        limiter = rate_limited("chat", settings.rate_limit_chat)
        async def endpoint(..., _rl=Depends(limiter)): ...
    """
    limit, window = parse_rate_spec(spec)

    def limiter(request: Request) -> None:
        user = getattr(request.state, "user_id", None) or getattr(request.state, "user", None)
        identity = str(user) if user else (request.client.host if request.client else "unknown")
        key = f"rl:{key_prefix}:{identity}"
        allowed, retry_after = get_rate_limiter().check(key, limit, window)
        if not allowed:
            raise HTTPException(status_code=429, headers={"Retry-After": str(retry_after)})

    return limiter

def rate_limited_identity(key_prefix: str, spec: str, identity: str) -> None:
    """Apply a rate-limit policy to a safely scoped explicit identity."""
    limit, window = parse_rate_spec(spec)
    allowed, retry_after = get_rate_limiter().check(f"rl:{key_prefix}:{identity}", limit, window)
    if not allowed:
        raise HTTPException(status_code=429, headers={"Retry-After": str(retry_after)})
