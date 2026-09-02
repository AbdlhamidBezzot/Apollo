"""Subtitles API routes."""

import logging
from typing import Any

from fastapi import APIRouter, Query

from app.core.config import get_settings
from app.core.ratelimit import rate_limited
from app.services.stremio import get_imdb_id, stremio_service

router = APIRouter(prefix="/subtitles", tags=["subtitles"])
settings = get_settings()

_rl_subtitles = rate_limited("subtitles:fetch", settings.rate_limit_read)
logger = logging.getLogger("app.subtitles.routes")


@router.get("", response_model=dict[str, Any])
async def get_subtitles(
    tmdb_id: int = Query(..., description="TMDB ID of the title"),
    media_type: str = Query(..., pattern="^(movie|tv)$", description="movie or tv"),
    season: int | None = Query(default=None, description="Season number for TV shows"),
    episode: int | None = Query(default=None, description="Episode number for TV shows"),
):
    """Fetch subtitle tracks from OpenSubtitles v3 addon."""
    imdb_id = await get_imdb_id(media_type, tmdb_id)
    if not imdb_id:
        imdb_id = f"tt{tmdb_id:07d}"

    subs = await stremio_service.fetch_subtitles(
        imdb_id=imdb_id,
        media_type=media_type,
        season=season,
        episode=episode,
    )

    return {"subtitles": subs, "imdb_id": imdb_id}
