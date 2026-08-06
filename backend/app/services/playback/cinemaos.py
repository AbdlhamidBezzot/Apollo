"""CinemaOS embed playback provider.

Resolves a TMDB title to an iframe embed URL served by cinemaos.tech.
The browser loads the stream inside the provider's own player; we only hand
out the embed URL.

Movie:  https://cinemaos.tech/player/{tmdb_id}
TV:     https://cinemaos.tech/player/{tmdb_id}/{season}/{episode}
"""

from datetime import UTC, datetime, timedelta

from .base import PlaybackProvider, PlaybackResult


class CinemaOSPlaybackProvider(PlaybackProvider):
    name = "cinemaos"

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
            path = f"/player/{tmdb_id}/{s}/{e}"
        else:
            path = f"/player/{tmdb_id}"
        url = f"https://cinemaos.tech{path}"
        exp = datetime.now(UTC) + timedelta(days=7)
        return PlaybackResult(
            provider=self.name,
            stream_url=url,
            content_type="text/html",
            expires_at=exp,
            metadata={"embed": True},
        )
