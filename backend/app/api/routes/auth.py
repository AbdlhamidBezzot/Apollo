"""Authentication routes: register, login, logout, refresh, account.

Tokens are JWTs in httpOnly cookies (not localStorage).
"""

from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import UserFacingError
from app.core.ratelimit import rate_limited
from app.core.security import create_token, decode_token, hash_password, verify_password
from app.db import get_db
from app.models import Profile, User
from app.schemas import LoginRequest, RegisterRequest, TokenPair, UserOut

from ..deps import REFRESH_COOKIE, CurrentUser, clear_auth_cookies, set_auth_cookies

router = APIRouter(prefix="/auth", tags=["auth"])

_settings = get_settings()
DbDep = Annotated[Session, Depends(get_db)]
_rl_register = rate_limited("auth", _settings.rate_limit_register)
_rl_login = rate_limited("login", _settings.rate_limit_login)
_rl_refresh = rate_limited("refresh", _settings.rate_limit_refresh)


@router.post("/register", response_model=TokenPair, status_code=201)
async def register(
    payload: RegisterRequest, db: DbDep, response: Response, _rl=Depends(_rl_register)
):
    settings = get_settings()
    if db.query(User).filter(User.email == payload.email).first():
        raise UserFacingError(status_code=409, detail="An account with this email already exists. Please sign in.")

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        auth_provider="email",
        email_verified=True,  # no email verification flow in this build
    )
    db.add(user)
    db.flush()
    # Every account starts with one default profile.
    db.add(Profile(user_id=user.id, display_name=payload.name))
    db.commit()

    access = create_token(str(user.id), settings.token_secret, "access", settings.access_token_ttl_min)
    refresh = create_token(str(user.id), settings.token_secret, "refresh", settings.refresh_token_ttl_days * 24 * 60)
    set_auth_cookies(response, access, refresh)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, db: DbDep, response: Response, _rl=Depends(_rl_login)):
    settings = get_settings()
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None:
        raise UserFacingError(status_code=404, detail="No account exists with this email. Please create an account.")
    if user.password_hash is None or not verify_password(payload.password, user.password_hash):
        raise UserFacingError(status_code=401, detail="Incorrect password. Please try again.")
    access = create_token(str(user.id), settings.token_secret, "access", settings.access_token_ttl_min)
    refresh = create_token(str(user.id), settings.token_secret, "refresh", settings.refresh_token_ttl_days * 24 * 60)
    set_auth_cookies(response, access, refresh)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
async def refresh(request: Request, db: DbDep, response: Response, _rl=Depends(_rl_refresh)):
    settings = get_settings()
    # Accept refresh token from cookie first (browser same-origin), then header (cross-origin dev / mobile).
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        claims = decode_token(token, settings.token_secret, "refresh")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = db.get(User, int(claims["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_token(str(user.id), settings.token_secret, "access", settings.access_token_ttl_min)
    refresh = create_token(str(user.id), settings.token_secret, "refresh", settings.refresh_token_ttl_days * 24 * 60)
    set_auth_cookies(response, access, refresh)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/logout", status_code=204)
async def logout(response: Response):
    clear_auth_cookies(response)
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user


@router.delete("/account", status_code=204)
async def delete_account(user: CurrentUser, db: DbDep, response: Response):
    """Permanently delete the current account and all of its data."""
    db.delete(user)
    db.commit()
    clear_auth_cookies(response)
    response.status_code = 204
    return response
