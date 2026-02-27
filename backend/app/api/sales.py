"""
SSS Corp ERP — Sales API Routes
Phase 3: Sales Order CRUD + approve

Endpoints (from CLAUDE.md):
  GET    /api/sales/orders                    sales.order.read
  POST   /api/sales/orders                    sales.order.create
  GET    /api/sales/orders/{id}               sales.order.read
  PUT    /api/sales/orders/{id}               sales.order.update
  DELETE /api/sales/orders/{id}               sales.order.delete
  POST   /api/sales/orders/{id}/approve       sales.order.approve
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.sales import (
    SalesOrderCreate,
    SalesOrderListResponse,
    SalesOrderResponse,
    SalesOrderUpdate,
)
from app.services.organization import check_approval_bypass
from app.services.sales import (
    approve_sales_order,
    create_sales_order,
    delete_sales_order,
    get_sales_order,
    list_sales_orders,
    update_sales_order,
)

sales_router = APIRouter(prefix="/api/sales", tags=["sales"])


@sales_router.get(
    "/orders",
    response_model=SalesOrderListResponse,
    dependencies=[Depends(require("sales.order.read"))],
)
async def api_list_orders(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    status: Optional[str] = Query(
        default=None,
        pattern=r"^(DRAFT|SUBMITTED|APPROVED|INVOICED|CANCELLED)$",
    ),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_sales_orders(
        db, limit=limit, offset=offset, search=search, so_status=status, org_id=org_id
    )
    return SalesOrderListResponse(items=items, total=total, limit=limit, offset=offset)


@sales_router.post(
    "/orders",
    response_model=SalesOrderResponse,
    status_code=201,
    dependencies=[Depends(require("sales.order.create"))],
)
async def api_create_order(
    body: SalesOrderCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    lines = [l.model_dump() for l in body.lines]
    so = await create_sales_order(
        db,
        customer_id=body.customer_id,
        order_date=body.order_date,
        note=body.note,
        lines=lines,
        created_by=user_id,
        org_id=org_id,
        requested_approver_id=body.requested_approver_id,
    )
    # Phase 4.2: Auto-approve if bypass is on
    if await check_approval_bypass(db, org_id, "sales.order"):
        so = await approve_sales_order(db, so.id, approved_by=user_id)
    return so


@sales_router.get(
    "/orders/{so_id}",
    response_model=SalesOrderResponse,
    dependencies=[Depends(require("sales.order.read"))],
)
async def api_get_order(
    so_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_sales_order(db, so_id, org_id=org_id)


@sales_router.put(
    "/orders/{so_id}",
    response_model=SalesOrderResponse,
    dependencies=[Depends(require("sales.order.update"))],
)
async def api_update_order(
    so_id: UUID,
    body: SalesOrderUpdate,
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    return await update_sales_order(db, so_id, update_data=update_data)


@sales_router.delete(
    "/orders/{so_id}",
    status_code=204,
    dependencies=[Depends(require("sales.order.delete"))],
)
async def api_delete_order(
    so_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    await delete_sales_order(db, so_id)


@sales_router.post(
    "/orders/{so_id}/approve",
    response_model=SalesOrderResponse,
    dependencies=[Depends(require("sales.order.approve"))],
)
async def api_approve_order(
    so_id: UUID,
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(token["sub"])
    return await approve_sales_order(db, so_id, approved_by=user_id)
