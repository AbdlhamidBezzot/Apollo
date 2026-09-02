"""WatchHub embed playback provider.

Resolves a TMDB title to streams/external stream options provided by WatchHub addon.
"""

from datetime import datetime, timedelta
from typing import Any

from app.services.playback.base import PlaybackProvider, PlaybackResult
from app.services.stremio import get_imdb_id, stremio_service


class WatchHubPlaybackProvider(PlaybackProvider):
    name = "watchhub"

    async def resolve(
        self,
        tmdb_id: int,
        media_type: str,
        season: int | None = None,
        episode: int | None = None,
    ) -> PlaybackResult:
        imdb_id = await get_imdb_id(media_type, tmdb_id)
        if not imdb_id:
            # Fallback if IMDb ID resolution fails
            imdb_id = f"tt{tmdb_id:07d}"

        streams = await stremio_service.fetch_watchhub_streams(
            imdb_id=imdb_id,
            media_type=media_type,
            season=season,
            episode=episode,
        )

        stream_url = ""
        content_type = "text/html"
        metadata: dict[str, Any] = {"available_streams": streams}

        if streams:
            first = streams[0]
            stream_url = first.get("url") or first.get("externalUrl") or first.get("androidUrl") or ""
            if first.get("name"):
                metadata["provider_name"] = first.get("name")
            if first.get("title"):
                metadata["title"] = first.get("title")

        if not stream_url:
            # Direct fallback embed URL if no streams returned
            path = f"/{media_type}/{tmdb_id}" if media_type == "movie" else f"/{media_type}/{tmdb_id}/{season or 1}/{episode or 1}"
            stream_url = f"https://cinemaos.tech/player{path}"

        return PlaybackResult(
            provider="watchhub",
            stream_url=stream_url,
            content_type=content_type,
            expires_at=datetime.utcnow() + timedelta(hours=6),
            metadata=metadata,
        )
