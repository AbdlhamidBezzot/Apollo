"""Application configuration, loaded from environment variables (.env)."""

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def coerce_postgres_dialect(url: str) -> str:
    """Return a psycopg v3 (postgresql+psycopg://) URL from any common form.

    Providers often hand back `postgres://` or `postgresql://` (no dialect),
    which SQLAlchemy maps to psycopg2. This rewrites those to psycopg 3 and
    also migrates any explicit legacy `+psycopg2` dialect.
    """
    for prefix in ("postgresql+psycopg2://", "postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    app_name: str = "Apollo API"
    secret_key: str = "change-me-to-a-long-random-string"
    jwt_secret: str = ""

    # Comma-separated list of browser origins allowed to call the API.
    # Dev builds run on localhost:3000 / localhost:5173; Vercel production is
    # baked in so the API works online even before you set the variable.
    cors_origins: str = (
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,"
        "https://apollo-94zv.vercel.app"
    )

    # Absolute frontend URL the API redirects to (e.g. Google OAuth callback).
    frontend_url: str = ""

    database_url: str = "sqlite:///./apollo.db"
    redis_url: str = "redis://localhost:6379/0"

    tmdb_api_key: str = ""
    tmdb_api_read_access_token: str = ""
    tmdb_api_base_url: str = "https://api.themoviedb.org/3"

    playback_provider: str = "vidsrc"

    google_client_id: str = ""
    google_client_secret: str = ""
    oauth_redirect_uri: str = ""

    # Development (same-origin localhost) uses Lax. In production the Vercel
    # frontend and Render API are cross-site, so cookies are always SameSite=None
    # + Secure (forced in cookie_samesite_used). This value affects dev only.
    cookie_samesite: str = "lax"

    access_token_minutes: int = 15
    refresh_token_days: int = 30
    jwt_access_token_expires_min: int | None = None
    jwt_refresh_token_expires_days: int | None = None

    rate_limit_login: str = "5/15minute"
    rate_limit_general: str = "120/minute"
    rate_limit_chat: str = "20/hour"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    llm_provider: str = "gemini"
    llm_api_key: str = ""

    @model_validator(mode="after")
    def _validate_no_wildcard_cors(self) -> "Settings":
        origins = {o.strip() for o in (self.cors_origins or "").split(",") if o.strip()}
        if "*" in origins:
            raise ValueError(
                "CORS_ORIGINS must not contain '*' because the API serves credentials "
                "(allow_credentials=True). List explicit origins instead."
            )
        return self

    @model_validator(mode="after")
    def _coerce_postgres_dialect(self) -> "Settings":
        """Force every Postgres URL onto psycopg v3.

        PaaS providers (Render/Railway) inject connection strings like
        `postgresql://user:pass@host/db` with no dialect suffix. SQLAlchemy 2.x
        maps a bare `postgresql://` to psycopg2 (not installed here), so we
        normalize to `postgresql+psycopg://` (the official psycopg 3 dialect).
        Also rewrites any legacy `+psycopg2` URL a user may paste in.
        """
        self.database_url = coerce_postgres_dialect(self.database_url)
        return self

    @property
    def active_llm_key(self) -> str:
        return self.llm_api_key or self.gemini_api_key or self.deepseek_api_key

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def frontend_origin(self) -> str:
        """Base URL to redirect OAuth callbacks back to."""
        if self.frontend_url:
            return self.frontend_url.rstrip("/")
        if self.cors_origin_list:
            return self.cors_origin_list[0]
        return "http://localhost:3000"

    @property
    def token_secret(self) -> str:
        return self.jwt_secret or self.secret_key

    @property
    def access_token_ttl_min(self) -> int:
        return self.jwt_access_token_expires_min or self.access_token_minutes

    @property
    def refresh_token_ttl_days(self) -> int:
        return self.jwt_refresh_token_expires_days or self.refresh_token_days

    @property
    def is_test(self) -> bool:
        return self.app_env == "test"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cookie_samesite_used(self) -> str:
        if self.is_production:
            # Cross-origin deployment (Vercel frontend + Render API): the browser
            # must send these cookies on cross-site fetch()/XHR calls. SameSite=Lax
            # is silently omitted on cross-origin XHR, which 401s /auth/me and
            # /auth/refresh. NONE is required (and Safe with Secure=True below).
            return "none"
        return self.cookie_samesite

    def ensure_production_ready(self) -> None:
        """Fail fast on insecure defaults so prod can never ship broken/leaky."""
        if not self.is_production:
            return
        if self.secret_key == "change-me-to-a-long-random-string" and not self.jwt_secret:
            raise RuntimeError(
                "Production requires SECRET_KEY (or JWT_SECRET) to be set to a strong random value."
            )
        if self.database_url.startswith("sqlite"):
            raise RuntimeError(
                "Production DATABASE_URL must be PostgreSQL, not sqlite. Set DATABASE_URL."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()