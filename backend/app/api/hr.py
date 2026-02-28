"""
SSS Corp ERP — HR API Routes
Phase 2: Employee, Timesheet, Leave, Payroll

Endpoints (from CLAUDE.md):
  GET    /api/hr/employees                    hr.employee.read
  POST   /api/hr/employees                    hr.employee.create
  PUT    /api/hr/employees/{id}               hr.employee.update
  DELETE /api/hr/employees/{id}               hr.employee.delete

  GET    /api/hr/timesheet                    hr.timesheet.read
  POST   /api/hr/timesheet                    hr.timesheet.create
  PUT    /api/hr/timesheet/{id}               hr.timesheet.update
  POST   /api/hr/timesheet/{id}/approve       hr.timesheet.approve
  POST   /api/hr/timesheet/{id}/final         hr.timesheet.execute
  POST   /api/hr/timesheet/{id}/unlock        hr.timesheet.execute

  GET    /api/hr/leave                        hr.leave.read
  POST   /api/hr/leave                        hr.leave.create
  POST   /api/hr/leave/{id}/approve           hr.leave.approve

  GET    /api/hr/payroll                      hr.payroll.read
  POST   /api/hr/payroll                      hr.payroll.create
  POST   /api/hr/payroll/run                  hr.payroll.execute
  GET    /api/hr/payroll/export               hr.payroll.export
"""

import csv
import io
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.hr import (
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeResponse,
    EmployeeUpdate,
    LeaveBalanceListResponse,
    LeaveBalanceResponse,
    LeaveBalanceUpdate,
    LeaveCreate,
    LeaveListResponse,
    LeaveResponse,
    PayrollRunCreate,
    PayrollRunListResponse,
    PayrollRunResponse,
    StandardTimesheetGenerate,
    StandardTimesheetListResponse,
    TimesheetBatchCreate,
    TimesheetCreate,
    TimesheetListResponse,
    TimesheetResponse,
    TimesheetUpdate,
)
from app.services.hr import (
    approve_leave,
    approve_timesheet,
    create_employee,
    create_leave,
    create_payroll_run,
    create_timesheet,
    create_timesheet_batch,
    delete_employee,
    execute_payroll,
    final_approve_timesheet,
    generate_standard_timesheets,
    get_employee,
    get_timesheet,
    list_employees,
    list_leave_balances,
    list_leaves,
    list_payroll_runs,
    list_standard_timesheets,
    list_timesheets,
    unlock_timesheet,
    update_employee,
    update_leave_balance,
    update_timesheet,
)
from app.services.organization import check_approval_bypass

hr_router = APIRouter(prefix="/api/hr", tags=["hr"])


# ============================================================
# EMPLOYEE ROUTES
# ============================================================

@hr_router.get(
    "/employees",
    response_model=EmployeeListResponse,
    dependencies=[Depends(require("hr.employee.read"))],
)
async def api_list_employees(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    role = token.get("role", "")
    user_id = UUID(token["sub"])

    department_id = None
    if role == "supervisor":
        from app.api._helpers import resolve_employee
        emp = await resolve_employee(db, user_id)
        if emp and emp.department_id:
            department_id = emp.department_id
        else:
            return EmployeeListResponse(items=[], total=0, limit=limit, offset=offset)
    # manager/owner → ไม่ filter

    items, total = await list_employees(
        db, limit=limit, offset=offset, search=search,
        org_id=org_id, department_id=department_id,
    )
    return EmployeeListResponse(items=items, total=total, limit=limit, offset=offset)


@hr_router.post(
    "/employees",
    response_model=EmployeeResponse,
    status_code=201,
    dependencies=[Depends(require("hr.employee.create"))],
)
async def api_create_employee(
    body: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_employee(
        db,
        employee_code=body.employee_code,
        full_name=body.full_name,
        position=body.position,
        hourly_rate=body.hourly_rate,
        daily_working_hours=body.daily_working_hours,
        cost_center_id=body.cost_center_id,
        user_id=body.user_id,
        org_id=org_id,
        department_id=body.department_id,
        supervisor_id=body.supervisor_id,
        pay_type=body.pay_type,
        daily_rate=body.daily_rate,
        monthly_salary=body.monthly_salary,
        hire_date=body.hire_date,
    )


@hr_router.get(
    "/employees/{emp_id}",
    response_model=EmployeeResponse,
    dependencies=[Depends(require("hr.employee.read"))],
)
async def api_get_employee(
    emp_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_employee(db, emp_id, org_id=org_id)


@hr_router.put(
    "/employees/{emp_id}",
    response_model=EmployeeResponse,
    dependencies=[Depends(require("hr.employee.update"))],
)
async def api_update_employee(
    emp_id: UUID,
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    return await update_employee(db, emp_id, update_data=update_data, org_id=org_id)


@hr_router.delete(
    "/employees/{emp_id}",
    status_code=204,
    dependencies=[Depends(require("hr.employee.delete"))],
)
async def api_delete_employee(
    emp_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_employee(db, emp_id, org_id=org_id)


# ============================================================
# TIMESHEET ROUTES (BR#18-22, BR#26)
# ============================================================

@hr_router.get(
    "/timesheet",
    response_model=TimesheetListResponse,
    dependencies=[Depends(require("hr.timesheet.read"))],
)
async def api_list_timesheets(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    employee_id: Optional[UUID] = Query(default=None),
    work_order_id: Optional[UUID] = Query(default=None),
    status: Optional[str] = Query(
        default=None,
        pattern=r"^(DRAFT|SUBMITTED|APPROVED|FINAL|REJECTED)$",
    ),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])
    role = token.get("role", "")

    # Data scope enforcement
    from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids

    filter_employee_id = employee_id
    filter_employee_ids = None

    if role == "staff":
        emp_id = await resolve_employee_id(db, user_id)
        if not emp_id:
            return TimesheetListResponse(items=[], total=0, limit=limit, offset=offset)
        filter_employee_id = emp_id  # force own data only
    elif role == "supervisor":
        if not employee_id:  # ไม่ได้ระบุ employee_id → filter ทั้งแผนก
            emp = await resolve_employee(db, user_id)
            if emp and emp.department_id:
                filter_employee_ids = await get_department_employee_ids(db, emp.department_id, org_id)
            else:
                return TimesheetListResponse(items=[], total=0, limit=limit, offset=offset)
    # manager/owner → ไม่ filter เพิ่ม (เห็นทั้ง org)

    items, total = await list_timesheets(
        db, limit=limit, offset=offset,
        employee_id=filter_employee_id,
        employee_ids=filter_employee_ids,
        work_order_id=work_order_id,
        status_filter=status, org_id=org_id,
    )
    return TimesheetListResponse(items=items, total=total, limit=limit, offset=offset)


@hr_router.post(
    "/timesheet",
    response_model=TimesheetResponse,
    status_code=201,
    dependencies=[Depends(require("hr.timesheet.create"))],
)
async def api_create_timesheet(
    body: TimesheetCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    role = token.get("role", "")

    # Data scope enforcement — staff can only create for themselves
    if role == "staff":
        from app.api._helpers import resolve_employee_id
        own_emp_id = await resolve_employee_id(db, user_id)
        if not own_emp_id or body.employee_id != own_emp_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Staff can only create timesheet for themselves")
    elif role == "supervisor":
        # BR#21: supervisor can create for department members
        from app.api._helpers import resolve_employee, get_department_employee_ids
        emp = await resolve_employee(db, user_id)
        if emp and emp.department_id:
            dept_ids = await get_department_employee_ids(db, emp.department_id, org_id)
            if body.employee_id not in dept_ids:
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="Supervisor can only create timesheet for own department")

    ts = await create_timesheet(
        db,
        employee_id=body.employee_id,
        work_order_id=body.work_order_id,
        work_date=body.work_date,
        regular_hours=body.regular_hours,
        ot_hours=body.ot_hours,
        ot_type_id=body.ot_type_id,
        note=body.note,
        created_by=user_id,
        org_id=org_id,
        requested_approver_id=body.requested_approver_id,
    )
    # Phase 4.2: Auto-approve if bypass is on
    if await check_approval_bypass(db, org_id, "hr.timesheet"):
        ts = await approve_timesheet(db, ts.id, approved_by=user_id)
    return ts


@hr_router.put(
    "/timesheet/{ts_id}",
    response_model=TimesheetResponse,
    dependencies=[Depends(require("hr.timesheet.update"))],
)
async def api_update_timesheet(
    ts_id: UUID,
    body: TimesheetUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    return await update_timesheet(db, ts_id, update_data=update_data, org_id=org_id)


@hr_router.post(
    "/timesheet/{ts_id}/approve",
    response_model=TimesheetResponse,
    dependencies=[Depends(require("hr.timesheet.approve"))],
)
async def api_approve_timesheet(
    ts_id: UUID,
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Supervisor approve (BR#23)."""
    user_id = UUID(token["sub"])
    return await approve_timesheet(db, ts_id, approved_by=user_id)


@hr_router.post(
    "/timesheet/{ts_id}/final",
    response_model=TimesheetResponse,
    dependencies=[Depends(require("hr.timesheet.execute"))],
)
async def api_final_approve_timesheet(
    ts_id: UUID,
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """HR final approve (BR#26)."""
    user_id = UUID(token["sub"])
    return await final_approve_timesheet(db, ts_id, final_approved_by=user_id)


@hr_router.post(
    "/timesheet/{ts_id}/unlock",
    response_model=TimesheetResponse,
    dependencies=[Depends(require("hr.timesheet.execute"))],
)
async def api_unlock_timesheet(
    ts_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """HR unlock a locked timesheet (BR#22)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await unlock_timesheet(db, ts_id, org_id=org_id)


@hr_router.post(
    "/timesheet/batch",
    response_model=list[TimesheetResponse],
    status_code=201,
    dependencies=[Depends(require("hr.timesheet.create"))],
)
async def api_create_timesheet_batch(
    body: TimesheetBatchCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create multiple WO time entries for a single date (Phase 4.4)."""
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    role = token.get("role", "")

    # Data scope enforcement — staff can only create for themselves
    if role == "staff":
        from app.api._helpers import resolve_employee_id
        own_emp_id = await resolve_employee_id(db, user_id)
        if not own_emp_id or body.employee_id != own_emp_id:
            from fastapi import HTTPException as HTTPExc
            raise HTTPExc(status_code=403, detail="Staff can only create timesheet for themselves")
    elif role == "supervisor":
        from app.api._helpers import resolve_employee, get_department_employee_ids
        emp = await resolve_employee(db, user_id)
        if emp and emp.department_id:
            dept_ids = await get_department_employee_ids(db, emp.department_id, org_id)
            if body.employee_id not in dept_ids:
                from fastapi import HTTPException as HTTPExc
                raise HTTPExc(status_code=403, detail="Supervisor can only create timesheet for own department")

    entries = [e.model_dump() for e in body.entries]
    timesheets = await create_timesheet_batch(
        db,
        employee_id=body.employee_id,
        work_date=body.work_date,
        entries=entries,
        created_by=user_id,
        org_id=org_id,
        requested_approver_id=body.requested_approver_id,
    )
    # Phase 4.2: Auto-approve if bypass is on
    if await check_approval_bypass(db, org_id, "hr.timesheet"):
        result = []
        for ts in timesheets:
            ts = await approve_timesheet(db, ts.id, approved_by=user_id)
            result.append(ts)
        return result
    return timesheets


# ============================================================
# STANDARD TIMESHEET ROUTES  (Phase 4.4)
# ============================================================

@hr_router.get(
    "/standard-timesheet",
    response_model=StandardTimesheetListResponse,
    dependencies=[Depends(require("hr.timesheet.read"))],
)
async def api_list_standard_timesheets(
    employee_id: Optional[UUID] = Query(default=None),
    period_start: Optional[str] = Query(default=None),
    period_end: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])
    role = token.get("role", "")

    from datetime import date as date_type
    ps = date_type.fromisoformat(period_start) if period_start else None
    pe = date_type.fromisoformat(period_end) if period_end else None

    # Data scope enforcement
    from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids

    filter_employee_id = employee_id
    filter_employee_ids = None

    if role == "staff":
        emp_id = await resolve_employee_id(db, user_id)
        if not emp_id:
            return StandardTimesheetListResponse(items=[], total=0)
        filter_employee_id = emp_id
    elif role == "supervisor":
        if not employee_id:
            emp = await resolve_employee(db, user_id)
            if emp and emp.department_id:
                filter_employee_ids = await get_department_employee_ids(db, emp.department_id, org_id)
            else:
                return StandardTimesheetListResponse(items=[], total=0)

    items, total = await list_standard_timesheets(
        db, employee_id=filter_employee_id, employee_ids=filter_employee_ids,
        period_start=ps, period_end=pe, org_id=org_id,
    )
    return StandardTimesheetListResponse(items=items, total=total)


@hr_router.post(
    "/standard-timesheet/generate",
    dependencies=[Depends(require("hr.timesheet.execute"))],
)
async def api_generate_standard_timesheets(
    body: StandardTimesheetGenerate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Generate standard timesheets for working days in a period (Phase 4.4)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    count = await generate_standard_timesheets(
        db,
        employee_id=body.employee_id,
        period_start=body.period_start,
        period_end=body.period_end,
        org_id=org_id,
    )
    return {"generated": count}


# ============================================================
# LEAVE ROUTES
# ============================================================

@hr_router.get(
    "/leave",
    response_model=LeaveListResponse,
    dependencies=[Depends(require("hr.leave.read"))],
)
async def api_list_leaves(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    employee_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])
    role = token.get("role", "")

    # Data scope enforcement
    from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids

    filter_employee_id = employee_id
    filter_employee_ids = None

    if role == "staff":
        emp_id = await resolve_employee_id(db, user_id)
        if not emp_id:
            return LeaveListResponse(items=[], total=0, limit=limit, offset=offset)
        filter_employee_id = emp_id
    elif role == "supervisor":
        if not employee_id:
            emp = await resolve_employee(db, user_id)
            if emp and emp.department_id:
                filter_employee_ids = await get_department_employee_ids(db, emp.department_id, org_id)
            else:
                return LeaveListResponse(items=[], total=0, limit=limit, offset=offset)

    items, total = await list_leaves(
        db, limit=limit, offset=offset,
        employee_id=filter_employee_id,
        employee_ids=filter_employee_ids,
        org_id=org_id,
    )
    return LeaveListResponse(items=items, total=total, limit=limit, offset=offset)


@hr_router.post(
    "/leave",
    response_model=LeaveResponse,
    status_code=201,
    dependencies=[Depends(require("hr.leave.create"))],
)
async def api_create_leave(
    body: LeaveCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    role = token.get("role", "")

    # Data scope enforcement — staff can only create leave for themselves
    if role == "staff":
        from app.api._helpers import resolve_employee_id
        own_emp_id = await resolve_employee_id(db, user_id)
        if not own_emp_id or body.employee_id != own_emp_id:
            from fastapi import HTTPException as HTTPExc
            raise HTTPExc(status_code=403, detail="Staff can only create leave for themselves")

    leave = await create_leave(
        db,
        employee_id=body.employee_id,
        leave_type=body.leave_type,
        start_date=body.start_date,
        end_date=body.end_date,
        reason=body.reason,
        created_by=user_id,
        org_id=org_id,
        requested_approver_id=body.requested_approver_id,
        leave_type_id=body.leave_type_id,
    )
    # Phase 4.2: Auto-approve if bypass is on
    if await check_approval_bypass(db, org_id, "hr.leave"):
        leave = await approve_leave(db, leave.id, approved_by=user_id)
    return leave


@hr_router.post(
    "/leave/{leave_id}/approve",
    response_model=LeaveResponse,
    dependencies=[Depends(require("hr.leave.approve"))],
)
async def api_approve_leave(
    leave_id: UUID,
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(token["sub"])
    return await approve_leave(db, leave_id, approved_by=user_id)


# ============================================================
# LEAVE BALANCE ROUTES  (Phase 4.3)
# ============================================================

@hr_router.get(
    "/leave-balance",
    response_model=LeaveBalanceListResponse,
    dependencies=[Depends(require("hr.leave.read"))],
)
async def api_list_leave_balances(
    employee_id: Optional[UUID] = Query(default=None),
    year: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])
    role = token.get("role", "")

    # Data scope enforcement
    from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids

    filter_employee_id = employee_id
    filter_employee_ids = None

    if role == "staff":
        emp_id = await resolve_employee_id(db, user_id)
        if not emp_id:
            return LeaveBalanceListResponse(items=[], total=0)
        filter_employee_id = emp_id
    elif role == "supervisor":
        if not employee_id:
            emp = await resolve_employee(db, user_id)
            if emp and emp.department_id:
                filter_employee_ids = await get_department_employee_ids(db, emp.department_id, org_id)
            else:
                return LeaveBalanceListResponse(items=[], total=0)

    items = await list_leave_balances(
        db, employee_id=filter_employee_id, employee_ids=filter_employee_ids,
        year=year, org_id=org_id,
    )
    return LeaveBalanceListResponse(items=items, total=len(items))


@hr_router.put(
    "/leave-balance/{balance_id}",
    response_model=LeaveBalanceResponse,
    dependencies=[Depends(require("hr.employee.update"))],
)
async def api_update_leave_balance(
    balance_id: UUID,
    body: LeaveBalanceUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    return await update_leave_balance(db, balance_id, update_data=update_data, org_id=org_id)


# ============================================================
# PAYROLL ROUTES
# ============================================================

@hr_router.get(
    "/payroll",
    response_model=PayrollRunListResponse,
    dependencies=[Depends(require("hr.payroll.read"))],
)
async def api_list_payroll_runs(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_payroll_runs(db, limit=limit, offset=offset, org_id=org_id)
    return PayrollRunListResponse(items=items, total=total, limit=limit, offset=offset)


@hr_router.post(
    "/payroll",
    response_model=PayrollRunResponse,
    status_code=201,
    dependencies=[Depends(require("hr.payroll.create"))],
)
async def api_create_payroll_run(
    body: PayrollRunCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_payroll_run(
        db,
        period_start=body.period_start,
        period_end=body.period_end,
        note=body.note,
        org_id=org_id,
    )


@hr_router.post(
    "/payroll/run",
    response_model=PayrollRunResponse,
    dependencies=[Depends(require("hr.payroll.execute"))],
)
async def api_execute_payroll(
    payroll_id: UUID = Query(...),
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Execute payroll run (BR#26: uses only FINAL timesheets)."""
    user_id = UUID(token["sub"])
    return await execute_payroll(db, payroll_id, executed_by=user_id)


@hr_router.get(
    "/payroll/export",
    dependencies=[Depends(require("hr.payroll.export"))],
)
async def api_export_payroll(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    token: dict = Depends(get_token_payload),
):
    """Export payroll runs as CSV."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_payroll_runs(db, limit=limit, offset=offset, org_id=org_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Period Start", "Period End", "Status",
        "Employee Count", "Total Amount", "Executed By",
        "Executed At", "Note", "Created At",
    ])
    for pr in items:
        writer.writerow([
            str(pr.id),
            str(pr.period_start),
            str(pr.period_end),
            pr.status.value if hasattr(pr.status, 'value') else str(pr.status),
            pr.employee_count,
            f"{pr.total_amount:.2f}",
            str(pr.executed_by) if pr.executed_by else "",
            str(pr.executed_at) if pr.executed_at else "",
            pr.note or "",
            str(pr.created_at),
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=payroll_export.csv"},
    )
