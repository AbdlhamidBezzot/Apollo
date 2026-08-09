"""TMDB API client.

Rules:
- The TMDB key lives ONLY here, server-side. The frontend never talks to TMDB.
- Responses are cached (Redis or in-memory) so the TMDB quota is not blown on
  every page load.
- External calls are wrapped in a timeout and degrade gracefully: if TMDB is
  down we surface a clear error instead of crashing the whole API.
"""

import json
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from app.core.cache import get_cache
from app.core.config import get_settings

TMDB_CACHE_TTL = 86400
logger = logging.getLogger("app.tmdb")


class TMDbError(Exception):
    pass


def _auth_params() -> dict[str, str]:
    settings = get_settings()
    if settings.tmdb_api_read_access_token:
        return {}
    if settings.tmdb_api_key:
        return {"api_key": settings.tmdb_api_key}
    raise TMDbError("TMDB_API_KEY is not configured")


def _auth_headers() -> dict[str, str]:
    settings = get_settings()
    if settings.tmdb_api_read_access_token:
        return {"Authorization": f"Bearer {settings.tmdb_api_read_access_token}"}
    return {}


async def _tmdb_get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    settings = get_settings()
    url = f"{settings.tmdb_api_base_url.rstrip('/')}/{path}"
    merged = {"language": "en-US", **(params or {})}
    merged.update(_auth_params())
    start_time = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=merged, headers=_auth_headers())
            elapsed = time.monotonic() - start_time
            logger.info("TMDB request success: path='%s' status=%d elapsed=%.3fs", path, resp.status_code, elapsed)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("TMDB HTTP status error: path='%s' status=%d", path, exc.response.status_code)
        raise TMDbError(f"TMDB returned {exc.response.status_code} for {path}") from exc
    except httpx.HTTPError as exc:
        logger.error("TMDB HTTP network error: path='%s' error='%s'", path, str(exc))
        raise TMDbError(f"TMDB unreachable: {exc}") from exc


async def _cached(
    path: str,
    params: dict[str, Any],
    ttl: int,
    namespace: str,
    loader: Callable[[], Awaitable[dict[str, Any]]],
) -> dict[str, Any]:
    cache = get_cache()
    key = f"tmdb:{namespace}:{path}:{json.dumps(params, sort_keys=True)}"
    cached = cache.get(key)
    if cached is not None:
        try:
            logger.debug("TMDB cache HIT: namespace='%s' path='%s'", namespace, path)
            return json.loads(cached)
        except (ValueError, TypeError):
            pass
    logger.info("TMDB cache MISS: namespace='%s' path='%s' fetching upstream", namespace, path)
    data = await loader()
    try:
        cache.set(key, json.dumps(data), ttl)
    except (TypeError, ValueError):
        pass
    return data


def _stamp_media_type(data: dict[str, Any], media_type: str | None) -> dict[str, Any]:
    """TMDB's media-specific endpoints omit `media_type` on each result, but the
    frontend needs it to build correct detail links (movie vs tv share id space)."""
    if media_type not in ("movie", "tv"):
        return data
    for item in data.get("results", []):
        if isinstance(item, dict) and not item.get("media_type"):
            item["media_type"] = media_type
    return data


class TMDBClient:
    @staticmethod
    async def trending(time_window: str = "week", page: int = 1) -> dict[str, Any]:
        params = {"page": page}
        return await _cached(
            f"trending/all/{time_window}",
            params,
            TMDB_CACHE_TTL,
            "trending",
            lambda: _tmdb_get(f"trending/all/{time_window}", params),
        )

    @staticmethod
    async def discover(
        media_type: str = "movie",
        page: int = 1,
        genres: list[int] | None = None,
        year: int | None = None,
        min_rating: float | None = None,
        max_runtime: int | None = None,
        language: str | None = None,
        origin_country: str | None = None,
        sort_by: str = "popularity.desc",
        provider: str | None = None,
        watch_region: str | None = None,
        monetization_types: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "page": page,
            "sort_by": sort_by,
            "include_adult": "false",
            "include_video": "false",
        }
        if genres:
            params["with_genres"] = ",".join(str(g) for g in genres)
        if year:
            params["year" if media_type == "movie" else "first_air_date_year"] = str(year)
        if min_rating:
            params["vote_average.gte"] = str(min_rating)
        if max_runtime:
            params["with_runtime.lte"] = str(max_runtime)
        if language:
            params["with_original_language"] = language
        if origin_country:
            params["with_origin_country"] = origin_country
        if provider:
            params["with_watch_providers"] = str(provider)
            params["watch_region"] = watch_region or "US"
        elif watch_region:
            params["watch_region"] = watch_region
        if monetization_types:
            params["with_watch_monetization_types"] = monetization_types
        return _stamp_media_type(
            await _cached(
                f"discover/{media_type}",
                params,
                TMDB_CACHE_TTL,
                "discover",
                lambda: _tmdb_get(f"discover/{media_type}", params),
            ),
            media_type,
        )

    @staticmethod
    async def popular(media_type: str = "movie", page: int = 1) -> dict[str, Any]:
        return _stamp_media_type(
            await _cached(
                f"{media_type}/popular",
                {"page": page},
                TMDB_CACHE_TTL,
                "popular",
                lambda: _tmdb_get(f"{media_type}/popular", {"page": page}),
            ),
            media_type,
        )

    @staticmethod
    async def top_rated(media_type: str = "movie", page: int = 1) -> dict[str, Any]:
        return _stamp_media_type(
            await _cached(
                f"{media_type}/top_rated",
                {"page": page},
                TMDB_CACHE_TTL,
                "top_rated",
                lambda: _tmdb_get(f"{media_type}/top_rated", {"page": page}),
            ),
            media_type,
        )

    @staticmethod
    async def search(query: str, media_type: str | None = None, page: int = 1) -> dict[str, Any]:
        path = f"search/{media_type}" if media_type in ("movie", "tv") else "search/multi"
        params = {"query": query, "page": page, "include_adult": "false"}
        data = await _cached(path, params, TMDB_CACHE_TTL, "search", lambda: _tmdb_get(path, params))
        return _stamp_media_type(data, media_type)

    @staticmethod
    async def detail(media_type: str, tmdb_id: int) -> dict[str, Any]:
        params = {"append_to_response": "videos"}
        return await _cached(
            f"{media_type}/{tmdb_id}",
            params,
            TMDB_CACHE_TTL,
            "detail",
            lambda: _tmdb_get(f"{media_type}/{tmdb_id}", params),
        )

    @staticmethod
    async def similar(media_type: str, tmdb_id: int, page: int = 1) -> dict[str, Any]:
        return _stamp_media_type(
            await _cached(
                f"{media_type}/{tmdb_id}/similar",
                {"page": page},
                TMDB_CACHE_TTL,
                "similar",
                lambda: _tmdb_get(f"{media_type}/{tmdb_id}/similar", {"page": page}),
            ),
            media_type,
        )

    @staticmethod
    async def credits(media_type: str, tmdb_id: int) -> dict[str, Any]:
        return await _cached(
            f"{media_type}/{tmdb_id}/credits",
            {},
            TMDB_CACHE_TTL,
            "credits",
            lambda: _tmdb_get(f"{media_type}/{tmdb_id}/credits", {}),
        )

    @staticmethod
    async def genres() -> dict[str, Any]:
        return await _cached("genre/movie/list", {}, TMDB_CACHE_TTL, "genres", lambda: _tmdb_get("genre/movie/list", {}))

    @staticmethod
    async def season_episodes(media_type: str, tmdb_id: int, season_number: int) -> dict[str, Any]:
        return await _cached(
            f"{media_type}/{tmdb_id}/season/{season_number}",
            {},
            TMDB_CACHE_TTL,
            "season",
            lambda: _tmdb_get(f"{media_type}/{tmdb_id}/season/{season_number}", {}),
        )


tmdb = TMDBClient()
