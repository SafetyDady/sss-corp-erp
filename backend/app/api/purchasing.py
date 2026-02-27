"""
SSS Corp ERP — Purchasing API Routes
Phase 3: PO CRUD + approve + goods receipt

Endpoints (from CLAUDE.md):
  GET    /api/purchasing/po                   purchasing.po.read
  POST   /api/purchasing/po                   purchasing.po.create
  GET    /api/purchasing/po/{id}              purchasing.po.read
  PUT    /api/purchasing/po/{id}              purchasing.po.update
  DELETE /api/purchasing/po/{id}              purchasing.po.delete
  POST   /api/purchasing/po/{id}/approve      purchasing.po.approve
  POST   /api/purchasing/po/{id}/receive      purchasing.po.update
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.purchasing import (
    GoodsReceiptLine,
    PurchaseOrderCreate,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
    PurchaseOrderUpdate,
)
from app.services.organization import check_approval_bypass
from app.services.purchasing import (
    approve_purchase_order,
    create_purchase_order,
    delete_purchase_order,
    get_purchase_order,
    list_purchase_orders,
    receive_goods,
    update_purchase_order,
)

purchasing_router = APIRouter(prefix="/api/purchasing", tags=["purchasing"])


@purchasing_router.get(
    "/po",
    response_model=PurchaseOrderListResponse,
    dependencies=[Depends(require("purchasing.po.read"))],
)
async def api_list_pos(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    status: Optional[str] = Query(
        default=None,
        pattern=r"^(DRAFT|SUBMITTED|APPROVED|RECEIVED|CANCELLED)$",
    ),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_purchase_orders(
        db, limit=limit, offset=offset, search=search, po_status=status, org_id=org_id
    )
    return PurchaseOrderListResponse(items=items, total=total, limit=limit, offset=offset)


@purchasing_router.post(
    "/po",
    response_model=PurchaseOrderResponse,
    status_code=201,
    dependencies=[Depends(require("purchasing.po.create"))],
)
async def api_create_po(
    body: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    lines = [l.model_dump() for l in body.lines]
    po = await create_purchase_order(
        db,
        supplier_name=body.supplier_name,
        order_date=body.order_date,
        expected_date=body.expected_date,
        note=body.note,
        lines=lines,
        created_by=user_id,
        org_id=org_id,
        requested_approver_id=body.requested_approver_id,
    )
    # Phase 4.2: Auto-approve if bypass is on
    if await check_approval_bypass(db, org_id, "purchasing.po"):
        po = await approve_purchase_order(db, po.id, approved_by=user_id)
    return po


@purchasing_router.get(
    "/po/{po_id}",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require("purchasing.po.read"))],
)
async def api_get_po(
    po_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_purchase_order(db, po_id, org_id=org_id)


@purchasing_router.put(
    "/po/{po_id}",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require("purchasing.po.update"))],
)
async def api_update_po(
    po_id: UUID,
    body: PurchaseOrderUpdate,
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    return await update_purchase_order(db, po_id, update_data=update_data)


@purchasing_router.delete(
    "/po/{po_id}",
    status_code=204,
    dependencies=[Depends(require("purchasing.po.delete"))],
)
async def api_delete_po(
    po_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    await delete_purchase_order(db, po_id)


@purchasing_router.post(
    "/po/{po_id}/approve",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require("purchasing.po.approve"))],
)
async def api_approve_po(
    po_id: UUID,
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(token["sub"])
    return await approve_purchase_order(db, po_id, approved_by=user_id)


@purchasing_router.post(
    "/po/{po_id}/receive",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require("purchasing.po.update"))],
)
async def api_receive_goods(
    po_id: UUID,
    lines: list[GoodsReceiptLine],
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    receipt_lines = [l.model_dump() for l in lines]
    return await receive_goods(
        db, po_id, receipt_lines=receipt_lines, received_by=user_id, org_id=org_id
    )
