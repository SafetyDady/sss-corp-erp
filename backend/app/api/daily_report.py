"""
SSS Corp ERP — Daily Work Report API Routes (Phase 5)

Endpoints:
  GET    /api/daily-report                       hr.dailyreport.read
  POST   /api/daily-report                       hr.dailyreport.create
  GET    /api/daily-report/{id}                  hr.dailyreport.read
  PUT    /api/daily-report/{id}                  hr.dailyreport.create
  POST   /api/daily-report/{id}/submit           hr.dailyreport.create
  POST   /api/daily-report/{id}/approve          hr.dailyreport.approve
  POST   /api/daily-report/batch-approve         hr.dailyreport.approve
  POST   /api/daily-report/{id}/reject           hr.dailyreport.approve

Data Scope:
  Staff → only own reports (employee_id forced)
  Supervisor → own department only
  Manager/Owner → all
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids
from app.schemas.daily_report import (
    BatchApproveRequest,
    DailyReportCreate,
    DailyReportListResponse,
    DailyReportResponse,
    DailyReportUpdate,
    RejectRequest,
)
from app.services.daily_report import (
    approve_daily_report,
    batch_approve_daily_reports,
    create_daily_report,
    get_daily_report,
    list_daily_reports,
    reject_daily_report,
    submit_daily_report,
    update_daily_report,
)

daily_report_router = APIRouter(prefix="/api/daily-report", tags=["Daily Work Report"])


# ============================================================
# LIST
# ============================================================

@daily_report_router.get(
    "",
    response_model=DailyReportListResponse,
    dependencies=[Depends(require("hr.dailyreport.read"))],
)
async def api_list_daily_reports(
    employee_id: Optional[UUID] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])
    role = token.get("role", "")

    # Data scope enforcement
    filter_employee_id = employee_id
    dept_emp_ids = None
    if role == "staff":
        # Staff can only see own reports
        emp_id = await resolve_employee_id(db, user_id)
        if not emp_id:
            return DailyReportListResponse(items=[], total=0, limit=limit, offset=offset)
        filter_employee_id = emp_id
    elif role == "supervisor":
        # Supervisor: if no specific employee_id, filter by department
        if not employee_id:
            emp = await resolve_employee(db, user_id)
            if emp and emp.department_id:
                dept_emp_ids = await get_department_employee_ids(db, emp.department_id, org_id)

    items, total = await list_daily_reports(
        db,
        org_id=org_id,
        employee_id=filter_employee_id,
        employee_ids=dept_emp_ids,
        date_from=date_from,
        date_to=date_to,
        report_status=status,
        limit=limit,
        offset=offset,
    )
    return DailyReportListResponse(items=items, total=total, limit=limit, offset=offset)


# ============================================================
# CREATE
# ============================================================

@daily_report_router.post(
    "",
    response_model=DailyReportResponse,
    status_code=201,
    dependencies=[Depends(require("hr.dailyreport.create"))],
)
async def api_create_daily_report(
    body: DailyReportCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])

    # Auto-resolve employee_id from user
    emp_id = await resolve_employee_id(db, user_id)
    if not emp_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="ไม่พบข้อมูลพนักงานสำหรับ user นี้")

    report = await create_daily_report(
        db,
        employee_id=emp_id,
        body=body,
        org_id=org_id,
        user_id=user_id,
    )
    return await get_daily_report(db, report.id)


# ============================================================
# GET
# ============================================================

@daily_report_router.get(
    "/{report_id}",
    response_model=DailyReportResponse,
    dependencies=[Depends(require("hr.dailyreport.read"))],
)
async def api_get_daily_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_daily_report(db, report_id, org_id=org_id)


# ============================================================
# UPDATE (DRAFT/REJECTED only — BR#54)
# ============================================================

@daily_report_router.put(
    "/{report_id}",
    response_model=DailyReportResponse,
    dependencies=[Depends(require("hr.dailyreport.create"))],
)
async def api_update_daily_report(
    report_id: UUID,
    body: DailyReportUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])
    await update_daily_report(db, report_id, body=body, user_id=user_id, org_id=org_id)
    return await get_daily_report(db, report_id, org_id=org_id)


# ============================================================
# SUBMIT (DRAFT → SUBMITTED)
# ============================================================

@daily_report_router.post(
    "/{report_id}/submit",
    response_model=DailyReportResponse,
    dependencies=[Depends(require("hr.dailyreport.create"))],
)
async def api_submit_daily_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])
    await submit_daily_report(db, report_id, user_id=user_id, org_id=org_id)
    return await get_daily_report(db, report_id, org_id=org_id)


# ============================================================
# APPROVE (SUBMITTED → APPROVED + auto-record)
# ============================================================

@daily_report_router.post(
    "/{report_id}/approve",
    response_model=DailyReportResponse,
    dependencies=[Depends(require("hr.dailyreport.approve"))],
)
async def api_approve_daily_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    approver_id = UUID(token["sub"])
    await approve_daily_report(db, report_id, approver_id=approver_id, org_id=org_id)
    return await get_daily_report(db, report_id, org_id=org_id)


# ============================================================
# BATCH APPROVE
# ============================================================

@daily_report_router.post(
    "/batch-approve",
    response_model=list[DailyReportResponse],
    dependencies=[Depends(require("hr.dailyreport.approve"))],
)
async def api_batch_approve(
    body: BatchApproveRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    approver_id = UUID(token["sub"])
    await batch_approve_daily_reports(
        db, body.report_ids, approver_id=approver_id, org_id=org_id
    )
    # Return updated reports
    results = []
    for rid in body.report_ids:
        r = await get_daily_report(db, rid, org_id=org_id)
        results.append(r)
    return results


# ============================================================
# REJECT (SUBMITTED → REJECTED)
# ============================================================

@daily_report_router.post(
    "/{report_id}/reject",
    response_model=DailyReportResponse,
    dependencies=[Depends(require("hr.dailyreport.approve"))],
)
async def api_reject_daily_report(
    report_id: UUID,
    body: RejectRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    approver_id = UUID(token["sub"])
    await reject_daily_report(db, report_id, approver_id=approver_id, reason=body.reason, org_id=org_id)
    return await get_daily_report(db, report_id, org_id=org_id)
