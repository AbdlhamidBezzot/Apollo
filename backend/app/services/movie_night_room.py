"""DB-backed Movie Night Room: group "pick together" flow (spec Ã‚Â§6).

One person creates a shareable room (code like APLO-K3F9), others join as an
account or a lightweight guest, everyone answers a handful of quick preference
prompts, and the bot merges the group's tastes into one grounded pick that the
host (optionally a majority) confirms. Playback launches on the host device.

This is the *pick-together* version. True synced playback across devices is a
separate, larger feature (WebSocket sync) scoped out per Ã‚Â§6.3.

Room flow mirrors the chatbot's grounding rule: any suggested title must come
from a real TMDB candidate pool, re-ranked for the group, and only then may the
LLM phrase a grounded pitch around it.
"""

from __future__ import annotations

import secrets
import string
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    MovieNightRoom,
    Profile,
    RoomParticipant,
    RoomSuggestion,
    WatchHistory,
)
from app.schemas import MovieNightRoomDetail, SuggestedTitle
from app.services import recommendations
from app.services.tmdb import TMDbError, tmdb

_ROOM_PREFIX = "APLO"
_CODE_ALPHABET = string.ascii_uppercase + string.digits


class MovieNightRoomError(Exception):
    pass


def _new_room_code(db: Session) -> str:
    for _ in range(50):
        suffix = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(4))
        code = f"{_ROOM_PREFIX}-{suffix}"
        if db.query(MovieNightRoom).filter(MovieNightRoom.room_code == code).first() is None:
            return code
    raise MovieNightRoomError("Could not allocate a room code")


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def create_room(db: Session, host: Profile, display_name: str | None = None) -> MovieNightRoom:
    room = MovieNightRoom(host_profile_id=host.id, room_code=_new_room_code(db), status="collecting")
    db.add(room)
    db.flush()
    db.add(
        RoomParticipant(
            room_id=room.id,
            profile_id=host.id,
            guest_name=None,
            token=_new_token(),
            preferences={},
        )
    )
    db.commit()
    db.refresh(room)
    return room


def get_room(db: Session, code: str) -> MovieNightRoom:
    room = (
        db.query(MovieNightRoom).filter(MovieNightRoom.room_code == code.strip().upper()).first()
    )
    if room is None:
        raise MovieNightRoomError("Room not found or expired")
    return room


def _host_participant(db: Session, room: MovieNightRoom) -> RoomParticipant:
    return (
        db.query(RoomParticipant)
        .filter(RoomParticipant.room_id == room.id, RoomParticipant.profile_id == room.host_profile_id)
        .one()
    )


def join_room(
    db: Session,
    code: str,
    profile: Profile | None = None,
    guest_name: str | None = None,
) -> tuple[MovieNightRoomDetail, str, bool]:
    """Return (detail, participant token, is_host). Logged-in accounts re-join
    their existing participant row; guests always get a fresh lightweight row."""
    room = get_room(db, code)
    if profile is not None:
        existing = (
            db.query(RoomParticipant)
            .filter(RoomParticipant.room_id == room.id, RoomParticipant.profile_id == profile.id)
            .first()
        )
        if existing:
            return _detail(db, room), existing.token, existing.profile_id == room.host_profile_id
        participant = RoomParticipant(
            room_id=room.id, profile_id=profile.id, token=_new_token(), preferences={}
        )
    else:
        participant = RoomParticipant(
            room_id=room.id,
            profile_id=None,
            guest_name=(guest_name or "Guest").strip()[:120] or "Guest",
            token=_new_token(),
            preferences={},
        )
    db.add(participant)
    db.commit()
    return _detail(db, room), participant.token, participant.profile_id == room.host_profile_id


def update_preferences(
    db: Session, code: str, token: str, pref_update: dict[str, Any]
) -> MovieNightRoomDetail:
    room = get_room(db, code)
    participant = (
        db.query(RoomParticipant).filter(RoomParticipant.room_id == room.id, RoomParticipant.token == token).first()
    )
    if participant is None:
        raise MovieNightRoomError("participant not found in room")
    prefs = dict(participant.preferences or {})
    for key in ("favorite_genres", "excluded_genres", "max_runtime_minutes", "mood", "intensity"):
        if key in pref_update and pref_update[key] is not None:
            prefs[key] = pref_update[key]
    participant.preferences = prefs
    db.commit()
    return _detail(db, room)


def leave_room(db: Session, code: str, token: str) -> dict[str, Any]:
    room = get_room(db, code)
    participant = (
        db.query(RoomParticipant).filter(RoomParticipant.room_id == room.id, RoomParticipant.token == token).first()
    )
    if participant is None:
        return {"status": "left"}

    is_host = participant.profile_id == room.host_profile_id
    db.delete(participant)

    remaining = db.query(RoomParticipant).filter(RoomParticipant.room_id == room.id).count()
    if is_host or remaining == 0:
        room.status = "closed"

    db.commit()
    return {"status": "left", "room_closed": is_host or remaining == 0}


def _participant_name(participant: RoomParticipant) -> str:
    if participant.guest_name:
        return participant.guest_name
    if participant.profile_id is not None:
        return f"profile#{participant.profile_id}"
    return "Guest"


def _detail(db: Session, room: MovieNightRoom) -> MovieNightRoomDetail:
    participants = (
        db.query(RoomParticipant)
        .filter(RoomParticipant.room_id == room.id)
        .order_by(RoomParticipant.joined_at)
        .all()
    )
    host = _host_participant(db, room)
    host_name = _participant_name(host)
    return MovieNightRoomDetail(
        code=room.room_code,
        status=room.status,
        host_name=host_name,
        participants=[
            {
                "name": _participant_name(p),
                "is_host": p.id == host.id,
                "has_preferences": bool(p.preferences),
                "preferences_pending": False,
            }
            for p in participants
        ],
        created_at=room.created_at,
    )


def _merge_preferences(participants: list[RoomParticipant]) -> dict[str, Any]:
    """Combine a group's preferences: union of favorite genres minus anything
    anyone vetoed, the minimum common available runtime, average intensity."""
    fav_sets: list[set[int]] = []
    vetoed: set[int] = set()
    runtimes: list[int] = []
    intensities: list[int] = []
    moods: list[str] = []
    for p in participants:
        prefs = p.preferences or {}
        if prefs.get("favorite_genres"):
            fav_sets.append(set(prefs["favorite_genres"]))
        if prefs.get("excluded_genres"):
            vetoed.update(prefs["excluded_genres"])
        if prefs.get("max_runtime_minutes"):
            runtimes.append(int(prefs["max_runtime_minutes"]))
        if prefs.get("intensity") is not None:
            intensities.append(int(prefs["intensity"]))
        if prefs.get("mood"):
            moods.append(str(prefs["mood"]).lower())
    genres = set()
    if fav_sets:
        overlap = set.intersection(*fav_sets)  # genres all participants are OK with
        genres = overlap or set.union(*fav_sets)  # fall back to union if intersection empty
    return {
        "genres": list(genres - vetoed) or None,
        "excluded": list(vetoed) or None,
        "max_runtime": min(runtimes) if runtimes else None,
        "intensity": round(sum(intensities) / len(intensities)) if intensities else None,
        "moods": moods,
    }


async def suggest_pick(db: Session, code: str) -> tuple[str, list[SuggestedTitle]]:
    """Merge participants' prefs -> real TMDB pool -> grounded LLM pitch."""
    from app.core.config import get_settings
    from app.services.tmdb import TMDbError

    room = get_room(db, code)
    participants = (
        db.query(RoomParticipant).filter(RoomParticipant.room_id == room.id).all()
    )
    merged = _merge_preferences(participants)

    if not merged["genres"]:
        # group has no shared constraints yet; fall back to a broad ranking
        merged["genres"] = None

    try:
        candidates = await recommendations.movie_night_candidates(
            db,
            room.host_profile_id,
            genres=merged["genres"],
            max_runtime=merged["max_runtime"],
            min_rating=6.0,
            limit=12,
        )
    except TMDbError as exc:
        raise MovieNightRoomError(f"Could not build candidate pool: {exc}") from exc

    if merged["excluded"]:
        filtered = [
            c for c in candidates if not (set(c.get("genre_ids") or []) & set(merged["excluded"]))
        ]
        if filtered:
            candidates = filtered
    candidates = candidates[:5]

    if not candidates:
        try:
            candidates = await recommendations.movie_night_candidates(
                db, room.host_profile_id, genres=None, max_runtime=None, min_rating=5.0, limit=5
            )
        except Exception:
            candidates = []

    # Persist suggestions for auditability.
    db.query(RoomSuggestion).filter(RoomSuggestion.room_id == room.id).delete()
    for i, c in enumerate(candidates):
        db.add(
            RoomSuggestion(
                room_id=room.id,
                tmdb_id=c["id"],
                media_type=c.get("media_type") or "movie",
                score=float(len(candidates) - i),
            )
        )
    room.status = "deciding"
    db.commit()

    if not candidates:
        return "Not enough shared signal yet Ã¢â‚¬â€ have everyone set a preference, then try again.", []

    _fallback_titles = [
        SuggestedTitle(
            tmdb_id=c["id"],
            media_type=c.get("media_type") or "movie",
            title=c.get("title") or c.get("name") or "Untitled",
            pitch=(c.get("overview") or "").split(".", 1)[0] + ".",
        )
        for c in candidates[:3]
    ]

    has_llm = bool(get_settings().llm_api_key and get_settings().llm_api_key.strip())
    if not has_llm:
        return "Since you're all up for this, here's a pick everyone should be into:", _fallback_titles

    try:
        reply, titles = await _group_pitch(db, room.host_profile_id, candidates, merged)
        return reply, titles
    except Exception:
        # LLM unavailable (quota, network, etc.) Ã¢â‚¬â€œ fall back to real-data picks.
        return "Since you're all up for this, here's a pick everyone should be into:", _fallback_titles


async def _group_pitch(
    db: Session, profile_id: int, candidates: list[dict[str, Any]], merged: dict[str, Any]
) -> tuple[str, list[SuggestedTitle]]:
    """Grounded LLM pitch that acknowledges the group. Reuses the chatbot's
    two-call grounding helpers so group picks obey the same "only from the real
    pool" rule as solo picks."""
    from app.services import chatbot

    fake_history = [{"role": "user", "content": _group_context(merged)}]
    pitched = await chatbot._grounded_pitch(db, profile_id, candidates, fake_history)
    titles = chatbot._suggested_from_result(pitched, candidates)
    reply = str(pitched.get("reply") or "Here are a few that fit the whole group:")
    return reply, titles


def _group_context(merged: dict[str, Any]) -> str:
    bits = ["The group is deciding what to watch together tonight."]
    if merged.get("genres"):
        bits.append(f"The group is open to these genres together: {merged['genres']}.")
    if merged.get("excluded"):
        bits.append(f"Someone vetoed: {merged['excluded']}.")
    if merged.get("max_runtime"):
        bits.append(f"Under {merged['max_runtime']} minutes please.")
    if merged.get("intensity") is not None:
        bits.append(f"Intensity level around {merged['intensity']} out of 5.")
    return " ".join(bits)


async def decide_async(
    db: Session,
    code: str,
    token: str,
    tmdb_id: int,
    media_type: str,
) -> dict[str, Any]:
    """Host confirms the pick -> resolve playback on the host device and log it."""
    from datetime import UTC, datetime

    from app.services.playback.base import get_provider

    room = get_room(db, code)
    participant = (
        db.query(RoomParticipant).filter(RoomParticipant.room_id == room.id, RoomParticipant.token == token).first()
    )
    if participant is None:
        raise MovieNightRoomError("participant not found")
    if participant.profile_id != room.host_profile_id:
        raise MovieNightRoomError("Only the host can confirm the group pick")

    provider = get_provider()
    try:
        result = await provider.resolve(tmdb_id, media_type)
        detail = await tmdb.detail(media_type, tmdb_id)
    except TMDbError as exc:
        raise MovieNightRoomError(f"Could not start playback: {exc}") from exc

    room.status = "decided"
    row = (
        db.query(WatchHistory)
        .filter(
            WatchHistory.profile_id == room.host_profile_id,
            WatchHistory.tmdb_id == tmdb_id,
            WatchHistory.media_type == media_type,
        )
        .first()
    )
    if row is None:
        db.add(
            WatchHistory(
                profile_id=room.host_profile_id,
                tmdb_id=tmdb_id,
                media_type=media_type,
                progress_seconds=0.0,
                completed=False,
            )
        )
    else:
        row.watched_at = datetime.now(UTC)
    db.commit()

    return {
        "reply": f"Enjoy! Launching **{detail.get('title') or detail.get('name')}** for the room.",
        "action": "play",
        "play_target": {
            "tmdb_id": tmdb_id,
            "media_type": media_type,
            "stream_url": result.stream_url,
            "content_type": result.content_type,
            "expires_at": result.expires_at.isoformat(),
            "poster": detail.get("poster_path"),
            "title": detail.get("title") or detail.get("name"),
        },
    }
