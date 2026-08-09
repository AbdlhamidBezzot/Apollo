"""FastAPI application entrypoint.

Boots the DB (SQLite in dev, Postgres in prod), CORS for the Next.js frontend,
and registers all routes. Run: uvicorn app.main:app --reload
"""

import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.core.cache import get_cache
from app.core.config import get_settings
from app.core.diagnostics import DiagnosticsMiddleware
from app.core.errors import sanitize_detail
from app.core.ratelimit import get_rate_limiter
from app.db import engine, init_db
from app.services.tmdb import TMDbError, tmdb

settings = get_settings()
logger = logging.getLogger(__name__)


async def _warm_home_feed() -> None:
    """Prefetch the home-page lists into the cache so the first page load is fast."""
    try:
        await asyncio.gather(
            tmdb.trending("week", 1),
            tmdb.popular("movie", 1),
            tmdb.popular("tv", 1),
            tmdb.top_rated("movie", 1),
            return_exceptions=True,
        )
    except TMDbError:
        pass


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_production_ready()
    init_db()
    cache = get_cache()
    cache.require_redis()  # production: fail fast if Redis is unavailable (no silent memory fallback)
    get_rate_limiter()  # warm the rate limiter so cache fallback is resolved once
    _backend = cache.backend
    if _backend == "redis":
        logger.info("Cache backend: redis (distributed rate limiting active, TMDB/episode cache shared)")
    else:
        _err = cache.last_redis_error or "Redis unreachable or REDIS_URL not configured"
        if settings.is_production:
            logger.critical(
                "PRODUCTION ALERT: Cache backend is 'memory' — rate limiting is per-process "
                "and NOT shared across instances. Redis connection failed: %s. "
                "Set REDIS_URL in Render environment variables.",
                _err,
            )
        else:
            logger.warning("Cache backend: memory (Redis unavailable — ok for local dev)")
    if settings.tmdb_api_key or settings.tmdb_api_read_access_token:
        await _warm_home_feed()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Outermost so request total time + per-stage breakdown cover everything,
# including CORS, routing, rate limiting, caching and serialization.
app.add_middleware(DiagnosticsMiddleware)

app.include_router(api_router)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    logger.warning("HTTP %s: %s", exc.status_code, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": sanitize_detail(exc, exc.status_code)},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled application error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": sanitize_detail(exc, 500)})


_HEALTH_TMDB_TTL = 120


async def _check_database() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("Database health check failed")
        return False


async def _check_redis() -> dict:
    cache = get_cache()
    connected = cache.backend == "redis"
    result: dict = {"connected": connected}
    if not connected:
        result["error"] = cache.last_redis_error or "Redis unreachable or REDIS_URL not configured"
        result["redis_url_configured"] = cache.is_redis_configured()
    return result


async def _check_tmdb() -> bool:
    if not (settings.tmdb_api_key or settings.tmdb_api_read_access_token):
        return False
    cached = get_cache().get("health:tmdb")
    if cached is not None:
        return cached == "1"
    ok = False
    try:
        headers = {"Accept": "application/json"}
        if settings.tmdb_api_read_access_token:
            headers["Authorization"] = f"Bearer {settings.tmdb_api_read_access_token}"
        params = {"api_key": settings.tmdb_api_key} if settings.tmdb_api_key else None
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.tmdb_api_base_url.rstrip('/')}/configuration",
                params=params,
                headers=headers,
            )
            ok = resp.status_code == 200
    except Exception:
        logger.exception("TMDB health check failed")
    try:
        get_cache().set("health:tmdb", "1" if ok else "0", _HEALTH_TMDB_TTL)
    except Exception:
        pass
    return ok


@app.get("/health")
async def health():
    redis_status = await _check_redis()
    return {
        "status": "ok",
        "database": await _check_database(),
        "redis": redis_status,
        "tmdb": await _check_tmdb(),
        "version": app.version,
        "environment": settings.app_env,
    }
