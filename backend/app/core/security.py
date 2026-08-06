"""Password hashing and JWT token helpers.

Security rules honoured here:
- passwords stored hashed (bcrypt), never plaintext
- short-lived JWT access tokens + long-lived refresh tokens
- tokens carried in httpOnly, secure cookies (see api/routes/auth.py)
"""

import base64
import hashlib
import os
import time
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import bcrypt
import jwt

ALGORITHM = "HS256"

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _derived_key(secret: str) -> bytes:
    # JWT HS256 requires the key length to match the hash; derive a fixed-size
    # key from the configured secret so any secret works.
    return hashlib.sha256(secret.encode("utf-8")).digest()


def create_token(subject: str, secret: str, token_type: TokenType, ttl_minutes: int) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl_minutes)).timestamp()),
    }
    return jwt.encode(payload, _derived_key(secret), algorithm=ALGORITHM)


def decode_token(token: str, secret: str, expected_type: TokenType) -> dict[str, Any]:
    claims = jwt.decode(token, _derived_key(secret), algorithms=[ALGORITHM])
    if claims.get("type") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return claims


def generate_state_token() -> str:
    return base64.urlsafe_b64encode(os.urandom(24)).decode("ascii")


def verify_iso_expires(token: str) -> bool:
    """True while a signed token's exp is still in the future (used for email links)."""
    try:
        claims = jwt.decode(token, options={"verify_signature": False})
        return claims.get("exp", 0) > time.time()
    except jwt.DecodeError:
        return False
