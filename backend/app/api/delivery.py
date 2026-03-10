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

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
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
# EXPORT (before get detail to avoid path conflict)
# ============================================================

@delivery_router.get(
    "/export",
    dependencies=[Depends(require("sales.delivery.export"))],
)
async def api_export_delivery_orders(
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Export delivery orders as .xlsx"""
    from sqlalchemy import select as sa_select
    from app.models.organization import Organization
    from app.models.sales import SalesOrder
    from app.models.customer import Customer
    from app.services.export import create_excel_workbook

    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    # Fetch org name for header
    org_result = await db.execute(
        sa_select(Organization.name).where(Organization.id == org_id)
    )
    org_name = org_result.scalar_one_or_none() or ""

    items, _ = await list_delivery_orders(db, limit=10000, offset=0, org_id=org_id)

    # Lookup SO numbers and customer names
    so_ids = {do.so_id for do in items}
    customer_ids = {do.customer_id for do in items if do.customer_id}
    so_map = {}
    customer_map = {}
    if so_ids:
        result = await db.execute(
            sa_select(SalesOrder.id, SalesOrder.so_number).where(SalesOrder.id.in_(so_ids))
        )
        so_map = {row.id: row.so_number for row in result.fetchall()}
    if customer_ids:
        result = await db.execute(
            sa_select(Customer.id, Customer.name).where(Customer.id.in_(customer_ids))
        )
        customer_map = {row.id: row.name for row in result.fetchall()}

    headers = ["DO Number", "SO Number", "ลูกค้า", "สถานะ", "จำนวน Lines", "วันที่ส่ง"]
    rows = []
    for do in items:
        num_lines = len(do.lines) if hasattr(do, "lines") and do.lines else 0
        rows.append([
            do.do_number,
            so_map.get(do.so_id, ""),
            customer_map.get(do.customer_id, ""),
            do.status.value if hasattr(do.status, "value") else str(do.status or ""),
            num_lines,
            str(do.delivery_date) if do.delivery_date else "",
        ])

    buf = create_excel_workbook(
        title="ใบส่งของ (Delivery Orders)",
        headers=headers,
        rows=rows,
        org_name=org_name,
        col_widths=[18, 18, 25, 12, 12, 14],
    )

    # Phase 13.7: Export audit log
    from app.api._helpers import get_client_ip
    from app.services.security import log_export
    await log_export(
        db, user_id=UUID(token["sub"]), org_id=org_id,
        endpoint=request.url.path, resource_type="delivery_orders",
        record_count=len(rows), ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        filters_used=dict(request.query_params),
    )

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=do_export.xlsx"},
    )


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
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("sales.delivery.approve")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    do = await ship_delivery_order(
        db, do_id, ship_data=body.model_dump(),
        shipped_by=user_id, org_id=org_id,
    )
    # Audit log
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="execute", resource_type="delivery_order",
        resource_id=str(do_id),
        description=f"Shipped delivery order {do_id}",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
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
