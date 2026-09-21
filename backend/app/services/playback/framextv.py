"""frameXTV embed playback provider.

Resolves a TMDB title to an iframe embed URL served by framextv.tech with server extraction support.

Movie:  https://framextv.tech/embed/{tmdb_id}?autoplay=1&muted=0&server={server}
TV:     https://framextv.tech/embed/{tmdb_id}/{season}/{episode}?autoplay=1&muted=0&server={server}

Extraction Servers:
- P.E.K.K.A IV (pekka): High bitrate 1080p uncompressed stream server (DEFAULT).
- Barbarian I (barbarian): Built-in multi-language subtitles & ultra-fast HLS stream decryption.
- Archer II (archer): Multi-audio tracks & 4K Ultra HD playback support.
- Goblin III (goblin): Fast automatic stream extraction mirror for popular titles.
"""

from datetime import UTC, datetime, timedelta

from .base import PlaybackProvider, PlaybackResult


class BaseFrameXTVProvider(PlaybackProvider):
    server_id: str = "pekka"

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
            path = f"/embed/{tmdb_id}/{s}/{e}"
        else:
            path = f"/embed/{tmdb_id}"

        url = f"https://framextv.tech{path}?autoplay=1&muted=0&server={self.server_id}"
        exp = datetime.now(UTC) + timedelta(days=7)
        return PlaybackResult(
            provider=self.name,
            stream_url=url,
            content_type="text/html",
            expires_at=exp,
            metadata={
                "embed": True,
                "server": self.server_id,
                "provider_type": "framextv",
            },
        )


class PekkaPlaybackProvider(BaseFrameXTVProvider):
    """P.E.K.K.A IV - High bitrate 1080p uncompressed stream server (Default)."""
    name = "pekka"
    server_id = "pekka"


class BarbarianPlaybackProvider(BaseFrameXTVProvider):
    """Barbarian I - Built-in multi-language subtitles & ultra-fast HLS stream decryption."""
    name = "barbarian"
    server_id = "barbarian"


class ArcherPlaybackProvider(BaseFrameXTVProvider):
    """Archer II - Multi-audio tracks & 4K Ultra HD playback support."""
    name = "archer"
    server_id = "archer"


class GoblinPlaybackProvider(BaseFrameXTVProvider):
    """Goblin III - Fast automatic stream extraction mirror for popular titles."""
    name = "goblin"
    server_id = "goblin"


class FrameXTVPlaybackProvider(BaseFrameXTVProvider):
    """Generic frameXTV provider using P.E.K.K.A IV server as default."""
    name = "framextv"
    server_id = "pekka"
