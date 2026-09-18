"""Pluggable playback providers.

The PlaybackProvider interface is the abstraction the plan calls for: swap in
whatever provider you get credentials for (see vidsrc.py for the pattern). The
rest of the app never touches a provider directly.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class PlaybackResult:
    provider: str
    stream_url: str
    content_type: str  # e.g. "application/x-mpegURL" (HLS) or "video/mp4"
    expires_at: datetime
    metadata: dict[str, Any]


class PlaybackProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def resolve(
        self,
        tmdb_id: int,
        media_type: str,
        season: int | None = None,
        episode: int | None = None,
    ) -> PlaybackResult:
        """Resolve a TMDB title to a secure, time-limited stream URL."""
        raise NotImplementedError

    async def availability(self, tmdb_id: int, media_type: str) -> bool:
        """Whether this provider can serve the title (defaults to True)."""
        return True


def get_provider_registry() -> dict[str, type[PlaybackProvider]]:
    from . import cinemaos, videasy, vidsrc

    return {
        "videasy": videasy.VideasyPlaybackProvider,
        "vidsrc": vidsrc.VidsrcPlaybackProvider,
        "cinemaos": cinemaos.CinemaOSPlaybackProvider,
    }


def available_providers() -> list[str]:
    """Names of every registered playback provider (for the player switcher)."""
    return list(get_provider_registry().keys())


def get_provider(name: str | None = None) -> PlaybackProvider:
    from app.core.config import get_settings

    selected = (name or get_settings().playback_provider or "videasy").lower()
    provider_cls = get_provider_registry().get(selected)
    if provider_cls is None:
        raise ValueError(f"Unknown playback provider: {selected}")
    return provider_cls()

