"""Authentication routes: register, login, logout, refresh, Google OAuth.

Tokens are JWTs in httpOnly cookies (not localStorage). Google OAuth exchanges
the code for a token, finds-or-creates the user, sets cookies and redirects
back to the frontend. Requires GOOGLE_CLIENT_ID/SECRET in .env.
"""

from typing import Annotated
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.ratelimit import rate_limited, rate_limited_identity
from app.core.security import create_token, decode_token, generate_state_token, hash_password, verify_password
from app.db import get_db
from app.models import Profile, User
from app.schemas import LoginRequest, RegisterRequest, TokenPair, UserOut

from ..deps import (
    OAUTH_STATE_COOKIE,
    REFRESH_COOKIE,
    CurrentUser,
    clear_auth_cookies,
    clear_oauth_state_cookie,
    set_auth_cookies,
    set_oauth_state_cookie,
)

router = APIRouter(prefix="/auth", tags=["auth"])

DbDep = Annotated[Session, Depends(get_db)]

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"


def _oauth_state_cookie_samesite(settings) -> tuple[bool, str]:
    """Return (secure, samesite) for the OAuth state cookie.

    In production the Vercel frontend and Render API are different origins, so
    the state cookie must be SameSite=None + Secure to be stored and returned
    across a cross-site callback. Development runs same-origin on localhost.
    """
    if settings.is_production:
        return True, "none"
    return False, settings.cookie_samesite_used


@router.post("/register", response_model=TokenPair, status_code=201)
async def register(
    payload: RegisterRequest, db: DbDep, response: Response, _rl=Depends(rate_limited("auth", "10/hour"))
):
    settings = get_settings()
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

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
async def login(payload: LoginRequest, db: DbDep, response: Response, _rl=Depends(rate_limited("login", "5/15minute"))):
    settings = get_settings()
    user = db.query(User).filter(User.email == payload.email).first()
    if user is not None and user.password_hash is None and user.auth_provider == "google":
        raise HTTPException(
            status_code=403,
            detail="google_account",
        )
    if user is None or user.password_hash is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_token(str(user.id), settings.token_secret, "access", settings.access_token_ttl_min)
    refresh = create_token(str(user.id), settings.token_secret, "refresh", settings.refresh_token_ttl_days * 24 * 60)
    set_auth_cookies(response, access, refresh)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
async def refresh(request: Request, db: DbDep, response: Response, _rl=Depends(rate_limited("auth", "30/minute"))):
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


@router.get("/google/authorize")
async def google_authorize():
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")
    state = generate_state_token()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.oauth_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
    }
    secure, samesite = _oauth_state_cookie_samesite(settings)
    # A 302 redirect instead of a JSON body: the browser performs one top-level
    # navigation that sets the state cookie and then lands on Google — no
    # cross-origin fetch() and no manual window.location on the frontend.
    redirect = RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{urlencode(params)}", status_code=302)
    set_oauth_state_cookie(redirect, state, secure=secure, samesite=samesite)
    return redirect


@router.get("/google/callback")
async def google_callback(
    request: Request,
    response: Response,
    db: DbDep,
    code: str | None = None,
    error: str | None = None,
    state: str | None = None,
):
    settings = get_settings()
    if error or not code:
        raise HTTPException(status_code=400, detail=f"OAuth failed: {error or 'no code'}")
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")
    expected_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not state or not expected_state or state != expected_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": settings.oauth_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_resp.raise_for_status()
            token_data = token_resp.json()

            userinfo_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
            userinfo_resp.raise_for_status()
            info = userinfo_resp.json()
    except (httpx.HTTPError, KeyError) as exc:
        raise HTTPException(status_code=502, detail=f"Google token exchange failed: {exc}")

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            email=email,
            name=info.get("name") or email.split("@")[0],
            password_hash=None,
            auth_provider="google",
            email_verified=bool(info.get("email_verified")),
        )
        db.add(user)
        db.flush()
        db.add(Profile(user_id=user.id, display_name=info.get("name") or email.split("@")[0]))
        db.commit()
    else:
        # Upgrade: a user who signed up by email can now use Google to sign in.
        user.email_verified = True
        db.commit()

    access = create_token(str(user.id), settings.token_secret, "access", settings.access_token_ttl_min)
    refresh = create_token(str(user.id), settings.token_secret, "refresh", settings.refresh_token_ttl_days * 24 * 60)
    set_auth_cookies(response, access, refresh)
    clear_oauth_state_cookie(response)
    # Redirect back to the frontend. Return the SAME injected response so the
    # auth cookies survive; returning a fresh Response() here would drop them.
    response.status_code = 303
    response.headers["Location"] = settings.frontend_origin
    return response
