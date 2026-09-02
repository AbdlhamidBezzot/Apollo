"""AutoEmbed playback provider.

Movie: https://player.autoembed.cc/embed/movie/{tmdb_id}
TV:    https://player.autoembed.cc/embed/tv/{tmdb_id}/{season}/{episode}
"""

from datetime import UTC, datetime, timedelta
from .base import PlaybackProvider, PlaybackResult


class AutoEmbedPlaybackProvider(PlaybackProvider):
    name = "autoembed"

    async def resolve(
        self,
        tmdb_id: int,
        media_type: str,
        season: int | None = None,
        episode: int | None = None,
    ) -> PlaybackResult:
        if media_type == "tv":
            s = season or 1
            e = episode or 1
            url = f"https://player.autoembed.cc/embed/tv/{tmdb_id}/{s}/{e}"
        else:
            url = f"https://player.autoembed.cc/embed/movie/{tmdb_id}"

        return PlaybackResult(
            provider=self.name,
            stream_url=url,
            content_type="text/html",
            expires_at=datetime.now(UTC) + timedelta(days=7),
            metadata={"embed": True},
        )
