"""Football Live Stream API client.

Integrates RapidAPI Football Live Stream API (football-live-streaming-api.p.rapidapi.com).
Caches match listings to prevent quota exhaustion and provides graceful fallback mock data
when an API key is not yet configured.
"""

import json
import logging
import time
from typing import Any
import httpx

from app.core.cache import get_cache
from app.core.config import get_settings

logger = logging.getLogger("app.football")
FOOTBALL_CACHE_TTL = 60  # Cache matches for 60 seconds


class FootballAPIError(Exception):
    pass


def _auth_headers() -> dict[str, str]:
    settings = get_settings()
    key = settings.rapidapi_football_key.strip()
    if not key:
        return {}
    return {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": settings.rapidapi_football_host,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }


def _get_mock_matches(status: str | None = None, page: int = 1) -> dict[str, Any]:
    """Fallback sample match data for preview/testing when key is missing or API unreachable."""
    all_matches = [
        {
            "match_id": "demo-1",
            "match_time": str(int(time.time())),
            "match_status": "live",
            "league_name": "Premier League",
            "home_team_name": "Arsenal",
            "home_team_logo": "https://media.api-sports.io/football/teams/42.png",
            "homeTeamScore": "2",
            "away_team_name": "Manchester City",
            "away_team_logo": "https://media.api-sports.io/football/teams/50.png",
            "awayTeamScore": "1",
            "servers": [
                {
                    "name": "Server 1 (Demo HLS Stream)",
                    "url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                    "type": "direct",
                    "header": {},
                },
                {
                    "name": "Server 2 (Backup Stream)",
                    "url": "https://playertest.longtailvideo.com/adaptive/oceans/oceans.m3u8",
                    "type": "direct",
                    "header": {},
                },
            ],
        },
        {
            "match_id": "demo-2",
            "match_time": str(int(time.time()) + 1800),
            "match_status": "live",
            "league_name": "La Liga",
            "home_team_name": "Real Madrid",
            "home_team_logo": "https://media.api-sports.io/football/teams/541.png",
            "homeTeamScore": "0",
            "away_team_name": "Barcelona",
            "away_team_logo": "https://media.api-sports.io/football/teams/529.png",
            "awayTeamScore": "0",
            "servers": [
                {
                    "name": "Server 1 (Direct)",
                    "url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                    "type": "direct",
                    "header": {},
                }
            ],
        },
        {
            "match_id": "demo-3",
            "match_time": str(int(time.time()) + 7200),
            "match_status": "vs",
            "league_name": "UEFA Champions League",
            "home_team_name": "Bayern Munich",
            "home_team_logo": "https://media.api-sports.io/football/teams/157.png",
            "homeTeamScore": "-",
            "away_team_name": "Paris Saint-Germain",
            "away_team_logo": "https://media.api-sports.io/football/teams/85.png",
            "awayTeamScore": "-",
            "servers": [
                {
                    "name": "Server 1 (Scheduled)",
                    "url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                    "type": "direct",
                    "header": {},
                }
            ],
        },
    ]

    filtered = all_matches
    if status:
        filtered = [m for m in all_matches if m.get("match_status") == status]

    return {
        "matches": filtered,
        "pagination": {"page": page, "hasNext": False},
        "is_demo": True,
    }


class FootballService:
    @staticmethod
    async def get_matches(
        page: int = 1, date: str | None = None, status: str | None = None
    ) -> dict[str, Any]:
        settings = get_settings()
        key = settings.rapidapi_football_key.strip()
        headers = _auth_headers()

        if not key:
            logger.info("RAPIDAPI_FOOTBALL_KEY is missing. Returning demo/fallback matches.")
            return _get_mock_matches(status=status, page=page)

        # Check Cache
        cache = get_cache()
        cache_key = f"football:matches:p{page}:d{date or 'none'}:s{status or 'all'}"
        cached_data = cache.get(cache_key)
        if cached_data:
            try:
                return json.loads(cached_data)
            except (ValueError, TypeError):
                pass

        params: dict[str, Any] = {"page": page}
        if date:
            params["date"] = date
        if status:
            params["status"] = status

        url = f"{settings.rapidapi_football_base_url.rstrip('/')}/matches"

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.get(url, params=params, headers=headers)
                if resp.status_code == 401 or resp.status_code == 403:
                    logger.warning(
                        "RapidAPI key rejected (%d). Returning demo matches.", resp.status_code
                    )
                    return _get_mock_matches(status=status, page=page)

                resp.raise_for_status()
                data = resp.json()

                if "matches" not in data or not isinstance(data.get("matches"), list):
                    data = {"matches": data.get("matches", []), "pagination": data.get("pagination", {"page": page, "hasNext": False})}

                data["is_demo"] = False

                # Cache successful response
                try:
                    cache.set(cache_key, json.dumps(data), FOOTBALL_CACHE_TTL)
                except Exception:
                    pass

                return data
        except httpx.HTTPError as exc:
            logger.error("Error fetching football matches from RapidAPI: %s", str(exc))
            # Fallback to mock on network error so UI remains usable
            demo = _get_mock_matches(status=status, page=page)
            demo["error_note"] = f"Unable to reach RapidAPI upstream ({exc}). Showing sample matches."
            return demo


football_service = FootballService()
