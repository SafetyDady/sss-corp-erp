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
  GET    /api/work-orders/{id}/materials      workorder.order.read
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
    get_manhour_summary,
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
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    status: Optional[str] = Query(default=None, pattern=r"^(DRAFT|OPEN|CLOSED)$"),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List work orders with pagination, search, and status filter."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_work_orders(
        db, limit=limit, offset=offset, search=search, wo_status=status, org_id=org_id
    )
    return WorkOrderListResponse(items=items, total=total, limit=limit, offset=offset)


# ============================================================
# WORK ORDER EXPORT  (Phase 10 — Excel Export)
# Must be BEFORE /{wo_id} to avoid route conflict
# ============================================================

@workorder_router.get(
    "/export",
    dependencies=[Depends(require("workorder.order.export"))],
)
async def api_export_work_orders(
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Export all work orders as .xlsx"""
    from sqlalchemy import select as sa_select
    from app.models.organization import Organization

    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    # Fetch org name for header
    org_result = await db.execute(
        sa_select(Organization.name).where(Organization.id == org_id)
    )
    org_name = org_result.scalar_one_or_none() or ""

    # Fetch all work orders (no pagination)
    items, _ = await list_work_orders(db, limit=10000, offset=0, org_id=org_id)

    # Fetch cost summaries for each WO
    cost_map = {}
    for wo in items:
        try:
            cost = await get_cost_summary(db, wo.id, org_id=org_id)
            cost_map[wo.id] = cost
        except Exception:
            cost_map[wo.id] = None

    from app.services.export import create_excel_workbook

    headers = [
        "WO Number", "สถานะ", "ลูกค้า", "Cost Center",
        "วัสดุ", "แรงงาน", "เครื่องมือ", "Overhead", "ต้นทุนรวม",
        "เปิดงาน", "ปิดงาน",
    ]
    rows = []
    for wo in items:
        status = wo.status.value if hasattr(wo.status, "value") else str(wo.status)
        cost = cost_map.get(wo.id)
        material = float(cost.get("material_cost", 0)) if cost else 0
        manhour = float(cost.get("manhour_cost", 0)) if cost else 0
        tools = float(cost.get("tools_recharge", 0)) if cost else 0
        overhead = float(cost.get("admin_overhead", 0)) if cost else 0
        total = float(cost.get("total_cost", 0)) if cost else 0
        rows.append([
            wo.wo_number,
            status,
            wo.customer_name or "",
            wo.cost_center_code or "",
            material,
            manhour,
            tools,
            overhead,
            total,
            wo.opened_at.strftime("%Y-%m-%d") if wo.opened_at else "",
            wo.closed_at.strftime("%Y-%m-%d") if wo.closed_at else "",
        ])

    buf = create_excel_workbook(
        title="รายการใบสั่งงาน (Work Orders)",
        headers=headers,
        rows=rows,
        org_name=org_name,
        col_widths=[16, 10, 25, 14, 14, 14, 14, 14, 16, 14, 14],
        money_cols=[4, 5, 6, 7, 8],
    )

    # Phase 13.7: Export audit log
    from app.api._helpers import get_client_ip
    from app.services.security import log_export
    await log_export(
        db, user_id=UUID(token["sub"]), org_id=org_id,
        endpoint=request.url.path, resource_type="work_orders",
        record_count=len(rows), ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        filters_used=dict(request.query_params),
    )

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=work_orders_export.xlsx"},
    )


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
        requested_approver_id=body.requested_approver_id,
    )


@workorder_router.get(
    "/{wo_id}",
    response_model=WorkOrderResponse,
    dependencies=[Depends(require("workorder.order.read"))],
)
async def api_get_work_order(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single work order by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_work_order(db, wo_id, org_id=org_id)


@workorder_router.put(
    "/{wo_id}",
    response_model=WorkOrderResponse,
    dependencies=[Depends(require("workorder.order.update"))],
)
async def api_update_work_order(
    wo_id: UUID,
    body: WorkOrderUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update work order fields. Cannot edit CLOSED WO."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    return await update_work_order(db, wo_id, update_data=update_data, org_id=org_id)


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
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_work_order(db, wo_id, user_id=user_id, user_role=user_role, org_id=org_id)


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
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Transition: DRAFT → OPEN."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    wo = await open_work_order(db, wo_id)

    # Audit log
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=UUID(token["sub"]), org_id=org_id,
        action="STATUS_CHANGE", resource_type="work_order",
        resource_id=str(wo.id),
        description=f"เปิดใบสั่งงาน {wo.wo_number}",
        changes={"status": {"old": "DRAFT", "new": "OPEN"}},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()  # Persist audit log (service already committed business data)

    return wo


@workorder_router.post(
    "/{wo_id}/close",
    response_model=WorkOrderResponse,
    dependencies=[Depends(require("workorder.order.approve"))],
)
async def api_close_work_order(
    wo_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Transition: OPEN → CLOSED."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    wo = await close_work_order(db, wo_id)

    # Audit log
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=UUID(token["sub"]), org_id=org_id,
        action="STATUS_CHANGE", resource_type="work_order",
        resource_id=str(wo.id),
        description=f"ปิดใบสั่งงาน {wo.wo_number}",
        changes={"status": {"old": "OPEN", "new": "CLOSED"}},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()  # Persist audit log (service already committed business data)

    return wo


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


# ============================================================
# MANHOUR SUMMARY (Phase 5)
# ============================================================

@workorder_router.get(
    "/{wo_id}/manhour-summary",
    dependencies=[Depends(require("workorder.order.read"))],
)
async def api_manhour_summary(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get planned vs actual manhour breakdown for a work order."""
    return await get_manhour_summary(db, wo_id)


# ============================================================
# MATERIALS (CONSUME + RETURN movements for a WO)
# ============================================================

@workorder_router.get(
    "/{wo_id}/materials",
    dependencies=[Depends(require("workorder.order.read"))],
)
async def api_wo_materials(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get CONSUME + RETURN movements for a work order, enriched with product/location info."""
    from app.models.inventory import StockMovement
    from app.services.inventory import get_movement_enrichment_info, get_movement_location_info
    from sqlalchemy import select

    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    # Verify WO exists
    await get_work_order(db, wo_id, org_id=org_id)

    # Fetch CONSUME + RETURN movements for this WO
    result = await db.execute(
        select(StockMovement).where(
            StockMovement.work_order_id == wo_id,
            StockMovement.movement_type.in_(["CONSUME", "RETURN"]),
        ).order_by(StockMovement.created_at.desc())
    )
    movements = list(result.scalars().all())

    # Batch-fetch location + enrichment info
    movement_ids = [m.id for m in movements if m.location_id]
    location_info = await get_movement_location_info(db, movement_ids)
    enrichment_info = await get_movement_enrichment_info(db, movements)

    # Fetch product info for display
    product_ids = {m.product_id for m in movements}
    product_map = {}
    if product_ids:
        from app.models.inventory import Product
        prod_result = await db.execute(
            select(Product.id, Product.sku, Product.name, Product.unit).where(Product.id.in_(product_ids))
        )
        product_map = {
            row.id: {"sku": row.sku, "name": row.name, "unit": row.unit}
            for row in prod_result.all()
        }

    items = []
    for m in movements:
        item = {
            "id": str(m.id),
            "product_id": str(m.product_id),
            "product_sku": product_map.get(m.product_id, {}).get("sku", ""),
            "product_name": product_map.get(m.product_id, {}).get("name", ""),
            "unit": product_map.get(m.product_id, {}).get("unit", ""),
            "movement_type": m.movement_type.value if hasattr(m.movement_type, 'value') else m.movement_type,
            "quantity": m.quantity,
            "unit_cost": float(m.unit_cost),
            "total_cost": float(m.quantity * m.unit_cost),
            "is_reversed": m.is_reversed,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        if m.id in location_info:
            item["location_name"] = location_info[m.id]["location_name"]
            item["warehouse_name"] = location_info[m.id]["warehouse_name"]
        items.append(item)

    return {"items": items, "total": len(items)}
