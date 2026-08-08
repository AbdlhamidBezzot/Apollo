"""SQLAlchemy models. Indexes on the columns we query most (tmdb_id, profile_id)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(32), default="email")
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    profiles: Mapped[list[Profile]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_kids: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="profiles")
    preferences: Mapped[Preferences | None] = relationship(
        back_populates="profile", cascade="all, delete-orphan", uselist=False
    )
    watch_history: Mapped[list[WatchHistory]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    watchlist: Mapped[list[WatchlistItem]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    ratings: Mapped[list[Rating]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    chat_sessions: Mapped[list[ChatSession]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    movie_night_rooms: Mapped[list[MovieNightRoom]] = relationship(back_populates="host")


class Preferences(Base):
    __tablename__ = "preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), unique=True)
    favorite_genres: Mapped[list] = mapped_column(JSON, default=list)
    excluded_genres: Mapped[list] = mapped_column(JSON, default=list)
    favorite_actors: Mapped[list] = mapped_column(JSON, default=list)
    onboarding_answers: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    profile: Mapped[Profile] = relationship(back_populates="preferences")


class WatchHistory(Base):
    __tablename__ = "watch_history"
    __table_args__ = (UniqueConstraint("profile_id", "tmdb_id", "media_type", name="uq_watch_profile_title"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    media_type: Mapped[str] = mapped_column(String(10))
    watched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    progress_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    season_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    episode_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    profile: Mapped[Profile] = relationship(back_populates="watch_history")


class WatchlistItem(Base):
    __tablename__ = "watchlist"
    __table_args__ = (UniqueConstraint("profile_id", "tmdb_id", "media_type", name="uq_watchlist_profile_title"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    media_type: Mapped[str] = mapped_column(String(10))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    profile: Mapped[Profile] = relationship(back_populates="watchlist")


class Rating(Base):
    __tablename__ = "ratings"
    __table_args__ = (UniqueConstraint("profile_id", "tmdb_id", "media_type", name="uq_ratings_profile_title"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    media_type: Mapped[str] = mapped_column(String(10))
    rating: Mapped[int] = mapped_column(Integer)
    rated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    profile: Mapped[Profile] = relationship(back_populates="ratings")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    profile: Mapped[Profile] = relationship(back_populates="chat_sessions")
    messages: Mapped[list[ChatMessage]] = relationship(back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(String(4000))
    suggested_titles: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped[ChatSession] = relationship(back_populates="messages")


class PlaybackSource(Base):
    __tablename__ = "playback_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    media_type: Mapped[str] = mapped_column(String(10))
    provider: Mapped[str] = mapped_column(String(64))
    provider_url_or_id: Mapped[str] = mapped_column(String(1000))
    quality_options: Mapped[list] = mapped_column(JSON, default=list)


class PlaybackCue(Base):
    """Skip-intro / skip-outro timecode windows, per title (optionally per episode)."""

    __tablename__ = "playback_cues"
    __table_args__ = (
        UniqueConstraint(
            "tmdb_id", "media_type", "season_number", "episode_number", name="uq_cue_title_season_episode"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    media_type: Mapped[str] = mapped_column(String(10))
    season_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    episode_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    intro_start: Mapped[float | None] = mapped_column(Float, nullable=True)
    intro_end: Mapped[float | None] = mapped_column(Float, nullable=True)
    outro_start: Mapped[float | None] = mapped_column(Float, nullable=True)
    outro_end: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class EpisodeMetadata(Base):
    """Optional per-episode anime metadata: canon/filler classification, story arc, audio tracks."""

    __tablename__ = "episode_metadata"
    __table_args__ = (
        UniqueConstraint("tmdb_id", "season_number", "episode_number", name="uq_episode_meta_season_episode"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    season_number: Mapped[int] = mapped_column(Integer)
    episode_number: Mapped[int] = mapped_column(Integer)
    is_filler: Mapped[bool] = mapped_column(Boolean, default=False)
    is_canon: Mapped[bool] = mapped_column(Boolean, default=True)
    arc_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    audio_languages: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class MovieNightRoom(Base):
    """Group "pick together" room (spec §6): host creates a shareable code, others
    join (account or guest), everyone sets quick preferences, and the bot merges
    them into one grounded pick. Distinct from the in-memory WebSocket sync rooms.
    """

    __tablename__ = "movie_night_rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    host_profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    room_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="collecting")  # collecting | deciding | decided
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    host: Mapped[Profile] = relationship(back_populates="movie_night_rooms", foreign_keys=[host_profile_id])
    participants: Mapped[list[RoomParticipant]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )
    suggestions: Mapped[list[RoomSuggestion]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )


class RoomParticipant(Base):
    __tablename__ = "room_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("movie_night_rooms.id", ondelete="CASCADE"), index=True)
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    guest_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # guest identity for pref updates
    preferences: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    room: Mapped[MovieNightRoom] = relationship(back_populates="participants")


class RoomSuggestion(Base):
    __tablename__ = "room_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("movie_night_rooms.id", ondelete="CASCADE"), index=True)
    tmdb_id: Mapped[int] = mapped_column(Integer)
    media_type: Mapped[str] = mapped_column(String(10))
    score: Mapped[float] = mapped_column(Float, default=0.0)
    presented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    room: Mapped[MovieNightRoom] = relationship(back_populates="suggestions")
