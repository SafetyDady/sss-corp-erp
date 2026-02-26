"""
SSS Corp ERP — Work Order API Routes
Phase 1: Work Order CRUD + Status transitions + Cost Summary

Endpoints (from CLAUDE.md):
  GET    /api/work-orders                     workorder.order.read
  POST   /api/work-orders                     workorder.order.create
  GET    /api/work-orders/{id}                workorder.order.read
  PUT    /api/work-orders/{id}                workorder.order.update
  DELETE /api/work-orders/{id}                workorder.order.delete
  POST   /api/work-orders/{id}/open           workorder.order.update
  POST   /api/work-orders/{id}/close          workorder.order.approve
  GET    /api/work-orders/{id}/cost-summary   workorder.order.read
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.workorder import (
    CostSummaryResponse,
    WorkOrderCreate,
    WorkOrderListResponse,
    WorkOrderResponse,
    WorkOrderUpdate,
)
from app.services.workorder import (
    close_work_order,
    create_work_order,
    delete_work_order,
    get_cost_summary,
    get_work_order,
    list_work_orders,
    open_work_order,
    update_work_order,
)


workorder_router = APIRouter(prefix="/api/work-orders", tags=["work-orders"])


# ============================================================
# CRUD
# ============================================================

@workorder_router.get(
    "",
    response_model=WorkOrderListResponse,
    dependencies=[Depends(require("workorder.order.read"))],
)
async def api_list_work_orders(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    status: Optional[str] = Query(default=None, pattern=r"^(DRAFT|OPEN|CLOSED)$"),
    db: AsyncSession = Depends(get_db),
):
    """List work orders with pagination, search, and status filter."""
    items, total = await list_work_orders(
        db, limit=limit, offset=offset, search=search, wo_status=status
    )
    return WorkOrderListResponse(items=items, total=total, limit=limit, offset=offset)


@workorder_router.post(
    "",
    response_model=WorkOrderResponse,
    status_code=201,
    dependencies=[Depends(require("workorder.order.create"))],
)
async def api_create_work_order(
    body: WorkOrderCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new work order (DRAFT status, auto wo_number)."""
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    return await create_work_order(
        db,
        customer_name=body.customer_name,
        description=body.description,
        cost_center_code=body.cost_center_code,
        created_by=user_id,
        org_id=org_id,
    )


@workorder_router.get(
    "/{wo_id}",
    response_model=WorkOrderResponse,
    dependencies=[Depends(require("workorder.order.read"))],
)
async def api_get_work_order(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single work order by ID."""
    return await get_work_order(db, wo_id)


@workorder_router.put(
    "/{wo_id}",
    response_model=WorkOrderResponse,
    dependencies=[Depends(require("workorder.order.update"))],
)
async def api_update_work_order(
    wo_id: UUID,
    body: WorkOrderUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update work order fields. Cannot edit CLOSED WO."""
    update_data = body.model_dump(exclude_unset=True)
    return await update_work_order(db, wo_id, update_data=update_data)


@workorder_router.delete(
    "/{wo_id}",
    status_code=204,
    dependencies=[Depends(require("workorder.order.delete"))],
)
async def api_delete_work_order(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Soft-delete a work order. Only DRAFT + no movements + creator/owner."""
    user_id = UUID(token["sub"])
    user_role = token.get("role", "")
    await delete_work_order(db, wo_id, user_id=user_id, user_role=user_role)


# ============================================================
# STATUS TRANSITIONS
# ============================================================

@workorder_router.post(
    "/{wo_id}/open",
    response_model=WorkOrderResponse,
    dependencies=[Depends(require("workorder.order.update"))],
)
async def api_open_work_order(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Transition: DRAFT → OPEN."""
    return await open_work_order(db, wo_id)


@workorder_router.post(
    "/{wo_id}/close",
    response_model=WorkOrderResponse,
    dependencies=[Depends(require("workorder.order.approve"))],
)
async def api_close_work_order(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Transition: OPEN → CLOSED."""
    return await close_work_order(db, wo_id)


# ============================================================
# COST SUMMARY
# ============================================================

@workorder_router.get(
    "/{wo_id}/cost-summary",
    response_model=CostSummaryResponse,
    dependencies=[Depends(require("workorder.order.read"))],
)
async def api_cost_summary(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get cost breakdown for a work order (Material + ManHour + Tools + Overhead)."""
    return await get_cost_summary(db, wo_id)
