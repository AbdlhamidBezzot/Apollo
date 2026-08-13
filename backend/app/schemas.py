"""Pydantic schemas. Input validation happens here (never trust the frontend)."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

MediaType = Literal["movie", "tv"]


# --- Auth ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    is_admin: bool
    email_verified: bool


# --- Profiles ---
class ProfileCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    is_kids: bool = False


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    avatar: str | None
    is_kids: bool


# --- Preferences ---
class PreferencesUpdate(BaseModel):
    favorite_genres: list[int] = []
    excluded_genres: list[int] = []
    favorite_actors: list[int] = []
    onboarding_answers: dict[str, Any] = {}


# --- Watchlist / history / ratings ---
class TitleRef(BaseModel):
    tmdb_id: int
    media_type: MediaType


class WatchlistItemCreate(TitleRef):
    pass


class WatchlistItemOut(WatchlistItemCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    added_at: datetime


class WatchHistoryUpdate(BaseModel):
    tmdb_id: int
    media_type: MediaType
    progress_seconds: float = Field(ge=0)
    completed: bool = False
    season_number: int | None = None
    episode_number: int | None = None


class WatchHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tmdb_id: int
    media_type: str
    watched_at: datetime
    progress_seconds: float
    completed: bool
    season_number: int | None = None
    episode_number: int | None = None


class RatingCreate(BaseModel):
    tmdb_id: int
    media_type: MediaType
    rating: int = Field(ge=1, le=5)


# --- Chat ---
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: int | None = None


class SuggestedTitle(BaseModel):
    tmdb_id: int
    media_type: MediaType
    title: str
    pitch: str


class ChatResponse(BaseModel):
    reply: str
    suggested_titles: list[SuggestedTitle] = []
    session_id: int | None = None
    action: Literal["none", "play"] = "none"
    play_target: dict[str, Any] | None = None


# --- Playback ---
class PlaybackSession(BaseModel):
    provider: str
    stream_url: str
    content_type: str
    expires_at: datetime
    poster: str | None = None
    title: str | None = None
    session_token: str | None = None


class PlaybackResolveRequest(BaseModel):
    tmdb_id: int
    media_type: MediaType
    season: int | None = None
    episode: int | None = None
    provider: str | None = None


# --- Content (TMDB passthrough) ---
class ContentList(BaseModel):
    page: int
    results: list[dict[str, Any]]
    total_pages: int
    total_results: int


# --- Skip intro/outro cues ---
class PlaybackCueUpdate(BaseModel):
    tmdb_id: int
    media_type: MediaType
    season: int | None = None
    episode: int | None = None
    intro_start: float | None = None
    intro_end: float | None = None
    outro_start: float | None = None
    outro_end: float | None = None


class PlaybackCueOut(PlaybackCueUpdate):
    model_config = ConfigDict(from_attributes=True)


# --- Episode metadata (anime) ---
class EpisodeMetadataUpdate(BaseModel):
    tmdb_id: int
    season: int = Field(ge=1)
    episode: int = Field(ge=1)
    is_filler: bool = False
    is_canon: bool = True
    arc_name: str | None = Field(default=None, max_length=200)
    audio_languages: list[str] = []


class EpisodeMetadataOut(BaseModel):
    tmdb_id: int
    season: int
    episode: int
    is_filler: bool
    is_canon: bool
    arc_name: str | None
    audio_languages: list[str]


# --- Movie Night rooms ---
class MovieNightRoomCreate(BaseModel):
    tmdb_id: int
    media_type: MediaType
    season: int | None = None
    episode: int | None = None


class MovieNightRoomOut(BaseModel):
    code: str
    tmdb_id: int | None = None
    media_type: MediaType | None = None
    season: int | None = None
    episode: int | None = None
    members: int = 0
    host: str | None = None


# --- Movie Night Room (group pick-together, spec §6) ---
class RoomPreferenceUpdate(BaseModel):
    favorite_genres: list[int] = []
    excluded_genres: list[int] = []
    max_runtime_minutes: int | None = None
    mood: str | None = None
    intensity: int | None = Field(default=None, ge=0, le=5)


class RoomParticipantOut(BaseModel):
    name: str
    is_host: bool = False
    has_preferences: bool = False
    preferences_pending: bool = False


class MovieNightRoomDetail(BaseModel):
    code: str
    status: str
    host_name: str
    participants: list[RoomParticipantOut] = []
    created_at: datetime


class MovieNightJoinRequest(BaseModel):
    guest_name: str | None = Field(default=None, max_length=120)


class MovieNightJoinResponse(BaseModel):
    room: MovieNightRoomDetail
    token: str
    is_host: bool = False


class MovieNightSuggestResponse(BaseModel):
    reply: str
    suggested_titles: list[SuggestedTitle] = []
    status: str = "deciding"


class MovieNightDecideRequest(BaseModel):
    tmdb_id: int
    media_type: MediaType


class MovieNightDecideResponse(BaseModel):
    reply: str
    action: Literal["none", "play"] = "play"
    play_target: dict[str, Any] | None = None
