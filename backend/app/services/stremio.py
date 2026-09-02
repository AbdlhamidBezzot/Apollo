"""Stremio Addons Integration Service.

Provides integration for:
- WatchHub (https://watchhub.strem.io)
- OpenSubtitles v3 (https://opensubtitles-v3.strem.io)
"""

import logging
from typing import Any
import httpx

from app.services.tmdb import TMDbError, tmdb

logger = logging.getLogger("app.stremio")

WATCHHUB_BASE_URL = "https://watchhub.strem.io"
OPENSUBTITLES_BASE_URL = "https://opensubtitles-v3.strem.io"


async def get_imdb_id(media_type: str, tmdb_id: int) -> str | None:
    """Resolve TMDB ID to IMDb ID (tt...) via TMDB external_ids API."""
    try:
        data = await tmdb.external_ids(media_type, tmdb_id)
        imdb_id = data.get("imdb_id")
        if imdb_id and isinstance(imdb_id, str) and imdb_id.startswith("tt"):
            return imdb_id
    except (TMDbError, Exception) as exc:
        logger.warning("Could not resolve IMDb ID for %s/%d: %s", media_type, tmdb_id, str(exc))
    return None


class StremioService:
    @staticmethod
    async def fetch_watchhub_streams(
        imdb_id: str,
        media_type: str,
        season: int | None = None,
        episode: int | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch stream options from WatchHub addon."""
        stremio_type = "series" if media_type == "tv" else "movie"
        if stremio_type == "series" and season and episode:
            query_id = f"{imdb_id}:{season}:{episode}"
        else:
            query_id = imdb_id

        url = f"{WATCHHUB_BASE_URL}/stream/{stremio_type}/{query_id}.json"

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("streams", [])
        except Exception as exc:
            logger.error("Error fetching WatchHub streams for %s: %s", query_id, str(exc))

        return []

    @staticmethod
    async def fetch_subtitles(
        imdb_id: str,
        media_type: str,
        season: int | None = None,
        episode: int | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch subtitles from OpenSubtitles v3 addon."""
        stremio_type = "series" if media_type == "tv" else "movie"
        if stremio_type == "series" and season and episode:
            query_id = f"{imdb_id}:{season}:{episode}"
        else:
            query_id = imdb_id

        url = f"{OPENSUBTITLES_BASE_URL}/subtitles/{stremio_type}/{query_id}.json"

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("subtitles", [])
        except Exception as exc:
            logger.error("Error fetching OpenSubtitles for %s: %s", query_id, str(exc))

        return []


stremio_service = StremioService()
