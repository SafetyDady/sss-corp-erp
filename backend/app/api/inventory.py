"""
SSS Corp ERP — Inventory API Routes
Phase 1: Product CRUD + Stock Movements

Endpoints (from CLAUDE.md):
  GET    /api/inventory/products              inventory.product.read
  POST   /api/inventory/products              inventory.product.create
  PUT    /api/inventory/products/{id}         inventory.product.update
  DELETE /api/inventory/products/{id}         inventory.product.delete

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
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
    StockMovementCreate,
    StockMovementListResponse,
    StockMovementResponse,
)
from app.services.inventory import (
    create_movement,
    create_product,
    delete_product,
    get_product,
    list_movements,
    list_products,
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
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    product_type: Optional[str] = Query(default=None, pattern=r"^(MATERIAL|CONSUMABLE)$"),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List products with pagination, search, and filter."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_products(
        db, limit=limit, offset=offset, search=search, product_type=product_type, org_id=org_id
    )
    return ProductListResponse(items=items, total=total, limit=limit, offset=offset)


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
    return await get_product(db, product_id, org_id=org_id)


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
# STOCK MOVEMENT ROUTES
# ============================================================

movement_router = APIRouter(prefix="/api/stock", tags=["stock-movements"])


@movement_router.get(
    "/movements",
    response_model=StockMovementListResponse,
    dependencies=[Depends(require("inventory.movement.read"))],
)
async def api_list_movements(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    product_id: Optional[UUID] = Query(default=None),
    movement_type: Optional[str] = Query(
        default=None,
        pattern=r"^(RECEIVE|ISSUE|TRANSFER|ADJUST|CONSUME|REVERSAL)$",
    ),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List stock movements with pagination and filters."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_movements(
        db, limit=limit, offset=offset, product_id=product_id, movement_type=movement_type, org_id=org_id
    )
    return StockMovementListResponse(items=items, total=total, limit=limit, offset=offset)


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
