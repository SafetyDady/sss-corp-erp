"""
SSS Corp ERP — Main Application
"""

import logging
import time
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.core.database import engine, Base
from app.api import all_routers

logger = logging.getLogger(__name__)
settings = get_settings()

# --- Sentry (error monitoring) ---
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=f"sss-corp-erp@{settings.APP_VERSION}",
        traces_sample_rate=0.2 if settings.ENVIRONMENT == "production" else 0.0,
        send_default_pii=False,
    )
    logger.info("Sentry initialized for %s", settings.ENVIRONMENT)

# --- Production safety checks ---
if settings.ENVIRONMENT == "production":
    if settings.JWT_SECRET_KEY == "change-this-to-a-random-secret":
        raise RuntimeError(
            "FATAL: JWT_SECRET_KEY must be changed in production! "
            "Set a strong random secret via environment variable."
        )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # NOTE: create_all disabled — use 'alembic upgrade head' instead.
    # create_all conflicts with Alembic migrations (creates tables/enums from
    # model metadata, then migrations fail trying to create them again).
    # if settings.ENVIRONMENT == "development":
    #     async with engine.begin() as conn:
    #         await conn.run_sync(Base.metadata.create_all)

    # Load persisted role permission overrides from DB
    try:
        from app.core.database import AsyncSessionLocal
        from app.core.config import DEFAULT_ORG_ID
        from app.core.permissions import load_role_overrides

        async with AsyncSessionLocal() as db:
            await load_role_overrides(db, DEFAULT_ORG_ID)
            logger.info("Role permission overrides loaded from DB")
    except Exception as e:
        logger.warning("Could not load role overrides: %s (using defaults)", e)

    # --- DB Query Profiler (Phase 14) ---
    try:
        from sqlalchemy import event
        from app.middleware.performance import _request_query_stats

        @event.listens_for(engine.sync_engine, "before_cursor_execute")
        def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            conn.info["query_start_time"] = time.perf_counter()

        @event.listens_for(engine.sync_engine, "after_cursor_execute")
        def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            start = conn.info.pop("query_start_time", None)
            if start is None:
                return
            elapsed_ms = (time.perf_counter() - start) * 1000
            stats = _request_query_stats.get(None)
            if stats is not None:
                stats["count"] += 1
                if elapsed_ms > stats["slowest_ms"]:
                    stats["slowest_ms"] = elapsed_ms
            if elapsed_ms > settings.PERF_SLOW_QUERY_MS:
                logger.warning("Slow query (%.1fms): %s", elapsed_ms, statement[:200])

        logger.info("DB query profiler enabled (slow threshold: %dms)", settings.PERF_SLOW_QUERY_MS)
    except Exception as e:
        logger.warning("Could not set up DB query profiler: %s", e)

    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# --- Middleware ---

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting (Phase 13.6: per-user via JWT, default_limits applied globally)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Performance Monitoring Middleware (Phase 14)
try:
    import redis.asyncio as aioredis
    from app.middleware.performance import PerformanceMiddleware

    _perf_redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    app.add_middleware(
        PerformanceMiddleware,
        redis_client=_perf_redis,
        slow_threshold_ms=settings.PERF_SLOW_REQUEST_MS,
    )
    logger.info("Performance middleware enabled (slow threshold: %dms)", settings.PERF_SLOW_REQUEST_MS)
except Exception as e:
    logger.warning("Could not set up performance middleware: %s", e)


# --- Register Routers ---
for router in all_routers:
    app.include_router(router)


# --- Root ---
@app.get("/")
@limiter.exempt
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if settings.ENVIRONMENT != "production" else None,
    }
