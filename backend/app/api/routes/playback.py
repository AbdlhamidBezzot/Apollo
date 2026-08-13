"""Playback routes.

Resolves a TMDB title to a short-lived, signed stream URL via the active
PlaybackProvider (vidsrc). Watching does not require an account: anyone can
resolve and play any title. No per-account concurrency cap.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.ratelimit import rate_limited
from app.db import get_db
from app.models import PlaybackCue
from app.schemas import PlaybackCueOut, PlaybackCueUpdate, PlaybackResolveRequest, PlaybackSession
from app.services.playback.base import PlaybackResult, available_providers, get_provider

router = APIRouter(prefix="/playback", tags=["playback"])

settings = get_settings()
DbDep = Annotated[Session, Depends(get_db)]


@router.get("/providers", response_model=list[str])
async def list_providers(
    _rl=Depends(rate_limited("content", settings.rate_limit_read)),
):
    """Names of every registered playback provider (for the player switcher)."""
    return available_providers()


@router.post("/resolve", response_model=PlaybackSession)
async def resolve(
    payload: PlaybackResolveRequest,
    db: DbDep,
    _rl=Depends(rate_limited("playback", settings.rate_limit_playback)),
):
    provider = get_provider(payload.provider)
    if not await provider.availability(payload.tmdb_id, payload.media_type):
        raise HTTPException(status_code=404, detail="Title not available from the active provider")

    result: PlaybackResult = await provider.resolve(
        payload.tmdb_id, payload.media_type, payload.season, payload.episode
    )

    return PlaybackSession(
        provider=result.provider,
        stream_url=result.stream_url,
        content_type=result.content_type,
        expires_at=result.expires_at,
        poster=None,
        title=None,
        session_token=None,
    )


def _cue_scope(db: Session, tmdb_id: int, media_type: str, season: int | None, episode: int | None):
    return (
        db.query(PlaybackCue)
        .filter(
            PlaybackCue.tmdb_id == tmdb_id,
            PlaybackCue.media_type == media_type,
            PlaybackCue.season_number == season,
            PlaybackCue.episode_number == episode,
        )
        .one_or_none()
    )


@router.get("/cues", response_model=PlaybackCueOut | None)
async def get_cues(
    tmdb_id: int,
    media_type: str,
    db: DbDep,
    season: int | None = None,
    episode: int | None = None,
    _rl=Depends(rate_limited("content", settings.rate_limit_read)),
):
    cue = _cue_scope(db, tmdb_id, media_type, season, episode)
    if cue is None:
        return None
    return PlaybackCueOut(
        tmdb_id=cue.tmdb_id,
        media_type=cue.media_type,
        season=cue.season_number,
        episode=cue.episode_number,
        intro_start=cue.intro_start,
        intro_end=cue.intro_end,
        outro_start=cue.outro_start,
        outro_end=cue.outro_end,
    )


@router.put("/cues", response_model=PlaybackCueOut)
async def upsert_cues(
    payload: PlaybackCueUpdate,
    db: DbDep,
    _rl=Depends(rate_limited("playback", settings.rate_limit_play)),
):
    cue = _cue_scope(db, payload.tmdb_id, payload.media_type, payload.season, payload.episode)
    if cue is None:
        cue = PlaybackCue(
            tmdb_id=payload.tmdb_id,
            media_type=payload.media_type,
            season_number=payload.season,
            episode_number=payload.episode,
        )
        db.add(cue)
    cue.intro_start = payload.intro_start
    cue.intro_end = payload.intro_end
    cue.outro_start = payload.outro_start
    cue.outro_end = payload.outro_end
    db.commit()
    db.refresh(cue)
    return PlaybackCueOut(
        tmdb_id=cue.tmdb_id,
        media_type=cue.media_type,
        season=cue.season_number,
        episode=cue.episode_number,
        intro_start=cue.intro_start,
        intro_end=cue.intro_end,
        outro_start=cue.outro_start,
        outro_end=cue.outro_end,
    )
