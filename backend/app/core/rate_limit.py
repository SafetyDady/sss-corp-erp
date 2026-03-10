"""
SSS Corp ERP — Rate Limiter
Phase 13.6: Per-user rate limiting with Redis backend

Dynamic rate limits are read from OrgSecurityConfig:
  - api_rate_limit_login: per-minute limit on /login (default 5)
  - api_rate_limit_per_minute: general API limit (default 120)
"""

import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Use Redis backend for rate limiting (production-ready).
# Falls back to in-memory if Redis is unavailable.
_storage_uri = None
try:
    if settings.REDIS_URL:
        _storage_uri = settings.REDIS_URL
        logger.info("Rate limiter using Redis: %s", settings.REDIS_URL)
except Exception:
    logger.warning("Redis URL not configured, using in-memory rate limiter")

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_storage_uri,
    default_limits=[],
)

# ============================================================
# DYNAMIC RATE LIMIT CACHE
# ============================================================
# Cached org security config values — refreshed every 5 minutes
# to avoid hitting DB on every request.

_rate_limit_cache: dict = {
    "login": 5,         # default from OrgSecurityConfig
    "api": 120,         # default from OrgSecurityConfig
    "last_refresh": 0,  # epoch timestamp
}

async def _refresh_rate_limits() -> None:
    """Refresh rate limit values from DB (non-blocking, fire-and-forget)."""
    import time
    now = time.time()
    # Only refresh every 5 minutes
    if now - _rate_limit_cache["last_refresh"] < 300:
        return
    try:
        from app.core.database import AsyncSessionLocal
        from app.core.config import DEFAULT_ORG_ID
        from app.models.security import OrgSecurityConfig
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(OrgSecurityConfig).where(OrgSecurityConfig.org_id == DEFAULT_ORG_ID)
            )
            config = result.scalar_one_or_none()
            if config:
                _rate_limit_cache["login"] = config.api_rate_limit_login
                _rate_limit_cache["api"] = config.api_rate_limit_per_minute
                _rate_limit_cache["last_refresh"] = now
                logger.debug(
                    "Rate limits refreshed: login=%d/min, api=%d/min",
                    config.api_rate_limit_login,
                    config.api_rate_limit_per_minute,
                )
    except Exception:
        logger.debug("Could not refresh rate limits from DB, using cached values")


def get_login_rate_limit() -> str:
    """Dynamic rate limit string for login endpoint.
    slowapi supports callables for limit values."""
    return f"{_rate_limit_cache['login']}/minute"


def get_api_rate_limit() -> str:
    """Dynamic rate limit string for general API endpoints."""
    return f"{_rate_limit_cache['api']}/minute"
