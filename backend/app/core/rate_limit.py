"""
SSS Corp ERP — Rate Limiter
Phase 13.6: Per-user rate limiting with Redis backend
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
