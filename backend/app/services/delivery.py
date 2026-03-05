"""
SSS Corp ERP — Delivery Order Service (Business Logic)
Phase C3: Delivery Order (DO) — Ship from SO + auto stock ISSUE

Status flow: DRAFT → SHIPPED (+CANCELLED)
- DRAFT: Created from SO (APPROVED), editable
- SHIPPED: Confirmed delivery → auto ISSUE stock per line
- CANCELLED: Only from DRAFT

Partial delivery: 1 SO = multiple DOs.
Per SO line: SUM(shipped_qty across all DOs) ≤ SO line.quantity
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import Product, ProductType
from app.models.sales import (
    DeliveryOrder,
    DeliveryOrderLine,
    DOStatus,
    SalesOrder,
    SalesOrderLine,
    SOStatus,
)
from app.models.user import User
from app.models.warehouse import Location, Warehouse
from app.services.inventory import create_movement


# ============================================================
# DO NUMBER GENERATOR
# ============================================================

async def _next_do_number(db: AsyncSession, org_id: UUID) -> str:
    """Generate next DO number: DO-{YYYY}-{NNNN}."""
    year = datetime.now(timezone.utc).year
    prefix = f"DO-{year}-"
    result = await db.execute(
        select(func.count()).where(
            DeliveryOrder.org_id == org_id,
            DeliveryOrder.do_number.like(f"{prefix}%"),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


# ============================================================
# VALIDATION HELPERS
# ============================================================

async def _validate_so(
    db: AsyncSession, so_id: UUID, org_id: UUID,
) -> SalesOrder:
    """Validate SO exists, is APPROVED, and belongs to org."""
    result = await db.execute(
        select(SalesOrder)
        .options(selectinload(SalesOrder.lines))
        .where(
            SalesOrder.id == so_id,
            SalesOrder.org_id == org_id,
            SalesOrder.is_active == True,
        )
    )
    so = result.scalar_one_or_none()
    if not so:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales order not found",
        )
    if so.status != SOStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"SO must be APPROVED (current: {so.status.value})",
        )
    return so


async def _validate_products_not_service(
    db: AsyncSession, product_ids: list[UUID],
) -> dict[UUID, Product]:
    """Validate products exist and are not SERVICE type."""
    result = await db.execute(
        select(Product).where(Product.id.in_(product_ids))
    )
    products = {p.id: p for p in result.scalars().all()}

    for pid in product_ids:
        if pid not in products:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {pid} not found",
            )
        p = products[pid]
        if p.product_type == ProductType.SERVICE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot create DO line for SERVICE product: {p.sku}",
            )
    return products


async def _get_shipped_qty_by_so_line(
    db: AsyncSession, so_id: UUID, org_id: UUID, exclude_do_id: UUID = None,
) -> dict[UUID, int]:
    """Get total shipped qty per SO line across all active DOs."""
    q = (
        select(
            DeliveryOrderLine.so_line_id,
            func.coalesce(func.sum(DeliveryOrderLine.shipped_qty), 0).label("total_shipped"),
        )
        .join(DeliveryOrder, DeliveryOrderLine.do_id == DeliveryOrder.id)
        .where(
            DeliveryOrder.so_id == so_id,
            DeliveryOrder.org_id == org_id,
            DeliveryOrder.is_active == True,
            DeliveryOrder.status != DOStatus.CANCELLED,
            DeliveryOrderLine.so_line_id.isnot(None),
        )
    )
    if exclude_do_id:
        q = q.where(DeliveryOrder.id != exclude_do_id)
    q = q.group_by(DeliveryOrderLine.so_line_id)

    result = await db.execute(q)
    return {row[0]: int(row[1]) for row in result.all()}


# ============================================================
# CREATE
# ============================================================

async def create_delivery_order(
    db: AsyncSession, *, body: dict, created_by: UUID, org_id: UUID,
) -> DeliveryOrder:
    """Create a new delivery order from an approved SO."""
    so = await _validate_so(db, body["so_id"], org_id)

    # Validate products (not SERVICE)
    product_ids = [line["product_id"] for line in body["lines"]]
    await _validate_products_not_service(db, product_ids)

    # Validate qty (partial delivery check)
    shipped_by_line = await _get_shipped_qty_by_so_line(db, so.id, org_id)
    so_lines_map = {line.id: line for line in so.lines}

    for line_data in body["lines"]:
        so_line_id = line_data.get("so_line_id")
        if so_line_id:
            so_line = so_lines_map.get(so_line_id)
            if not so_line:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"SO line {so_line_id} not found in this SO",
                )
            already_shipped = shipped_by_line.get(so_line_id, 0)
            new_ordered = line_data["ordered_qty"]
            if already_shipped + new_ordered > so_line.quantity:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"Ordered qty ({new_ordered}) + already shipped ({already_shipped}) "
                        f"exceeds SO line qty ({so_line.quantity}) for SO line {so_line_id}"
                    ),
                )

    do_number = await _next_do_number(db, org_id)

    do = DeliveryOrder(
        do_number=do_number,
        so_id=so.id,
        customer_id=so.customer_id,
        delivery_date=body["delivery_date"],
        shipping_address=body.get("shipping_address"),
        shipping_method=body.get("shipping_method"),
        note=body.get("note"),
        status=DOStatus.DRAFT,
        created_by=created_by,
        org_id=org_id,
    )
    db.add(do)
    await db.flush()

    for idx, line_data in enumerate(body["lines"], 1):
        line = DeliveryOrderLine(
            do_id=do.id,
            so_line_id=line_data.get("so_line_id"),
            product_id=line_data["product_id"],
            line_number=idx,
            ordered_qty=line_data["ordered_qty"],
            shipped_qty=0,
            location_id=line_data.get("location_id"),
            note=line_data.get("note"),
        )
        db.add(line)

    await db.commit()
    return await get_delivery_order(db, do.id, org_id=org_id)


# ============================================================
# READ
# ============================================================

async def get_delivery_order(
    db: AsyncSession, do_id: UUID, org_id: UUID,
) -> DeliveryOrder:
    """Get a single DO with lines loaded."""
    result = await db.execute(
        select(DeliveryOrder)
        .options(selectinload(DeliveryOrder.lines))
        .where(
            DeliveryOrder.id == do_id,
            DeliveryOrder.org_id == org_id,
            DeliveryOrder.is_active == True,
        )
    )
    do = result.scalar_one_or_none()
    if not do:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delivery order not found",
        )
    return do


async def list_delivery_orders(
    db: AsyncSession, *, limit: int = 20, offset: int = 0,
    search: Optional[str] = None, do_status: Optional[str] = None,
    org_id: UUID,
) -> tuple[list[DeliveryOrder], int]:
    """List DOs with pagination, search, filters."""
    query = select(DeliveryOrder).where(
        DeliveryOrder.org_id == org_id,
        DeliveryOrder.is_active == True,
    )
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                DeliveryOrder.do_number.ilike(pattern),
                DeliveryOrder.note.ilike(pattern),
            )
        )
    if do_status:
        query = query.where(DeliveryOrder.status == do_status)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        query.options(selectinload(DeliveryOrder.lines))
        .order_by(DeliveryOrder.created_at.desc())
        .limit(limit).offset(offset)
    )
    result = await db.execute(query)
    items = list(result.scalars().unique().all())
    return items, total


# ============================================================
# UPDATE (DRAFT only)
# ============================================================

async def update_delivery_order(
    db: AsyncSession, do_id: UUID, *, body: dict, org_id: UUID,
) -> DeliveryOrder:
    """Update a DRAFT delivery order. Replace lines if provided."""
    do = await get_delivery_order(db, do_id, org_id=org_id)
    if do.status != DOStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only edit DRAFT DOs (current: {do.status.value})",
        )

    new_lines = body.pop("lines", None)

    for field, value in body.items():
        if value is not None and hasattr(do, field):
            setattr(do, field, value)

    if new_lines is not None:
        product_ids = [line["product_id"] for line in new_lines]
        await _validate_products_not_service(db, product_ids)

        # Validate qty for new lines
        shipped_by_line = await _get_shipped_qty_by_so_line(
            db, do.so_id, org_id, exclude_do_id=do.id,
        )
        so_result = await db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.lines))
            .where(SalesOrder.id == do.so_id)
        )
        so = so_result.scalar_one_or_none()
        so_lines_map = {line.id: line for line in so.lines} if so else {}

        for line_data in new_lines:
            so_line_id = line_data.get("so_line_id")
            if so_line_id and so_line_id in so_lines_map:
                so_line = so_lines_map[so_line_id]
                already_shipped = shipped_by_line.get(so_line_id, 0)
                new_ordered = line_data["ordered_qty"]
                if already_shipped + new_ordered > so_line.quantity:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=(
                            f"Ordered qty ({new_ordered}) + shipped ({already_shipped}) "
                            f"exceeds SO line qty ({so_line.quantity})"
                        ),
                    )

        for old_line in do.lines:
            await db.delete(old_line)
        await db.flush()

        for idx, line_data in enumerate(new_lines, 1):
            line = DeliveryOrderLine(
                do_id=do.id,
                so_line_id=line_data.get("so_line_id"),
                product_id=line_data["product_id"],
                line_number=idx,
                ordered_qty=line_data["ordered_qty"],
                shipped_qty=0,
                location_id=line_data.get("location_id"),
                note=line_data.get("note"),
            )
            db.add(line)

    await db.commit()
    return await get_delivery_order(db, do_id, org_id=org_id)


# ============================================================
# DELETE (DRAFT only)
# ============================================================

async def delete_delivery_order(
    db: AsyncSession, do_id: UUID, org_id: UUID,
) -> None:
    """Soft-delete a DRAFT delivery order."""
    do = await get_delivery_order(db, do_id, org_id=org_id)
    if do.status != DOStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only delete DRAFT DOs (current: {do.status.value})",
        )
    do.is_active = False
    await db.commit()


# ============================================================
# CANCEL (DRAFT → CANCELLED)
# ============================================================

async def cancel_delivery_order(
    db: AsyncSession, do_id: UUID, org_id: UUID,
) -> DeliveryOrder:
    """Cancel a DRAFT delivery order."""
    do = await get_delivery_order(db, do_id, org_id=org_id)
    if do.status != DOStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only cancel DRAFT DOs (current: {do.status.value})",
        )
    do.status = DOStatus.CANCELLED
    await db.commit()
    return await get_delivery_order(db, do_id, org_id=org_id)


# ============================================================
# SHIP (DRAFT → SHIPPED — auto ISSUE stock movements)
# ============================================================

async def ship_delivery_order(
    db: AsyncSession, do_id: UUID, *, ship_data: dict, shipped_by: UUID, org_id: UUID,
) -> DeliveryOrder:
    """
    Confirm shipment: DRAFT → SHIPPED.
    Creates ISSUE stock movements per line with shipped_qty > 0.
    """
    do = await get_delivery_order(db, do_id, org_id=org_id)
    if do.status != DOStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only ship DRAFT DOs (current: {do.status.value})",
        )

    lines_by_id = {line.id: line for line in do.lines}
    ship_lines = ship_data.get("lines", [])
    ship_note = ship_data.get("note")

    for ship_line in ship_lines:
        line_id = ship_line["line_id"]
        shipped_qty = ship_line["shipped_qty"]
        line = lines_by_id.get(line_id)

        if not line:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"DO line {line_id} not found",
            )

        if shipped_qty > line.ordered_qty:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Shipped qty ({shipped_qty}) exceeds ordered qty ({line.ordered_qty}) "
                    f"for line #{line.line_number}"
                ),
            )

        line.shipped_qty = shipped_qty

        if shipped_qty > 0:
            location_id = ship_line.get("location_id") or line.location_id

            # Get product unit_cost for movement
            prod_result = await db.execute(
                select(Product).where(Product.id == line.product_id)
            )
            product = prod_result.scalar_one_or_none()
            unit_cost = product.cost if product else Decimal("0.00")

            # Create ISSUE movement for this line
            movement = await create_movement(
                db,
                product_id=line.product_id,
                movement_type="ISSUE",
                quantity=shipped_qty,
                unit_cost=unit_cost,
                reference=f"DO {do.do_number} line #{line.line_number}",
                note=ship_note or line.note,
                created_by=shipped_by,
                org_id=org_id,
                location_id=location_id,
                cost_center_id=None,
                skip_cc_validation=True,  # DO ISSUE is sales fulfillment, not CC charge
            )
            line.movement_id = movement.id

    do.status = DOStatus.SHIPPED
    do.shipped_by = shipped_by
    do.shipped_at = datetime.now(timezone.utc)
    await db.commit()
    return await get_delivery_order(db, do_id, org_id=org_id)


# ============================================================
# REMAINING QTY (for partial delivery UI)
# ============================================================

async def get_remaining_qty_for_so(
    db: AsyncSession, so_id: UUID, org_id: UUID,
) -> dict:
    """Get remaining deliverable qty per SO line."""
    so = await _validate_so(db, so_id, org_id)
    shipped_by_line = await _get_shipped_qty_by_so_line(db, so_id, org_id)

    # Get product info
    product_ids = [line.product_id for line in so.lines]
    products_map = {}
    if product_ids:
        result = await db.execute(
            select(Product.id, Product.sku, Product.name, Product.unit, Product.product_type)
            .where(Product.id.in_(product_ids))
        )
        for row in result.all():
            products_map[row[0]] = {
                "sku": row[1], "name": row[2], "unit": row[3], "type": row[4],
            }

    lines = []
    for so_line in so.lines:
        p = products_map.get(so_line.product_id, {})
        # Skip SERVICE products
        if p.get("type") == ProductType.SERVICE:
            continue
        shipped = shipped_by_line.get(so_line.id, 0)
        remaining = so_line.quantity - shipped
        lines.append({
            "so_line_id": so_line.id,
            "product_id": so_line.product_id,
            "product_sku": p.get("sku"),
            "product_name": p.get("name"),
            "product_unit": p.get("unit"),
            "so_qty": so_line.quantity,
            "shipped_qty": shipped,
            "remaining_qty": max(0, remaining),
        })

    return {
        "so_id": so.id,
        "so_number": so.so_number,
        "lines": lines,
    }


# ============================================================
# ENRICHMENT
# ============================================================

async def enrich_delivery_orders(
    db: AsyncSession, dos: list[DeliveryOrder],
) -> list[dict]:
    """Enrich DO list with related names."""
    if not dos:
        return []

    user_ids = set()
    for do in dos:
        user_ids.add(do.created_by)
        if do.shipped_by:
            user_ids.add(do.shipped_by)

    user_map = {}
    if user_ids:
        result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(user_ids))
        )
        user_map = {row.id: row.full_name for row in result.all()}

    enriched = []
    for do in dos:
        # Get product info for lines
        line_enrichment = await _enrich_do_lines(db, list(do.lines))

        lines = []
        for line in sorted(do.lines, key=lambda x: x.line_number):
            le = line_enrichment.get(line.id, {})
            lines.append({
                "id": line.id,
                "do_id": line.do_id,
                "so_line_id": line.so_line_id,
                "product_id": line.product_id,
                "product_sku": le.get("product_sku"),
                "product_name": le.get("product_name"),
                "product_unit": le.get("product_unit"),
                "line_number": line.line_number,
                "ordered_qty": line.ordered_qty,
                "shipped_qty": line.shipped_qty,
                "location_id": line.location_id,
                "location_name": le.get("location_name"),
                "warehouse_name": le.get("warehouse_name"),
                "movement_id": line.movement_id,
                "note": line.note,
                "created_at": line.created_at,
                "updated_at": line.updated_at,
            })

        d = {
            "id": do.id,
            "do_number": do.do_number,
            "so_id": do.so_id,
            "so_number": do.sales_order.so_number if do.sales_order else None,
            "customer_id": do.customer_id,
            "customer_name": do.customer.name if do.customer else None,
            "customer_code": do.customer.code if do.customer else None,
            "delivery_date": do.delivery_date,
            "shipping_address": do.shipping_address,
            "shipping_method": do.shipping_method,
            "note": do.note,
            "status": do.status.value if hasattr(do.status, "value") else do.status,
            "shipped_by": do.shipped_by,
            "shipped_by_name": user_map.get(do.shipped_by) if do.shipped_by else None,
            "shipped_at": do.shipped_at,
            "created_by": do.created_by,
            "creator_name": user_map.get(do.created_by),
            "is_active": do.is_active,
            "org_id": do.org_id,
            "lines": lines,
            "line_count": len(lines),
            "created_at": do.created_at,
            "updated_at": do.updated_at,
        }
        enriched.append(d)

    return enriched


async def _enrich_do_lines(
    db: AsyncSession, lines: list[DeliveryOrderLine],
) -> dict:
    """Batch-fetch product + location info for DO lines."""
    if not lines:
        return {}

    product_ids = {l.product_id for l in lines}
    location_ids = {l.location_id for l in lines if l.location_id}

    product_info = {}
    if product_ids:
        result = await db.execute(
            select(Product.id, Product.sku, Product.name, Product.unit)
            .where(Product.id.in_(product_ids))
        )
        for row in result.all():
            product_info[row[0]] = {
                "product_sku": row[1],
                "product_name": row[2],
                "product_unit": row[3],
            }

    location_info = {}
    if location_ids:
        result = await db.execute(
            select(Location.id, Location.name, Warehouse.name)
            .join(Warehouse, Location.warehouse_id == Warehouse.id)
            .where(Location.id.in_(location_ids))
        )
        for row in result.all():
            location_info[row[0]] = {
                "location_name": row[1],
                "warehouse_name": row[2],
            }

    enrichment = {}
    for l in lines:
        p = product_info.get(l.product_id, {})
        loc = location_info.get(l.location_id, {}) if l.location_id else {}
        enrichment[l.id] = {
            "product_sku": p.get("product_sku"),
            "product_name": p.get("product_name"),
            "product_unit": p.get("product_unit"),
            "location_name": loc.get("location_name"),
            "warehouse_name": loc.get("warehouse_name"),
        }
    return enrichment
