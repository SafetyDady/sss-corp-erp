"""
SSS Corp ERP — HR Service (Business Logic)
Phase 2: Employee, Timesheet, Leave, Payroll

Business Rules enforced:
  BR#18 — 1 hour = 1 WO (no overlap)
  BR#19 — Lock period 7 days
  BR#20 — Daily hours ≤ working hours
  BR#21 — Supervisor can fill on behalf
  BR#22 — HR unlock before editing past lock period
  BR#23 — OT Flow: staff → supervisor approve → HR final
  BR#26 — HR is final authority before payroll
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hr import (
    Employee,
    Leave,
    LeaveStatus,
    PayrollRun,
    PayrollStatus,
    Timesheet,
    TimesheetStatus,
)
from app.models.master import OTType
from app.models.workorder import WorkOrder, WOStatus


LOCK_PERIOD_DAYS = 7


# ============================================================
# EMPLOYEE CRUD
# ============================================================

async def create_employee(
    db: AsyncSession,
    *,
    employee_code: str,
    full_name: str,
    position: Optional[str],
    hourly_rate: Decimal,
    daily_working_hours: Decimal,
    cost_center_id: Optional[UUID],
    user_id: Optional[UUID],
    org_id: UUID,
) -> Employee:
    existing = await db.execute(
        select(Employee).where(
            Employee.org_id == org_id,
            Employee.employee_code == employee_code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Employee code '{employee_code}' already exists",
        )

    emp = Employee(
        employee_code=employee_code,
        full_name=full_name,
        position=position,
        hourly_rate=hourly_rate,
        daily_working_hours=daily_working_hours,
        cost_center_id=cost_center_id,
        user_id=user_id,
        org_id=org_id,
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return emp


async def get_employee(db: AsyncSession, emp_id: UUID) -> Employee:
    result = await db.execute(
        select(Employee).where(Employee.id == emp_id, Employee.is_active == True)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return emp


async def list_employees(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
) -> tuple[list[Employee], int]:
    query = select(Employee).where(Employee.is_active == True)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Employee.employee_code.ilike(pattern)) | (Employee.full_name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Employee.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_employee(
    db: AsyncSession,
    emp_id: UUID,
    *,
    update_data: dict,
) -> Employee:
    emp = await get_employee(db, emp_id)
    for field, value in update_data.items():
        if value is not None:
            setattr(emp, field, value)
    await db.commit()
    await db.refresh(emp)
    return emp


async def delete_employee(db: AsyncSession, emp_id: UUID) -> None:
    emp = await get_employee(db, emp_id)
    emp.is_active = False
    await db.commit()


# ============================================================
# TIMESHEET (BR#18-22, BR#26)
# ============================================================

async def create_timesheet(
    db: AsyncSession,
    *,
    employee_id: UUID,
    work_order_id: UUID,
    work_date: date,
    regular_hours: Decimal,
    ot_hours: Decimal,
    ot_type_id: Optional[UUID],
    note: Optional[str],
    created_by: UUID,
    org_id: UUID,
) -> Timesheet:
    # Validate employee exists
    emp = await get_employee(db, employee_id)

    # Validate WO exists and is OPEN
    wo_result = await db.execute(
        select(WorkOrder).where(WorkOrder.id == work_order_id)
    )
    wo = wo_result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status != WOStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Timesheet can only be created for OPEN work orders",
        )

    # BR#19: Lock period — cannot backdate > 7 days
    today = date.today()
    if (today - work_date).days > LOCK_PERIOD_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot create timesheet older than {LOCK_PERIOD_DAYS} days (BR#19)",
        )

    # BR#20: Daily hours ≤ working hours
    existing_hours_result = await db.execute(
        select(func.coalesce(func.sum(Timesheet.regular_hours + Timesheet.ot_hours), 0)).where(
            Timesheet.employee_id == employee_id,
            Timesheet.work_date == work_date,
        )
    )
    existing_hours = existing_hours_result.scalar() or Decimal("0")
    new_total = existing_hours + regular_hours + ot_hours
    if new_total > emp.daily_working_hours + Decimal("8.00"):
        # Allow up to daily_working_hours + 8 hours OT max
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Total daily hours ({new_total}) exceeds limit (BR#20)",
        )

    # BR#18: No overlap — check if same employee already has entry for same WO on same date
    overlap_result = await db.execute(
        select(Timesheet).where(
            Timesheet.employee_id == employee_id,
            Timesheet.work_order_id == work_order_id,
            Timesheet.work_date == work_date,
        )
    )
    if overlap_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Timesheet entry already exists for this employee/WO/date (BR#18)",
        )

    # Validate OT type if provided
    if ot_type_id:
        ot_result = await db.execute(
            select(OTType).where(OTType.id == ot_type_id, OTType.is_active == True)
        )
        if not ot_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="OT type not found")

    ts = Timesheet(
        employee_id=employee_id,
        work_order_id=work_order_id,
        work_date=work_date,
        regular_hours=regular_hours,
        ot_hours=ot_hours,
        ot_type_id=ot_type_id,
        note=note,
        created_by=created_by,
        status=TimesheetStatus.DRAFT,
        org_id=org_id,
    )
    db.add(ts)
    await db.commit()
    await db.refresh(ts)
    return ts


async def get_timesheet(db: AsyncSession, ts_id: UUID) -> Timesheet:
    result = await db.execute(
        select(Timesheet).where(Timesheet.id == ts_id)
    )
    ts = result.scalar_one_or_none()
    if not ts:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    return ts


async def list_timesheets(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    employee_id: Optional[UUID] = None,
    work_order_id: Optional[UUID] = None,
    status_filter: Optional[str] = None,
) -> tuple[list[Timesheet], int]:
    query = select(Timesheet)

    if employee_id:
        query = query.where(Timesheet.employee_id == employee_id)
    if work_order_id:
        query = query.where(Timesheet.work_order_id == work_order_id)
    if status_filter:
        query = query.where(Timesheet.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Timesheet.work_date.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_timesheet(
    db: AsyncSession,
    ts_id: UUID,
    *,
    update_data: dict,
) -> Timesheet:
    ts = await get_timesheet(db, ts_id)

    # Cannot edit FINAL or REJECTED timesheets
    if ts.status in (TimesheetStatus.FINAL, TimesheetStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot edit timesheet in {ts.status.value} status",
        )

    # BR#19: Check lock period for editing
    today = date.today()
    if ts.is_locked or (today - ts.work_date).days > LOCK_PERIOD_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Timesheet is locked — HR must unlock first (BR#19/BR#22)",
        )

    for field, value in update_data.items():
        if value is not None:
            setattr(ts, field, value)

    await db.commit()
    await db.refresh(ts)
    return ts


async def approve_timesheet(
    db: AsyncSession,
    ts_id: UUID,
    *,
    approved_by: UUID,
) -> Timesheet:
    """Supervisor approve (BR#23)."""
    ts = await get_timesheet(db, ts_id)

    if ts.status not in (TimesheetStatus.DRAFT, TimesheetStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot approve timesheet in {ts.status.value} status",
        )

    ts.status = TimesheetStatus.APPROVED
    ts.approved_by = approved_by
    await db.commit()
    await db.refresh(ts)
    return ts


async def final_approve_timesheet(
    db: AsyncSession,
    ts_id: UUID,
    *,
    final_approved_by: UUID,
) -> Timesheet:
    """HR final approve (BR#26). After this, ManHour cost is charged to WO."""
    ts = await get_timesheet(db, ts_id)

    if ts.status != TimesheetStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only APPROVED timesheets can be finalized (BR#26)",
        )

    ts.status = TimesheetStatus.FINAL
    ts.final_approved_by = final_approved_by
    ts.is_locked = True
    await db.commit()
    await db.refresh(ts)
    return ts


async def unlock_timesheet(
    db: AsyncSession,
    ts_id: UUID,
) -> Timesheet:
    """HR unlock a locked timesheet (BR#22)."""
    ts = await get_timesheet(db, ts_id)

    if not ts.is_locked:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Timesheet is not locked",
        )

    ts.is_locked = False
    # Revert to APPROVED so it can be edited and re-finalized
    if ts.status == TimesheetStatus.FINAL:
        ts.status = TimesheetStatus.APPROVED
    await db.commit()
    await db.refresh(ts)
    return ts


# ============================================================
# LEAVE
# ============================================================

async def create_leave(
    db: AsyncSession,
    *,
    employee_id: UUID,
    leave_type: str,
    start_date: date,
    end_date: date,
    reason: Optional[str],
    created_by: UUID,
    org_id: UUID,
) -> Leave:
    await get_employee(db, employee_id)

    leave = Leave(
        employee_id=employee_id,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        created_by=created_by,
        org_id=org_id,
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)
    return leave


async def list_leaves(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    employee_id: Optional[UUID] = None,
) -> tuple[list[Leave], int]:
    query = select(Leave)
    if employee_id:
        query = query.where(Leave.employee_id == employee_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Leave.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def approve_leave(
    db: AsyncSession,
    leave_id: UUID,
    *,
    approved_by: UUID,
    approve: bool = True,
) -> Leave:
    result = await db.execute(
        select(Leave).where(Leave.id == leave_id)
    )
    leave = result.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")

    if leave.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot approve leave in {leave.status.value} status",
        )

    leave.status = LeaveStatus.APPROVED if approve else LeaveStatus.REJECTED
    leave.approved_by = approved_by
    await db.commit()
    await db.refresh(leave)
    return leave


# ============================================================
# PAYROLL
# ============================================================

async def create_payroll_run(
    db: AsyncSession,
    *,
    period_start: date,
    period_end: date,
    note: Optional[str],
    org_id: UUID,
) -> PayrollRun:
    pr = PayrollRun(
        period_start=period_start,
        period_end=period_end,
        note=note,
        org_id=org_id,
    )
    db.add(pr)
    await db.commit()
    await db.refresh(pr)
    return pr


async def list_payroll_runs(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[PayrollRun], int]:
    query = select(PayrollRun)
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(PayrollRun.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def execute_payroll(
    db: AsyncSession,
    payroll_id: UUID,
    *,
    executed_by: UUID,
) -> PayrollRun:
    """Execute payroll — aggregate FINAL timesheets for the period (BR#26)."""
    result = await db.execute(
        select(PayrollRun).where(PayrollRun.id == payroll_id)
    )
    pr = result.scalar_one_or_none()
    if not pr:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    if pr.status != PayrollStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only DRAFT payroll runs can be executed",
        )

    # Sum hours from FINAL timesheets in period
    ts_query = select(
        func.count(func.distinct(Timesheet.employee_id)),
        func.coalesce(func.sum(Timesheet.regular_hours), 0),
        func.coalesce(func.sum(Timesheet.ot_hours), 0),
    ).where(
        Timesheet.status == TimesheetStatus.FINAL,
        Timesheet.work_date >= pr.period_start,
        Timesheet.work_date <= pr.period_end,
        Timesheet.org_id == pr.org_id,
    )
    ts_result = await db.execute(ts_query)
    row = ts_result.one()
    emp_count = row[0] or 0
    total_regular = row[1] or Decimal("0")
    total_ot = row[2] or Decimal("0")

    # Simple total: just sum hours × average rate (actual would join employee rates)
    # For now, store aggregated totals
    pr.employee_count = emp_count
    pr.total_amount = total_regular + total_ot  # Placeholder — real calc needs employee rates
    pr.status = PayrollStatus.EXECUTED
    pr.executed_by = executed_by
    pr.executed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(pr)
    return pr
