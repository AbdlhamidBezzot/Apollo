"""Media Stream & Subtitle Resolver API Routes.

Endpoints:
- GET /api/v1/media/{tmdb_id}/streams     -> Aggregate streams from all user add-ons
- GET /api/v1/media/{tmdb_id}/subtitles   -> Aggregate subtitles from all user add-ons

Supports movies (media_type=movie) and TV series (media_type=tv&season=S&episode=E).
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import CurrentUserOptional, DbDep
from app.core.config import get_settings
from app.core.ratelimit import rate_limited
from app.schemas import ApolloStream, ApolloSubtitle, MediaStreamsResponse, MediaSubtitlesResponse
from app.services.stream_resolver import resolve_streams_for_user, resolve_subtitles_for_user

router = APIRouter(prefix="/media", tags=["media-addons"])
settings = get_settings()


@router.get(
    "/{tmdb_id}/streams",
    response_model=MediaStreamsResponse,
    dependencies=[Depends(rate_limited("media_streams", "120/minute"))],
)
async def get_media_streams(
    tmdb_id: int,
    user: CurrentUserOptional,
    db: DbDep,
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
    season: int | None = Query(None, ge=1),
    episode: int | None = Query(None, ge=1),
):
    """Aggregate streams from all active user add-ons for the given title."""
    if media_type == "tv" and (season is None or episode is None):
        raise HTTPException(
            status_code=400,
            detail="For TV content, 'season' and 'episode' query parameters are required.",
        )

    raw_streams = await resolve_streams_for_user(
        user_id=user.id if user else None,
        db=db,
        tmdb_id=tmdb_id,
        media_type=media_type,
        season=season,
        episode=episode,
    )

    apollo_streams = [
        ApolloStream(
            id=s["id"],
            addon_id=s["addonId"],
            addon_name=s["addonName"],
            title=s.get("title"),
            quality=s.get("quality"),
            language=s.get("language"),
            url=s.get("url"),
            is_direct=s.get("isDirect", False),
            is_torrent=s.get("isTorrent", False),
            subtitles=[
                ApolloSubtitle(id=sub["id"], language=sub["language"], url=sub["url"])
                for sub in s.get("subtitles", [])
            ],
            metadata=s.get("metadata", {}),
        )
        for s in raw_streams
    ]

    return MediaStreamsResponse(
        tmdb_id=tmdb_id,
        media_type=media_type,
        streams=apollo_streams,
    )


@router.get(
    "/{tmdb_id}/subtitles",
    response_model=MediaSubtitlesResponse,
    dependencies=[Depends(rate_limited("media_subtitles", "120/minute"))],
)
async def get_media_subtitles(
    tmdb_id: int,
    user: CurrentUserOptional,
    db: DbDep,
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
    season: int | None = Query(None, ge=1),
    episode: int | None = Query(None, ge=1),
):
    """Aggregate subtitles from all active user add-ons for the given title."""
    raw_subs = await resolve_subtitles_for_user(
        user_id=user.id if user else None,
        db=db,
        tmdb_id=tmdb_id,
        media_type=media_type,
        season=season,
        episode=episode,
    )


    apollo_subs = [
        ApolloSubtitle(id=s["id"], language=s["language"], url=s["url"])
        for s in raw_subs
    ]

    return MediaSubtitlesResponse(
        tmdb_id=tmdb_id,
        media_type=media_type,
        subtitles=apollo_subs,
    )
