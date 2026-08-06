"""vidsrc-embed.ru embed playback provider.

Resolves a TMDB title to an iframe embed URL served by vidsrc-embed.ru.
The browser loads the stream inside the provider's own player; we only hand out
the embed URL.

Movie:  https://vidsrc-embed.ru/embed/movie/{tmdb_id}
TV:     https://vidsrc-embed.ru/embed/tv/{tmdb_id}/{season}-{episode}
"""

from datetime import UTC, datetime, timedelta

from .base import PlaybackProvider, PlaybackResult


class VidsrcPlaybackProvider(PlaybackProvider):
    name = "vidsrc"

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
            path = f"/embed/tv/{tmdb_id}/{s}-{e}"
        else:
            path = f"/embed/movie/{tmdb_id}"
        url = f"https://vidsrc-embed.ru{path}"
        exp = datetime.now(UTC) + timedelta(days=7)
        return PlaybackResult(
            provider=self.name,
            stream_url=url,
            content_type="text/html",
            expires_at=exp,
            metadata={"embed": True},
        )
