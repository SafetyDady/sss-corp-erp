"""
SSS Corp ERP — Health Check Endpoint
Verifies application, database, and Redis connectivity.
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/api/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    checks = {"service": "sss-corp-erp", "version": settings.APP_VERSION}

    # Database check
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        logger.error("Health check — DB failed: %s", e)
        checks["database"] = "error"

    # Redis check
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as e:
        logger.warning("Health check — Redis unavailable: %s", e)
        checks["redis"] = "unavailable"

    # Overall status
    if checks["database"] == "ok":
        checks["status"] = "ok"
    else:
        checks["status"] = "degraded"

    return checks
