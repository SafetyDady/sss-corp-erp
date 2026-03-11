"""
SSS Corp ERP — Performance Monitoring Models
Phase 14: PerformanceLog + PerformanceAnalysis + WebVitalLog
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin


# ============================================================
# ENUMS
# ============================================================

class AnalysisSeverity(str, enum.Enum):
    HEALTHY = "HEALTHY"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


# ============================================================
# PERFORMANCE LOG
# ============================================================

class PerformanceLog(Base, TimestampMixin):
    """
    Records individual request performance metrics.
    High-volume — buffered through Redis before batch insert.
    Retention: 30 days (auto-cleanup).
    """
    __tablename__ = "performance_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Request info
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    response_time_ms: Mapped[float] = mapped_column(Float, nullable=False)

    # Context
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Slow request flag
    is_slow: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # DB query stats
    query_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    slowest_query_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Error info (for 4xx/5xx)
    error_detail: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Timestamp for partitioning/cleanup
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_perf_log_org_recorded", "org_id", "recorded_at"),
        Index("ix_perf_log_path", "path", "recorded_at"),
        Index("ix_perf_log_slow", "is_slow", "recorded_at"),
        Index("ix_perf_log_status", "status_code"),
        Index("ix_perf_log_recorded", "recorded_at"),
    )

    def __repr__(self) -> str:
        return f"<PerformanceLog {self.method} {self.path} {self.response_time_ms}ms>"


# ============================================================
# PERFORMANCE ANALYSIS (AI cache)
# ============================================================

class PerformanceAnalysis(Base, TimestampMixin):
    """
    Cached AI analysis results.
    TTL: 1 hour (re-analyzed on demand after expiry).
    """
    __tablename__ = "performance_analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )

    # Analysis parameters
    period: Mapped[str] = mapped_column(String(20), nullable=False)
    focus: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Results
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False, default="HEALTHY"
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    recommendations: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # AI model info
    model_used: Mapped[str] = mapped_column(String(50), nullable=False)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Cache control
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        Index("ix_perf_analysis_org_period", "org_id", "period", "focus"),
        Index("ix_perf_analysis_expires", "expires_at"),
    )

    def __repr__(self) -> str:
        return f"<PerformanceAnalysis {self.period} {self.severity}>"


# ============================================================
# WEB VITAL LOG
# ============================================================

class WebVitalLog(Base):
    """
    Frontend Web Vitals beacon data.
    Lightweight — no TimestampMixin (recorded_at serves as timestamp).
    """
    __tablename__ = "web_vital_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Core Web Vitals
    lcp: Mapped[float | None] = mapped_column(Float, nullable=True)
    fid: Mapped[float | None] = mapped_column(Float, nullable=True)
    cls: Mapped[float | None] = mapped_column(Float, nullable=True)
    ttfb: Mapped[float | None] = mapped_column(Float, nullable=True)
    inp: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Page context
    page_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_web_vitals_org_recorded", "org_id", "recorded_at"),
    )
