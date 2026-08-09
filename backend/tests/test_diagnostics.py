"""Request diagnostics tests: timing accumulation, snapshot shape, middleware.

The tests confirm the probes are no-ops outside an HTTP request and that the
middleware records total time / JSON response time for real requests.
"""

import time

import app.core.diagnostics as diag_mod
from app.core.diagnostics import begin, current, measure


def test_measure_is_noop_without_active_context():
    # No active request context -> measure() must not raise and must not record.
    assert current() is None
    with measure("ratelimit"):
        pass
    assert current() is None


def test_begin_add_and_measure_record_spans():
    diag = begin("GET", "/api/v1/content/popular")
    assert current() is diag
    try:
        with measure("ratelimit"):
            time.sleep(0.02)
        with measure("cache_get"):
            time.sleep(0.01)
        assert diag.spans["ratelimit"] >= 0.02
        assert diag.spans["cache_get"] >= 0.01
    finally:
        diag_mod._current.set(None)


def test_snapshot_json_fields_and_response_time():
    diag = begin("GET", "/api/v1/content/movie/550")
    diag.status_code = 200
    diag.add("ratelimit", 0.001)
    diag.add("cache_get", 0.002)
    diag.add("cache_set", 0.001)
    diag.add("tmdb", 0.400)
    snap = diag.snapshot(0.4053)

    assert snap["method"] == "GET"
    assert snap["status"] == 200
    assert snap["cache"] == "miss"
    assert snap["total_ms"] == 405.3
    # json_response = total - (ratelimit + cache_get + cache_set + tmdb)
    assert snap["json_response_ms"] == 1.3

    # Cache-hit requests report tmdb_ms = 0 and cache == hit.
    diag2 = begin("GET", "/x")
    diag2.add("cache_get", 0.001)
    assert diag2.snapshot(0.002)["cache"] == "hit"

    diag_mod._current.set(None)


def test_middleware_logs_stage_times_end_to_end(caplog):
    import asyncio
    import json
    import logging

    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route
    from starlette.testclient import TestClient

    from app.core.diagnostics import DiagnosticsMiddleware, measure

    async def slow(request):
        with measure("cache_get"):
            await asyncio.sleep(0.05)
        return JSONResponse({"ok": True})

    app = Starlette(routes=[Route("/slow", slow)])
    app.add_middleware(DiagnosticsMiddleware)

    with caplog.at_level(logging.INFO, logger="app.diag"), TestClient(app) as client:
        resp = client.get("/slow")
        assert resp.status_code == 200

    records = [r for r in caplog.records if r.name == "app.diag"]
    assert len(records) == 1, "expected exactly one diag log line"
    data = json.loads(records[0].getMessage().split("diag ", 1)[1])
    assert data["method"] == "GET"
    assert data["path"] == "/slow"
    assert data["status"] == 200
    assert data["total_ms"] >= 50.0
    assert data["cache_get_ms"] >= 50.0
    assert data["cache"] == "hit"
