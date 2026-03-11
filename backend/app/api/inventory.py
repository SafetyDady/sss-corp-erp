"""
SSS Corp ERP — Inventory API Routes
Phase 1: Product CRUD + Stock Movements
Stock-Location Integration: location-aware movements + low stock
Stock Withdrawal: CONSUME->WO, ISSUE->CC, TRANSFER 2-way, ADJUST +/-, RETURN

Endpoints (from CLAUDE.md):
  GET    /api/inventory/products              inventory.product.read
  POST   /api/inventory/products              inventory.product.create
  GET    /api/inventory/products/{id}         inventory.product.read
  PUT    /api/inventory/products/{id}         inventory.product.update
  DELETE /api/inventory/products/{id}         inventory.product.delete

  GET    /api/inventory/stock-by-location     inventory.product.read
  GET    /api/inventory/low-stock-count       inventory.product.read

  GET    /api/stock/movements                 inventory.movement.read
  POST   /api/stock/movements                 inventory.movement.create
  POST   /api/stock/movements/{id}/reverse    inventory.movement.delete
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
from app.schemas.inventory import (
    LowStockCountResponse,
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
    StockByLocationListResponse,
    StockByLocationResponse,
    StockMovementCreate,
    StockMovementListResponse,
    StockMovementResponse,
)
from app.services.inventory import (
    create_movement,
    create_product,
    delete_product,
    get_low_stock_count,
    get_movement_enrichment_info,
    get_movement_location_info,
    get_product,
    get_stock_aging_report,
    list_movements,
    list_products,
    list_stock_by_location,
    reverse_movement,
    update_product,
)


# ============================================================
# PRODUCT ROUTES
# ============================================================

product_router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@product_router.get(
    "/products",
    response_model=ProductListResponse,
    dependencies=[Depends(require("inventory.product.read"))],
)
async def api_list_products(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    product_type: Optional[str] = Query(default=None, pattern=r"^(MATERIAL|CONSUMABLE|SERVICE|SPAREPART|FINISHED_GOODS)$"),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List products with pagination, search, and filter."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_products(
        db, limit=limit, offset=offset, search=search, product_type=product_type, org_id=org_id
    )

    # Compute is_low_stock for each item
    response_items = []
    for p in items:
        resp = ProductResponse.model_validate(p)
        resp.is_low_stock = p.min_stock > 0 and p.on_hand <= p.min_stock
        response_items.append(resp)

    return ProductListResponse(items=response_items, total=total, limit=limit, offset=offset)


@product_router.post(
    "/products",
    response_model=ProductResponse,
    status_code=201,
    dependencies=[Depends(require("inventory.product.create"))],
)
async def api_create_product(
    body: ProductCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new product."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    product = await create_product(
        db,
        sku=body.sku,
        name=body.name,
        model=body.model,
        description=body.description,
        product_type=body.product_type,
        unit=body.unit,
        cost=body.cost,
        min_stock=body.min_stock,
        org_id=org_id,
    )
    return product


# ── Product Export (Phase 10) ── must be before {product_id} route
@product_router.get(
    "/products/export",
    dependencies=[Depends(require("inventory.product.export"))],
)
async def api_export_products(
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Export all active products as .xlsx"""
    from sqlalchemy import select as sa_select
    from app.models.organization import Organization

    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    # Fetch org name for header
    org_result = await db.execute(
        sa_select(Organization.name).where(Organization.id == org_id)
    )
    org_name = org_result.scalar_one_or_none() or ""

    # Fetch all active products (no pagination — export all)
    items, _ = await list_products(db, limit=10000, offset=0, org_id=org_id)

    from app.services.export import create_excel_workbook

    headers = ["SKU", "ชื่อสินค้า", "Model", "ประเภท", "หน่วย", "คงเหลือ", "Min Stock", "ต้นทุน/หน่วย"]
    rows = []
    for p in items:
        ptype = p.product_type.value if hasattr(p.product_type, "value") else str(p.product_type)
        rows.append([
            p.sku,
            p.name,
            p.model or "",
            ptype,
            p.unit,
            p.on_hand,
            p.min_stock,
            float(p.cost),
        ])

    buf = create_excel_workbook(
        title="รายการสินค้า (Products)",
        headers=headers,
        rows=rows,
        org_name=org_name,
        col_widths=[15, 30, 20, 14, 8, 10, 10, 14],
        money_cols=[7],
    )

    # Phase 13.7: Export audit log
    from app.api._helpers import get_client_ip
    from app.services.security import log_export
    await log_export(
        db, user_id=UUID(token["sub"]), org_id=org_id,
        endpoint=request.url.path, resource_type="products",
        record_count=len(rows), ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        filters_used=dict(request.query_params),
    )

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=products_export.xlsx"},
    )


@product_router.get(
    "/products/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require("inventory.product.read"))],
)
async def api_get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single product by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    product = await get_product(db, product_id, org_id=org_id)
    resp = ProductResponse.model_validate(product)
    resp.is_low_stock = product.min_stock > 0 and product.on_hand <= product.min_stock
    return resp


@product_router.put(
    "/products/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require("inventory.product.update"))],
)
async def api_update_product(
    product_id: UUID,
    body: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update an existing product."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    return await update_product(db, product_id, update_data=update_data, org_id=org_id)


@product_router.delete(
    "/products/{product_id}",
    status_code=204,
    dependencies=[Depends(require("inventory.product.delete"))],
)
async def api_delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Soft-delete a product (Business Rule #4)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_product(db, product_id, org_id=org_id)


# ============================================================
# STOCK BY LOCATION ROUTES
# ============================================================

@product_router.get(
    "/stock-by-location",
    response_model=StockByLocationListResponse,
    dependencies=[Depends(require("inventory.product.read"))],
)
async def api_list_stock_by_location(
    product_id: Optional[UUID] = Query(default=None),
    location_id: Optional[UUID] = Query(default=None),
    warehouse_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List stock breakdown by location."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items = await list_stock_by_location(
        db, product_id=product_id, location_id=location_id, warehouse_id=warehouse_id, org_id=org_id
    )
    return StockByLocationListResponse(
        items=[StockByLocationResponse(**item) for item in items],
        total=len(items),
    )


@product_router.get(
    "/low-stock-count",
    response_model=LowStockCountResponse,
    dependencies=[Depends(require("inventory.product.read"))],
)
async def api_low_stock_count(
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Count products where on_hand <= min_stock AND min_stock > 0."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    count = await get_low_stock_count(db, org_id=org_id)
    return LowStockCountResponse(count=count)


# ============================================================
# STOCK AGING REPORT (Phase 11.11)
# ============================================================

@product_router.get(
    "/stock-aging",
    dependencies=[Depends(require("inventory.product.read"))],
)
async def api_stock_aging_report(
    warehouse_id: Optional[UUID] = Query(default=None),
    product_type: Optional[str] = Query(
        default=None,
        pattern=r"^(MATERIAL|CONSUMABLE|SPAREPART|FINISHED_GOODS)$",
    ),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Stock Aging Report — FIFO-based inventory age analysis by bracket."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_stock_aging_report(
        db, org_id=org_id, warehouse_id=warehouse_id, product_type=product_type
    )


@product_router.get(
    "/stock-aging/export",
    dependencies=[Depends(require("inventory.product.export"))],
)
async def api_stock_aging_export(
    request: Request,
    warehouse_id: Optional[UUID] = Query(default=None),
    product_type: Optional[str] = Query(
        default=None,
        pattern=r"^(MATERIAL|CONSUMABLE|SPAREPART|FINISHED_GOODS)$",
    ),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Export Stock Aging Report as .xlsx"""
    from sqlalchemy import select as sa_select
    from app.models.organization import Organization

    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    # Fetch org name for header
    org_result = await db.execute(
        sa_select(Organization.name).where(Organization.id == org_id)
    )
    org_name = org_result.scalar_one_or_none() or ""

    # Get aging report data
    report = await get_stock_aging_report(
        db, org_id=org_id, warehouse_id=warehouse_id, product_type=product_type
    )

    from app.services.export import create_excel_workbook

    headers = [
        "SKU", "ชื่อสินค้า", "Model", "ประเภท", "หน่วย",
        "คงเหลือ", "ต้นทุน/หน่วย", "มูลค่ารวม",
        "0-30 วัน", "31-60 วัน", "61-90 วัน", "90+ วัน",
        "มูลค่า 0-30", "มูลค่า 31-60", "มูลค่า 61-90", "มูลค่า 90+",
        "วันเก่าสุด",
    ]
    rows = []
    for p in report.get("products", []):
        rows.append([
            p["sku"],
            p["name"],
            p.get("model") or "",
            p["product_type"],
            p["unit"],
            p["on_hand"],
            float(p["unit_cost"]),
            float(p["total_value"]),
            p["qty_0_30"],
            p["qty_31_60"],
            p["qty_61_90"],
            p["qty_90_plus"],
            float(p["value_0_30"]),
            float(p["value_31_60"]),
            float(p["value_61_90"]),
            float(p["value_90_plus"]),
            p["days_oldest"],
        ])

    buf = create_excel_workbook(
        title="รายงานอายุสินค้าคงคลัง (Stock Aging)",
        headers=headers,
        rows=rows,
        org_name=org_name,
        col_widths=[15, 28, 18, 14, 8, 10, 14, 14, 10, 10, 10, 10, 14, 14, 14, 14, 10],
        money_cols=[6, 7, 12, 13, 14, 15],
    )

    # Phase 13.7: Export audit log
    from app.api._helpers import get_client_ip
    from app.services.security import log_export
    await log_export(
        db, user_id=UUID(token["sub"]), org_id=org_id,
        endpoint=request.url.path, resource_type="stock_aging",
        record_count=len(rows), ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        filters_used=dict(request.query_params),
    )

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=stock_aging_report.xlsx"},
    )


# ============================================================
# STOCK MOVEMENT ROUTES
# ============================================================

movement_router = APIRouter(prefix="/api/stock", tags=["stock-movements"])


@movement_router.get(
    "/movements",
    response_model=StockMovementListResponse,
    dependencies=[Depends(require("inventory.movement.read"))],
)
async def api_list_movements(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    product_id: Optional[UUID] = Query(default=None),
    movement_type: Optional[str] = Query(
        default=None,
        pattern=r"^(RECEIVE|ISSUE|TRANSFER|ADJUST|CONSUME|RETURN|REVERSAL)$",
    ),
    location_id: Optional[UUID] = Query(default=None),
    work_order_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List stock movements with pagination and filters."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_movements(
        db, limit=limit, offset=offset, product_id=product_id,
        movement_type=movement_type, location_id=location_id,
        work_order_id=work_order_id, org_id=org_id
    )

    # Batch-fetch location names for movements
    movement_ids = [m.id for m in items if m.location_id]
    location_info = await get_movement_location_info(db, movement_ids)

    # Batch-fetch enrichment info (WO/CC/CE/to_location names)
    enrichment_info = await get_movement_enrichment_info(db, items)

    # Build response with location + enrichment names
    response_items = []
    for m in items:
        resp = StockMovementResponse.model_validate(m)
        if m.id in location_info:
            resp.location_name = location_info[m.id]["location_name"]
            resp.warehouse_name = location_info[m.id]["warehouse_name"]
        if m.id in enrichment_info:
            ei = enrichment_info[m.id]
            resp.work_order_number = ei.get("work_order_number")
            resp.cost_center_name = ei.get("cost_center_name")
            resp.cost_element_name = ei.get("cost_element_name")
            resp.to_location_name = ei.get("to_location_name")
            resp.to_warehouse_name = ei.get("to_warehouse_name")
        response_items.append(resp)

    return StockMovementListResponse(items=response_items, total=total, limit=limit, offset=offset)


@movement_router.post(
    "/movements",
    response_model=StockMovementResponse,
    status_code=201,
    dependencies=[Depends(require("inventory.movement.create"))],
)
async def api_create_movement(
    body: StockMovementCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """
    Create a stock movement.
    ADJUST type requires owner role (Business Rule #7).
    """
    user_id = UUID(token["sub"])
    user_role = token.get("role", "")
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    # BR#7: ADJUST — Owner only
    if body.movement_type.value == "ADJUST" and user_role != "owner":
        from fastapi import HTTPException, status as http_status

        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="ADJUST movements require owner role",
        )

    movement = await create_movement(
        db,
        product_id=body.product_id,
        movement_type=body.movement_type,
        quantity=body.quantity,
        unit_cost=body.unit_cost,
        reference=body.reference,
        note=body.note,
        created_by=user_id,
        org_id=org_id,
        location_id=body.location_id,
        work_order_id=body.work_order_id,
        cost_center_id=body.cost_center_id,
        cost_element_id=body.cost_element_id,
        to_location_id=body.to_location_id,
        adjust_type=body.adjust_type,
        bin_id=body.bin_id,
    )

    # Audit log
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    mv_type = body.movement_type.value if hasattr(body.movement_type, "value") else str(body.movement_type)
    await create_audit_log(
        db, user_id=user_id, org_id=org_id,
        action="CREATE", resource_type="stock_movement",
        resource_id=str(movement.id),
        description=f"สร้าง stock movement ({mv_type}) จำนวน {body.quantity}",
        changes={"movement_type": mv_type, "product_id": str(body.product_id), "quantity": body.quantity},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()  # Persist audit log (service already committed business data)

    return movement


@movement_router.post(
    "/movements/{movement_id}/reverse",
    response_model=StockMovementResponse,
    status_code=201,
    dependencies=[Depends(require("inventory.movement.delete"))],
)
async def api_reverse_movement(
    movement_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """
    Reverse an existing stock movement (Business Rule #8).
    Creates a REVERSAL movement and marks original as reversed.
    """
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    reversal = await reverse_movement(
        db, movement_id, created_by=user_id, org_id=org_id
    )

    # Audit log
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=org_id,
        action="DELETE", resource_type="stock_movement",
        resource_id=str(movement_id),
        description=f"กลับรายการ stock movement {movement_id}",
        changes={"original_movement_id": str(movement_id), "reversal_id": str(reversal.id)},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()  # Persist audit log (service already committed business data)

    return reversal
