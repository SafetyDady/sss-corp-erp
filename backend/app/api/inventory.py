"""
SSS Corp ERP — Inventory API Routes
Phase 1: Product CRUD + Stock Movements
Stock-Location Integration: location-aware movements + low stock

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

from fastapi import APIRouter, Depends, Query
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
    get_movement_location_info,
    get_product,
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
    product_type: Optional[str] = Query(default=None, pattern=r"^(MATERIAL|CONSUMABLE|SERVICE)$"),
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
        description=body.description,
        product_type=body.product_type,
        unit=body.unit,
        cost=body.cost,
        min_stock=body.min_stock,
        org_id=org_id,
    )
    return product


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
):
    """Update an existing product."""
    update_data = body.model_dump(exclude_unset=True)
    return await update_product(db, product_id, update_data=update_data)


@product_router.delete(
    "/products/{product_id}",
    status_code=204,
    dependencies=[Depends(require("inventory.product.delete"))],
)
async def api_delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a product (Business Rule #4)."""
    await delete_product(db, product_id)


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
        pattern=r"^(RECEIVE|ISSUE|TRANSFER|ADJUST|CONSUME|REVERSAL)$",
    ),
    location_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List stock movements with pagination and filters."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_movements(
        db, limit=limit, offset=offset, product_id=product_id,
        movement_type=movement_type, location_id=location_id, org_id=org_id
    )

    # Batch-fetch location names for movements
    movement_ids = [m.id for m in items if m.location_id]
    location_info = await get_movement_location_info(db, movement_ids)

    # Build response with location names
    response_items = []
    for m in items:
        resp = StockMovementResponse.model_validate(m)
        if m.id in location_info:
            resp.location_name = location_info[m.id]["location_name"]
            resp.warehouse_name = location_info[m.id]["warehouse_name"]
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
    )
    return movement


@movement_router.post(
    "/movements/{movement_id}/reverse",
    response_model=StockMovementResponse,
    status_code=201,
    dependencies=[Depends(require("inventory.movement.delete"))],
)
async def api_reverse_movement(
    movement_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """
    Reverse an existing stock movement (Business Rule #8).
    Creates a REVERSAL movement and marks original as reversed.
    """
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    return await reverse_movement(
        db, movement_id, created_by=user_id, org_id=org_id
    )
