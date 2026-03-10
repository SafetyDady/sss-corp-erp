"""
SSS Corp ERP — Internal Recharge API Routes
Phase C9: Fixed Recharge — Budget CRUD + Generate + Report

Endpoints:
  GET    /api/finance/recharge/budgets              finance.recharge.read
  POST   /api/finance/recharge/budgets              finance.recharge.create
  GET    /api/finance/recharge/budgets/{id}         finance.recharge.read
  PUT    /api/finance/recharge/budgets/{id}         finance.recharge.update
  DELETE /api/finance/recharge/budgets/{id}         finance.recharge.delete
  POST   /api/finance/recharge/budgets/{id}/activate  finance.recharge.update
  POST   /api/finance/recharge/budgets/{id}/close     finance.recharge.update
  POST   /api/finance/recharge/generate             finance.recharge.execute
  GET    /api/finance/recharge/entries               finance.recharge.read
  GET    /api/finance/reports/cost-center-summary    finance.report.read
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.recharge import (
    CostCenterSummaryResponse,
    CostCenterSummaryRow,
    FixedRechargeBudgetCreate,
    FixedRechargeBudgetListResponse,
    FixedRechargeBudgetResponse,
    FixedRechargeBudgetUpdate,
    FixedRechargeEntryListResponse,
    FixedRechargeEntryResponse,
    RechargeGenerateRequest,
)
from app.services import recharge as recharge_svc


recharge_router = APIRouter(prefix="/api/finance", tags=["finance-recharge"])


# ============================================================
# BUDGET CRUD
# ============================================================

@recharge_router.get(
    "/recharge/budgets",
    response_model=FixedRechargeBudgetListResponse,
    dependencies=[Depends(require("finance.recharge.read"))],
)
async def list_budgets(
    fiscal_year: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    items, total = await recharge_svc.list_budgets(
        db, org_id=org_id, fiscal_year=fiscal_year, limit=limit, offset=offset,
    )
    enriched = await recharge_svc.enrich_budgets(db, items)
    return FixedRechargeBudgetListResponse(
        items=[FixedRechargeBudgetResponse(**row) for row in enriched],
        total=total, limit=limit, offset=offset,
    )


@recharge_router.post(
    "/recharge/budgets",
    response_model=FixedRechargeBudgetResponse,
    status_code=201,
    dependencies=[Depends(require("finance.recharge.create"))],
)
async def create_budget(
    body: FixedRechargeBudgetCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    user_id = UUID(token["sub"])
    budget = await recharge_svc.create_budget(
        db,
        fiscal_year=body.fiscal_year,
        source_cost_center_id=body.source_cost_center_id,
        annual_budget=body.annual_budget,
        description=body.description,
        created_by=user_id,
        org_id=org_id,
    )
    enriched = await recharge_svc.enrich_budgets(db, [budget])
    return FixedRechargeBudgetResponse(**enriched[0])


@recharge_router.get(
    "/recharge/budgets/{budget_id}",
    response_model=FixedRechargeBudgetResponse,
    dependencies=[Depends(require("finance.recharge.read"))],
)
async def get_budget(
    budget_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    budget = await recharge_svc.get_budget(db, budget_id, org_id)
    enriched = await recharge_svc.enrich_budgets(db, [budget])
    return FixedRechargeBudgetResponse(**enriched[0])


@recharge_router.put(
    "/recharge/budgets/{budget_id}",
    response_model=FixedRechargeBudgetResponse,
    dependencies=[Depends(require("finance.recharge.update"))],
)
async def update_budget(
    budget_id: UUID,
    body: FixedRechargeBudgetUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    budget = await recharge_svc.update_budget(
        db, budget_id, org_id=org_id,
        annual_budget=body.annual_budget,
        description=body.description,
    )
    enriched = await recharge_svc.enrich_budgets(db, [budget])
    return FixedRechargeBudgetResponse(**enriched[0])


@recharge_router.delete(
    "/recharge/budgets/{budget_id}",
    status_code=204,
    dependencies=[Depends(require("finance.recharge.delete"))],
)
async def delete_budget(
    budget_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    await recharge_svc.delete_budget(db, budget_id, org_id)


# ============================================================
# STATUS TRANSITIONS
# ============================================================

@recharge_router.post(
    "/recharge/budgets/{budget_id}/activate",
    response_model=FixedRechargeBudgetResponse,
    dependencies=[Depends(require("finance.recharge.update"))],
)
async def activate_budget(
    budget_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    user_id = UUID(token["sub"])
    budget = await recharge_svc.activate_budget(db, budget_id, org_id)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=org_id,
        action="update", resource_type="recharge_budget",
        resource_id=str(budget_id),
        description=f"Activated recharge budget {budget_id}",
        changes={"status": "ACTIVE"},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    enriched = await recharge_svc.enrich_budgets(db, [budget])
    return FixedRechargeBudgetResponse(**enriched[0])


@recharge_router.post(
    "/recharge/budgets/{budget_id}/close",
    response_model=FixedRechargeBudgetResponse,
    dependencies=[Depends(require("finance.recharge.update"))],
)
async def close_budget(
    budget_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    budget = await recharge_svc.close_budget(db, budget_id, org_id)
    enriched = await recharge_svc.enrich_budgets(db, [budget])
    return FixedRechargeBudgetResponse(**enriched[0])


# ============================================================
# GENERATE ENTRIES
# ============================================================

@recharge_router.post(
    "/recharge/generate",
    response_model=list[FixedRechargeEntryResponse],
    status_code=201,
    dependencies=[Depends(require("finance.recharge.execute"))],
)
async def generate_entries(
    body: RechargeGenerateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    user_id = UUID(token["sub"])
    entries = await recharge_svc.generate_monthly_entries(
        db,
        budget_id=body.budget_id,
        year=body.year,
        month=body.month,
        generated_by=user_id,
        org_id=org_id,
    )
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=org_id,
        action="execute", resource_type="recharge_entry",
        description=f"Generated {len(entries)} recharge entries for {body.year}/{body.month:02d}",
        changes={"budget_id": str(body.budget_id), "year": body.year, "month": body.month, "count": len(entries)},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    enriched = await recharge_svc.enrich_entries(db, entries)
    return [FixedRechargeEntryResponse(**row) for row in enriched]


# ============================================================
# LIST ENTRIES
# ============================================================

@recharge_router.get(
    "/recharge/entries",
    response_model=FixedRechargeEntryListResponse,
    dependencies=[Depends(require("finance.recharge.read"))],
)
async def list_entries(
    budget_id: Optional[UUID] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    is_inter_company: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    items, total = await recharge_svc.list_entries(
        db, org_id=org_id, budget_id=budget_id,
        year=year, month=month, is_inter_company=is_inter_company,
        limit=limit, offset=offset,
    )
    enriched = await recharge_svc.enrich_entries(db, items)

    # Calculate monthly budget for context
    monthly_budget = None
    if budget_id:
        budget = await recharge_svc.get_budget(db, budget_id, org_id)
        monthly_budget = (budget.annual_budget / Decimal("12")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    return FixedRechargeEntryListResponse(
        items=[FixedRechargeEntryResponse(**row) for row in enriched],
        total=total, limit=limit, offset=offset,
        monthly_budget=monthly_budget,
    )


# ============================================================
# COST CENTER SUMMARY (Actual + Fixed)
# ============================================================

@recharge_router.get(
    "/reports/cost-center-summary",
    response_model=CostCenterSummaryResponse,
    dependencies=[Depends(require("finance.report.read"))],
)
async def cost_center_summary(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    rows = await recharge_svc.get_cost_center_summary(
        db, org_id=org_id, year=year, month=month,
    )
    return CostCenterSummaryResponse(
        items=[CostCenterSummaryRow(**r) for r in rows],
        period_year=year,
        period_month=month,
    )
