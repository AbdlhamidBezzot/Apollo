"""In-memory Movie Night sync rooms.

Rooms are ephemeral: created by a logged-in user, joinable by anyone with the
6-char invite code, and dropped when the last member leaves. State sync
(play/pause/seek/chat) is relayed over WebSockets by the route handler.
"""

import asyncio
import secrets
import string
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

_CODE_ALPHABET = string.ascii_uppercase + string.digits


@dataclass
class MovieNightRoom:
    code: str
    host: str
    tmdb_id: int | None = None
    media_type: str | None = None
    season: int | None = None
    episode: int | None = None
    connections: dict[str, WebSocket] = field(default_factory=dict)
    last_state: dict[str, Any] = field(default_factory=dict)

    @property
    def members(self) -> int:
        return len(self.connections)


class MovieNightManager:
    def __init__(self) -> None:
        self._rooms: dict[str, MovieNightRoom] = {}
        self._lock = asyncio.Lock()

    async def create(
        self,
        host: str,
        tmdb_id: int | None = None,
        media_type: str | None = None,
        season: int | None = None,
        episode: int | None = None,
    ) -> MovieNightRoom:
        async with self._lock:
            code = self._new_code()
            room = MovieNightRoom(
                code=code,
                host=host,
                tmdb_id=tmdb_id,
                media_type=media_type,
                season=season,
                episode=episode,
            )
            self._rooms[code] = room
            return room

    def _new_code(self) -> str:
        while True:
            code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
            if code not in self._rooms:
                return code

    def get(self, code: str) -> MovieNightRoom | None:
        return self._rooms.get(code)

    async def connect(self, code: str, conn_id: str, ws: WebSocket) -> MovieNightRoom | None:
        room = self._rooms.get(code)
        if room is None:
            return None
        room.connections[conn_id] = ws
        return room

    async def disconnect(self, code: str, conn_id: str) -> None:
        room = self._rooms.get(code)
        if room is None:
            return
        room.connections.pop(conn_id, None)
        if not room.connections:
            async with self._lock:
                if room.connections:
                    return
                self._rooms.pop(code, None)

    async def broadcast(self, code: str, message: dict[str, Any], exclude: str | None = None) -> None:
        room = self._rooms.get(code)
        if room is None:
            return
        for cid, ws in list(room.connections.items()):
            if cid == exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                room.connections.pop(cid, None)

    def info(self, code: str) -> dict[str, Any] | None:
        room = self._rooms.get(code)
        if room is None:
            return None
        return {
            "code": room.code,
            "host": room.host,
            "tmdb_id": room.tmdb_id,
            "media_type": room.media_type,
            "season": room.season,
            "episode": room.episode,
            "members": room.members,
        }


movie_night = MovieNightManager()
