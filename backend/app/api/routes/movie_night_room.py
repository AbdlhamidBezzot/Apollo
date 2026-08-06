"""Movie Night Room (group pick-together) routes (spec §6).

REST endpoints for create / join / preferences / live status / suggest / decide.
Rooms are DB-backed and distinct from the in-memory WebSocket sync rooms.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.ratelimit import rate_limited
from app.db import get_db
from app.schemas import (
    MovieNightDecideRequest,
    MovieNightDecideResponse,
    MovieNightJoinRequest,
    MovieNightJoinResponse,
    MovieNightRoomDetail,
    MovieNightSuggestResponse,
    RoomPreferenceUpdate,
)
from app.services import movie_night_room as svc
from app.services.movie_night_room import MovieNightRoomError

from ..deps import CurrentProfile

router = APIRouter(prefix="/movie-night-room", tags=["movie-night-room"])

DbDep = Annotated[Session, Depends(get_db)]


class RoomCreateResponse(BaseModel):
    code: str
    status: str
    token: str
    is_host: bool = True


@router.post("", response_model=RoomCreateResponse, status_code=201)
async def create_room(
    profile: CurrentProfile, db: DbDep, _rl=Depends(rate_limited("me", "120/minute"))
):
    room = svc.create_room(db, profile)
    host = svc._host_participant(db, room)
    return RoomCreateResponse(code=room.room_code, status=room.status, token=host.token)


@router.get("/{code}", response_model=MovieNightRoomDetail)
async def room_status(code: str, db: DbDep, _rl=Depends(rate_limited("me", "120/minute"))):
    try:
        room = svc.get_room(db, code)
        return svc._detail(db, room)
    except MovieNightRoomError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{code}/join", response_model=MovieNightJoinResponse)
async def join_room(
    code: str,
    payload: MovieNightJoinRequest,
    db: DbDep,
    _rl=Depends(rate_limited("me", "120/minute")),
):
    try:
        detail, token, is_host = svc.join_room(db, code, profile=None, guest_name=payload.guest_name)
        return MovieNightJoinResponse(room=detail, token=token, is_host=is_host)
    except MovieNightRoomError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{code}/join/account", response_model=MovieNightJoinResponse)
async def join_room_with_account(
    code: str, profile: CurrentProfile, db: DbDep, _rl=Depends(rate_limited("me", "120/minute"))
):
    try:
        detail, token, is_host = svc.join_room(db, code, profile=profile)
        return MovieNightJoinResponse(room=detail, token=token, is_host=is_host)
    except MovieNightRoomError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/{code}/preferences", response_model=MovieNightRoomDetail)
async def set_preferences(
    code: str,
    payload: RoomPreferenceUpdate,
    token: str,
    db: DbDep,
    _rl=Depends(rate_limited("me", "120/minute")),
):
    try:
        return svc.update_preferences(
            db,
            code,
            token,
            payload.model_dump(exclude_unset=True),
        )
    except MovieNightRoomError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{code}/leave")
async def leave_room(
    code: str,
    token: str,
    db: DbDep,
    _rl=Depends(rate_limited("me", "120/minute")),
):
    try:
        return svc.leave_room(db, code, token)
    except MovieNightRoomError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{code}/suggest", response_model=MovieNightSuggestResponse)
async def suggest(
    code: str,
    token: str,
    db: DbDep,
    _rl=Depends(rate_limited("chat", "20/hour")),
):
    try:
        reply, titles = await svc.suggest_pick(db, code)
        return MovieNightSuggestResponse(reply=reply, suggested_titles=[t.model_dump() for t in titles])
    except MovieNightRoomError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{code}/decide", response_model=MovieNightDecideResponse)
async def decide(
    code: str,
    payload: MovieNightDecideRequest,
    token: str,
    db: DbDep,
    _rl=Depends(rate_limited("play", "30/minute")),
):
    try:
        result = await svc.decide_async(db, code, token, payload.tmdb_id, payload.media_type)
        return MovieNightDecideResponse(**result)
    except MovieNightRoomError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
