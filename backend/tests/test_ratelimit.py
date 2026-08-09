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


def test_spoofed_xforwardedfor_ignored_without_trusted_flag(monkeypatch):
    """When rate_limit_trust_forwarded=False and no trusted_proxies, the
    X-Forwarded-For header MUST be ignored. All requests collapse to the
    actual client IP in the socket, preventing header-spoofing attacks."""
    import app.core.ratelimit as rl
    from app.core.config import Settings

    # Default: trust_forwarded=False, trusted_proxies=""
    fake_settings = Settings(_env_file=None, rate_limit_trust_forwarded=False, rate_limit_trusted_proxies="")
    monkeypatch.setattr(rl, "get_settings", lambda: fake_settings)

    limiter = rate_limited(f"testspoof-{uuid.uuid4().hex}", "2/minute")

    # Attacker sends a different spoofed IP in X-Forwarded-For from the SAME socket
    req_a = Request(_scope("1.2.3.4", [(b"x-forwarded-for", b"9.9.9.9")]))
    req_b = Request(_scope("1.2.3.4", [(b"x-forwarded-for", b"8.8.8.8")]))

    # Both should consume from the SAME bucket (client socket "1.2.3.4")
    limiter(req_a)
    limiter(req_b)  # fills the capacity=2 bucket
    with pytest.raises(HTTPException):
        # Third request (still from "1.2.3.4") must be blocked regardless of spoofed header
        Request(_scope("1.2.3.4", [(b"x-forwarded-for", b"7.7.7.7")]))
        limiter(Request(_scope("1.2.3.4", [(b"x-forwarded-for", b"7.7.7.7")])))


def test_trusted_proxies_list_enables_forwarded_for(monkeypatch):
    """When the connecting host matches rate_limit_trusted_proxies, X-Forwarded-For
    is honoured and different clients get distinct buckets."""
    import app.core.ratelimit as rl
    from app.core.config import Settings

    # Trust only 10.0.0.1 (internal proxy)
    fake_settings = Settings(
        _env_file=None,
        rate_limit_trust_forwarded=False,
        rate_limit_trusted_proxies="10.0.0.1",
    )
    monkeypatch.setattr(rl, "get_settings", lambda: fake_settings)

    limiter = rate_limited(f"testproxylist-{uuid.uuid4().hex}", "2/minute")

    # Both requests arrive through the trusted proxy at 10.0.0.1
    req_client_a = Request(_scope("10.0.0.1", [(b"x-forwarded-for", b"203.0.113.10")]))
    req_client_b = Request(_scope("10.0.0.1", [(b"x-forwarded-for", b"203.0.113.11")]))

    limiter(req_client_a)
    limiter(req_client_a)
    with pytest.raises(HTTPException):
        limiter(req_client_a)  # client A exhausted

    # client B has a separate bucket — should still pass
    limiter(req_client_b)
    limiter(req_client_b)
    with pytest.raises(HTTPException):
        limiter(req_client_b)


def test_untrusted_proxy_cannot_spoof_via_trusted_proxies_list(monkeypatch):
    """A host NOT in rate_limit_trusted_proxies cannot spoof via X-Forwarded-For.
    Its requests collapse to the connecting socket IP."""
    import app.core.ratelimit as rl
    from app.core.config import Settings

    fake_settings = Settings(
        _env_file=None,
        rate_limit_trust_forwarded=False,
        rate_limit_trusted_proxies="10.0.0.1",
    )
    monkeypatch.setattr(rl, "get_settings", lambda: fake_settings)

    limiter = rate_limited(f"testuntrusted-{uuid.uuid4().hex}", "2/minute")

    # Attacker at 5.5.5.5 claims to be at various IPs via X-Forwarded-For
    req1 = Request(_scope("5.5.5.5", [(b"x-forwarded-for", b"203.0.113.99")]))
    req2 = Request(_scope("5.5.5.5", [(b"x-forwarded-for", b"198.51.100.1")]))

    limiter(req1)
    limiter(req2)  # Both consume from the "5.5.5.5" bucket
    with pytest.raises(HTTPException):
        limiter(Request(_scope("5.5.5.5", [(b"x-forwarded-for", b"1.1.1.1")])))


def test_xreal_ip_used_when_trusted(monkeypatch):
    """When proxied through a trusted host, X-Real-IP is used if X-Forwarded-For
    is absent."""
    import app.core.ratelimit as rl
    from app.core.config import Settings

    fake_settings = Settings(_env_file=None, rate_limit_trust_forwarded=True)
    monkeypatch.setattr(rl, "get_settings", lambda: fake_settings)

    limiter = rate_limited(f"testrealip-{uuid.uuid4().hex}", "2/minute")

    req = Request(_scope(headers=[(b"x-real-ip", b"203.0.113.55")]))
    limiter(req)
    limiter(req)
    with pytest.raises(HTTPException):
        limiter(req)


# ---------------------------------------------------------------------------
# Redis backend selection tests
# ---------------------------------------------------------------------------

def test_cache_is_redis_configured_false_for_localhost():
    """is_redis_configured() returns False for localhost URLs (dev/test defaults)."""
    from unittest.mock import patch

    from app.core.cache import _LOCALHOST_REDIS_PREFIXES, CacheClient

    client = CacheClient.__new__(CacheClient)
    client._in_memory = {}
    client._use_redis = False
    client._redis = None
    client._last_redis_check = 0.0
    client._last_redis_error = None
    client._rl_lock = __import__("threading").Lock()
    client._rl_buckets = {}

    for prefix in _LOCALHOST_REDIS_PREFIXES:
        url = f"{prefix}:6379/0"
        with patch("app.core.cache.get_settings") as mock_settings:
            mock_settings.return_value.redis_url = url
            assert client.is_redis_configured() is False, f"Expected False for {url}"


def test_cache_is_redis_configured_true_for_remote():
    """is_redis_configured() returns True for non-localhost Redis URLs."""
    from unittest.mock import patch

    from app.core.cache import CacheClient

    client = CacheClient.__new__(CacheClient)
    client._in_memory = {}
    client._use_redis = False
    client._redis = None
    client._last_redis_check = 0.0
    client._last_redis_error = None
    client._rl_lock = __import__("threading").Lock()
    client._rl_buckets = {}

    remote_urls = [
        "redis://red-abc123.render.com:6379/0",
        "rediss://my-redis.upstash.io:6380",
        "redis://10.0.1.5:6379/0",  # private but non-localhost
    ]
    for url in remote_urls:
        with patch("app.core.cache.get_settings") as mock_settings:
            mock_settings.return_value.redis_url = url
            assert client.is_redis_configured() is True, f"Expected True for {url}"


def test_redis_connection_failure_populates_last_error():
    """When Redis is unreachable, last_redis_error is set to a non-None string."""
    from unittest.mock import patch

    from app.core.cache import CacheClient

    client = CacheClient.__new__(CacheClient)
    client._in_memory = {}
    client._use_redis = False
    client._redis = None
    client._last_redis_check = 0.0
    client._last_redis_error = None
    client._rl_lock = __import__("threading").Lock()
    client._rl_buckets = {}

    # Point at an unreachable Redis (port nobody listens on)
    with patch("app.core.cache.get_settings") as mock_settings:
        mock_settings.return_value.redis_url = "redis://127.0.0.1:19999/0"
        result = client._ensure_redis()

    assert result is False
    assert client._use_redis is False
    assert client._last_redis_error is not None
    assert len(client._last_redis_error) > 0


def test_redis_backend_selected_with_fake_redis():
    """When _ensure_redis succeeds (fake connection), backend returns 'redis'."""
    import time

    from app.core.cache import CacheClient

    class PingableRedis:
        def ping(self):
            return True

    client = CacheClient.__new__(CacheClient)
    client._in_memory = {}
    client._redis = PingableRedis()
    client._use_redis = True
    client._last_redis_check = time.time()
    client._last_redis_error = None
    client._rl_lock = __import__("threading").Lock()
    client._rl_buckets = {}

    assert client.backend == "redis"


def test_production_config_rejects_localhost_redis():
    """ensure_production_ready() raises RuntimeError if REDIS_URL is localhost in production."""
    from app.core.config import Settings

    settings = Settings(
        _env_file=None,
        app_env="production",
        secret_key="a-very-long-and-random-secret-key-for-production-use",
        database_url="postgresql+psycopg://user:pass@host/db",
        redis_url="redis://localhost:6379/0",
        cors_origins="https://example.com",
    )
    with pytest.raises(RuntimeError, match="REDIS_URL still points to localhost"):
        settings.ensure_production_ready()


def test_production_config_accepts_remote_redis():
    """ensure_production_ready() passes when REDIS_URL is a remote host."""
    from app.core.config import Settings

    settings = Settings(
        _env_file=None,
        app_env="production",
        secret_key="a-very-long-and-random-secret-key-for-production-use",
        database_url="postgresql+psycopg://user:pass@host/db",
        redis_url="redis://red-xyz.render.com:6379/0",
        cors_origins="https://example.com",
    )
    # Should not raise — remote Redis URL is acceptable
    settings.ensure_production_ready()


def test_redis_error_logged_not_silenced(caplog):
    """Redis connection failures must appear in logs at ERROR level, not be swallowed."""
    import logging
    from unittest.mock import patch

    from app.core.cache import CacheClient

    client = CacheClient.__new__(CacheClient)
    client._in_memory = {}
    client._use_redis = False
    client._redis = None
    client._last_redis_check = 0.0
    client._last_redis_error = None
    client._rl_lock = __import__("threading").Lock()
    client._rl_buckets = {}

    with caplog.at_level(logging.ERROR, logger="app.cache"), patch("app.core.cache.get_settings") as mock_settings:
        mock_settings.return_value.redis_url = "redis://127.0.0.1:19998/0"
        client._ensure_redis()

    error_records = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert len(error_records) >= 1, "Expected at least one ERROR log for Redis connection failure"
    assert any("Redis connection failed" in r.message for r in error_records)


def test_redis_logs_never_leak_credentials(caplog):
    """Redis URLs with embedded passwords must be redacted in logs."""
    import logging
    from unittest.mock import patch

    from app.core.cache import CacheClient, _sanitize_redis_url

    assert _sanitize_redis_url("redis://:s3cr3t@red-abcd.render.com:6379/0") == \
        "redis://red-abcd.render.com:6379/0", "password must be stripped from sanitized URL"

    client = CacheClient.__new__(CacheClient)
    client._in_memory = {}
    client._use_redis = False
    client._redis = None
    client._last_redis_check = 0.0
    client._last_redis_error = None
    client._rl_lock = __import__("threading").Lock()
    client._rl_buckets = {}

    url_with_pass = "redis://:s3cr3t@127.0.0.1:19997/0"
    with caplog.at_level(logging.ERROR, logger="app.cache"), patch("app.core.cache.get_settings") as mock_settings:
        mock_settings.return_value.redis_url = url_with_pass
        client._ensure_redis()

    joined = "\n".join(r.message for r in caplog.records)
    assert "s3cr3t" not in joined, "Redis password leaked into logs"
    assert "Redis connection failed" in joined


def test_require_redis_raises_in_production_when_unreachable():
    """Production + unreachable Redis must fail fast instead of silently degrading."""
    import logging
    from unittest import mock

    from app.core.cache import CacheClient

    client = CacheClient.__new__(CacheClient)
    client._in_memory = {}
    client._use_redis = False
    client._redis = None
    client._last_redis_check = 0.0
    client._last_redis_error = None
    client._rl_lock = __import__("threading").Lock()
    client._rl_buckets = {}
    client._ensure_redis = lambda: False  # simulate unreachable Redis
    client._last_redis_error = "SomeError: connection refused"

    prod_settings = mock.Mock(is_production=True)
    with (
        mock.patch("app.core.cache.get_settings", return_value=prod_settings),
        mock.patch.object(logging.getLogger("app.cache"), "critical") as mock_critical,
        pytest.raises(RuntimeError, match="Redis is REQUIRED in production"),
    ):
        client.require_redis()
        assert mock_critical.called, "expected a critical log on production Redis failure"


def test_require_redis_is_noop_outside_production():
    """In dev/test the memory fallback stays allowed: require_redis must not raise."""
    from unittest import mock

    from app.core.cache import CacheClient

    client = CacheClient.__new__(CacheClient)
    client._in_memory = {}
    client._use_redis = False
    client._redis = None
    client._last_redis_check = 0.0
    client._last_redis_error = None
    client._rl_lock = __import__("threading").Lock()
    client._rl_buckets = {}
    client._ensure_redis = lambda: False

    dev_settings = mock.Mock(is_production=False)
    with mock.patch("app.core.cache.get_settings", return_value=dev_settings):
        # Should return cleanly, no RuntimeError, and leave backend as memory.
        client.require_redis()
        assert client._use_redis is False


# ---------------------------------------------------------------------------
# Production strategy: default route limits (STRICT / GENEROUS / MODERATE)
# ---------------------------------------------------------------------------

def test_default_route_limits_match_strategy():
    """Default limit specs must match the STRICT / GENEROUS / MODERATE strategy."""
    from app.core.config import Settings

    s = Settings(_env_file=None)

    # STRICT — auth + LLM (abuse-prone / per-call cost)
    assert parse_rate_spec(s.rate_limit_login) == (15, 900)
    assert parse_rate_spec(s.rate_limit_register) == (20, 3600)
    assert parse_rate_spec(s.rate_limit_refresh) == (60, 60)
    assert parse_rate_spec(s.rate_limit_chat) == (60, 3600)
    assert parse_rate_spec(s.rate_limit_chat_stream) == (120, 3600)

    # GENEROUS — normal content browsing
    assert parse_rate_spec(s.rate_limit_read) == (600, 60)

    # GENEROUS but protected — search / discover
    assert parse_rate_spec(s.rate_limit_search) == (600, 60)
    assert parse_rate_spec(s.rate_limit_discover) == (300, 60)

    # MODERATE — personal writes + playback/play
    assert parse_rate_spec(s.rate_limit_me) == (180, 60)
    assert parse_rate_spec(s.rate_limit_play) == (120, 60)
    assert parse_rate_spec(s.rate_limit_playback) == (120, 60)


def test_burst_capacity_equals_configured_limit():
    """A token bucket allows an immediate burst equal to the configured limit."""
    cache = get_cache()
    key = f"rl:burst:{uuid.uuid4().hex}"
    limit, window = parse_rate_spec("120/minute")
    allowed = [cache.rate_limit_take(key, limit, limit / window, window) for _ in range(limit)]
    assert all(ok for ok, _ in allowed)

    denied, retry_after = cache.rate_limit_take(key, limit, limit / window, window)
    assert denied is False
    assert retry_after >= 1


# ---------------------------------------------------------------------------
# Authenticated per-user buckets (must NOT share one IP bucket)
# ---------------------------------------------------------------------------

def test_state_user_id_takes_precedence_over_bearer_token():
    """request.state.user_id (set by the auth dependency) wins over a Bearer
    token for a DIFFERENT user — requests from the same IP stay separated."""
    settings = get_settings()
    other_token = create_token("999", settings.token_secret, "access", 15)
    limiter = rate_limited(f"teststate-{uuid.uuid4().hex}", "2/minute")

    def _state_user(user_id: int):
        req = _request(headers=[(b"authorization", f"Bearer {other_token}".encode())])
        req.state.user_id = user_id
        return req

    limiter(_state_user(7))
    limiter(_state_user(7))
    with pytest.raises(HTTPException):
        limiter(_state_user(7))  # u:7 bucket exhausted

    # Token user 999 (no state override) still has a fresh bucket on the SAME IP.
    token_user = _request(headers=[(b"authorization", f"Bearer {other_token}".encode())])
    limiter(token_user)
    limiter(token_user)
    with pytest.raises(HTTPException):
        limiter(token_user)


def test_two_authenticated_users_same_ip_have_separate_buckets_via_token():
    """Two authenticated users behind one public IP get distinct per-user buckets."""
    settings = get_settings()
    token_a = create_token("111", settings.token_secret, "access", 15)
    token_b = create_token("222", settings.token_secret, "access", 15)
    limiter = rate_limited(f"testusers-{uuid.uuid4().hex}", "2/minute")

    req_a = _request("203.0.113.20", [(b"authorization", f"Bearer {token_a}".encode())])
    req_b = _request("203.0.113.20", [(b"authorization", f"Bearer {token_b}".encode())])

    limiter(req_a)
    limiter(req_a)
    with pytest.raises(HTTPException):
        limiter(req_a)  # user A exhausted

    # user B from the same NATed public IP is unaffected.
    limiter(req_b)
    limiter(req_b)
    with pytest.raises(HTTPException):
        limiter(req_b)


# ---------------------------------------------------------------------------
# Anonymous per-IP buckets (must still be rate limited by IP)
# ---------------------------------------------------------------------------

def test_anonymous_users_limited_per_ip():
    """Anonymous users share the bucket only with their own client IP."""
    limiter = rate_limited(f"testanon-{uuid.uuid4().hex}", "2/minute")
    req_a = _request("198.51.100.1")
    req_b = _request("198.51.100.2")

    limiter(req_a)
    limiter(req_a)
    with pytest.raises(HTTPException):
        limiter(req_a)

    # A different anonymous IP is unaffected.
    limiter(req_b)
    limiter(req_b)
    with pytest.raises(HTTPException):
        limiter(req_b)


# ---------------------------------------------------------------------------
# Forwarded-IP security (trusted proxies preserved, untrusted ignored)
# ---------------------------------------------------------------------------

def test_request_ip_trusted_proxy_preserves_forwarded_identity(monkeypatch):
    """Only a host listed in RATE_LIMIT_TRUSTED_PROXIES may supply X-Forwarded-For;
    an untrusted socket's header is ignored and its own IP is used."""
    import app.core.ratelimit as rl
    from app.core.config import Settings

    fake = Settings(_env_file=None, rate_limit_trust_forwarded=False, rate_limit_trusted_proxies="10.0.0.1")
    monkeypatch.setattr(rl, "get_settings", lambda: fake)

    # Trusted proxy at 10.0.0.1 forwards the real client IP.
    req_trusted = Request(_scope("10.0.0.1", [(b"x-forwarded-for", b"198.51.100.77")]))
    assert rl._request_ip(req_trusted) == "198.51.100.77"

    # Untrusted socket 5.5.5.5 cannot spoof: its forwarded header is ignored.
    req_untrusted = Request(_scope("5.5.5.5", [(b"x-forwarded-for", b"203.0.113.9")]))
    assert rl._request_ip(req_untrusted) == "5.5.5.5"
