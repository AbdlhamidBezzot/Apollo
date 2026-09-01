"""Football live streaming routes."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
import httpx

from app.core.config import get_settings
from app.core.ratelimit import rate_limited
from app.services.football import FootballAPIError, football_service

router = APIRouter(prefix="/football", tags=["football"])
settings = get_settings()

_rl_football = rate_limited("football:matches", settings.rate_limit_football)
logger = logging.getLogger("app.football.routes")


@router.get("/matches")
async def list_matches(
    page: int = 1,
    date: str | None = Query(default=None, pattern=r"^\d{8}$|^$", description="Date in DDMMYYYY format"),
    status: str | None = Query(default=None, description="live or vs"),
    _rl=Depends(_rl_football),
):
    """Fetch paginated live or scheduled football matches."""
    try:
        data = await football_service.get_matches(page=page, date=date, status=status)
        return data
    except FootballAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        logger.error("Unexpected error in list_matches: %s", str(exc))
        raise HTTPException(status_code=500, detail="Internal server error fetching matches")


@router.get("/proxy")
async def stream_proxy(
    url: str = Query(..., description="Target stream URL"),
    referer: str | None = Query(default=None, description="Referer header"),
    user_agent: str | None = Query(default=None, description="User-Agent header"),
    _rl=Depends(_rl_football),
):
    """Proxy stream segments with custom Referer/User-Agent headers for referer-restricted streams."""
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid stream URL scheme")

    headers = {}
    if referer:
        headers["Referer"] = referer
    if user_agent:
        headers["User-Agent"] = user_agent
    else:
        headers[
            "User-Agent"
        ] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    async def generate_stream():
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
                async with client.stream("GET", url, headers=headers) as resp:
                    async for chunk in resp.aiter_bytes():
                        yield chunk
        except Exception as exc:
            logger.error("Stream proxy error for URL %s: %s", url, str(exc))

    # Basic content type detection
    media_type = "application/x-mpegURL" if ".m3u8" in url.lower() else "video/MP2T"

    return StreamingResponse(generate_stream(), media_type=media_type)
