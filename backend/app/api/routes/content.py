"""Content routes â€” proxied, cached TMDB data. No keys are exposed here."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.ratelimit import rate_limited
from app.core.errors import sanitize_detail
from app.db import get_db
from app.models import EpisodeMetadata
from app.schemas import ContentList, EpisodeMetadataUpdate
from app.services.recommendations import recommend_for_profile
from app.services.tmdb import TMDbError, tmdb

from ..deps import CurrentProfile

router = APIRouter(prefix="/content", tags=["content"])

DbDep = Annotated[Session, Depends(get_db)]


@router.get("/trending", response_model=ContentList)
async def trending(
    time_window: Literal["day", "week"] = "week", page: int = 1, _rl=Depends(rate_limited("content", "120/minute"))
):
    try:
        data = await tmdb.trending(time_window, page)
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/popular", response_model=ContentList)
async def popular(
    media_type: Literal["movie", "tv"] = "movie", page: int = 1, _rl=Depends(rate_limited("content", "120/minute"))
):
    try:
        data = await tmdb.popular(media_type, page)
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/top-rated", response_model=ContentList)
async def top_rated(
    media_type: Literal["movie", "tv"] = "movie", page: int = 1, _rl=Depends(rate_limited("content", "120/minute"))
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
    _rl=Depends(rate_limited("content", "120/minute")),
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
    _rl=Depends(rate_limited("content", "120/minute")),
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
    _rl=Depends(rate_limited("content", "120/minute")),
):
    if not q.strip():
        raise HTTPException(status_code=422, detail="query 'q' is required")
    try:
        data = await tmdb.search(q.strip(), media_type if media_type != "multi" else None, page)
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/genres")
async def genres(_rl=Depends(rate_limited("content", "120/minute"))):
    try:
        return await tmdb.genres()
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))


@router.get("/recommend", response_model=ContentList)
async def recommend(
    profile: CurrentProfile,
    db: DbDep,
    limit: int = Query(12, ge=1, le=24),
    _rl=Depends(rate_limited("me", "120/minute")),
):
    try:
        results = await recommend_for_profile(db, profile.id, limit=limit)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))
    return ContentList(page=1, results=results, total_pages=1, total_results=len(results))


@router.get("/{media_type}/{tmdb_id}")
async def detail(media_type: Literal["movie", "tv"], tmdb_id: int, _rl=Depends(rate_limited("content", "120/minute"))):
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
    _rl=Depends(rate_limited("content", "120/minute")),
):
    try:
        data = await tmdb.season_episodes(media_type, tmdb_id, season_number)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))

    meta_rows = (
        db.query(EpisodeMetadata)
        .filter(
            EpisodeMetadata.tmdb_id == tmdb_id,
            EpisodeMetadata.season_number == season_number,
        )
        .all()
    )
    meta_by_ep = {m.episode_number: m for m in meta_rows}
    for ep in data.get("episodes", []):
        m = meta_by_ep.get(ep.get("episode_number"))
        if m is not None:
            ep["meta"] = {
                "is_filler": m.is_filler,
                "is_canon": m.is_canon,
                "arc_name": m.arc_name,
                "audio_languages": m.audio_languages or [],
            }
    return data


@router.put("/episode-meta")
async def upsert_episode_meta(payload: EpisodeMetadataUpdate, db: DbDep, _rl=Depends(rate_limited("me", "120/minute"))):
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
    return {"status": "ok"}


@router.delete("/episode-meta")
async def delete_episode_meta(
    tmdb_id: int, season: int, episode: int, db: DbDep, _rl=Depends(rate_limited("me", "120/minute"))
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
    return {"status": "ok"}


@router.get("/{media_type}/{tmdb_id}/similar", response_model=ContentList)
async def similar(
    media_type: Literal["movie", "tv"], tmdb_id: int, page: int = 1, _rl=Depends(rate_limited("content", "120/minute"))
):
    try:
        data = await tmdb.similar(media_type, tmdb_id, page)
        return ContentList(**data)
    except TMDbError as exc:
        raise HTTPException(status_code=502, detail=sanitize_detail(exc, 502))
