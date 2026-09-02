"""API router aggregation."""

from fastapi import APIRouter

from .routes import auth, chatbot, contact, content, football, me, movie_night, movie_night_room, playback

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(content.router)
api_router.include_router(football.router)
api_router.include_router(me.router)
api_router.include_router(chatbot.router)
api_router.include_router(playback.router)
api_router.include_router(movie_night.router)
api_router.include_router(movie_night.ws_router)
api_router.include_router(movie_night_room.router)
api_router.include_router(contact.router)
