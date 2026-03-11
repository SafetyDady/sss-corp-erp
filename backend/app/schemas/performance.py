"""
SSS Corp ERP — Performance Monitoring Schemas
Phase 14: Request/Response schemas for performance API
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# SUMMARY (14.5)
# ============================================================

class PerformanceSummaryResponse(BaseModel):
    period: str
    total_requests: int
    avg_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    error_rate: float
    slow_request_count: int
    unique_endpoints: int
    avg_query_count: float | None = None
    avg_lcp_ms: float | None = None
    avg_fid_ms: float | None = None
    avg_cls: float | None = None
    avg_ttfb_ms: float | None = None


class EndpointPerformance(BaseModel):
    path: str
    method: str
    request_count: int
    avg_response_time_ms: float
    p95_response_time_ms: float
    max_response_time_ms: float
    error_count: int
    error_rate: float
    avg_query_count: float | None = None


class EndpointListResponse(BaseModel):
    items: list[EndpointPerformance]
    total: int
    limit: int
    offset: int


class SlowRequestEntry(BaseModel):
    id: UUID
    method: str
    path: str
    status_code: int
    response_time_ms: float
    query_count: int | None = None
    slowest_query_ms: float | None = None
    user_id: UUID | None = None
    ip_address: str | None = None
    recorded_at: datetime

    model_config = {"from_attributes": True}


class SlowRequestListResponse(BaseModel):
    items: list[SlowRequestEntry]
    total: int


# ============================================================
# WEB VITALS BEACON (14.4)
# ============================================================

class WebVitalBeacon(BaseModel):
    lcp: float | None = None
    fid: float | None = None
    cls: float | None = None
    ttfb: float | None = None
    inp: float | None = None
    page_url: str | None = None


# ============================================================
# AI ANALYSIS (14.6-14.7)
# ============================================================

class AnalyzeRequest(BaseModel):
    period: str = Field(default="24h", pattern=r"^(24h|7d|30d)$")
    focus: str | None = Field(default="general", max_length=100)


class AnalyzeEndpointRequest(BaseModel):
    path: str = Field(..., max_length=500)
    period: str = Field(default="24h", pattern=r"^(24h|7d|30d)$")


class AnalysisResponse(BaseModel):
    id: UUID
    period: str
    focus: str | None
    severity: str
    summary: str
    details: dict | None = None
    recommendations: list | None = None
    model_used: str
    tokens_used: int | None
    created_at: datetime
    expires_at: datetime
    is_cached: bool = False

    model_config = {"from_attributes": True}


# ============================================================
# NATURAL LANGUAGE QUERY (14.8)
# ============================================================

class AskRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)


class AskResponse(BaseModel):
    question: str
    answer: str
    data_context: dict | None = None
    model_used: str
    tokens_used: int | None
