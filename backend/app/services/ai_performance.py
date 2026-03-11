"""
SSS Corp ERP — AI Performance Analysis Engine
Phase 14: Claude API integration for Thai-language analysis
"""

import logging
import uuid as uuid_mod
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.performance import PerformanceAnalysis

logger = logging.getLogger("performance.ai")

ANALYSIS_TTL_HOURS = 1
AI_MODEL = "claude-3-5-haiku-20241022"

_client = None


def _get_anthropic_client():
    """Lazy-load Anthropic client. Returns None if API key not configured."""
    global _client
    if _client is not None:
        return _client
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        import anthropic

        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        return _client
    except Exception as e:
        logger.warning("Could not initialize Anthropic client: %s", e)
        return None


# ============================================================
# CACHE
# ============================================================


async def get_cached_analysis(
    db: AsyncSession, org_id: UUID, period: str, focus: str | None = None
) -> PerformanceAnalysis | None:
    """Get cached analysis if exists and not expired."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(PerformanceAnalysis)
        .where(
            and_(
                PerformanceAnalysis.org_id == org_id,
                PerformanceAnalysis.period == period,
                PerformanceAnalysis.focus == (focus or "general"),
                PerformanceAnalysis.expires_at > now,
            )
        )
        .order_by(PerformanceAnalysis.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_latest_analysis(
    db: AsyncSession, org_id: UUID
) -> PerformanceAnalysis | None:
    """Get most recent analysis regardless of expiry."""
    result = await db.execute(
        select(PerformanceAnalysis)
        .where(PerformanceAnalysis.org_id == org_id)
        .order_by(PerformanceAnalysis.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ============================================================
# ANALYSIS ENGINE
# ============================================================

SYSTEM_PROMPT = (
    "คุณเป็นผู้เชี่ยวชาญด้าน Performance Engineering วิเคราะห์ระบบ ERP (FastAPI + PostgreSQL + React) "
    "ตอบเป็นภาษาไทย ใช้ markdown formatting ให้คำแนะนำที่ actionable เฉพาะเจาะจง "
    "ระดับความรุนแรง: HEALTHY (ระบบปกติ), WARNING (ต้องเฝ้าระวัง), CRITICAL (ต้องแก้ไขด่วน) "
    "บรรทัดแรกต้องเป็น: SEVERITY: HEALTHY|WARNING|CRITICAL"
)


async def analyze_performance(
    db: AsyncSession,
    org_id: UUID,
    period: str = "24h",
    focus: str | None = None,
    summary_data: dict | None = None,
    endpoint_data: list | None = None,
) -> PerformanceAnalysis:
    """Run AI analysis on performance data with caching."""
    focus_key = focus or "general"

    # 1. Check cache
    cached = await get_cached_analysis(db, org_id, period, focus_key)
    if cached:
        return cached

    # 2. Build prompt
    prompt = _build_analysis_prompt(period, focus_key, summary_data, endpoint_data)

    # 3. Call Claude API
    client = _get_anthropic_client()
    if not client:
        return await _store_placeholder(
            db,
            org_id,
            period,
            focus_key,
            "ไม่สามารถวิเคราะห์ได้ — ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY\n\n"
            "กรุณาตั้งค่า API key ใน environment variables เพื่อเปิดใช้งาน AI Analysis.",
        )

    try:
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM_PROMPT,
        )

        response_text = message.content[0].text
        tokens_used = (message.usage.input_tokens or 0) + (
            message.usage.output_tokens or 0
        )

        # Parse severity from first line
        severity = "HEALTHY"
        summary_text = response_text
        if response_text.startswith("SEVERITY:"):
            first_line, *rest = response_text.split("\n", 1)
            sev_value = first_line.replace("SEVERITY:", "").strip().upper()
            if sev_value in ("HEALTHY", "WARNING", "CRITICAL"):
                severity = sev_value
            summary_text = rest[0] if rest else response_text

        analysis = PerformanceAnalysis(
            id=uuid_mod.uuid4(),
            org_id=org_id,
            period=period,
            focus=focus_key,
            severity=severity,
            summary=summary_text.strip(),
            details={"raw_metrics": summary_data} if summary_data else None,
            recommendations=None,
            model_used=AI_MODEL,
            tokens_used=tokens_used,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=ANALYSIS_TTL_HOURS),
        )
        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)
        return analysis

    except Exception as e:
        logger.error("AI analysis failed: %s", e)
        return await _store_placeholder(
            db,
            org_id,
            period,
            focus_key,
            f"ไม่สามารถวิเคราะห์ได้ — เกิดข้อผิดพลาด: {str(e)[:200]}",
            severity="WARNING",
        )


async def ask_question(
    db: AsyncSession,
    org_id: UUID,
    question: str,
    summary_data: dict | None = None,
    endpoint_data: list | None = None,
) -> dict:
    """Natural language Q&A about performance."""
    client = _get_anthropic_client()
    if not client:
        return {
            "question": question,
            "answer": "ไม่สามารถตอบได้ — ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY",
            "data_context": None,
            "model_used": "none",
            "tokens_used": 0,
        }

    prompt_parts = [f"คำถามจากผู้ดูแลระบบ ERP: {question}\n"]
    if summary_data:
        prompt_parts.append("## ข้อมูล Performance ปัจจุบัน")
        for k, v in summary_data.items():
            if v is not None:
                prompt_parts.append(f"- {k}: {v}")
    if endpoint_data:
        prompt_parts.append("\n## Top 10 Endpoints (ช้าสุด)")
        for ep in endpoint_data[:10]:
            prompt_parts.append(
                f"- {ep['method']} {ep['path']}: avg={ep['avg_response_time_ms']}ms, "
                f"count={ep['request_count']}, errors={ep['error_count']}"
            )

    try:
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": "\n".join(prompt_parts)}],
            system=(
                "คุณเป็นผู้เชี่ยวชาญ Performance ของระบบ ERP "
                "ตอบคำถามเป็นภาษาไทย กระชับ ใช้ markdown "
                "อ้างอิงข้อมูลที่ให้มา ถ้าข้อมูลไม่พอให้บอกตรงๆ"
            ),
        )

        tokens_used = (message.usage.input_tokens or 0) + (
            message.usage.output_tokens or 0
        )

        return {
            "question": question,
            "answer": message.content[0].text,
            "data_context": summary_data,
            "model_used": AI_MODEL,
            "tokens_used": tokens_used,
        }
    except Exception as e:
        logger.error("AI ask failed: %s", e)
        return {
            "question": question,
            "answer": f"เกิดข้อผิดพลาด: {str(e)[:200]}",
            "data_context": None,
            "model_used": AI_MODEL,
            "tokens_used": 0,
        }


# ============================================================
# HELPERS
# ============================================================


async def _store_placeholder(
    db: AsyncSession,
    org_id: UUID,
    period: str,
    focus: str,
    summary: str,
    severity: str = "HEALTHY",
) -> PerformanceAnalysis:
    analysis = PerformanceAnalysis(
        id=uuid_mod.uuid4(),
        org_id=org_id,
        period=period,
        focus=focus,
        severity=severity,
        summary=summary,
        model_used="none",
        tokens_used=0,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis


def _build_analysis_prompt(
    period: str, focus: str, summary: dict | None, endpoints: list | None
) -> str:
    parts = [f"วิเคราะห์ประสิทธิภาพระบบ ERP ในช่วง {period}:\n"]

    if summary:
        parts.append("## สรุปภาพรวม")
        parts.append(f"- จำนวน Request ทั้งหมด: {summary.get('total_requests', 'N/A')}")
        parts.append(f"- Response Time เฉลี่ย: {summary.get('avg_response_time_ms', 'N/A')} ms")
        parts.append(f"- P95 Response Time: {summary.get('p95_response_time_ms', 'N/A')} ms")
        parts.append(f"- P99 Response Time: {summary.get('p99_response_time_ms', 'N/A')} ms")
        parts.append(f"- Error Rate: {summary.get('error_rate', 'N/A')}%")
        parts.append(f"- Slow Requests (>1s): {summary.get('slow_request_count', 'N/A')}")
        parts.append(f"- Endpoints ที่ใช้งาน: {summary.get('unique_endpoints', 'N/A')}")
        if summary.get("avg_lcp_ms"):
            parts.append("\n## Web Vitals")
            parts.append(f"- LCP: {summary['avg_lcp_ms']} ms")
            parts.append(f"- FID: {summary.get('avg_fid_ms', 'N/A')} ms")
            parts.append(f"- CLS: {summary.get('avg_cls', 'N/A')}")

    if endpoints:
        parts.append("\n## Endpoints ที่ช้าที่สุด (Top 10)")
        for ep in endpoints[:10]:
            parts.append(
                f"- {ep.get('method', '?')} {ep.get('path', '?')}: "
                f"avg={ep.get('avg_response_time_ms', '?')}ms, "
                f"p95={ep.get('p95_response_time_ms', '?')}ms, "
                f"count={ep.get('request_count', '?')}, "
                f"errors={ep.get('error_count', 0)}"
            )

    if focus and focus != "general":
        parts.append(f"\n## จุดสนใจเฉพาะ: {focus}")

    parts.append(
        "\n\nกรุณาวิเคราะห์และให้คำแนะนำ:\n"
        "1. ระบุ severity (HEALTHY/WARNING/CRITICAL)\n"
        "2. สรุปสถานะโดยรวม\n"
        "3. ระบุปัญหาที่พบ (ถ้ามี)\n"
        "4. แนะนำวิธีแก้ไข/ปรับปรุง\n"
        "5. ให้คะแนนความสุขภาพ 1-10"
    )

    return "\n".join(parts)
