"""Chatbot routes. Rate-limited tightly: LLM calls cost money per message."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.ratelimit import rate_limited
from app.core.errors import sanitize_detail
from app.db import get_db
from app.schemas import ChatRequest, ChatResponse
from app.services import chatbot
from app.services.tmdb import TMDbError

from ..deps import CurrentProfile

router = APIRouter(prefix="/chat", tags=["chat"])

DbDep = Annotated[Session, Depends(get_db)]


class AcceptRequest(BaseModel):
    tmdb_id: int
    media_type: str = "movie"


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest, profile: CurrentProfile, db: DbDep, _rl=Depends(rate_limited("chat", "20/hour"))):
    try:
        result = await chatbot.handle_message(db, profile.id, payload.message, payload.session_id)
    except TMDbError as exc:
        raise HTTPException(
            status_code=503,
            detail=sanitize_detail(exc, 503),
        )
    return ChatResponse(**result)


@router.post("/stream")
async def chat_stream(payload: ChatRequest, profile: CurrentProfile, db: DbDep, _rl=Depends(rate_limited("chat", "60/hour"))):
    async def safe_generator():
        import json as _json
        try:
            async for chunk in chatbot.handle_message_stream(db, profile.id, payload.message, payload.session_id):
                yield chunk
        except Exception as exc:
            import logging
            logging.exception("Unhandled error in chat stream: %s", exc)
            fallback = "CineBot is temporarily unavailable. Please try again shortly."
            yield f"data: {_json.dumps({'type': 'token', 'token': fallback})}\n\n"
            yield f"data: {_json.dumps({'type': 'done'})}\n\n"
    return StreamingResponse(safe_generator(), media_type="text/event-stream")


@router.post("/accept", response_model=ChatResponse)
async def accept(
    payload: AcceptRequest, profile: CurrentProfile, db: DbDep, _rl=Depends(rate_limited("play", "30/minute"))
):
    if payload.media_type not in ("movie", "tv"):
        raise HTTPException(status_code=422, detail="media_type must be movie or tv")
    result = await chatbot.accept_title(db, profile.id, payload.tmdb_id, payload.media_type)
    return ChatResponse(**result)
