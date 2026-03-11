"""
SSS Corp ERP — Performance Monitoring Middleware
Phase 14: Request timing + X-Response-Time header + Redis buffering
"""

import json
import logging
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("performance")

# ContextVar for DB query profiling (bridges middleware ↔ SQLAlchemy events)
_request_query_stats: ContextVar[dict | None] = ContextVar(
    "request_query_stats", default=None
)

SKIP_PATHS = frozenset({"/docs", "/redoc", "/openapi.json", "/", "/favicon.ico"})


class PerformanceMiddleware(BaseHTTPMiddleware):
    """Measures request response time and buffers to Redis."""

    def __init__(self, app, redis_client=None, slow_threshold_ms: int = 1000):
        super().__init__(app)
        self.redis = redis_client
        self.slow_threshold_ms = slow_threshold_ms

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path

        # Skip non-API and docs paths
        if path in SKIP_PATHS or not path.startswith("/api"):
            return await call_next(request)

        # Initialize per-request query stats
        query_stats = {"count": 0, "slowest_ms": 0.0}
        token = _request_query_stats.set(query_stats)

        start_time = time.perf_counter()
        response = None
        error_detail = None

        try:
            response = await call_next(request)
        except Exception as exc:
            error_detail = str(exc)[:500]
            raise
        finally:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            _request_query_stats.reset(token)

            # Add X-Response-Time header
            if response is not None:
                response.headers["X-Response-Time"] = f"{elapsed_ms:.1f}ms"

            status_code = response.status_code if response else 500
            is_slow = elapsed_ms > self.slow_threshold_ms

            # Extract user/org from JWT (best-effort, non-raising)
            user_id = None
            org_id = None
            try:
                from app.core.security import get_token_payload_from_request

                payload = get_token_payload_from_request(request)
                if payload:
                    user_id = payload.get("sub")
                    org_id = payload.get("org_id")
            except Exception:
                pass

            # Build log entry
            log_entry = {
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "method": request.method,
                "path": path,
                "status_code": status_code,
                "response_time_ms": round(elapsed_ms, 2),
                "user_id": user_id,
                "ip_address": _get_ip(request),
                "user_agent": (request.headers.get("user-agent") or "")[:500],
                "is_slow": is_slow,
                "query_count": query_stats.get("count"),
                "slowest_query_ms": round(query_stats.get("slowest_ms", 0), 2)
                or None,
                "error_detail": error_detail
                or (None if status_code < 400 else f"HTTP {status_code}"),
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }

            # Push to Redis buffer (fire-and-forget)
            await self._buffer_log(log_entry)

            if is_slow:
                logger.warning(
                    "Slow request: %s %s %.1fms (queries=%d, slowest_query=%.1fms)",
                    request.method,
                    path,
                    elapsed_ms,
                    query_stats.get("count", 0),
                    query_stats.get("slowest_ms", 0),
                )

        return response

    async def _buffer_log(self, entry: dict) -> None:
        """Push log entry to Redis list. Non-blocking."""
        if not self.redis:
            return
        try:
            await self.redis.rpush("perf:buffer", json.dumps(entry))
        except Exception:
            logger.debug("Failed to buffer performance log to Redis")


def _get_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None
