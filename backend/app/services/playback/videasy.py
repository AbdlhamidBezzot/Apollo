"""VIDEASY embed playback provider.

Resolves a TMDB title to an iframe embed URL served by player.videasy.net.
The browser loads the stream inside the provider's own player; we only hand
out the embed URL.

Movie:  https://player.videasy.net/movie/{tmdb_id}
TV:     https://player.videasy.net/tv/{tmdb_id}/{season}/{episode}
"""

from datetime import UTC, datetime, timedelta

from .base import PlaybackProvider, PlaybackResult


class VideasyPlaybackProvider(PlaybackProvider):
    name = "videasy"

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
            path = f"/tv/{tmdb_id}/{s}/{e}"
        else:
            path = f"/movie/{tmdb_id}"
        url = f"https://player.videasy.net{path}"
        exp = datetime.now(UTC) + timedelta(days=7)
        return PlaybackResult(
            provider=self.name,
            stream_url=url,
            content_type="text/html",
            expires_at=exp,
            metadata={"embed": True},
        )
