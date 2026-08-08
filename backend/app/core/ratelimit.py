"""Rate limiting.

Consistent token-bucket limits (burst-tolerant) backed by Redis, so the state
is shared across every backend instance. Falls back to an in-memory token bucket
for local dev/tests.

Every request is scoped to the authenticated user when one can be identified
(request.state.user_id, or the access JWT in the Authorization header/cookie);
otherwise it falls back to the client IP. That keeps offices / mobile carriers /
NAT users from collectively exhausting a per-IP cap.

Returns HTTP 429 with a Retry-After header so clients can back off correctly.
"""

import re

from fastapi import HTTPException, Request

from app.core.cache import get_cache
from app.core.config import get_settings
from app.core.security import decode_token

ACCESS_COOKIE = "apollo_access"


def parse_rate_spec(spec: str) -> tuple[int, int]:
    """'5/15minute' -> (5, 900); '120/minute' -> (120, 60); '20/hour' -> (20, 3600)."""
    count_str, _, window_str = spec.partition("/")
    m = re.match(r"^(\d+)?\s*([a-zA-Z]+)$", window_str.strip())
    multiplier = int(m.group(1)) if m and m.group(1) else 1
    unit = (m.group(2).rstrip("s").lower() if m else window_str.replace("s", "")).strip()
    base_seconds = {
        "minute": 60, "min": 60, "hour": 3600, "hr": 3600, "second": 1, "sec": 1, "day": 86400,
    }.get(unit, 60)
    return int(count_str), multiplier * base_seconds


def _extract_access_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1]
    return request.cookies.get(ACCESS_COOKIE)


def _request_ip(request: Request) -> str:
    settings = get_settings()
    if settings.rate_limit_trust_forwarded:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _identity(request: Request) -> str:
    """Prefer the authenticated user over the shared client IP."""
    user = getattr(request.state, "user_id", None)
    if user is None:
        user = getattr(request.state, "user", None)
    if user is not None:
        return f"u:{user}"

    token = _extract_access_token(request)
    if token:
        try:
            claims = decode_token(token, get_settings().token_secret, "access")
            return f"u:{int(claims['sub'])}"
        except Exception:
            pass
    return f"ip:{_request_ip(request)}"


def _check(key_prefix: str, spec: str, identity: str) -> tuple[bool, int]:
    limit, window = parse_rate_spec(spec)
    # Token bucket: allow an immediate burst of `limit` then refill at
    # limit / window (e.g. 2 req/s for a 120/min read endpoint).
    return get_cache().rate_limit_take(
        f"rl:{key_prefix}:{identity}",
        capacity=max(int(limit), 1),
        refill_per_second=max(limit / window, 0.0),
        window=max(window, 1),
    )


def rate_limited(key_prefix: str, spec: str):
    """FastAPI dependency factory: rate limit by key prefix per identity.

    Usage:
        limiter = rate_limited("chat", settings.rate_limit_chat)
        async def endpoint(..., _rl=Depends(limiter)): ...
    """

    def limiter(request: Request) -> None:
        allowed, retry_after = _check(key_prefix, spec, _identity(request))
        if not allowed:
            raise HTTPException(status_code=429, headers={"Retry-After": str(retry_after)})

    return limiter


def rate_limited_identity(key_prefix: str, spec: str, identity: str) -> None:
    """Apply a rate limit to a safely-scoped explicit identity (used inline)."""
    allowed, retry_after = _check(key_prefix, spec, identity)
    if not allowed:
        raise HTTPException(status_code=429, headers={"Retry-After": str(retry_after)})


def get_rate_limiter():
    """Warm the shared cache/backend once at boot (see main lifespan)."""
    return get_cache()
