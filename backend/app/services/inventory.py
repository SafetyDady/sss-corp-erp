"""
SSS Corp ERP — Inventory Service (Business Logic)
Phase 1: Product CRUD + Stock Movements

Business Rules enforced:
  #1  MATERIAL cost >= 1.00 THB
  #2  SKU unique (DB constraint + service guard)
  #3  SKU immutable once movements exist
  #4  Cannot delete if has movements or balance > 0 (soft delete)
  #5  on_hand >= 0 at all times
  #6  ISSUE: balance >= qty
  #7  ADJUST: Owner only (checked at API layer via permission)
  #8  Movements are immutable — REVERSAL only
"""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import (
    MovementType,
    Product,
    ProductType,
    StockMovement,
)


# ============================================================
# PRODUCT CRUD
# ============================================================

async def create_product(
    db: AsyncSession,
    *,
    sku: str,
    name: str,
    description: Optional[str],
    product_type: str,
    unit: str,
    cost: Decimal,
    min_stock: int,
    org_id: UUID,
) -> Product:
    """Create a new product. Business Rule #1 & #2."""

    # BR#1: MATERIAL cost >= 1.00
    if product_type == ProductType.MATERIAL and cost < Decimal("1.00"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="MATERIAL product cost must be >= 1.00 THB",
        )

    # BR#2: SKU unique check (service layer, DB also enforces)
    existing = await db.execute(
        select(Product).where(Product.sku == sku)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product with SKU '{sku}' already exists",
        )

    product = Product(
        sku=sku,
        name=name,
        description=description,
        product_type=product_type,
        unit=unit,
        cost=cost,
        min_stock=min_stock,
        on_hand=0,
        org_id=org_id,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def get_product(db: AsyncSession, product_id: UUID, *, org_id: Optional[UUID] = None) -> Product:
    """Get a single product by ID."""
    query = select(Product).where(Product.id == product_id, Product.is_active == True)
    if org_id:
        query = query.where(Product.org_id == org_id)
    result = await db.execute(query)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    return product


async def list_products(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    product_type: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[Product], int]:
    """List products with pagination, search, and filter."""
    query = select(Product).where(Product.is_active == True)
    if org_id:
        query = query.where(Product.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Product.sku.ilike(pattern)) | (Product.name.ilike(pattern))
        )

    if product_type:
        query = query.where(Product.product_type == product_type)

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginated results
    query = query.order_by(Product.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def update_product(
    db: AsyncSession,
    product_id: UUID,
    *,
    update_data: dict,
) -> Product:
    """Update a product. Business Rule #1 & #3."""
    product = await get_product(db, product_id)

    # BR#3: SKU immutable if product has movements
    if "sku" in update_data and update_data["sku"] is not None:
        has_movements = await _product_has_movements(db, product_id)
        if has_movements:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cannot change SKU — product has stock movements",
            )
        # Check uniqueness of new SKU
        if update_data["sku"] != product.sku:
            existing = await db.execute(
                select(Product).where(Product.sku == update_data["sku"])
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Product with SKU '{update_data['sku']}' already exists",
                )

    # Apply updates
    for field, value in update_data.items():
        if value is not None:
            setattr(product, field, value)

    # BR#1: Re-validate MATERIAL cost after update
    if product.product_type == ProductType.MATERIAL and product.cost < Decimal("1.00"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="MATERIAL product cost must be >= 1.00 THB",
        )

    await db.commit()
    await db.refresh(product)
    return product


async def delete_product(db: AsyncSession, product_id: UUID) -> None:
    """
    Soft-delete a product. Business Rule #4:
    Cannot delete if has movements or on_hand > 0
    """
    product = await get_product(db, product_id)

    # BR#4: Check movements
    has_movements = await _product_has_movements(db, product_id)
    if has_movements:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot delete product — has stock movements",
        )

    # BR#4: Check balance
    if product.on_hand > 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot delete product — on_hand balance > 0",
        )

    product.is_active = False
    await db.commit()


# ============================================================
# STOCK MOVEMENTS
# ============================================================

async def create_movement(
    db: AsyncSession,
    *,
    product_id: UUID,
    movement_type: str,
    quantity: int,
    unit_cost: Decimal,
    reference: Optional[str],
    note: Optional[str],
    created_by: UUID,
    org_id: UUID,
) -> StockMovement:
    """
    Create a stock movement and update on_hand.
    Business Rules #5, #6.
    """
    # Get product (must be active)
    product = await get_product(db, product_id)

    # Calculate qty delta
    qty_delta = _calculate_qty_delta(movement_type, quantity)

    # BR#5: on_hand >= 0 check BEFORE applying
    new_on_hand = product.on_hand + qty_delta
    if new_on_hand < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Insufficient stock: on_hand={product.on_hand}, requested={quantity}",
        )

    # Create movement record (immutable — BR#8)
    movement = StockMovement(
        product_id=product_id,
        movement_type=movement_type,
        quantity=quantity,
        unit_cost=unit_cost,
        reference=reference,
        note=note,
        created_by=created_by,
        org_id=org_id,
    )
    db.add(movement)

    # Update on_hand
    product.on_hand = new_on_hand
    await db.commit()
    await db.refresh(movement)
    return movement


async def reverse_movement(
    db: AsyncSession,
    movement_id: UUID,
    *,
    created_by: UUID,
    org_id: UUID,
    note: Optional[str] = None,
) -> StockMovement:
    """
    Create a REVERSAL movement for an existing movement. Business Rule #8.
    """
    # Get original movement
    result = await db.execute(
        select(StockMovement).where(StockMovement.id == movement_id)
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movement not found",
        )

    if original.is_reversed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Movement already reversed",
        )

    # Get the product
    product = await get_product(db, original.product_id)

    # Calculate reverse delta (opposite of original)
    original_delta = _calculate_qty_delta(original.movement_type, original.quantity)
    reverse_delta = -original_delta

    # BR#5: Check on_hand after reversal
    new_on_hand = product.on_hand + reverse_delta
    if new_on_hand < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot reverse — would result in negative stock: {new_on_hand}",
        )

    # Create reversal movement
    reversal = StockMovement(
        product_id=original.product_id,
        movement_type=MovementType.REVERSAL,
        quantity=original.quantity,
        unit_cost=original.unit_cost,
        reference=f"REVERSAL of {movement_id}",
        note=note or f"Reversal of movement {movement_id}",
        created_by=created_by,
        org_id=org_id,
    )
    db.add(reversal)

    # Mark original as reversed
    original.is_reversed = True
    original.reversed_by_id = reversal.id

    # Update on_hand
    product.on_hand = new_on_hand

    await db.commit()
    await db.refresh(reversal)
    return reversal


async def list_movements(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    product_id: Optional[UUID] = None,
    movement_type: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[StockMovement], int]:
    """List stock movements with pagination and filters."""
    query = select(StockMovement)
    if org_id:
        query = query.where(StockMovement.org_id == org_id)

    if product_id:
        query = query.where(StockMovement.product_id == product_id)

    if movement_type:
        query = query.where(StockMovement.movement_type == movement_type)

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginated results
    query = query.order_by(StockMovement.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


# ============================================================
# HELPERS
# ============================================================

def _calculate_qty_delta(movement_type: str, quantity: int) -> int:
    """
    Calculate on_hand delta based on movement type.
    RECEIVE/ADJUST(+) → increase, ISSUE/CONSUME/TRANSFER → decrease
    REVERSAL is handled separately (inverse of original)
    """
    increase_types = {MovementType.RECEIVE}
    decrease_types = {MovementType.ISSUE, MovementType.CONSUME, MovementType.TRANSFER}

    mt = MovementType(movement_type) if isinstance(movement_type, str) else movement_type

    if mt in increase_types:
        return quantity
    elif mt in decrease_types:
        return -quantity
    elif mt == MovementType.ADJUST:
        # ADJUST can be positive or negative — quantity is already signed
        return quantity
    else:
        return 0


async def _product_has_movements(db: AsyncSession, product_id: UUID) -> bool:
    """Check if a product has any stock movements."""
    result = await db.execute(
        select(func.count()).where(StockMovement.product_id == product_id)
    )
    count = result.scalar() or 0
    return count > 0
