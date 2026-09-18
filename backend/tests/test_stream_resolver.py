import pytest
from unittest.mock import AsyncMock, patch
from app.services.ssrf_guard import safe_http_get, SSRFValidationError, DEFAULT_HEADERS, FALLBACK_HEADERS
from app.services.stream_resolver import fetch_addon_streams, fetch_addon_subtitles
from app.models import AddonCatalog


@pytest.mark.asyncio
async def test_safe_http_get_retry_fallback_on_403():
    mock_resp_403 = AsyncMock()
    mock_resp_403.status_code = 403

    mock_resp_200 = AsyncMock()
    mock_resp_200.status_code = 200
    mock_resp_200.headers = {}
    mock_resp_200.content = b'{"streams": []}'

    with patch("httpx.AsyncClient.get", side_effect=[mock_resp_403, mock_resp_200]) as mock_get:
        res = await safe_http_get("https://example.com/manifest.json")
        assert res == b'{"streams": []}'
        assert mock_get.call_count == 2
        # First call used DEFAULT_HEADERS
        assert mock_get.call_args_list[0].kwargs["headers"]["User-Agent"] == DEFAULT_HEADERS["User-Agent"]
        # Second call used FALLBACK_HEADERS
        assert mock_get.call_args_list[1].kwargs["headers"]["User-Agent"] == FALLBACK_HEADERS["User-Agent"]


@pytest.mark.asyncio
async def test_fetch_addon_streams_mirror_fallback():
    addon = AddonCatalog(
        addon_id="com.stremio.torrentio",
        name="Torrentio Lite",
        manifest_url="https://torrentio.strem.fun/lite/manifest.json",
    )

    mock_resp_empty = b'{"streams": []}'
    mock_resp_valid = b'{"streams": [{"title": "Stream 1", "infoHash": "abc12345"}]}'

    with patch("app.services.stream_resolver.safe_http_get", side_effect=[mock_resp_empty, mock_resp_valid]) as mock_fetch:
        streams = await fetch_addon_streams(addon, "series", "tt3032476:2:7")
        assert len(streams) == 1
        assert streams[0]["title"] == "Stream 1"
        assert mock_fetch.call_count == 2
