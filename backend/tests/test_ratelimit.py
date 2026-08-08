"""Rate-limit tests: token-bucket semantics, per-user/per-IP scoping, 429 + Retry-After."""

import uuid

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core.cache import get_cache
from app.core.config import get_settings
from app.core.ratelimit import parse_rate_spec, rate_limited
from app.core.security import create_token


def _scope(ip: str = "10.99.0.1", headers: list[tuple[bytes, bytes]] | None = None) -> dict:
    return {
        "type": "http",
        "method": "GET",
        "path": "/x",
        "query_string": b"",
        "headers": headers or [(b"host", b"localhost")],
        "client": (ip, 5500),
        "server": ("testserver", 80),
        "scheme": "http",
    }


def _request(ip: str = "10.99.0.1", headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    return Request(_scope(ip, headers))


def _request_with_state(ip: str, state: dict) -> Request:
    req = _request(ip)
    for k, v in state.items():
        setattr(req.state, k, v)
    return req


def test_parse_rate_spec():
    assert parse_rate_spec("5/15minute") == (5, 900)
    assert parse_rate_spec("120/minute") == (120, 60)
    assert parse_rate_spec("20/hour") == (20, 3600)
    assert parse_rate_spec("10/5minute") == (10, 300)


def test_memory_token_bucket_allows_burst_then_blocks():
    cache = get_cache()
    key = f"rl:test-bucket:{uuid.uuid4().hex}"
    allowed = [cache.rate_limit_take(key, 5, 5 / 60, 60) for _ in range(5)]
    assert all(ok for ok, _ in allowed)

    denied, retry_after = cache.rate_limit_take(key, 5, 5 / 60, 60)
    assert denied is False
    assert retry_after >= 1


def test_redis_backend_uses_lua():
    cache = get_cache()
    calls: list[list] = []

    class FakeRedis:
        def eval(self, script, numkeys, *args):
            calls.append([script, numkeys, *args])
            return [0, 12]

    old_redis = cache._redis
    old_use = cache._use_redis
    try:
        cache._redis = FakeRedis()
        cache._use_redis = True
        ok, retry = cache.rate_limit_take("rl:test-redis:u:1", 10, 1, 60)
        assert ok is False
        assert retry == 12
        assert len(calls) == 1
        script, numkeys, *_ = calls[0]
        assert "cjson.decode" in script
        assert numkeys == 1
    finally:
        cache._redis = old_redis
        cache._use_redis = old_use


def test_rate_limit_returns_429_with_retry_after():
    limiter = rate_limited(f"testscope-{uuid.uuid4().hex}", "2/minute")

    req = _request_with_state("10.99.0.1", {"user_id": 42})
    limiter(req)
    limiter(req)  # burst capacity of 2

    with pytest.raises(HTTPException) as exc:
        limiter(req)
    assert exc.value.status_code == 429
    assert exc.value.headers["Retry-After"].isdigit()


def test_unauthenticated_endpoint_uses_bearer_token_for_identity():
    settings = get_settings()
    token = create_token("77", settings.token_secret, "access", 15)
    limiter = rate_limited(f"testbearer-{uuid.uuid4().hex}", "2/minute")

    req_user = _request(headers=[(b"authorization", f"Bearer {token}".encode())])
    req_ip = _request()  # same proxy IP, no token

    limiter(req_user)
    limiter(req_user)  # user's bucket is full
    with pytest.raises(HTTPException):
        limiter(req_user)

    # The untokenized request from the SAME IP still has its own quota.
    limiter(req_ip)
    limiter(req_ip)
    with pytest.raises(HTTPException):
        limiter(req_ip)


def test_bad_or_expired_tokens_fall_back_to_ip():
    limiter = rate_limited(f"testbadtoken-{uuid.uuid4().hex}", "2/minute")
    req = _request(headers=[(b"authorization", b"Bearer not-a-valid-token")])
    limiter(req)
    limiter(req)
    with pytest.raises(HTTPException):
        limiter(req)


def test_authenticated_user_and_same_ip_have_separate_buckets():
    limiter = rate_limited(f"testsep-{uuid.uuid4().hex}", "3/minute")

    req_user = _request_with_state("10.0.0.1", {"user_id": 9})
    req_ip = _request_with_state("10.0.0.1", {})

    for _ in range(3):
        limiter(req_user)
    with pytest.raises(HTTPException):
        limiter(req_user)

    for _ in range(3):
        limiter(req_ip)
    with pytest.raises(HTTPException):
        limiter(req_ip)


def test_forwarded_for_used_when_trusted(monkeypatch):
    import app.core.ratelimit as rl
    from app.core.config import Settings

    fake_settings = Settings(_env_file=None, rate_limit_trust_forwarded=True)
    monkeypatch.setattr(rl, "get_settings", lambda: fake_settings)

    limiter = rate_limited(f"testfwd-{uuid.uuid4().hex}", "2/minute")

    req1 = Request(_scope(headers=[(b"x-forwarded-for", b"203.0.113.9")]))
    req2 = Request(_scope(headers=[(b"x-forwarded-for", b"198.51.100.7")]))
    limiter(req1)
    limiter(req1)
    with pytest.raises(HTTPException):
        limiter(req1)
    limiter(req2)
    limiter(req2)
    with pytest.raises(HTTPException):
        limiter(req2)
