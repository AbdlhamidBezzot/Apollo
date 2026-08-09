"""Per-request latency diagnostics.

Accumulates wall-clock timings for the stages that dominate response time and
emits a single structured (JSON) log line per HTTP request:

    Request total
    ├── ratelimit_ms    rate limiter / Redis EVAL
    ├── cache_get_ms     Redis cache GET
    ├── cache_set_ms     Redis cache SET (only when a cache miss refills)
    ├── tmdb_ms          TMDB upstream HTTP fetch (only on cache miss)
    └── json_response_ms remaining: JSON serialization + response delivery

Every probe is a no-op when no request context is active (e.g. direct service
calls in tests), so this layer has zero effect outside an HTTP request.

Logs go to the ``app.diag`` logger at INFO level; set it to a higher level to
silence the per-request lines.
"""

from __future__ import annotations

import contextlib
import contextvars
import json
import logging
import time

logger = logging.getLogger("app.diag")

_current: contextvars.ContextVar[Diag | None] = contextvars.ContextVar(
    "apollo_request_diag", default=None
)


class Diag:
    """Accumulates per-request stage timings (seconds, wall-clock)."""

    __slots__ = ("method", "path", "status_code", "spans", "started")

    def __init__(self, method: str, path: str) -> None:
        self.method = method
        self.path = path
        self.status_code: int = 0
        self.spans: dict[str, float] = {}
        self.started = time.perf_counter()

    def add(self, name: str, seconds: float) -> None:
        self.spans[name] = self.spans.get(name, 0.0) + seconds

    def snapshot(self, total_seconds: float) -> dict:
        ratelimit_ms = round(self.spans.get("ratelimit", 0.0) * 1000, 2)
        cache_get_ms = round(self.spans.get("cache_get", 0.0) * 1000, 2)
        cache_set_ms = round(self.spans.get("cache_set", 0.0) * 1000, 2)
        tmdb_ms = round(self.spans.get("tmdb", 0.0) * 1000, 2)
        spent = ratelimit_ms + cache_get_ms + cache_set_ms + tmdb_ms
        return {
            "method": self.method,
            "path": self.path,
            "status": self.status_code,
            "total_ms": round(total_seconds * 1000, 2),
            "ratelimit_ms": ratelimit_ms,
            "cache_get_ms": cache_get_ms,
            "cache_set_ms": cache_set_ms,
            "tmdb_ms": tmdb_ms,
            "json_response_ms": round(max(0.0, total_seconds * 1000 - spent), 2),
            "cache": "miss" if tmdb_ms > 0 else "hit",
        }


def begin(method: str, path: str) -> Diag:
    diag = Diag(method, path)
    _current.set(diag)
    return diag


def current() -> Diag | None:
    return _current.get()


def add(name: str, seconds: float) -> None:
    diag = _current.get()
    if diag is not None:
        diag.add(name, seconds)


@contextlib.contextmanager
def measure(name: str):
    diag = _current.get()
    if diag is None:
        yield
        return
    start = time.perf_counter()
    try:
        yield
    finally:
        diag.add(name, time.perf_counter() - start)


def log_request(diag: Diag, total_seconds: float) -> None:
    logger.info("diag %s", json.dumps(diag.snapshot(total_seconds), sort_keys=True))


class DiagnosticsMiddleware:
    """Outermost ASGI middleware: records total time, then logs the breakdown."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request = scope
        diag = begin(request.get("method", "?"), request.get("path", "?"))

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                diag.status_code = message.get("status", 0)
            await send(message)

        started = time.perf_counter()
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            log_request(diag, time.perf_counter() - started)
