"""
SSS Corp ERP — Daily Work Report Service (Phase 5)
CRUD + validation + approve → auto-record Timesheet

Business Rules:
  BR#50 — 1 report per employee per day
  BR#51 — Time overlap validation
  BR#52 — Auto-create Timesheet on approve
  BR#53 — Auto-update StandardTimesheet OT on approve
  BR#54 — Edit only DRAFT/REJECTED
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.daily_report import (
    DailyWorkReport,
    DailyWorkReportLine,
    LineType,
    ReportStatus,
)
from app.models.hr import (
    Employee,
    StandardTimesheet,
    Timesheet,
    TimesheetStatus,
)
from app.models.workorder import WorkOrder
from app.models.master import OTType
from app.schemas.daily_report import DailyReportLineCreate


# ============================================================
# VALIDATION
# ============================================================

def validate_report_lines(lines: list[DailyReportLineCreate], report_date: date) -> tuple[Decimal, Decimal]:
    """
    BR#51: Validate no time overlap within same line_type.
    Returns (total_regular_hours, total_ot_hours).
    """
    regular_lines = [l for l in lines if l.line_type == LineType.REGULAR]
    ot_lines = [l for l in lines if l.line_type == LineType.OT]

    # Check overlap within REGULAR
    for i, a in enumerate(regular_lines):
        for b in regular_lines[i + 1:]:
            if a.start_time < b.end_time and b.start_time < a.end_time:
                raise HTTPException(
                    status_code=400,
                    detail=f"เวลาปกติ {a.start_time}-{a.end_time} ซ้อนกับ {b.start_time}-{b.end_time}",
                )

    # Check overlap within OT
    for i, a in enumerate(ot_lines):
        for b in ot_lines[i + 1:]:
            if a.start_time < b.end_time and b.start_time < a.end_time:
                raise HTTPException(
                    status_code=400,
                    detail=f"เวลา OT {a.start_time}-{a.end_time} ซ้อนกับ {b.start_time}-{b.end_time}",
                )

    # Calculate hours from start-end
    total_regular = Decimal("0.00")
    total_ot = Decimal("0.00")

    for line in lines:
        d_start = datetime.combine(report_date, line.start_time)
        d_end = datetime.combine(report_date, line.end_time)
        delta_seconds = (d_end - d_start).total_seconds()
        if delta_seconds <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม: {line.start_time}-{line.end_time}",
            )
        hours = Decimal(str(delta_seconds / 3600)).quantize(Decimal("0.01"))
        if line.line_type == LineType.REGULAR:
            total_regular += hours
        else:
            total_ot += hours

    return total_regular, total_ot


def _calc_line_hours(report_date: date, start_time, end_time) -> Decimal:
    """Calculate hours between start and end time."""
    d_start = datetime.combine(report_date, start_time)
    d_end = datetime.combine(report_date, end_time)
    delta_seconds = (d_end - d_start).total_seconds()
    return Decimal(str(delta_seconds / 3600)).quantize(Decimal("0.01"))


# ============================================================
# CREATE (BR#50)
# ============================================================

async def create_daily_report(
    db: AsyncSession,
    *,
    employee_id: UUID,
    body,
    org_id: UUID,
    user_id: UUID,
) -> DailyWorkReport:
    # Check duplicate (BR#50)
    existing = await db.execute(
        select(DailyWorkReport).where(
            DailyWorkReport.employee_id == employee_id,
            DailyWorkReport.report_date == body.report_date,
            DailyWorkReport.org_id == org_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"วันที่ {body.report_date} มีรายงานแล้ว",
        )

    # Validate lines (BR#51)
    total_regular, total_ot = validate_report_lines(body.lines, body.report_date)

    # Create report
    report = DailyWorkReport(
        employee_id=employee_id,
        report_date=body.report_date,
        status=ReportStatus.DRAFT,
        total_regular_hours=total_regular,
        total_ot_hours=total_ot,
        note=body.note,
        created_by=user_id,
        org_id=org_id,
    )
    db.add(report)
    await db.flush()

    # Create lines
    for line_data in body.lines:
        hours = _calc_line_hours(body.report_date, line_data.start_time, line_data.end_time)
        line = DailyWorkReportLine(
            report_id=report.id,
            line_type=line_data.line_type,
            start_time=line_data.start_time,
            end_time=line_data.end_time,
            work_order_id=line_data.work_order_id,
            hours=hours,
            ot_type_id=line_data.ot_type_id,
            note=line_data.note,
        )
        db.add(line)

    await db.commit()
    await db.refresh(report)
    return report


# ============================================================
# UPDATE (BR#54)
# ============================================================

async def update_daily_report(
    db: AsyncSession,
    report_id: UUID,
    *,
    body,
    user_id: UUID,
) -> DailyWorkReport:
    report = await _get_report_or_404(db, report_id)

    # BR#54: Only DRAFT or REJECTED can be edited
    if report.status not in (ReportStatus.DRAFT, ReportStatus.REJECTED):
        raise HTTPException(
            status_code=400,
            detail=f"แก้ไขไม่ได้ — สถานะปัจจุบัน: {report.status.value}",
        )

    if body.note is not None:
        report.note = body.note

    if body.lines is not None:
        # Validate new lines
        total_regular, total_ot = validate_report_lines(body.lines, report.report_date)

        # Delete old lines
        await db.execute(
            delete(DailyWorkReportLine).where(
                DailyWorkReportLine.report_id == report_id
            )
        )

        # Create new lines
        for line_data in body.lines:
            hours = _calc_line_hours(report.report_date, line_data.start_time, line_data.end_time)
            line = DailyWorkReportLine(
                report_id=report.id,
                line_type=line_data.line_type,
                start_time=line_data.start_time,
                end_time=line_data.end_time,
                work_order_id=line_data.work_order_id,
                hours=hours,
                ot_type_id=line_data.ot_type_id,
                note=line_data.note,
            )
            db.add(line)

        report.total_regular_hours = total_regular
        report.total_ot_hours = total_ot

    # Reset to DRAFT if was REJECTED
    if report.status == ReportStatus.REJECTED:
        report.status = ReportStatus.DRAFT
        report.reject_reason = None

    await db.commit()
    await db.refresh(report)
    return report


# ============================================================
# SUBMIT (DRAFT → SUBMITTED)
# ============================================================

async def submit_daily_report(
    db: AsyncSession,
    report_id: UUID,
    *,
    user_id: UUID,
) -> DailyWorkReport:
    report = await _get_report_or_404(db, report_id)

    if report.status != ReportStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"ส่งได้เฉพาะสถานะ DRAFT — ปัจจุบัน: {report.status.value}",
        )

    report.status = ReportStatus.SUBMITTED
    report.submitted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(report)
    return report


# ============================================================
# APPROVE (SUBMITTED → APPROVED + auto-record)
# ============================================================

async def approve_daily_report(
    db: AsyncSession,
    report_id: UUID,
    *,
    approver_id: UUID,
    org_id: UUID,
) -> DailyWorkReport:
    report = await _get_report_or_404(db, report_id)

    if report.status != ReportStatus.SUBMITTED:
        raise HTTPException(
            status_code=400,
            detail=f"อนุมัติได้เฉพาะสถานะ SUBMITTED — ปัจจุบัน: {report.status.value}",
        )

    report.status = ReportStatus.APPROVED
    report.approved_by = approver_id
    report.approved_at = datetime.now(timezone.utc)

    # Auto-record (BR#52, BR#53)
    await _auto_record_on_approve(db, report, org_id=org_id)

    await db.commit()
    await db.refresh(report)
    return report


async def batch_approve_daily_reports(
    db: AsyncSession,
    report_ids: list[UUID],
    *,
    approver_id: UUID,
    org_id: UUID,
) -> list[DailyWorkReport]:
    results = []
    for rid in report_ids:
        report = await approve_daily_report(
            db, rid, approver_id=approver_id, org_id=org_id
        )
        results.append(report)
    return results


# ============================================================
# REJECT (SUBMITTED → REJECTED)
# ============================================================

async def reject_daily_report(
    db: AsyncSession,
    report_id: UUID,
    *,
    approver_id: UUID,
    reason: str,
) -> DailyWorkReport:
    report = await _get_report_or_404(db, report_id)

    if report.status != ReportStatus.SUBMITTED:
        raise HTTPException(
            status_code=400,
            detail=f"ปฏิเสธได้เฉพาะสถานะ SUBMITTED — ปัจจุบัน: {report.status.value}",
        )

    report.status = ReportStatus.REJECTED
    report.approved_by = approver_id
    report.approved_at = datetime.now(timezone.utc)
    report.reject_reason = reason
    await db.commit()
    await db.refresh(report)
    return report


# ============================================================
# LIST / GET
# ============================================================

async def list_daily_reports(
    db: AsyncSession,
    *,
    org_id: UUID,
    employee_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    report_status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """List reports with employee name/code join."""
    query = (
        select(
            DailyWorkReport,
            Employee.full_name.label("employee_name"),
            Employee.employee_code.label("employee_code"),
        )
        .join(Employee, DailyWorkReport.employee_id == Employee.id)
        .where(DailyWorkReport.org_id == org_id)
    )
    count_query = (
        select(func.count(DailyWorkReport.id))
        .where(DailyWorkReport.org_id == org_id)
    )

    if employee_id:
        query = query.where(DailyWorkReport.employee_id == employee_id)
        count_query = count_query.where(DailyWorkReport.employee_id == employee_id)
    if date_from:
        query = query.where(DailyWorkReport.report_date >= date_from)
        count_query = count_query.where(DailyWorkReport.report_date >= date_from)
    if date_to:
        query = query.where(DailyWorkReport.report_date <= date_to)
        count_query = count_query.where(DailyWorkReport.report_date <= date_to)
    if report_status:
        query = query.where(DailyWorkReport.status == report_status)
        count_query = count_query.where(DailyWorkReport.status == report_status)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(
        DailyWorkReport.report_date.desc(), Employee.employee_code
    ).limit(limit).offset(offset)

    result = await db.execute(query)
    rows = result.all()

    items = []
    for row in rows:
        report = row[0]
        emp_name = row[1]
        emp_code = row[2]

        # Load lines with WO/OT joins
        lines = await _load_report_lines(db, report.id)

        items.append({
            "id": report.id,
            "employee_id": report.employee_id,
            "employee_name": emp_name,
            "employee_code": emp_code,
            "report_date": report.report_date,
            "status": report.status,
            "total_regular_hours": report.total_regular_hours,
            "total_ot_hours": report.total_ot_hours,
            "note": report.note,
            "submitted_at": report.submitted_at,
            "approved_by": report.approved_by,
            "approved_at": report.approved_at,
            "reject_reason": report.reject_reason,
            "lines": lines,
            "created_at": report.created_at,
            "updated_at": report.updated_at,
        })

    return items, total


async def get_daily_report(
    db: AsyncSession,
    report_id: UUID,
) -> dict:
    """Get single report with joins."""
    result = await db.execute(
        select(
            DailyWorkReport,
            Employee.full_name.label("employee_name"),
            Employee.employee_code.label("employee_code"),
        )
        .join(Employee, DailyWorkReport.employee_id == Employee.id)
        .where(DailyWorkReport.id == report_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")

    report = row[0]
    lines = await _load_report_lines(db, report.id)

    return {
        "id": report.id,
        "employee_id": report.employee_id,
        "employee_name": row[1],
        "employee_code": row[2],
        "report_date": report.report_date,
        "status": report.status,
        "total_regular_hours": report.total_regular_hours,
        "total_ot_hours": report.total_ot_hours,
        "note": report.note,
        "submitted_at": report.submitted_at,
        "approved_by": report.approved_by,
        "approved_at": report.approved_at,
        "reject_reason": report.reject_reason,
        "lines": lines,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }


# ============================================================
# INTERNAL HELPERS
# ============================================================

async def _get_report_or_404(db: AsyncSession, report_id: UUID) -> DailyWorkReport:
    result = await db.execute(
        select(DailyWorkReport).where(DailyWorkReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


async def _load_report_lines(db: AsyncSession, report_id: UUID) -> list[dict]:
    """Load lines with WO number and OT type name joins."""
    result = await db.execute(
        select(
            DailyWorkReportLine,
            WorkOrder.wo_number.label("wo_number"),
            OTType.name.label("ot_type_name"),
        )
        .outerjoin(WorkOrder, DailyWorkReportLine.work_order_id == WorkOrder.id)
        .outerjoin(OTType, DailyWorkReportLine.ot_type_id == OTType.id)
        .where(DailyWorkReportLine.report_id == report_id)
        .order_by(DailyWorkReportLine.start_time)
    )
    rows = result.all()

    return [
        {
            "id": row[0].id,
            "line_type": row[0].line_type,
            "start_time": row[0].start_time,
            "end_time": row[0].end_time,
            "work_order_id": row[0].work_order_id,
            "wo_number": row[1],
            "ot_type_id": row[0].ot_type_id,
            "ot_type_name": row[2],
            "hours": row[0].hours,
            "note": row[0].note,
        }
        for row in rows
    ]


async def _auto_record_on_approve(
    db: AsyncSession,
    report: DailyWorkReport,
    *,
    org_id: UUID,
) -> None:
    """
    BR#52: Auto-create Timesheet WO Time Entries from approved report lines.
    BR#53: Auto-update StandardTimesheet with OT hours.
    """
    # Load lines
    lines_result = await db.execute(
        select(DailyWorkReportLine).where(
            DailyWorkReportLine.report_id == report.id
        )
    )
    lines = lines_result.scalars().all()

    # ── 1. Delete old Timesheet entries from this report (re-approve case) ──
    await db.execute(
        delete(Timesheet).where(
            Timesheet.employee_id == report.employee_id,
            Timesheet.work_date == report.report_date,
            Timesheet.note.like(f"DailyReport#{report.id}%"),
        )
    )

    # ── 2. Group lines by work_order_id ──
    wo_groups: dict[UUID, dict] = {}
    for line in lines:
        if line.work_order_id:
            key = line.work_order_id
            if key not in wo_groups:
                wo_groups[key] = {
                    "regular": Decimal("0"),
                    "ot": Decimal("0"),
                    "ot_type_id": None,
                }
            if line.line_type == LineType.REGULAR:
                wo_groups[key]["regular"] += line.hours
            else:
                wo_groups[key]["ot"] += line.hours
                wo_groups[key]["ot_type_id"] = line.ot_type_id

    # ── 3. Create Timesheet records per WO ──
    for wo_id, hours_data in wo_groups.items():
        ts = Timesheet(
            employee_id=report.employee_id,
            work_order_id=wo_id,
            work_date=report.report_date,
            regular_hours=hours_data["regular"],
            ot_hours=hours_data["ot"],
            ot_type_id=hours_data["ot_type_id"],
            status=TimesheetStatus.FINAL,
            note=f"DailyReport#{report.id}",
            created_by=report.approved_by,
            org_id=org_id,
        )
        db.add(ts)

    # ── 4. Update StandardTimesheet with OT hours (BR#53) ──
    std_result = await db.execute(
        select(StandardTimesheet).where(
            StandardTimesheet.employee_id == report.employee_id,
            StandardTimesheet.work_date == report.report_date,
        )
    )
    std_ts = std_result.scalar_one_or_none()
    if std_ts:
        std_ts.ot_hours = report.total_ot_hours

    await db.flush()
