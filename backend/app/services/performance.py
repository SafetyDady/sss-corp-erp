"""
SSS Corp ERP — Performance Service
Phase 14: Aggregation, Redis buffer flush, retention cleanup
"""

import json
import logging
import uuid as uuid_mod
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.performance import PerformanceAnalysis, PerformanceLog, WebVitalLog

logger = logging.getLogger("performance")


# ============================================================
# REDIS BUFFER FLUSH
# ============================================================


async def flush_redis_buffer(redis_client, db: AsyncSession, batch_size: int = 200) -> int:
    """Move performance logs from Redis buffer to PostgreSQL."""
    if not redis_client:
        return 0

    count = 0
    while count < batch_size:
        raw = await redis_client.lpop("perf:buffer")
        if not raw:
            break
        try:
            entry = json.loads(raw)
            log = PerformanceLog(
                id=uuid_mod.UUID(entry["id"]),
                org_id=uuid_mod.UUID(entry["org_id"]) if entry.get("org_id") else None,
                method=entry["method"],
                path=entry["path"],
                status_code=entry["status_code"],
                response_time_ms=entry["response_time_ms"],
                user_id=uuid_mod.UUID(entry["user_id"]) if entry.get("user_id") else None,
                ip_address=entry.get("ip_address"),
                user_agent=entry.get("user_agent"),
                is_slow=entry.get("is_slow", False),
                query_count=entry.get("query_count"),
                slowest_query_ms=entry.get("slowest_query_ms"),
                error_detail=entry.get("error_detail"),
            )
            db.add(log)
            count += 1
        except Exception as e:
            logger.warning("Failed to parse perf log entry: %s", e)
            continue

    if count > 0:
        await db.commit()
        logger.debug("Flushed %d performance logs from Redis to DB", count)

    return count


# ============================================================
# HELPERS
# ============================================================


def _period_to_cutoff(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "7d":
        return now - timedelta(days=7)
    elif period == "30d":
        return now - timedelta(days=30)
    return now - timedelta(hours=24)


# ============================================================
# AGGREGATION QUERIES (14.5)
# ============================================================


async def get_summary(db: AsyncSession, org_id: UUID | None, period: str = "24h") -> dict:
    """Aggregate performance summary for a period."""
    cutoff = _period_to_cutoff(period)

    conditions = [PerformanceLog.recorded_at >= cutoff]
    if org_id:
        conditions.append(PerformanceLog.org_id == org_id)
    base_filter = and_(*conditions)

    # Main aggregation
    result = await db.execute(
        select(
            func.count().label("total"),
            func.avg(PerformanceLog.response_time_ms).label("avg_ms"),
            func.count().filter(PerformanceLog.is_slow.is_(True)).label("slow_count"),
            func.count().filter(PerformanceLog.status_code >= 400).label("error_count"),
            func.count(func.distinct(PerformanceLog.path)).label("unique_endpoints"),
            func.avg(PerformanceLog.query_count).label("avg_queries"),
        ).where(base_filter)
    )
    row = result.one()
    total = row.total or 0

    # P95 and P99 using percentile_cont
    p95 = p99 = 0.0
    if total > 0:
        pct_result = await db.execute(
            select(
                func.percentile_cont(0.95)
                .within_group(PerformanceLog.response_time_ms)
                .label("p95"),
                func.percentile_cont(0.99)
                .within_group(PerformanceLog.response_time_ms)
                .label("p99"),
            ).where(base_filter)
        )
        pct_row = pct_result.one()
        p95 = round(pct_row.p95 or 0, 2)
        p99 = round(pct_row.p99 or 0, 2)

    # Web Vitals averages
    vitals_conditions = [WebVitalLog.recorded_at >= cutoff]
    if org_id:
        vitals_conditions.append(WebVitalLog.org_id == org_id)

    vitals_result = await db.execute(
        select(
            func.avg(WebVitalLog.lcp).label("avg_lcp"),
            func.avg(WebVitalLog.fid).label("avg_fid"),
            func.avg(WebVitalLog.cls).label("avg_cls"),
            func.avg(WebVitalLog.ttfb).label("avg_ttfb"),
        ).where(and_(*vitals_conditions))
    )
    v_row = vitals_result.one()

    return {
        "period": period,
        "total_requests": total,
        "avg_response_time_ms": round(float(row.avg_ms or 0), 2),
        "p95_response_time_ms": p95,
        "p99_response_time_ms": p99,
        "error_rate": round((row.error_count / total * 100) if total > 0 else 0, 2),
        "slow_request_count": row.slow_count or 0,
        "unique_endpoints": row.unique_endpoints or 0,
        "avg_query_count": round(float(row.avg_queries or 0), 1) if row.avg_queries else None,
        "avg_lcp_ms": round(float(v_row.avg_lcp or 0), 1) if v_row.avg_lcp else None,
        "avg_fid_ms": round(float(v_row.avg_fid or 0), 1) if v_row.avg_fid else None,
        "avg_cls": round(float(v_row.avg_cls or 0), 3) if v_row.avg_cls else None,
        "avg_ttfb_ms": round(float(v_row.avg_ttfb or 0), 1) if v_row.avg_ttfb else None,
    }


async def get_endpoint_breakdown(
    db: AsyncSession,
    org_id: UUID | None,
    period: str = "24h",
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """Per-endpoint performance metrics, sorted by avg response time desc."""
    cutoff = _period_to_cutoff(period)

    conditions = [PerformanceLog.recorded_at >= cutoff]
    if org_id:
        conditions.append(PerformanceLog.org_id == org_id)
    base_filter = and_(*conditions)

    # Count distinct endpoints
    count_result = await db.execute(
        select(
            func.count(
                func.distinct(func.concat(PerformanceLog.method, " ", PerformanceLog.path))
            )
        ).where(base_filter)
    )
    total = count_result.scalar() or 0

    # Grouped aggregation
    query = (
        select(
            PerformanceLog.path,
            PerformanceLog.method,
            func.count().label("request_count"),
            func.avg(PerformanceLog.response_time_ms).label("avg_ms"),
            func.percentile_cont(0.95)
            .within_group(PerformanceLog.response_time_ms)
            .label("p95_ms"),
            func.max(PerformanceLog.response_time_ms).label("max_ms"),
            func.count().filter(PerformanceLog.status_code >= 400).label("error_count"),
            func.avg(PerformanceLog.query_count).label("avg_queries"),
        )
        .where(base_filter)
        .group_by(PerformanceLog.path, PerformanceLog.method)
        .order_by(func.avg(PerformanceLog.response_time_ms).desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    rows = result.all()

    items = []
    for r in rows:
        req_count = r.request_count or 0
        items.append(
            {
                "path": r.path,
                "method": r.method,
                "request_count": req_count,
                "avg_response_time_ms": round(float(r.avg_ms or 0), 2),
                "p95_response_time_ms": round(float(r.p95_ms or 0), 2),
                "max_response_time_ms": round(float(r.max_ms or 0), 2),
                "error_count": r.error_count or 0,
                "error_rate": round(
                    (r.error_count / req_count * 100) if req_count > 0 else 0, 2
                ),
                "avg_query_count": round(float(r.avg_queries or 0), 1)
                if r.avg_queries
                else None,
            }
        )

    return items, total


async def get_slow_requests(
    db: AsyncSession, org_id: UUID | None, limit: int = 50
) -> tuple[list, int]:
    """Get recent slow requests."""
    conditions = [PerformanceLog.is_slow.is_(True)]
    if org_id:
        conditions.append(PerformanceLog.org_id == org_id)
    base_filter = and_(*conditions)

    count_result = await db.execute(select(func.count()).select_from(PerformanceLog).where(base_filter))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(PerformanceLog)
        .where(base_filter)
        .order_by(PerformanceLog.recorded_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all()), total


# ============================================================
# WEB VITALS
# ============================================================


async def record_web_vitals(
    db: AsyncSession,
    org_id: UUID | None,
    user_id: UUID | None,
    data: dict,
    user_agent: str | None = None,
) -> None:
    """Record a Web Vitals beacon from the frontend."""
    vital = WebVitalLog(
        id=uuid_mod.uuid4(),
        org_id=org_id,
        user_id=user_id,
        lcp=data.get("lcp"),
        fid=data.get("fid"),
        cls=data.get("cls"),
        ttfb=data.get("ttfb"),
        inp=data.get("inp"),
        page_url=data.get("page_url"),
        user_agent=user_agent,
    )
    db.add(vital)
    await db.commit()


# ============================================================
# RETENTION CLEANUP
# ============================================================


async def cleanup_old_logs(db: AsyncSession, retention_days: int = 30) -> int:
    """Delete performance logs older than retention period."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    r1 = await db.execute(
        delete(PerformanceLog).where(PerformanceLog.recorded_at < cutoff)
    )
    r2 = await db.execute(
        delete(WebVitalLog).where(WebVitalLog.recorded_at < cutoff)
    )
    r3 = await db.execute(
        delete(PerformanceAnalysis).where(PerformanceAnalysis.expires_at < cutoff)
    )

    await db.commit()
    total = (r1.rowcount or 0) + (r2.rowcount or 0) + (r3.rowcount or 0)
    if total > 0:
        logger.info("Cleaned up %d old performance records (>%d days)", total, retention_days)
    return total
