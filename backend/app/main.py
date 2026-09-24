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


from app.services.seed_catalog import seed_catalog
from app.services.addon_cron import run_addon_revalidation_cron


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
    seed_catalog()
    cron_task = asyncio.create_task(run_addon_revalidation_cron())
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
    try:
        yield
    finally:
        cron_task.cancel()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+)(:\d+)?|capacitor://.*|https://.*\.vercel\.app|https://.*\.missapollo\.me",
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
_health_cache: dict[str, tuple[bool, float]] = {}


async def _check_database() -> bool:
    def _ping():
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    try:
        return await asyncio.to_thread(_ping)
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
    import time
    now = time.monotonic()
    cached = _health_cache.get("tmdb")
    if cached and (now - cached[1]) < _HEALTH_TMDB_TTL:
        return cached[0]
    ok = False
    try:
        headers = {"Accept": "application/json"}
        if settings.tmdb_api_read_access_token:
            headers["Authorization"] = f"Bearer {settings.tmdb_api_read_access_token}"
        params = {"api_key": settings.tmdb_api_key} if settings.tmdb_api_key else None
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.get(
                f"{settings.tmdb_api_base_url.rstrip('/')}/configuration",
                params=params,
                headers=headers,
            )
            ok = resp.status_code == 200
    except Exception:
        logger.exception("TMDB health check failed")
    _health_cache["tmdb"] = (ok, now)
    return ok



@app.get("/health")
async def health():
    db_ok, redis_status, tmdb_ok = await asyncio.gather(
        _check_database(),
        _check_redis(),
        _check_tmdb(),
        return_exceptions=True,
    )
    return {
        "status": "ok",
        "database": db_ok if isinstance(db_ok, bool) else False,
        "redis": redis_status if isinstance(redis_status, dict) else {"connected": False},
        "tmdb": tmdb_ok if isinstance(tmdb_ok, bool) else False,
        "version": app.version,
        "environment": settings.app_env,
    }

