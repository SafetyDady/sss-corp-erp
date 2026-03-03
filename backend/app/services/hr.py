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
    PayrollSlip,
    PayrollSlipStatus,
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
    department_id: Optional[UUID] = None,
    supervisor_id: Optional[UUID] = None,
    pay_type: str = "DAILY",
    daily_rate: Optional[Decimal] = None,
    monthly_salary: Optional[Decimal] = None,
    hire_date=None,
    work_schedule_id: Optional[UUID] = None,
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

    # Validate user_id uniqueness — 1 User : 1 Employee only
    if user_id:
        dup_user = await db.execute(
            select(Employee).where(
                Employee.user_id == user_id,
                Employee.is_active == True,
            )
        )
        if dup_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User นี้ถูกเชื่อมกับพนักงานคนอื่นแล้ว (1 User : 1 Employee)",
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
        department_id=department_id,
        supervisor_id=supervisor_id,
        pay_type=pay_type,
        daily_rate=daily_rate,
        monthly_salary=monthly_salary,
        hire_date=hire_date,
        work_schedule_id=work_schedule_id,
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return emp


async def get_employee(db: AsyncSession, emp_id: UUID, *, org_id: Optional[UUID] = None) -> Employee:
    query = select(Employee).where(Employee.id == emp_id, Employee.is_active == True)
    if org_id:
        query = query.where(Employee.org_id == org_id)
    result = await db.execute(query)
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
    org_id: Optional[UUID] = None,
    department_id: Optional[UUID] = None,
) -> tuple[list[Employee], int]:
    query = select(Employee).where(Employee.is_active == True)
    if org_id:
        query = query.where(Employee.org_id == org_id)
    if department_id:
        query = query.where(Employee.department_id == department_id)

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
    org_id: Optional[UUID] = None,
) -> Employee:
    emp = await get_employee(db, emp_id, org_id=org_id)

    # Validate user_id uniqueness on update — 1 User : 1 Employee
    new_user_id = update_data.get("user_id")
    if new_user_id is not None and new_user_id != emp.user_id:
        dup_user = await db.execute(
            select(Employee).where(
                Employee.user_id == new_user_id,
                Employee.is_active == True,
                Employee.id != emp_id,
            )
        )
        if dup_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User นี้ถูกเชื่อมกับพนักงานคนอื่นแล้ว (1 User : 1 Employee)",
            )

    for field, value in update_data.items():
        if value is not None:
            setattr(emp, field, value)
    await db.commit()
    await db.refresh(emp)
    return emp


async def delete_employee(db: AsyncSession, emp_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    emp = await get_employee(db, emp_id, org_id=org_id)
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
    requested_approver_id: Optional[UUID] = None,
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
        requested_approver_id=requested_approver_id,
    )
    db.add(ts)
    await db.commit()
    await db.refresh(ts)
    return ts


async def get_timesheet(db: AsyncSession, ts_id: UUID, *, org_id: Optional[UUID] = None) -> Timesheet:
    query = select(Timesheet).where(Timesheet.id == ts_id)
    if org_id:
        query = query.where(Timesheet.org_id == org_id)
    result = await db.execute(query)
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
    employee_ids: Optional[list[UUID]] = None,
    work_order_id: Optional[UUID] = None,
    status_filter: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[Timesheet], int]:
    query = select(Timesheet)
    if org_id:
        query = query.where(Timesheet.org_id == org_id)

    if employee_id:
        query = query.where(Timesheet.employee_id == employee_id)
    elif employee_ids is not None:
        if employee_ids:
            query = query.where(Timesheet.employee_id.in_(employee_ids))
        else:
            return [], 0

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
    org_id: Optional[UUID] = None,
) -> Timesheet:
    ts = await get_timesheet(db, ts_id, org_id=org_id)

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
    *,
    org_id: Optional[UUID] = None,
) -> Timesheet:
    """HR unlock a locked timesheet (BR#22)."""
    ts = await get_timesheet(db, ts_id, org_id=org_id)

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
    leave_type: Optional[str] = None,
    start_date: date,
    end_date: date,
    reason: Optional[str],
    created_by: UUID,
    org_id: UUID,
    requested_approver_id: Optional[UUID] = None,
    leave_type_id: Optional[UUID] = None,
) -> Leave:
    await get_employee(db, employee_id)

    # Phase 4.3: Calculate days count
    days_count = (end_date - start_date).days + 1

    # Auto-resolve leave_type from leave_type_id if not provided
    if not leave_type and leave_type_id:
        from app.models.master import LeaveType as LeaveTypeModel
        lt_result = await db.execute(
            select(LeaveTypeModel).where(LeaveTypeModel.id == leave_type_id)
        )
        lt_obj = lt_result.scalar_one_or_none()
        if lt_obj:
            leave_type = lt_obj.code
    if not leave_type:
        leave_type = "OTHER"

    # Phase 4.3: Quota check (BR#36) if leave_type_id provided
    if leave_type_id:
        from app.models.hr import LeaveBalance
        from app.models.master import LeaveType as LeaveTypeModel
        lt_result = await db.execute(
            select(LeaveTypeModel).where(LeaveTypeModel.id == leave_type_id)
        )
        lt = lt_result.scalar_one_or_none()
        if not lt:
            raise HTTPException(status_code=404, detail="Leave type not found")

        if lt.default_quota is not None:
            current_year = start_date.year
            bal_result = await db.execute(
                select(LeaveBalance).where(
                    LeaveBalance.employee_id == employee_id,
                    LeaveBalance.leave_type_id == leave_type_id,
                    LeaveBalance.year == current_year,
                )
            )
            balance = bal_result.scalar_one_or_none()
            if not balance:
                # Auto-create balance with default quota
                balance = LeaveBalance(
                    employee_id=employee_id,
                    leave_type_id=leave_type_id,
                    year=current_year,
                    quota=lt.default_quota,
                    used=0,
                    org_id=org_id,
                )
                db.add(balance)
                await db.flush()

            remaining = balance.quota - balance.used
            if days_count > remaining:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"ลาเกินโควต้า: เหลือ {remaining} วัน แต่ขอลา {days_count} วัน (BR#36)",
                )

    leave = Leave(
        employee_id=employee_id,
        leave_type=leave_type,
        leave_type_id=leave_type_id,
        start_date=start_date,
        end_date=end_date,
        days_count=days_count,
        reason=reason,
        created_by=created_by,
        org_id=org_id,
        requested_approver_id=requested_approver_id,
    )
    db.add(leave)
    await db.flush()

    # Phase 4.3: Increment used in leave balance
    if leave_type_id:
        from app.models.hr import LeaveBalance
        current_year = start_date.year
        bal_result = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.leave_type_id == leave_type_id,
                LeaveBalance.year == current_year,
            )
        )
        balance = bal_result.scalar_one_or_none()
        if balance:
            balance.used += days_count

    await db.commit()
    await db.refresh(leave)
    return leave


async def list_leaves(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    employee_id: Optional[UUID] = None,
    employee_ids: Optional[list[UUID]] = None,
    org_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> tuple[list[dict], int]:
    """List leaves with joined employee_name + leave_type info."""
    from app.models.master import LeaveType as LeaveTypeModel

    query = (
        select(
            Leave,
            Employee.full_name.label("employee_name"),
            LeaveTypeModel.name.label("leave_type_name"),
            LeaveTypeModel.code.label("leave_type_code"),
        )
        .outerjoin(Employee, Leave.employee_id == Employee.id)
        .outerjoin(LeaveTypeModel, Leave.leave_type_id == LeaveTypeModel.id)
    )
    if org_id:
        query = query.where(Leave.org_id == org_id)
    if employee_id:
        query = query.where(Leave.employee_id == employee_id)
    elif employee_ids is not None:
        if employee_ids:
            query = query.where(Leave.employee_id.in_(employee_ids))
        else:
            return [], 0
    if status:
        query = query.where(Leave.status == status)

    # Count
    count_filters = []
    if org_id:
        count_filters.append(Leave.org_id == org_id)
    if employee_id:
        count_filters.append(Leave.employee_id == employee_id)
    elif employee_ids is not None:
        if employee_ids:
            count_filters.append(Leave.employee_id.in_(employee_ids))
        else:
            return [], 0
    if status:
        count_filters.append(Leave.status == status)
    count_q = select(func.count()).select_from(
        select(Leave.id).where(*count_filters).subquery() if count_filters else select(Leave.id).subquery()
    )
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    query = query.order_by(Leave.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()

    items = []
    for row in rows:
        leave = row[0]
        d = {
            "id": leave.id,
            "employee_id": leave.employee_id,
            "employee_name": row[1],
            "leave_type": leave.leave_type,
            "leave_type_id": leave.leave_type_id,
            "leave_type_name": row[2],
            "leave_type_code": row[3],
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "days_count": leave.days_count,
            "reason": leave.reason,
            "status": leave.status,
            "created_by": leave.created_by,
            "approved_by": leave.approved_by,
            "requested_approver_id": leave.requested_approver_id,
            "created_at": leave.created_at,
            "updated_at": leave.updated_at,
        }
        items.append(d)
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
# STANDARD TIMESHEET + BATCH  (Phase 4.4 — Timesheet Redesign)
# ============================================================

async def list_standard_timesheets(
    db: AsyncSession,
    *,
    employee_id: Optional[UUID] = None,
    employee_ids: Optional[list[UUID]] = None,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list, int]:
    from app.models.hr import StandardTimesheet
    query = select(StandardTimesheet)
    if org_id:
        query = query.where(StandardTimesheet.org_id == org_id)
    if employee_id:
        query = query.where(StandardTimesheet.employee_id == employee_id)
    elif employee_ids is not None:
        if employee_ids:
            query = query.where(StandardTimesheet.employee_id.in_(employee_ids))
        else:
            return [], 0
    if period_start:
        query = query.where(StandardTimesheet.work_date >= period_start)
    if period_end:
        query = query.where(StandardTimesheet.work_date <= period_end)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(StandardTimesheet.work_date.asc())
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def generate_standard_timesheets(
    db: AsyncSession,
    *,
    employee_id: Optional[UUID] = None,
    period_start: date,
    period_end: date,
    org_id: UUID,
) -> int:
    """
    Auto-generate StandardTimesheet records for working days.
    Checks approved leaves and marks days accordingly.
    Phase 4.9: Also checks ShiftRoster for employees with work_schedule_id.
    Returns count of records created.
    """
    from app.models.hr import DayStatus, ShiftRoster, StandardTimesheet, LeaveBalance
    from app.models.master import LeaveType as LeaveTypeModel, ShiftType
    from app.models.organization import OrgWorkConfig

    # Get org work config (fallback for employees without schedule)
    wc_result = await db.execute(
        select(OrgWorkConfig).where(OrgWorkConfig.org_id == org_id)
    )
    work_config = wc_result.scalar_one_or_none()
    org_working_days = work_config.working_days if work_config else [1, 2, 3, 4, 5, 6]
    org_hours = work_config.hours_per_day if work_config else Decimal("8.00")

    # Get employees
    emp_query = select(Employee).where(Employee.is_active == True)
    if employee_id:
        emp_query = emp_query.where(Employee.id == employee_id)
    emp_result = await db.execute(emp_query)
    employees = list(emp_result.scalars().all())

    # Get approved leaves in the period
    leave_query = select(Leave).where(
        Leave.status == LeaveStatus.APPROVED,
        Leave.start_date <= period_end,
        Leave.end_date >= period_start,
    )
    if employee_id:
        leave_query = leave_query.where(Leave.employee_id == employee_id)
    leave_result = await db.execute(leave_query)
    all_leaves = list(leave_result.scalars().all())

    # Build leave lookup: {(employee_id, date): leave}
    leave_map = {}
    for lv in all_leaves:
        d = max(lv.start_date, period_start)
        end = min(lv.end_date, period_end)
        while d <= end:
            leave_map[(lv.employee_id, d)] = lv
            d += timedelta(days=1)

    # Get leave type info for paid/unpaid determination
    leave_type_map = {}
    if all_leaves:
        lt_ids = {lv.leave_type_id for lv in all_leaves if lv.leave_type_id}
        if lt_ids:
            lt_result = await db.execute(
                select(LeaveTypeModel).where(LeaveTypeModel.id.in_(lt_ids))
            )
            for lt in lt_result.scalars().all():
                leave_type_map[lt.id] = lt

    # Phase 4.9: Get shift rosters in the period for all relevant employees
    emp_ids = [e.id for e in employees]
    roster_map = {}  # {(employee_id, date): roster}
    if emp_ids:
        roster_result = await db.execute(
            select(ShiftRoster).where(
                ShiftRoster.employee_id.in_(emp_ids),
                ShiftRoster.roster_date >= period_start,
                ShiftRoster.roster_date <= period_end,
            )
        )
        for r in roster_result.scalars().all():
            roster_map[(r.employee_id, r.roster_date)] = r

    # Phase 4.9: Get shift type working hours lookup
    shift_hours_map = {}  # {shift_type_id: working_hours}
    shift_type_ids = {r.shift_type_id for r in roster_map.values() if r.shift_type_id}
    if shift_type_ids:
        st_result = await db.execute(
            select(ShiftType).where(ShiftType.id.in_(shift_type_ids))
        )
        for st in st_result.scalars().all():
            shift_hours_map[st.id] = st.working_hours

    created_count = 0
    current_date = period_start
    while current_date <= period_end:
        iso_weekday = current_date.isoweekday()

        for emp in employees:
            # Check if record already exists
            existing = await db.execute(
                select(StandardTimesheet).where(
                    StandardTimesheet.employee_id == emp.id,
                    StandardTimesheet.work_date == current_date,
                )
            )
            if existing.scalar_one_or_none():
                continue

            leave = leave_map.get((emp.id, current_date))

            # Phase 4.9: Resolve work status using roster or OrgWorkConfig fallback
            roster = roster_map.get((emp.id, current_date))
            if roster:
                # Employee has a roster entry for this date
                is_working = roster.is_working_day
                emp_hours = Decimal(str(shift_hours_map.get(roster.shift_type_id, 0))) if roster.shift_type_id else Decimal("0.00")
            else:
                # Fallback to OrgWorkConfig
                is_working = iso_weekday in org_working_days
                emp_hours = emp.daily_working_hours or org_hours

            if not is_working:
                # Non-working day — skip unless there's a leave record
                if not leave:
                    continue
                actual_status = DayStatus.HOLIDAY
                scheduled_hours = Decimal("0.00")
                leave_ref = None
            elif leave:
                # Working day with approved leave
                lt = leave_type_map.get(leave.leave_type_id) if leave.leave_type_id else None
                if lt and not lt.is_paid:
                    actual_status = DayStatus.LEAVE_UNPAID
                    scheduled_hours = Decimal("0.00")
                else:
                    actual_status = DayStatus.LEAVE_PAID
                    scheduled_hours = emp_hours
                leave_ref = leave.id
            else:
                # Normal working day
                actual_status = DayStatus.WORK
                scheduled_hours = emp_hours
                leave_ref = None

            st_entry = StandardTimesheet(
                employee_id=emp.id,
                work_date=current_date,
                scheduled_hours=scheduled_hours,
                actual_status=actual_status,
                leave_id=leave_ref,
                org_id=org_id,
            )
            db.add(st_entry)
            created_count += 1

        current_date += timedelta(days=1)

    await db.commit()
    return created_count


async def create_timesheet_batch(
    db: AsyncSession,
    *,
    employee_id: UUID,
    work_date: date,
    entries: list[dict],
    created_by: UUID,
    org_id: UUID,
    requested_approver_id: Optional[UUID] = None,
) -> list[Timesheet]:
    """
    Create multiple WO time entries for a single employee on a single date.
    Validates total hours, WO status, and overlaps.
    """
    emp = await get_employee(db, employee_id)

    # BR#19: Lock period
    today = date.today()
    if (today - work_date).days > LOCK_PERIOD_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot create timesheet older than {LOCK_PERIOD_DAYS} days (BR#19)",
        )

    # BR#39: Check if employee is on leave this day
    from app.models.hr import StandardTimesheet, DayStatus
    std_result = await db.execute(
        select(StandardTimesheet).where(
            StandardTimesheet.employee_id == employee_id,
            StandardTimesheet.work_date == work_date,
            StandardTimesheet.actual_status.in_([DayStatus.LEAVE_PAID, DayStatus.LEAVE_UNPAID]),
        )
    )
    if std_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="วันนี้คุณลา ไม่สามารถกรอก WO Time Entry ได้ (BR#39)",
        )

    # Calculate total hours from existing entries for this day
    existing_hours_result = await db.execute(
        select(func.coalesce(func.sum(Timesheet.regular_hours), 0)).where(
            Timesheet.employee_id == employee_id,
            Timesheet.work_date == work_date,
        )
    )
    existing_regular = existing_hours_result.scalar() or Decimal("0")

    # Sum new regular hours
    new_regular_total = sum(Decimal(str(e.get("regular_hours", 0))) for e in entries)
    total_regular = existing_regular + new_regular_total

    # BR#20: Regular hours per day check
    if total_regular > emp.daily_working_hours:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"ชั่วโมงปกติรวม ({total_regular}) เกินกำหนด {emp.daily_working_hours} ชม./วัน (BR#20)",
        )

    created = []
    for entry in entries:
        wo_id = entry["work_order_id"]
        regular_hours = Decimal(str(entry.get("regular_hours", 0)))
        ot_hours = Decimal(str(entry.get("ot_hours", 0)))
        ot_type_id = entry.get("ot_type_id")
        note = entry.get("note")

        # Validate WO is OPEN
        wo_result = await db.execute(
            select(WorkOrder).where(WorkOrder.id == wo_id)
        )
        wo = wo_result.scalar_one_or_none()
        if not wo:
            raise HTTPException(status_code=404, detail=f"Work order {wo_id} not found")
        if wo.status != WOStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Work order {wo_id} is not OPEN",
            )

        # BR#18: No duplicate for same employee/WO/date
        overlap = await db.execute(
            select(Timesheet).where(
                Timesheet.employee_id == employee_id,
                Timesheet.work_order_id == wo_id,
                Timesheet.work_date == work_date,
            )
        )
        if overlap.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Timesheet already exists for WO {wo_id} on {work_date} (BR#18)",
            )

        # Validate OT type
        if ot_type_id:
            ot_result = await db.execute(
                select(OTType).where(OTType.id == ot_type_id, OTType.is_active == True)
            )
            if not ot_result.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="OT type not found")

        ts = Timesheet(
            employee_id=employee_id,
            work_order_id=wo_id,
            work_date=work_date,
            regular_hours=regular_hours,
            ot_hours=ot_hours,
            ot_type_id=ot_type_id,
            note=note,
            created_by=created_by,
            status=TimesheetStatus.DRAFT,
            org_id=org_id,
            requested_approver_id=requested_approver_id,
        )
        db.add(ts)
        created.append(ts)

    await db.commit()
    for ts in created:
        await db.refresh(ts)
    return created


# ============================================================
# LEAVE BALANCE  (Phase 4.3 — BR#36)
# ============================================================

async def list_leave_balances(
    db: AsyncSession,
    *,
    employee_id: Optional[UUID] = None,
    employee_ids: Optional[list[UUID]] = None,
    year: Optional[int] = None,
    org_id: Optional[UUID] = None,
) -> list[dict]:
    """List leave balances with joined employee_name + leave_type info."""
    from app.models.hr import LeaveBalance
    from app.models.master import LeaveType as LeaveTypeModel

    query = (
        select(
            LeaveBalance,
            Employee.full_name.label("employee_name"),
            LeaveTypeModel.name.label("leave_type_name"),
            LeaveTypeModel.code.label("leave_type_code"),
        )
        .outerjoin(Employee, LeaveBalance.employee_id == Employee.id)
        .outerjoin(LeaveTypeModel, LeaveBalance.leave_type_id == LeaveTypeModel.id)
    )
    if org_id:
        query = query.where(Employee.org_id == org_id)
    if employee_id:
        query = query.where(LeaveBalance.employee_id == employee_id)
    elif employee_ids is not None:
        if employee_ids:
            query = query.where(LeaveBalance.employee_id.in_(employee_ids))
        else:
            return []
    if year:
        query = query.where(LeaveBalance.year == year)
    query = query.order_by(LeaveBalance.year.desc(), Employee.full_name.asc())
    result = await db.execute(query)
    rows = result.all()

    items = []
    for row in rows:
        bal = row[0]
        items.append({
            "id": bal.id,
            "employee_id": bal.employee_id,
            "employee_name": row[1],
            "leave_type_id": bal.leave_type_id,
            "leave_type_name": row[2],
            "leave_type_code": row[3],
            "year": bal.year,
            "quota": bal.quota,
            "used": bal.used,
            "created_at": bal.created_at,
            "updated_at": bal.updated_at,
        })
    return items


async def update_leave_balance(
    db: AsyncSession,
    balance_id: UUID,
    *,
    update_data: dict,
    org_id: Optional[UUID] = None,
) -> "LeaveBalance":
    from app.models.hr import LeaveBalance
    query = select(LeaveBalance).where(LeaveBalance.id == balance_id)
    if org_id:
        query = query.join(Employee, LeaveBalance.employee_id == Employee.id).where(Employee.org_id == org_id)
    result = await db.execute(query)
    balance = result.scalar_one_or_none()
    if not balance:
        raise HTTPException(status_code=404, detail="Leave balance not found")

    for field, value in update_data.items():
        if value is not None:
            setattr(balance, field, value)

    await db.commit()
    await db.refresh(balance)
    return balance


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
    org_id: Optional[UUID] = None,
) -> tuple[list[PayrollRun], int]:
    query = select(PayrollRun)
    if org_id:
        query = query.where(PayrollRun.org_id == org_id)
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
    """Execute payroll — aggregate FINAL timesheets for the period (BR#26).
    Also generates PayrollSlip per employee (Go-Live G7)."""
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

    # Get all active employees in org
    emp_result = await db.execute(
        select(Employee).where(
            Employee.org_id == pr.org_id,
            Employee.is_active == True,
        )
    )
    employees = {e.id: e for e in emp_result.scalars().all()}

    # Get per-employee FINAL timesheet aggregates for the period
    ts_query = select(
        Timesheet.employee_id,
        func.coalesce(func.sum(Timesheet.regular_hours), 0).label("regular_hours"),
        func.coalesce(func.sum(Timesheet.ot_hours), 0).label("ot_hours"),
    ).where(
        Timesheet.status == TimesheetStatus.FINAL,
        Timesheet.work_date >= pr.period_start,
        Timesheet.work_date <= pr.period_end,
        Timesheet.org_id == pr.org_id,
    ).group_by(Timesheet.employee_id)

    ts_result = await db.execute(ts_query)
    ts_rows = ts_result.all()
    ts_map = {row.employee_id: row for row in ts_rows}

    # Calculate working days in period for base salary
    from app.models.organization import OrgWorkConfig
    wc_result = await db.execute(
        select(OrgWorkConfig).where(OrgWorkConfig.org_id == pr.org_id)
    )
    work_config = wc_result.scalar_one_or_none()
    working_day_nums = work_config.working_days if work_config else [1, 2, 3, 4, 5, 6]
    hours_per_day = float(work_config.hours_per_day) if work_config else 8.0

    # Count working days in period
    working_days_count = 0
    d = pr.period_start
    while d <= pr.period_end:
        if d.isoweekday() in working_day_nums:
            working_days_count += 1
        d += timedelta(days=1)

    # Generate PayrollSlip per employee + aggregate totals
    total_amount = Decimal("0")
    slip_count = 0

    for emp_id, emp in employees.items():
        ts_data = ts_map.get(emp_id)
        regular_hours = Decimal(str(ts_data.regular_hours)) if ts_data else Decimal("0")
        ot_hours = Decimal(str(ts_data.ot_hours)) if ts_data else Decimal("0")

        # Calculate base salary based on pay type
        if emp.pay_type.value == "MONTHLY" and emp.monthly_salary:
            base_salary = emp.monthly_salary
        elif emp.pay_type.value == "DAILY" and emp.daily_rate:
            base_salary = emp.daily_rate * working_days_count
        else:
            # Fallback: hourly_rate × hours_per_day × working_days
            base_salary = emp.hourly_rate * Decimal(str(hours_per_day)) * working_days_count

        # OT amount = ot_hours × hourly_rate × 1.5 (simplified — actual uses OT types)
        ot_amount = ot_hours * emp.hourly_rate * Decimal("1.5")
        gross_amount = base_salary + ot_amount
        deductions = Decimal("0")  # Placeholder
        net_amount = gross_amount - deductions

        slip = PayrollSlip(
            org_id=pr.org_id,
            payroll_run_id=pr.id,
            employee_id=emp_id,
            base_salary=base_salary,
            regular_hours=regular_hours,
            ot_hours=ot_hours,
            ot_amount=ot_amount,
            gross_amount=gross_amount,
            deductions=deductions,
            net_amount=net_amount,
            status=PayrollSlipStatus.DRAFT,
        )
        db.add(slip)
        total_amount += net_amount
        slip_count += 1

    # Update payroll run
    pr.employee_count = slip_count
    pr.total_amount = total_amount
    pr.status = PayrollStatus.EXECUTED
    pr.executed_by = executed_by
    pr.executed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(pr)
    return pr


# ============================================================
# PAYROLL SLIP  (Go-Live G7)
# ============================================================

async def release_payslips(
    db: AsyncSession,
    payroll_run_id: UUID,
    *,
    org_id: UUID,
) -> int:
    """Release all DRAFT payslips for a payroll run → RELEASED (visible to staff)."""
    from sqlalchemy import update as sql_update
    result = await db.execute(
        select(PayrollRun).where(
            PayrollRun.id == payroll_run_id,
            PayrollRun.org_id == org_id,
        )
    )
    pr = result.scalar_one_or_none()
    if not pr:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    if pr.status != PayrollStatus.EXECUTED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only EXECUTED payroll runs can have slips released",
        )

    stmt = (
        sql_update(PayrollSlip)
        .where(
            PayrollSlip.payroll_run_id == payroll_run_id,
            PayrollSlip.status == PayrollSlipStatus.DRAFT,
        )
        .values(
            status=PayrollSlipStatus.RELEASED,
            released_at=datetime.now(timezone.utc),
        )
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount


async def get_my_payslips(
    db: AsyncSession,
    *,
    employee_id: UUID,
    org_id: UUID,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """Get payslips for a specific employee (staff sees only RELEASED)."""
    base = (
        select(PayrollSlip, PayrollRun.period_start, PayrollRun.period_end)
        .join(PayrollRun, PayrollSlip.payroll_run_id == PayrollRun.id)
        .where(
            PayrollSlip.employee_id == employee_id,
            PayrollSlip.org_id == org_id,
            PayrollSlip.status == PayrollSlipStatus.RELEASED,
        )
    )

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    rows = await db.execute(
        base.order_by(PayrollRun.period_end.desc()).limit(limit).offset(offset)
    )
    items = []
    for slip, p_start, p_end in rows.all():
        items.append({
            "id": slip.id,
            "payroll_run_id": slip.payroll_run_id,
            "employee_id": slip.employee_id,
            "period_start": p_start,
            "period_end": p_end,
            "base_salary": slip.base_salary,
            "regular_hours": slip.regular_hours,
            "ot_hours": slip.ot_hours,
            "ot_amount": slip.ot_amount,
            "gross_amount": slip.gross_amount,
            "deductions": slip.deductions,
            "net_amount": slip.net_amount,
            "status": slip.status.value,
            "released_at": slip.released_at,
            "created_at": slip.created_at,
            "updated_at": slip.updated_at,
        })
    return items, total


async def get_payslips_for_run(
    db: AsyncSession,
    payroll_run_id: UUID,
    *,
    org_id: UUID,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """Get all payslips for a payroll run (manager/owner view)."""
    base = (
        select(PayrollSlip, Employee.full_name, Employee.employee_code)
        .join(Employee, PayrollSlip.employee_id == Employee.id)
        .where(
            PayrollSlip.payroll_run_id == payroll_run_id,
            PayrollSlip.org_id == org_id,
        )
    )

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    rows = await db.execute(
        base.order_by(Employee.employee_code).limit(limit).offset(offset)
    )
    items = []
    for slip, emp_name, emp_code in rows.all():
        items.append({
            "id": slip.id,
            "payroll_run_id": slip.payroll_run_id,
            "employee_id": slip.employee_id,
            "employee_name": emp_name,
            "employee_code": emp_code,
            "base_salary": slip.base_salary,
            "regular_hours": slip.regular_hours,
            "ot_hours": slip.ot_hours,
            "ot_amount": slip.ot_amount,
            "gross_amount": slip.gross_amount,
            "deductions": slip.deductions,
            "net_amount": slip.net_amount,
            "status": slip.status.value,
            "released_at": slip.released_at,
            "created_at": slip.created_at,
            "updated_at": slip.updated_at,
        })
    return items, total


# ============================================================
# PROFILE SELF-EDIT  (Go-Live G7)
# ============================================================

async def update_profile_self(
    db: AsyncSession,
    user_id: UUID,
    org_id: UUID,
    *,
    full_name: Optional[str] = None,
    position: Optional[str] = None,
) -> Employee:
    """Update own employee profile (full_name + position only)."""
    result = await db.execute(
        select(Employee).where(
            Employee.user_id == user_id,
            Employee.org_id == org_id,
            Employee.is_active == True,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    if full_name is not None:
        emp.full_name = full_name
    if position is not None:
        emp.position = position

    await db.commit()
    await db.refresh(emp)
    return emp


# ============================================================
# SHIFT ROSTER  (Phase 4.9 — Shift Management)
# ============================================================

async def generate_shift_roster(
    db: AsyncSession,
    *,
    employee_ids: Optional[list[UUID]] = None,
    start_date: date,
    end_date: date,
    org_id: UUID,
    overwrite_existing: bool = False,
    work_schedule_id: Optional[UUID] = None,
    pattern_offset: Optional[int] = None,
) -> dict:
    """
    Auto-generate ShiftRoster entries based on employee's WorkSchedule.
    For FIXED: checks isoweekday in working_days → creates roster with default shift.
    For ROTATING: calculates cycle position from cycle_start_date.
    If work_schedule_id is provided, use it as override for all employees in this call
    (allows staff to pick their own schedule without changing employee record).
    Returns {created_count, skipped_count, employee_count}.
    """
    from app.models.hr import ShiftRoster
    from app.models.master import ShiftType, WorkSchedule, ScheduleType

    # Get employees — if override schedule provided, don't require work_schedule_id on employee
    emp_query = select(Employee).where(
        Employee.is_active == True,
        Employee.org_id == org_id,
    )
    if not work_schedule_id:
        # Original behavior: only employees with assigned schedule
        emp_query = emp_query.where(Employee.work_schedule_id.isnot(None))
    if employee_ids:
        emp_query = emp_query.where(Employee.id.in_(employee_ids))
    emp_result = await db.execute(emp_query)
    employees = list(emp_result.scalars().all())

    if not employees:
        return {"created_count": 0, "skipped_count": 0, "employee_count": 0}

    # Get all work schedules (include override schedule)
    schedule_ids = {e.work_schedule_id for e in employees if e.work_schedule_id}
    if work_schedule_id:
        schedule_ids.add(work_schedule_id)
    ws_result = await db.execute(
        select(WorkSchedule).where(WorkSchedule.id.in_(schedule_ids))
    )
    schedules = {ws.id: ws for ws in ws_result.scalars().all()}

    # Get shift types by code for ROTATING pattern lookup
    st_result = await db.execute(
        select(ShiftType).where(
            ShiftType.org_id == org_id,
            ShiftType.is_active == True,
        )
    )
    shift_by_code = {st.code: st for st in st_result.scalars().all()}

    created_count = 0
    skipped_count = 0

    for emp in employees:
        # Use override schedule if provided, otherwise employee's assigned schedule
        effective_schedule_id = work_schedule_id or emp.work_schedule_id
        ws = schedules.get(effective_schedule_id)
        if not ws:
            continue

        # Validate cycle_start_date for ROTATING schedules
        if ws.schedule_type == ScheduleType.ROTATING and ws.cycle_start_date:
            if ws.cycle_start_date > start_date:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cycle start date ({ws.cycle_start_date}) cannot be after generation start date ({start_date}). "
                           f"Please update the work schedule's cycle_start_date.",
                )

        current = start_date
        while current <= end_date:
            # Check if roster already exists
            existing = await db.execute(
                select(ShiftRoster).where(
                    ShiftRoster.employee_id == emp.id,
                    ShiftRoster.roster_date == current,
                )
            )
            existing_roster = existing.scalar_one_or_none()

            if existing_roster:
                if not overwrite_existing or existing_roster.is_manual_override:
                    skipped_count += 1
                    current += timedelta(days=1)
                    continue
                # Overwrite: delete existing
                await db.delete(existing_roster)
                await db.flush()

            # Determine shift for this date
            shift_type_id = None
            is_working = False

            if ws.schedule_type == ScheduleType.FIXED:
                iso_weekday = current.isoweekday()
                if ws.working_days and iso_weekday in ws.working_days:
                    is_working = True
                    shift_type_id = ws.default_shift_type_id
            elif ws.schedule_type == ScheduleType.ROTATING:
                if ws.rotation_pattern and ws.cycle_start_date:
                    pat_len = len(ws.rotation_pattern)
                    if pattern_offset is not None:
                        # User explicitly chose starting position:
                        # day 1 of generation = pattern_offset, day 2 = offset+1, etc.
                        day_in_period = (current - start_date).days
                        position = (day_in_period + pattern_offset) % pat_len
                    else:
                        # Default: calculate from cycle_start_date (historical reference)
                        days_since = (current - ws.cycle_start_date).days
                        position = days_since % pat_len
                    pattern_entry = ws.rotation_pattern[position]

                    if pattern_entry.upper() == "OFF":
                        is_working = False
                    else:
                        is_working = True
                        shift = shift_by_code.get(pattern_entry.upper())
                        if shift:
                            shift_type_id = shift.id

            roster = ShiftRoster(
                employee_id=emp.id,
                roster_date=current,
                shift_type_id=shift_type_id,
                is_working_day=is_working,
                is_manual_override=False,
                org_id=org_id,
            )
            db.add(roster)
            created_count += 1

            current += timedelta(days=1)

    await db.commit()
    return {
        "created_count": created_count,
        "skipped_count": skipped_count,
        "employee_count": len(employees),
    }


async def list_shift_rosters(
    db: AsyncSession,
    *,
    employee_id: Optional[UUID] = None,
    employee_ids: Optional[list[UUID]] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    org_id: UUID,
    limit: int = 500,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """List shift rosters with joined employee and shift type info."""
    from app.models.hr import ShiftRoster
    from app.models.master import ShiftType

    query = select(ShiftRoster).where(ShiftRoster.org_id == org_id)

    if employee_id:
        query = query.where(ShiftRoster.employee_id == employee_id)
    if employee_ids:
        query = query.where(ShiftRoster.employee_id.in_(employee_ids))
    if start_date:
        query = query.where(ShiftRoster.roster_date >= start_date)
    if end_date:
        query = query.where(ShiftRoster.roster_date <= end_date)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(ShiftRoster.roster_date, ShiftRoster.employee_id).limit(limit).offset(offset)
    result = await db.execute(query)
    rosters = list(result.scalars().all())

    # Join employee names and shift type info
    emp_ids = {r.employee_id for r in rosters}
    st_ids = {r.shift_type_id for r in rosters if r.shift_type_id}

    emp_map = {}
    if emp_ids:
        emp_result = await db.execute(select(Employee).where(Employee.id.in_(emp_ids)))
        emp_map = {e.id: e for e in emp_result.scalars().all()}

    st_map = {}
    if st_ids:
        st_result = await db.execute(select(ShiftType).where(ShiftType.id.in_(st_ids)))
        st_map = {s.id: s for s in st_result.scalars().all()}

    items = []
    for r in rosters:
        emp = emp_map.get(r.employee_id)
        st = st_map.get(r.shift_type_id) if r.shift_type_id else None
        items.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": emp.full_name if emp else None,
            "roster_date": r.roster_date,
            "shift_type_id": r.shift_type_id,
            "shift_type_code": st.code if st else None,
            "shift_type_name": st.name if st else None,
            "start_time": str(st.start_time)[:5] if st and st.start_time else None,
            "end_time": str(st.end_time)[:5] if st and st.end_time else None,
            "working_hours": st.working_hours if st else None,
            "is_working_day": r.is_working_day,
            "is_manual_override": r.is_manual_override,
            "note": r.note,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        })

    return items, total


async def update_shift_roster(
    db: AsyncSession,
    roster_id: UUID,
    *,
    update_data: dict,
    org_id: UUID,
) -> dict:
    """Update a shift roster entry (manual override)."""
    from app.models.hr import ShiftRoster
    from app.models.master import ShiftType

    result = await db.execute(
        select(ShiftRoster).where(
            ShiftRoster.id == roster_id,
            ShiftRoster.org_id == org_id,
        )
    )
    roster = result.scalar_one_or_none()
    if not roster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift roster entry not found",
        )

    for field, value in update_data.items():
        if value is not None:
            setattr(roster, field, value)

    # Mark as manual override
    roster.is_manual_override = True

    await db.commit()
    await db.refresh(roster)

    # Get joined info
    emp = await db.execute(select(Employee).where(Employee.id == roster.employee_id))
    emp_obj = emp.scalar_one_or_none()

    st = None
    if roster.shift_type_id:
        st_result = await db.execute(select(ShiftType).where(ShiftType.id == roster.shift_type_id))
        st = st_result.scalar_one_or_none()

    return {
        "id": roster.id,
        "employee_id": roster.employee_id,
        "employee_name": emp_obj.full_name if emp_obj else None,
        "roster_date": roster.roster_date,
        "shift_type_id": roster.shift_type_id,
        "shift_type_code": st.code if st else None,
        "shift_type_name": st.name if st else None,
        "is_working_day": roster.is_working_day,
        "is_manual_override": roster.is_manual_override,
        "note": roster.note,
        "created_at": roster.created_at,
        "updated_at": roster.updated_at,
    }
