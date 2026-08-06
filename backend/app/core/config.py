"""Application configuration, loaded from environment variables (.env)."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    app_name: str = "Apollo API"
    secret_key: str = "change-me-to-a-long-random-string"
    jwt_secret: str = ""
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    database_url: str = "postgresql+psycopg://apollo:YPoDBI5XWDQTG3QHhIcb3Y7f@localhost:5432/apollo"
    redis_url: str = "redis://localhost:6379/0"

    tmdb_api_key: str = ""
    tmdb_api_read_access_token: str = ""
    tmdb_api_base_url: str = "https://api.themoviedb.org/3"

    playback_provider: str = "vidsrc"

    google_client_id: str = ""
    google_client_secret: str = ""
    oauth_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"

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

    @property
    def active_llm_key(self) -> str:
        return self.llm_api_key or self.gemini_api_key or self.deepseek_api_key

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
