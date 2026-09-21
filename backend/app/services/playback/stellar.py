"""Stellar 4K embed playback provider.

Resolves a TMDB title to an iframe embed URL served by stellar.rip.

Movie:  https://stellar.rip/en/watch/embed/movie/{tmdb_id}?theme=FF0A47&title=true&poster=true&autoPlay=true&startAt=0
TV:     https://stellar.rip/en/watch/embed/tv/{tmdb_id}-{season}-{episode}?theme=FF0A47&title=true&poster=true&autoPlay=true&startAt=0&nextButton=true&autoNext=false
"""

from datetime import UTC, datetime, timedelta

from .base import PlaybackProvider, PlaybackResult


class StellarPlaybackProvider(PlaybackProvider):
    name = "stellar"

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
            path = f"/en/watch/embed/tv/{tmdb_id}-{s}-{e}"
            query = "theme=FF0A47&title=true&poster=true&autoPlay=true&startAt=0&nextButton=true&autoNext=false"
        else:
            path = f"/en/watch/embed/movie/{tmdb_id}"
            query = "theme=FF0A47&title=true&poster=true&autoPlay=true&startAt=0"

        url = f"https://stellar.rip{path}?{query}"
        exp = datetime.now(UTC) + timedelta(days=7)
        return PlaybackResult(
            provider=self.name,
            stream_url=url,
            content_type="text/html",
            expires_at=exp,
            metadata={
                "embed": True,
                "provider_type": "stellar",
            },
        )
