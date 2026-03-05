"""
SSS Corp ERP — Delivery Order API Routes
Phase C3: Delivery Order (DO)

Endpoints:
  GET    /api/sales/delivery                     sales.delivery.read
  POST   /api/sales/delivery                     sales.delivery.create
  GET    /api/sales/delivery/remaining/{so_id}   sales.delivery.read
  GET    /api/sales/delivery/{id}                sales.delivery.read
  PUT    /api/sales/delivery/{id}                sales.delivery.update
  DELETE /api/sales/delivery/{id}                sales.delivery.delete
  POST   /api/sales/delivery/{id}/ship           sales.delivery.approve
  POST   /api/sales/delivery/{id}/cancel         sales.delivery.update
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.delivery import (
    DeliveryOrderCreate,
    DeliveryOrderListResponse,
    DeliveryOrderResponse,
    DeliveryOrderUpdate,
    DOShipRequest,
    RemainingQtyResponse,
)
from app.services.delivery import (
    cancel_delivery_order,
    create_delivery_order,
    delete_delivery_order,
    enrich_delivery_orders,
    get_delivery_order,
    get_remaining_qty_for_so,
    list_delivery_orders,
    ship_delivery_order,
    update_delivery_order,
)

delivery_router = APIRouter(
    prefix="/api/sales/delivery", tags=["delivery"]
)


# ============================================================
# LIST
# ============================================================

@delivery_router.get(
    "",
    response_model=DeliveryOrderListResponse,
    dependencies=[Depends(require("sales.delivery.read"))],
)
async def api_list_delivery_orders(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("sales.delivery.read")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    items, total = await list_delivery_orders(
        db, limit=limit, offset=offset, search=search,
        do_status=status, org_id=org_id,
    )
    enriched = await enrich_delivery_orders(db, items)
    return {"items": enriched, "total": total, "limit": limit, "offset": offset}


# ============================================================
# CREATE
# ============================================================

@delivery_router.post(
    "",
    response_model=DeliveryOrderResponse,
    dependencies=[Depends(require("sales.delivery.create"))],
)
async def api_create_delivery_order(
    body: DeliveryOrderCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("sales.delivery.create")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    do = await create_delivery_order(
        db, body=body.model_dump(), created_by=user_id, org_id=org_id,
    )
    enriched = await enrich_delivery_orders(db, [do])
    return enriched[0]


# ============================================================
# REMAINING QTY (before get detail to avoid path conflict)
# ============================================================

@delivery_router.get(
    "/remaining/{so_id}",
    response_model=RemainingQtyResponse,
    dependencies=[Depends(require("sales.delivery.read"))],
)
async def api_remaining_qty(
    so_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("sales.delivery.read")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    return await get_remaining_qty_for_so(db, so_id, org_id=org_id)


# ============================================================
# GET DETAIL
# ============================================================

@delivery_router.get(
    "/{do_id}",
    response_model=DeliveryOrderResponse,
    dependencies=[Depends(require("sales.delivery.read"))],
)
async def api_get_delivery_order(
    do_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("sales.delivery.read")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    do = await get_delivery_order(db, do_id, org_id=org_id)
    enriched = await enrich_delivery_orders(db, [do])
    return enriched[0]


# ============================================================
# UPDATE (DRAFT only)
# ============================================================

@delivery_router.put(
    "/{do_id}",
    response_model=DeliveryOrderResponse,
    dependencies=[Depends(require("sales.delivery.update"))],
)
async def api_update_delivery_order(
    do_id: UUID,
    body: DeliveryOrderUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("sales.delivery.update")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    do = await update_delivery_order(
        db, do_id, body=body.model_dump(exclude_unset=True), org_id=org_id,
    )
    enriched = await enrich_delivery_orders(db, [do])
    return enriched[0]


# ============================================================
# DELETE (DRAFT only)
# ============================================================

@delivery_router.delete(
    "/{do_id}",
    dependencies=[Depends(require("sales.delivery.delete"))],
)
async def api_delete_delivery_order(
    do_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("sales.delivery.delete")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    await delete_delivery_order(db, do_id, org_id=org_id)
    return {"detail": "Delivery order deleted"}


# ============================================================
# SHIP (DRAFT → SHIPPED — auto ISSUE stock movements)
# ============================================================

@delivery_router.post(
    "/{do_id}/ship",
    response_model=DeliveryOrderResponse,
    dependencies=[Depends(require("sales.delivery.approve"))],
)
async def api_ship_delivery_order(
    do_id: UUID,
    body: DOShipRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("sales.delivery.approve")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    do = await ship_delivery_order(
        db, do_id, ship_data=body.model_dump(),
        shipped_by=user_id, org_id=org_id,
    )
    enriched = await enrich_delivery_orders(db, [do])
    return enriched[0]


# ============================================================
# CANCEL (DRAFT → CANCELLED)
# ============================================================

@delivery_router.post(
    "/{do_id}/cancel",
    response_model=DeliveryOrderResponse,
    dependencies=[Depends(require("sales.delivery.update"))],
)
async def api_cancel_delivery_order(
    do_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("sales.delivery.update")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    do = await cancel_delivery_order(db, do_id, org_id=org_id)
    enriched = await enrich_delivery_orders(db, [do])
    return enriched[0]
