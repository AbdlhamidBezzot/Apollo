"""Shared FastAPI dependencies: current user/profile and cookie helpers."""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, Response
from fastapi.security import APIKeyCookie
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_token
from app.db import get_db
from app.models import Profile, User

ACCESS_COOKIE = "apollo_access"
REFRESH_COOKIE = "apollo_refresh"
PROFILE_COOKIE = "apollo_profile"

cookie_scheme = APIKeyCookie(name=ACCESS_COOKIE, auto_error=False)

DbDep = Annotated[Session, Depends(get_db)]


def get_current_user(
    request: Request,
    db: DbDep,
    access_token: str | None = Depends(cookie_scheme),
) -> User:
    settings = get_settings()
    if not access_token:
        auth = request.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            access_token = auth.split(" ", 1)[1]
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        claims = decode_token(access_token, settings.token_secret, "access")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get(User, int(claims["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    request.state.user_id = user.id
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_profile(user: CurrentUser, db: DbDep, request: Request) -> Profile:
    profile_id = request.cookies.get(PROFILE_COOKIE)
    if profile_id:
        profile = db.get(Profile, int(profile_id))
        if profile and profile.user_id == user.id:
            return profile
    # Fall back to the first profile of the user.
    profile = db.query(Profile).filter(Profile.user_id == user.id).order_by(Profile.id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="No profile for this account; create one first")
    return profile


CurrentProfile = Annotated[Profile, Depends(get_current_profile)]


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    settings = get_settings()
    secure = settings.is_production
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.access_token_ttl_min * 60,
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.refresh_token_ttl_days * 86400,
        path="/api/v1/auth",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth")
    response.delete_cookie(PROFILE_COOKIE, path="/")
