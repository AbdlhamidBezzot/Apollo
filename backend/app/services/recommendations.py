"""Lightweight content-based recommendation engine.

Scores TMDB candidate titles against a profile's preferences and watch/rating
history, then feeds the personalized "Because you watched" home row.
Collaborative filtering is a later stretch goal (the plan says so); this keeps
Phase 1 running with zero external services.
"""

from collections import Counter
from typing import Any

from sqlalchemy.orm import Session

from app.models import Preferences, Rating, WatchHistory
from app.services.tmdb import TMDbError, tmdb


def profile_context(db: Session, profile_id: int) -> dict[str, Any]:
    prefs = db.query(Preferences).filter(Preferences.profile_id == profile_id).one_or_none()
    rated = db.query(Rating).filter(Rating.profile_id == profile_id).all()
    history = (
        db.query(WatchHistory)
        .filter(WatchHistory.profile_id == profile_id)
        .order_by(WatchHistory.watched_at.desc())
        .all()
    )

    liked = [r for r in rated if r.rating >= 4]
    seeds = [(r.media_type, r.tmdb_id) for r in liked]
    seeds += [(h.media_type, h.tmdb_id) for h in history if h.completed or h.progress_seconds >= 300]

    seen: set[tuple[str, int]] = set()
    unique_seeds: list[tuple[str, int]] = []
    for seed in seeds:
        if seed not in seen:
            seen.add(seed)
            unique_seeds.append(seed)

    return {
        "favorite_genres": set(prefs.favorite_genres or []) if prefs else set(),
        "excluded_genres": set(prefs.excluded_genres or []) if prefs else set(),
        "liked_ids": {r.tmdb_id for r in liked},
        "disliked_ids": {r.tmdb_id for r in rated if r.rating <= 2},
        "watched_ids": {h.tmdb_id for h in history},
        "seeds": unique_seeds[:4],
    }


def _title_score(title: dict[str, Any], ctx: dict[str, Any]) -> float:
    genre_ids = set(title.get("genre_ids") or [])
    score = 0.0
    score += 2.0 * len(genre_ids & ctx["favorite_genres"])
    score -= 2.0 * len(genre_ids & ctx["excluded_genres"])
    if title.get("id") in ctx["liked_ids"]:
        score += 1.0
    if title.get("id") in ctx["disliked_ids"]:
        score -= 5.0
    if title.get("id") in ctx["watched_ids"]:
        score -= 3.0  # de-prioritize already-watched titles
    # Slight popularity/vote boost keeps quality high.
    score += 0.3 * float(title.get("vote_average") or 0)
    return score


async def rank_titles(db: Session, profile_id: int, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ctx = profile_context(db, profile_id)
    ranked = sorted(candidates, key=lambda t: _title_score(t, ctx), reverse=True)
    return ranked


async def movie_night_candidates(
    db: Session,
    profile_id: int,
    genres: list[int] | None = None,
    max_runtime: int | None = None,
    min_rating: float = 6.0,
    limit: int = 12,
) -> list[dict[str, Any]]:
    """Candidate pool for Movie Night: TMDB discover, re-ranked for the user."""
    discovered = await tmdb.discover(
        media_type="movie",
        genres=genres,
        max_runtime=max_runtime,
        min_rating=min_rating,
        sort_by="popularity.desc",
    )
    ranked = await rank_titles(db, profile_id, discovered.get("results", []))
    return ranked[:limit]


async def recommend_for_profile(db: Session, profile_id: int, limit: int = 12) -> list[dict[str, Any]]:
    """Personalized "Because you watched" picks for the home row.

    Candidate pool = similar titles to the profile's signals (high ratings,
    meaningful watch history) plus discover results for the genres that profile
    tends toward, all re-ranked by _title_score. Returns early with no TMDB
    calls when the profile has no signals yet.
    """
    ctx = profile_context(db, profile_id)
    if not ctx["seeds"]:
        return []

    candidates: dict[tuple[str, int], dict[str, Any]] = {}

    def add(item: dict[str, Any]) -> None:
        media_type = item.get("media_type")
        item_id = item.get("id")
        if media_type in ("movie", "tv") and item_id:
            key = (media_type, item_id)
            if key not in candidates:
                candidates[key] = item

    signal_genres: Counter = Counter()
    for media_type, tmdb_id in ctx["seeds"]:
        try:
            detail = await tmdb.detail(media_type, tmdb_id)
        except TMDbError:
            continue
        for genre in detail.get("genres", []):
            signal_genres[genre.get("id")] += 1
        try:
            similar = await tmdb.similar(media_type, tmdb_id)
        except TMDbError:
            continue
        for item in similar.get("results", [])[:12]:
            add(item)

    for genre_id in ctx["favorite_genres"]:
        signal_genres[genre_id] += 1

    for genre_id, _count in signal_genres.most_common(3):
        for media_type in ("movie", "tv"):
            try:
                discovered = await tmdb.discover(media_type=media_type, genres=[genre_id], sort_by="popularity.desc")
            except TMDbError:
                continue
            for item in discovered.get("results", [])[:20]:
                add(item)

    if not candidates:
        return []

    ranked = await rank_titles(db, profile_id, list(candidates.values()))
    return [
        title
        for title in ranked
        if title.get("id") not in ctx["watched_ids"] and title.get("id") not in ctx["disliked_ids"]
    ][:limit]
