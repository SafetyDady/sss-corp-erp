"""
SSS Corp ERP — Performance Monitoring API
Phase 14: 8 endpoints for performance dashboard + AI analysis
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings, DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.performance import (
    AnalysisResponse,
    AnalyzeEndpointRequest,
    AnalyzeRequest,
    AskRequest,
    AskResponse,
    EndpointListResponse,
    PerformanceSummaryResponse,
    SlowRequestListResponse,
    WebVitalBeacon,
)
from app.services import performance as perf_svc
from app.services import ai_performance as ai_svc

router = APIRouter(prefix="/api/admin/performance", tags=["performance"])

settings = get_settings()


def _org_id(token: dict) -> UUID:
    return UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID


# ============================================================
# 14.5 — AGGREGATION ENDPOINTS
# ============================================================


@router.get(
    "/summary",
    dependencies=[Depends(require("admin.config.read"))],
    response_model=PerformanceSummaryResponse,
)
async def api_performance_summary(
    period: str = Query("24h", pattern=r"^(24h|7d|30d)$"),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Aggregated performance metrics for a given period."""
    org_id = _org_id(token)

    # Flush Redis buffer first to get fresh data
    try:
        import redis.asyncio as aioredis
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await perf_svc.flush_redis_buffer(redis_client, db)
        await redis_client.aclose()
    except Exception:
        pass

    return await perf_svc.get_summary(db, org_id, period)


@router.get(
    "/endpoints",
    dependencies=[Depends(require("admin.config.read"))],
    response_model=EndpointListResponse,
)
async def api_performance_endpoints(
    period: str = Query("24h", pattern=r"^(24h|7d|30d)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Per-endpoint performance breakdown."""
    org_id = _org_id(token)
    items, total = await perf_svc.get_endpoint_breakdown(
        db, org_id, period, limit, offset
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get(
    "/slow-requests",
    dependencies=[Depends(require("admin.config.read"))],
    response_model=SlowRequestListResponse,
)
async def api_slow_requests(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Recent slow requests."""
    org_id = _org_id(token)
    items, total = await perf_svc.get_slow_requests(db, org_id, limit)
    return {"items": items, "total": total}


# ============================================================
# 14.4 — WEB VITALS BEACON
# ============================================================


@router.post("/vitals", status_code=201)
async def api_record_vitals(
    body: WebVitalBeacon,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Record frontend Web Vitals (fire-and-forget)."""
    org_id = _org_id(token)
    user_id = UUID(token["sub"])
    await perf_svc.record_web_vitals(
        db, org_id, user_id, body.model_dump(exclude_none=True)
    )
    return {"status": "ok"}


# ============================================================
# 14.6-14.7 — AI ANALYSIS
# ============================================================


@router.post(
    "/analyze",
    dependencies=[Depends(require("admin.config.read"))],
    response_model=AnalysisResponse,
)
async def api_analyze(
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Trigger AI performance analysis."""
    org_id = _org_id(token)

    # Gather data for AI
    summary_data = await perf_svc.get_summary(db, org_id, body.period)
    endpoints, _ = await perf_svc.get_endpoint_breakdown(
        db, org_id, body.period, limit=10
    )

    analysis = await ai_svc.analyze_performance(
        db,
        org_id,
        period=body.period,
        focus=body.focus,
        summary_data=summary_data,
        endpoint_data=endpoints,
    )

    return AnalysisResponse(
        id=analysis.id,
        period=analysis.period,
        focus=analysis.focus,
        severity=analysis.severity,
        summary=analysis.summary,
        details=analysis.details,
        recommendations=analysis.recommendations,
        model_used=analysis.model_used,
        tokens_used=analysis.tokens_used,
        created_at=analysis.created_at,
        expires_at=analysis.expires_at,
        is_cached=False,
    )


@router.get(
    "/analysis/latest",
    dependencies=[Depends(require("admin.config.read"))],
)
async def api_latest_analysis(
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get most recent cached analysis."""
    org_id = _org_id(token)
    analysis = await ai_svc.get_latest_analysis(db, org_id)
    if not analysis:
        return {"analysis": None}
    return AnalysisResponse(
        id=analysis.id,
        period=analysis.period,
        focus=analysis.focus,
        severity=analysis.severity,
        summary=analysis.summary,
        details=analysis.details,
        recommendations=analysis.recommendations,
        model_used=analysis.model_used,
        tokens_used=analysis.tokens_used,
        created_at=analysis.created_at,
        expires_at=analysis.expires_at,
        is_cached=True,
    )


@router.post(
    "/analyze/endpoint",
    dependencies=[Depends(require("admin.config.read"))],
    response_model=AnalysisResponse,
)
async def api_analyze_endpoint(
    body: AnalyzeEndpointRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Analyze a specific endpoint."""
    org_id = _org_id(token)

    summary_data = await perf_svc.get_summary(db, org_id, body.period)
    endpoints, _ = await perf_svc.get_endpoint_breakdown(
        db, org_id, body.period, limit=10
    )

    analysis = await ai_svc.analyze_performance(
        db,
        org_id,
        period=body.period,
        focus=body.path,
        summary_data=summary_data,
        endpoint_data=endpoints,
    )

    return AnalysisResponse(
        id=analysis.id,
        period=analysis.period,
        focus=analysis.focus,
        severity=analysis.severity,
        summary=analysis.summary,
        details=analysis.details,
        recommendations=analysis.recommendations,
        model_used=analysis.model_used,
        tokens_used=analysis.tokens_used,
        created_at=analysis.created_at,
        expires_at=analysis.expires_at,
        is_cached=False,
    )


# ============================================================
# 14.8 — NATURAL LANGUAGE QUERY
# ============================================================


@router.post(
    "/ask",
    dependencies=[Depends(require("admin.config.read"))],
    response_model=AskResponse,
)
async def api_ask(
    body: AskRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Natural language performance question (Thai)."""
    org_id = _org_id(token)

    # Gather context for AI
    summary_data = await perf_svc.get_summary(db, org_id, "24h")
    endpoints, _ = await perf_svc.get_endpoint_breakdown(db, org_id, "24h", limit=10)

    return await ai_svc.ask_question(
        db, org_id, body.question, summary_data, endpoints
    )
