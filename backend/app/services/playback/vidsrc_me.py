"""VidSrc.me playback provider.

Movie: https://vidsrc.me/embed/movie?tmdb={tmdb_id}
TV:    https://vidsrc.me/embed/tv?tmdb={tmdb_id}&season={season}&episode={episode}
"""

from datetime import UTC, datetime, timedelta
from .base import PlaybackProvider, PlaybackResult


class VidSrcMePlaybackProvider(PlaybackProvider):
    name = "vidsrc_me"

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
            url = f"https://vidsrc.me/embed/tv?tmdb={tmdb_id}&season={s}&episode={e}"
        else:
            url = f"https://vidsrc.me/embed/movie?tmdb={tmdb_id}"

        return PlaybackResult(
            provider=self.name,
            stream_url=url,
            content_type="text/html",
            expires_at=datetime.now(UTC) + timedelta(days=7),
            metadata={"embed": True},
        )
