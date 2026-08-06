"""Movie Night sync rooms: REST (create/inspect) + WebSocket (state + chat relay).

Rooms are invite-code based. Anyone with the code can join the WebSocket to
watch in sync and chat; the host controls playback and state changes are
relayed to everyone else.
"""

import uuid

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.schemas import MovieNightRoomCreate, MovieNightRoomOut
from app.services.movie_night import movie_night

from ..deps import CurrentProfile

router = APIRouter(prefix="/movie-night", tags=["movie-night"])


@router.post("/rooms", response_model=MovieNightRoomOut, status_code=201)
async def create_room(payload: MovieNightRoomCreate, profile: CurrentProfile):
    host = profile.display_name or "Guest"
    room = await movie_night.create(
        host=host,
        tmdb_id=payload.tmdb_id,
        media_type=payload.media_type,
        season=payload.season,
        episode=payload.episode,
    )
    return MovieNightRoomOut(
        code=room.code,
        tmdb_id=room.tmdb_id,
        media_type=room.media_type,
        season=room.season,
        episode=room.episode,
        members=room.members,
        host=room.host,
    )


@router.get("/rooms/{code}", response_model=MovieNightRoomOut)
async def get_room(code: str):
    info = movie_night.info(code.upper())
    if info is None:
        raise HTTPException(status_code=404, detail="Room not found or expired")
    return MovieNightRoomOut(**info)


ws_router = APIRouter()


@ws_router.websocket("/ws/movie-night/{code}")
async def movie_night_ws(websocket: WebSocket, code: str):
    room_code = code.upper()
    conn_id = uuid.uuid4().hex
    room = await movie_night.connect(room_code, conn_id, websocket)
    if room is None:
        await websocket.close(code=4404)
        return

    await websocket.accept()
    await websocket.send_json(
        {
            "type": "hello",
            "code": room.code,
            "host": room.host,
            "members": room.members,
            "play_target": {
                "tmdb_id": room.tmdb_id,
                "media_type": room.media_type,
                "season": room.season,
                "episode": room.episode,
            },
            "state": room.last_state,
        }
    )
    await movie_night.broadcast(room_code, {"type": "join", "members": room.members}, exclude=conn_id)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type == "state":
                room.last_state = data.get("payload", {})
                await movie_night.broadcast(room_code, {"type": "state", "payload": room.last_state}, exclude=conn_id)
            elif msg_type == "chat":
                text = str(data.get("payload", {}).get("text", ""))[:500]
                if text.strip():
                    payload = {"sender": data.get("payload", {}).get("sender", "Guest"), "text": text}
                    await movie_night.broadcast(
                        room_code,
                        {"type": "chat", "payload": payload},
                        exclude=conn_id,
                    )
            elif msg_type == "leave":
                break
    except WebSocketDisconnect:
        pass
    finally:
        await movie_night.disconnect(room_code, conn_id)
        remaining = movie_night.info(room_code)
        if remaining:
            await movie_night.broadcast(room_code, {"type": "leave", "members": remaining["members"]})
