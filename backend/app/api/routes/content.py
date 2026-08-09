"""Content routes â€” proxied, cached TMDB data. No keys are exposed here."""

import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.cache import get_cache
from app.core.config import get_settings
from app.core.errors import sanitize_detail
from app.core.ratelimit import rate_limited
from app.db import get_db
from app.models import EpisodeMetadata
from app.schemas import ContentList, EpisodeMetadataUpdate
from app.services.recommendations import recommend_for_profile
from app.services.tmdb import TMDbError, tmdb

from ..deps import CurrentProfile

router = APIRouter(prefix="/content", tags=["content"])

settings = get_settings()
DbDep = Annotated[Session, Depends(get_db)]
EPISODE_METADATA_CACHE_TTL = 3600

_rl_trending = rate_limited("content:trending", settings.rate_limit_read)
_rl_popular = rate_limited("content:popular", settings.rate_limit_read)
_rl_top_rated = rate_limited("content:top_rated", settings.rate_limit_read)
_rl_discover = rate_limited("content:discover", settings.rate_limit_read)
_rl_top_streaming = rate_limited("content:top_streaming", settings.rate_limit_read)
_rl_search = rate_limited("content:search", settings.rate_limit_search)
_rl_genres = rate_limited("content:genres", settings.rate_limit_read)
_rl_recommend = rate_limited("content:recommend", settings.rate_limit_search)
_rl_detail = rate_limited("content:detail", settings.rate_limit_read)
_rl_season = rate_limited("content:season", settings.rate_limit_read)
_rl_similar = rate_limited("content:similar", settings.rate_limit_read)
_rl_me = rate_limited("me", settings.rate_limit_me)


def _episode_metadata_cache_key(tmdb_id: int, season_number: int) -> str:
    return f"db:episode-metadata:{tmdb_id}:season:{season_number}"


def _episode_metadata_for_season(db: Session, tmdb_id: int, season_number: int) -> dict[int, dict]:
    """Load shared episode metadata without caching profile-specific data."""
    cache = get_cache()
    cache_key = _episode_metadata_cache_key(tmdb_id, season_number)
    raw = cache.get(cache_key)
    if raw is not None:
        try:
            return {int(item["episode_number"]): item for item in json.loads(raw)}
        except (TypeError, ValueError, KeyError):
            pass

    rows = (
        db.query(EpisodeMetadata)
        .filter(
            EpisodeMetadata.tmdb_id == tmdb_id,
            EpisodeMetadata.season_number == season_number,
        )
        .all()
    )
    items = [
        {
            "episode_number": row.episode_number,
            "is_filler": row.is_filler,
            "is_canon": row.is_canon,
            "arc_name": row.arc_name,
            "audio_languages": row.audio_languages or [],
        }
        for row in rows
    ]
    try:
        cache.set(cache_key, json.dumps(items), EPISODE_METADATA_CACHE_TTL)
    except (TypeError, ValueError):
        pass
    return {item["episode_number"]: item for item in items}


@router.get("/trending", response_model=ContentList)
async def trending(
    time_window: Literal["day", "week"] = "week", page: int = 1, _rl=Depends(_rl_trending)
):
    try:
        data = await tmdb.trending(time_window, page)
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/popular", response_model=ContentList)
async def popular(
    media_type: Literal["movie", "tv"] = "movie", page: int = 1, _rl=Depends(_rl_popular)
):
    try:
        data = await tmdb.popular(media_type, page)
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/top-rated", response_model=ContentList)
async def top_rated(
    media_type: Literal["movie", "tv"] = "movie", page: int = 1, _rl=Depends(_rl_top_rated)
):
    try:
        data = await tmdb.top_rated(media_type, page)
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/discover", response_model=ContentList)
async def discover(
    media_type: Literal["movie", "tv"] = "movie",
    page: int = 1,
    genre: list[int] = Query(default=[]),
    year: int | None = None,
    min_rating: float | None = None,
    max_runtime: int | None = None,
    language: str | None = None,
    origin_country: str | None = None,
    sort_by: str = "popularity.desc",
    provider: str | None = Query(default=None),
    watch_region: str | None = Query(default="US"),
    monetization_types: str | None = Query(default=None),
    _rl=Depends(_rl_discover),
):
    try:
        data = await tmdb.discover(
            media_type=media_type,
            page=page,
            genres=genre or None,
            year=year,
            min_rating=min_rating,
            max_runtime=max_runtime,
            language=language,
            origin_country=origin_country,
            sort_by=sort_by,
            provider=provider,
            watch_region=watch_region,
            monetization_types=monetization_types,
        )
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/top-streaming", response_model=ContentList)
async def top_streaming(
    media_type: Literal["movie", "tv"] = "movie",
    watch_region: str = "US",
    _rl=Depends(_rl_top_streaming),
):
    try:
        data = await tmdb.discover(
            media_type=media_type,
            page=1,
            sort_by="popularity.desc",
            watch_region=watch_region,
            monetization_types="flatrate",
        )
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/search", response_model=ContentList)
async def search(
    q: str,
    media_type: Literal["movie", "tv", "multi"] = "multi",
    page: int = 1,
    _rl=Depends(_rl_search),
):
    if not q.strip():
        raise HTTPException(status_code=422, detail="query 'q' is required")
    try:
        data = await tmdb.search(q.strip(), media_type if media_type != "multi" else None, page)
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/genres")
async def genres(_rl=Depends(_rl_genres)):
    try:
        return await tmdb.genres()
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/recommend", response_model=ContentList)
async def recommend(
profile: CurrentProfile,
    db: DbDep,
    limit: int = Query(12, ge=1, le=24),
    _rl=Depends(_rl_recommend),
):
    try:
        results = await recommend_for_profile(db, profile.id, limit=limit)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))
    return ContentList(page=1, results=results, total_pages=1, total_results=len(results))


@router.get("/{media_type}/{tmdb_id}")
async def detail(media_type: Literal["movie", "tv"], tmdb_id: int, _rl=Depends(_rl_detail)):
    try:
        item = await tmdb.detail(media_type, tmdb_id)
        credits = await tmdb.credits(media_type, tmdb_id)
        item["media_type"] = media_type
        item["credits"] = credits
        return item
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/{media_type}/{tmdb_id}/season/{season_number}")
async def season(
    media_type: Literal["movie", "tv"],
    tmdb_id: int,
    season_number: int,
    db: DbDep,
    _rl=Depends(_rl_season),
):
    try:
        data = await tmdb.season_episodes(media_type, tmdb_id, season_number)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))

    meta_by_ep = _episode_metadata_for_season(db, tmdb_id, season_number)
    for ep in data.get("episodes", []):
        if (meta := meta_by_ep.get(ep.get("episode_number"))) is not None:
            ep["meta"] = {key: value for key, value in meta.items() if key != "episode_number"}
    return data


@router.put("/episode-meta")
async def upsert_episode_meta(payload: EpisodeMetadataUpdate, db: DbDep, _rl=Depends(_rl_me)):
    row = (
        db.query(EpisodeMetadata)
        .filter(
            EpisodeMetadata.tmdb_id == payload.tmdb_id,
            EpisodeMetadata.season_number == payload.season,
            EpisodeMetadata.episode_number == payload.episode,
        )
        .one_or_none()
    )
    if row is None:
        row = EpisodeMetadata(tmdb_id=payload.tmdb_id, season_number=payload.season, episode_number=payload.episode)
        db.add(row)
    row.is_filler = payload.is_filler
    row.is_canon = payload.is_canon
    row.arc_name = payload.arc_name
    row.audio_languages = payload.audio_languages
    db.commit()
    get_cache().delete(_episode_metadata_cache_key(payload.tmdb_id, payload.season))
    return {"status": "ok"}


@router.delete("/episode-meta")
async def delete_episode_meta(
    tmdb_id: int, season: int, episode: int, db: DbDep, _rl=Depends(_rl_me)
):
    row = (
        db.query(EpisodeMetadata)
        .filter(
            EpisodeMetadata.tmdb_id == tmdb_id,
            EpisodeMetadata.season_number == season,
            EpisodeMetadata.episode_number == episode,
        )
        .one_or_none()
    )
    if row is not None:
        db.delete(row)
        db.commit()
    get_cache().delete(_episode_metadata_cache_key(tmdb_id, season))
    return {"status": "ok"}


@router.get("/{media_type}/{tmdb_id}/similar", response_model=ContentList)
async def similar(
    media_type: Literal["movie", "tv"], tmdb_id: int, page: int = 1, _rl=Depends(_rl_similar)
):
    try:
        data = await tmdb.similar(media_type, tmdb_id, page)
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))
