from uuid import UUID

from pydantic_settings import BaseSettings
from functools import lru_cache

# Default org_id for single-tenant mode (Phase 1-3).
# Will be replaced by real org_id from JWT payload in Phase 4 (multi-tenant).
DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/sss_corp_erp"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-this-to-a-random-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    # App
    ENVIRONMENT: str = "development"
    APP_NAME: str = "SSS Corp ERP"
    APP_VERSION: str = "1.0.0"

    # Sentry (monitoring — optional)
    SENTRY_DSN: str = ""

    # Email (Phase 4.6 — disabled by default)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@sss-corp.com"
    EMAIL_ENABLED: bool = False
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
