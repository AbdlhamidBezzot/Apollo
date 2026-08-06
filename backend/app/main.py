"""FastAPI application entrypoint.

Boots the DB (SQLite in dev, Postgres in prod), CORS for the Next.js frontend,
and registers all routes. Run: uvicorn app.main:app --reload
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.core.cache import get_cache
from app.core.config import get_settings
from app.core.errors import sanitize_detail
from app.core.ratelimit import get_rate_limiter
from app.db import init_db
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
    init_db()
    get_rate_limiter()  # warm the rate limiter so cache fallback is resolved once
    logger.info("Cache backend selected: %s", get_cache().backend)
    if get_settings().tmdb_api_key or get_settings().tmdb_api_read_access_token:
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


@app.get("/health")
async def health():
    return {"status": "ok", "cache": get_cache().backend}
