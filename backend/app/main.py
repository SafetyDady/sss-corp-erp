"""
SSS Corp ERP — Main Application
"""

import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings
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

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables (dev only — use Alembic in production)
    if settings.ENVIRONMENT == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
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

# Rate Limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --- Rate limit on login ---
@app.middleware("http")
async def rate_limit_login(request: Request, call_next):
    if request.url.path == "/api/auth/login" and request.method == "POST":
        # Apply 5/minute limit
        pass  # slowapi handles via decorator — see below
    return await call_next(request)


# --- Register Routers ---
for router in all_routers:
    app.include_router(router)


# --- Root ---
@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if settings.ENVIRONMENT != "production" else None,
    }
