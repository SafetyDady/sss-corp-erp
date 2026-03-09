"""
SSS Corp ERP — Sales API Routes
SO Flow Upgrade: CRUD + submit + approve/reject + cancel

Endpoints:
  GET    /api/sales/orders                    sales.order.read
  POST   /api/sales/orders                    sales.order.create
  GET    /api/sales/orders/{id}               sales.order.read
  PUT    /api/sales/orders/{id}               sales.order.update   (DRAFT/SUBMITTED)
  DELETE /api/sales/orders/{id}               sales.order.delete   (DRAFT only)
  POST   /api/sales/orders/{id}/submit        sales.order.create   (DRAFT→SUBMITTED)
  POST   /api/sales/orders/{id}/approve       sales.order.approve  (body: {action, reason})
  POST   /api/sales/orders/{id}/cancel        sales.order.update   (DRAFT/SUBMITTED→CANCELLED)
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
from app.schemas.sales import (
    SOApproveRequest,
    SalesOrderCreate,
    SalesOrderListResponse,
    SalesOrderResponse,
    SalesOrderUpdate,
)
from app.services.organization import check_approval_bypass
from app.services.sales import (
    approve_sales_order,
    cancel_sales_order,
    create_sales_order,
    delete_sales_order,
    enrich_sales_orders,
    get_sales_order,
    list_sales_orders,
    submit_sales_order,
    update_sales_order,
)

sales_router = APIRouter(prefix="/api/sales", tags=["sales"])


@sales_router.get(
    "/orders",
    response_model=SalesOrderListResponse,
    dependencies=[Depends(require("sales.order.read"))],
)
async def api_list_orders(
    limit: int = Query(default=20, ge=1, le=500),
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
    enriched = await enrich_sales_orders(db, items)
    return SalesOrderListResponse(items=enriched, total=total, limit=limit, offset=offset)


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
        vat_rate=body.vat_rate,
    )
    enriched = await enrich_sales_orders(db, [so])
    return enriched[0]


# ── SO Export (Phase 10) ── must be before /orders/{so_id}
@sales_router.get(
    "/orders/export",
    dependencies=[Depends(require("sales.order.export"))],
)
async def api_export_orders(
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Export sales orders as .xlsx"""
    from sqlalchemy import select as sa_select
    from app.models.organization import Organization
    from app.services.export import create_excel_workbook

    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    # Fetch org name for header
    org_result = await db.execute(
        sa_select(Organization.name).where(Organization.id == org_id)
    )
    org_name = org_result.scalar_one_or_none() or ""

    items, _ = await list_sales_orders(db, limit=10000, offset=0, org_id=org_id)
    enriched = await enrich_sales_orders(db, items)

    headers = ["SO Number", "ลูกค้า", "สถานะ", "ยอดรวม", "วันที่สั่ง", "วันที่อนุมัติ"]
    rows = []
    for so_dict in enriched:
        rows.append([
            so_dict.get("so_number", ""),
            so_dict.get("customer_name", ""),
            so_dict.get("status", ""),
            float(so_dict.get("total_amount") or 0),
            str(so_dict.get("order_date", "")),
            str(so_dict.get("approved_at", "")) if so_dict.get("approved_at") else "",
        ])

    buf = create_excel_workbook(
        title="ใบสั่งขาย (Sales Orders)",
        headers=headers,
        rows=rows,
        org_name=org_name,
        col_widths=[18, 25, 14, 16, 14, 14],
        money_cols=[3],
    )

    # Phase 13.7: Export audit log
    from app.api._helpers import get_client_ip
    from app.services.security import log_export
    await log_export(
        db, user_id=UUID(token["sub"]), org_id=org_id,
        endpoint=request.url.path, resource_type="sales_orders",
        record_count=len(rows), ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        filters_used=dict(request.query_params),
    )

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=so_export.xlsx"},
    )


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
    so = await get_sales_order(db, so_id, org_id=org_id)
    enriched = await enrich_sales_orders(db, [so])
    return enriched[0]


@sales_router.put(
    "/orders/{so_id}",
    response_model=SalesOrderResponse,
    dependencies=[Depends(require("sales.order.update"))],
)
async def api_update_order(
    so_id: UUID,
    body: SalesOrderUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    # Convert lines from Pydantic models to dicts
    if "lines" in update_data and update_data["lines"] is not None:
        update_data["lines"] = [
            l.model_dump() if hasattr(l, "model_dump") else l
            for l in body.lines
        ]
    so = await update_sales_order(db, so_id, update_data=update_data, org_id=org_id)
    enriched = await enrich_sales_orders(db, [so])
    return enriched[0]


@sales_router.delete(
    "/orders/{so_id}",
    status_code=204,
    dependencies=[Depends(require("sales.order.delete"))],
)
async def api_delete_order(
    so_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_sales_order(db, so_id, org_id=org_id)


@sales_router.post(
    "/orders/{so_id}/submit",
    response_model=SalesOrderResponse,
    dependencies=[Depends(require("sales.order.create"))],
)
async def api_submit_order(
    so_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    so = await submit_sales_order(db, so_id, org_id=org_id)

    # Phase 4.2: Auto-approve if bypass is on
    if await check_approval_bypass(db, org_id, "sales.order"):
        so = await approve_sales_order(db, so_id, approved_by=user_id, org_id=org_id)

    enriched = await enrich_sales_orders(db, [so])
    return enriched[0]


@sales_router.post(
    "/orders/{so_id}/approve",
    response_model=SalesOrderResponse,
    dependencies=[Depends(require("sales.order.approve"))],
)
async def api_approve_order(
    so_id: UUID,
    body: SOApproveRequest,
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    so = await approve_sales_order(
        db,
        so_id,
        approved_by=user_id,
        action=body.action,
        reason=body.reason,
        org_id=org_id,
    )
    enriched = await enrich_sales_orders(db, [so])
    return enriched[0]


@sales_router.post(
    "/orders/{so_id}/cancel",
    response_model=SalesOrderResponse,
    dependencies=[Depends(require("sales.order.update"))],
)
async def api_cancel_order(
    so_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    so = await cancel_sales_order(db, so_id, org_id=org_id)
    enriched = await enrich_sales_orders(db, [so])
    return enriched[0]
