"""Personal routes: profiles, preferences, watchlist, history, ratings."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.ratelimit import rate_limited
from app.db import get_db
from app.models import Preferences, Profile, Rating, WatchHistory, WatchlistItem
from app.schemas import (
    AvatarUpdate,
    PreferencesUpdate,
    ProfileCreate,
    ProfileOut,
    RatingCreate,
    WatchHistoryOut,
    WatchHistoryUpdate,
    WatchlistItemCreate,
    WatchlistItemOut,
)

from ..deps import CurrentProfile, CurrentUser

router = APIRouter(prefix="/me", tags=["me"])

settings = get_settings()
DbDep = Annotated[Session, Depends(get_db)]
_rl_me = rate_limited("me", settings.rate_limit_me)


# --- Profiles ---
@router.get("/profiles", response_model=list[ProfileOut])
async def list_profiles(user: CurrentUser, db: DbDep):
    return db.query(Profile).filter(Profile.user_id == user.id).order_by(Profile.id).all()


@router.post("/profiles", response_model=ProfileOut, status_code=201)
async def create_profile(
    payload: ProfileCreate, user: CurrentUser, db: DbDep, _rl=Depends(_rl_me)
):
    profile = Profile(user_id=user.id, display_name=payload.display_name, is_kids=payload.is_kids)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


# --- Preferences ---
@router.get("/preferences")
async def get_preferences(profile: CurrentProfile, db: DbDep):
    prefs = db.query(Preferences).filter(Preferences.profile_id == profile.id).one_or_none()
    if prefs is None:
        return {"favorite_genres": [], "excluded_genres": [], "favorite_actors": [], "onboarding_answers": {}}
    return {
        "favorite_genres": prefs.favorite_genres or [],
        "excluded_genres": prefs.excluded_genres or [],
        "favorite_actors": prefs.favorite_actors or [],
        "onboarding_answers": prefs.onboarding_answers or {},
    }


@router.put("/preferences")
async def update_preferences(payload: PreferencesUpdate, profile: CurrentProfile, db: DbDep):
    prefs = db.query(Preferences).filter(Preferences.profile_id == profile.id).one_or_none()
    if prefs is None:
        prefs = Preferences(profile_id=profile.id)
        db.add(prefs)
    prefs.favorite_genres = payload.favorite_genres
    prefs.excluded_genres = payload.excluded_genres
    prefs.favorite_actors = payload.favorite_actors
    prefs.onboarding_answers = payload.onboarding_answers
    db.commit()
    return {"status": "ok"}


# --- Watchlist ---
@router.get("/watchlist", response_model=list[WatchlistItemOut])
async def list_watchlist(profile: CurrentProfile, db: DbDep):
    return (
        db.query(WatchlistItem)
        .filter(WatchlistItem.profile_id == profile.id)
        .order_by(WatchlistItem.added_at.desc())
        .all()
    )


@router.post("/watchlist", response_model=WatchlistItemOut, status_code=201)
async def add_to_watchlist(payload: WatchlistItemCreate, profile: CurrentProfile, db: DbDep):
    existing = (
        db.query(WatchlistItem)
        .filter(
            WatchlistItem.profile_id == profile.id,
            WatchlistItem.tmdb_id == payload.tmdb_id,
            WatchlistItem.media_type == payload.media_type,
        )
        .first()
    )
    if existing:
        return existing
    item = WatchlistItem(profile_id=profile.id, tmdb_id=payload.tmdb_id, media_type=payload.media_type)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/watchlist/{media_type}/{tmdb_id}", status_code=204)
async def remove_from_watchlist(media_type: str, tmdb_id: int, profile: CurrentProfile, db: DbDep):
    item = (
        db.query(WatchlistItem)
        .filter(
            WatchlistItem.profile_id == profile.id,
            WatchlistItem.tmdb_id == tmdb_id,
            WatchlistItem.media_type == media_type,
        )
        .first()
    )
    if item:
        db.delete(item)
        db.commit()


# --- Watch history ---
@router.get("/history", response_model=list[WatchHistoryOut])
async def list_history(profile: CurrentProfile, db: DbDep, limit: int = 50):
    return (
        db.query(WatchHistory)
        .filter(WatchHistory.profile_id == profile.id)
        .order_by(WatchHistory.watched_at.desc())
        .limit(min(limit, 200))
        .all()
    )


@router.put("/history", response_model=WatchHistoryOut)
async def update_history(payload: WatchHistoryUpdate, profile: CurrentProfile, db: DbDep, _rl=Depends(_rl_me)):
    entry = (
        db.query(WatchHistory)
        .filter(
            WatchHistory.profile_id == profile.id,
            WatchHistory.tmdb_id == payload.tmdb_id,
            WatchHistory.media_type == payload.media_type,
        )
        .first()
    )
    if entry is None:
        entry = WatchHistory(profile_id=profile.id, tmdb_id=payload.tmdb_id, media_type=payload.media_type)
        db.add(entry)
    entry.progress_seconds = payload.progress_seconds
    entry.completed = payload.completed
    if payload.media_type == "tv":
        entry.season_number = payload.season_number if payload.season_number is not None else (entry.season_number or 1)
        entry.episode_number = payload.episode_number if payload.episode_number is not None else (entry.episode_number or 1)
    else:
        entry.season_number = payload.season_number
        entry.episode_number = payload.episode_number
    entry.watched_at = datetime.now(UTC)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/history/{media_type}/{tmdb_id}", status_code=204)
async def remove_history_entry(media_type: str, tmdb_id: int, profile: CurrentProfile, db: DbDep, _rl=Depends(_rl_me)):
    entry = (
        db.query(WatchHistory)
        .filter(
            WatchHistory.profile_id == profile.id,
            WatchHistory.tmdb_id == tmdb_id,
            WatchHistory.media_type == media_type,
        )
        .first()
    )
    if entry:
        db.delete(entry)
        db.commit()


# --- Ratings ---
@router.put("/ratings", status_code=200)
async def rate_title(payload: RatingCreate, profile: CurrentProfile, db: DbDep):
    rating = (
        db.query(Rating)
        .filter(
            Rating.profile_id == profile.id, Rating.tmdb_id == payload.tmdb_id, Rating.media_type == payload.media_type
        )
        .first()
    )
    if rating is None:
        rating = Rating(profile_id=profile.id, tmdb_id=payload.tmdb_id, media_type=payload.media_type)
        db.add(rating)
    rating.rating = payload.rating
    db.commit()
    return {"status": "ok"}


@router.get("/ratings")
async def list_ratings(profile: CurrentProfile, db: DbDep):
    return [
        {"tmdb_id": r.tmdb_id, "media_type": r.media_type, "rating": r.rating}
        for r in db.query(Rating).filter(Rating.profile_id == profile.id).all()
    ]


@router.put("/avatar", response_model=ProfileOut)
async def update_avatar(payload: AvatarUpdate, profile: CurrentProfile, db: DbDep):
    profile.avatar = payload.avatar.strip()
    db.commit()
    db.refresh(profile)
    return profile

