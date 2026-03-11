"""
SSS Corp ERP — Stock Take Service
Phase 11.14: Cycle Count workflow
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import Product, ProductType, StockByLocation
from app.models.stocktake import StockTake, StockTakeLine, StockTakeStatus
from app.models.warehouse import Location, Warehouse
from app.models.hr import Employee
from app.models.user import User

logger = logging.getLogger(__name__)


# ============================================================
# HELPERS
# ============================================================

async def _next_stocktake_number(db: AsyncSession, org_id: UUID) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"ST-{year}-"
    result = await db.execute(
        select(func.count()).select_from(StockTake).where(
            StockTake.org_id == org_id,
            StockTake.stocktake_number.like(f"{prefix}%"),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


async def _enrich_stocktake(db: AsyncSession, st: StockTake) -> dict:
    """Build enrichment dict for a single stock take."""
    data = {
        "id": st.id,
        "stocktake_number": st.stocktake_number,
        "status": st.status.value if st.status else None,
        "warehouse_id": st.warehouse_id,
        "warehouse_name": None,
        "location_id": st.location_id,
        "location_name": None,
        "counted_by": st.counted_by,
        "counter_name": None,
        "note": st.note,
        "reference": st.reference,
        "approved_by": st.approved_by,
        "approver_name": None,
        "approved_at": st.approved_at,
        "approved_reason": st.approved_reason,
        "posted_at": st.posted_at,
        "created_by": st.created_by,
        "is_active": st.is_active,
        "created_at": st.created_at,
        "updated_at": st.updated_at,
        "lines": [],
        "line_count": len(st.lines) if st.lines else 0,
        "total_variance_value": Decimal("0"),
    }

    # Warehouse name
    if st.warehouse_id:
        wh = await db.get(Warehouse, st.warehouse_id)
        if wh:
            data["warehouse_name"] = wh.name

    # Location name
    if st.location_id:
        loc = await db.get(Location, st.location_id)
        if loc:
            data["location_name"] = loc.name

    # Counter name
    if st.counted_by:
        emp = await db.get(Employee, st.counted_by)
        if emp:
            data["counter_name"] = emp.full_name

    # Approver name
    if st.approved_by:
        user = await db.get(User, st.approved_by)
        if user:
            data["approver_name"] = user.full_name

    # Enrich lines
    total_var_value = Decimal("0")
    for line in (st.lines or []):
        ld = {
            "id": line.id,
            "stocktake_id": line.stocktake_id,
            "line_number": line.line_number,
            "product_id": line.product_id,
            "product_sku": None,
            "product_name": None,
            "product_unit": None,
            "location_id": line.location_id,
            "location_name": None,
            "warehouse_name": data["warehouse_name"],
            "system_qty": line.system_qty,
            "counted_qty": line.counted_qty,
            "variance": None,
            "unit_cost": line.unit_cost,
            "variance_value": None,
            "movement_id": line.movement_id,
            "note": line.note,
            "created_at": line.created_at,
            "updated_at": line.updated_at,
        }

        # Product info
        prod = await db.get(Product, line.product_id)
        if prod:
            ld["product_sku"] = prod.sku
            ld["product_name"] = prod.name
            ld["product_unit"] = prod.unit

        # Location info
        if line.location_id:
            loc = await db.get(Location, line.location_id)
            if loc:
                ld["location_name"] = loc.name

        # Variance
        if line.counted_qty is not None:
            variance = line.system_qty - line.counted_qty
            ld["variance"] = variance
            var_value = Decimal(str(variance)) * (line.unit_cost or Decimal("0"))
            ld["variance_value"] = var_value
            total_var_value += var_value

        data["lines"].append(ld)

    data["total_variance_value"] = total_var_value
    return data


# ============================================================
# CRUD
# ============================================================

async def create_stocktake(
    db: AsyncSession, *, body, created_by: UUID, org_id: UUID
) -> dict:
    # Validate warehouse
    wh = await db.get(Warehouse, body.warehouse_id)
    if not wh or wh.org_id != org_id:
        raise HTTPException(404, "Warehouse not found")

    # Validate location if provided
    if body.location_id:
        loc = await db.get(Location, body.location_id)
        if not loc or loc.warehouse_id != body.warehouse_id:
            raise HTTPException(422, "Location does not belong to selected warehouse")

    number = await _next_stocktake_number(db, org_id)
    st = StockTake(
        org_id=org_id,
        stocktake_number=number,
        status=StockTakeStatus.DRAFT,
        warehouse_id=body.warehouse_id,
        location_id=body.location_id,
        counted_by=body.counted_by,
        note=body.note,
        reference=body.reference,
        created_by=created_by,
    )
    db.add(st)
    await db.flush()

    # Auto-populate lines from current stock
    if body.location_id:
        # Products with stock at specific location
        q = (
            select(StockByLocation, Product)
            .join(Product, Product.id == StockByLocation.product_id)
            .where(
                StockByLocation.location_id == body.location_id,
                StockByLocation.on_hand > 0,
                Product.org_id == org_id,
                Product.is_active == True,
                Product.product_type != ProductType.SERVICE,
            )
            .order_by(Product.sku)
        )
        result = await db.execute(q)
        rows = result.all()
        for i, (sbl, prod) in enumerate(rows, 1):
            line = StockTakeLine(
                stocktake_id=st.id,
                line_number=i,
                product_id=prod.id,
                location_id=body.location_id,
                system_qty=sbl.on_hand,
                unit_cost=prod.cost,
            )
            db.add(line)
    else:
        # All products with stock at any location in the warehouse
        wh_locations = select(Location.id).where(Location.warehouse_id == body.warehouse_id)
        q = (
            select(StockByLocation, Product)
            .join(Product, Product.id == StockByLocation.product_id)
            .where(
                StockByLocation.location_id.in_(wh_locations),
                StockByLocation.on_hand > 0,
                Product.org_id == org_id,
                Product.is_active == True,
                Product.product_type != ProductType.SERVICE,
            )
            .order_by(Product.sku, StockByLocation.location_id)
        )
        result = await db.execute(q)
        rows = result.all()
        for i, (sbl, prod) in enumerate(rows, 1):
            line = StockTakeLine(
                stocktake_id=st.id,
                line_number=i,
                product_id=prod.id,
                location_id=sbl.location_id,
                system_qty=sbl.on_hand,
                unit_cost=prod.cost,
            )
            db.add(line)

    await db.commit()

    # Reload with lines
    return await get_stocktake(db, st.id, org_id)


async def get_stocktake(db: AsyncSession, stocktake_id: UUID, org_id: UUID) -> dict:
    result = await db.execute(
        select(StockTake)
        .options(selectinload(StockTake.lines))
        .where(
            StockTake.id == stocktake_id,
            StockTake.org_id == org_id,
            StockTake.is_active == True,
        )
    )
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(404, "Stock Take not found")
    return await _enrich_stocktake(db, st)


async def list_stocktakes(
    db: AsyncSession,
    *,
    org_id: UUID,
    limit: int = 20,
    offset: int = 0,
    search: str | None = None,
    status: str | None = None,
) -> dict:
    base = select(StockTake).where(
        StockTake.org_id == org_id,
        StockTake.is_active == True,
    )

    if status:
        base = base.where(StockTake.status == StockTakeStatus(status))
    if search:
        base = base.where(StockTake.stocktake_number.ilike(f"%{search}%"))

    # Count
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch
    q = (
        base.options(selectinload(StockTake.lines))
        .order_by(StockTake.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(q)
    items = []
    for st in result.scalars().all():
        items.append(await _enrich_stocktake(db, st))

    return {"items": items, "total": total, "limit": limit, "offset": offset}


async def update_stocktake(
    db: AsyncSession, stocktake_id: UUID, *, body, org_id: UUID
) -> dict:
    result = await db.execute(
        select(StockTake)
        .options(selectinload(StockTake.lines))
        .where(
            StockTake.id == stocktake_id,
            StockTake.org_id == org_id,
            StockTake.is_active == True,
        )
    )
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(404, "Stock Take not found")
    if st.status != StockTakeStatus.DRAFT:
        raise HTTPException(422, "Can only edit DRAFT stock take")

    if body.counted_by is not None:
        st.counted_by = body.counted_by
    if body.note is not None:
        st.note = body.note
    if body.reference is not None:
        st.reference = body.reference

    # Update line counted_qty
    if body.lines:
        line_map = {line.id: line for line in st.lines}
        for lu in body.lines:
            line = line_map.get(lu.line_id)
            if line:
                line.counted_qty = lu.counted_qty
                if lu.note is not None:
                    line.note = lu.note

    await db.commit()
    return await get_stocktake(db, stocktake_id, org_id)


async def delete_stocktake(
    db: AsyncSession, stocktake_id: UUID, org_id: UUID
) -> None:
    result = await db.execute(
        select(StockTake).where(
            StockTake.id == stocktake_id,
            StockTake.org_id == org_id,
            StockTake.is_active == True,
        )
    )
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(404, "Stock Take not found")
    if st.status != StockTakeStatus.DRAFT:
        raise HTTPException(422, "Can only delete DRAFT stock take")

    st.is_active = False
    await db.commit()


# ============================================================
# STATUS TRANSITIONS
# ============================================================

async def submit_stocktake(
    db: AsyncSession, stocktake_id: UUID, org_id: UUID
) -> dict:
    result = await db.execute(
        select(StockTake)
        .options(selectinload(StockTake.lines))
        .where(
            StockTake.id == stocktake_id,
            StockTake.org_id == org_id,
            StockTake.is_active == True,
        )
    )
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(404, "Stock Take not found")
    if st.status != StockTakeStatus.DRAFT:
        raise HTTPException(422, "Can only submit DRAFT stock take")

    if not st.lines:
        raise HTTPException(422, "Stock Take has no lines")

    # Validate all lines have counted_qty
    for line in st.lines:
        if line.counted_qty is None:
            raise HTTPException(
                422,
                f"Line #{line.line_number}: counted_qty is required before submitting"
            )

    # BR#ST7: Re-snapshot system_qty at submit time
    for line in st.lines:
        prod = await db.get(Product, line.product_id)
        if line.location_id:
            sbl_result = await db.execute(
                select(StockByLocation).where(
                    StockByLocation.product_id == line.product_id,
                    StockByLocation.location_id == line.location_id,
                )
            )
            sbl = sbl_result.scalar_one_or_none()
            line.system_qty = sbl.on_hand if sbl else 0
        elif prod:
            line.system_qty = prod.on_hand
        # Also snapshot cost
        if prod:
            line.unit_cost = prod.cost

    st.status = StockTakeStatus.SUBMITTED
    await db.commit()

    # Notify approvers
    try:
        from app.services.notification import notify_approval_request
        await notify_approval_request(
            db=db,
            document_type="Stock Take",
            document_number=st.stocktake_number,
            document_id=str(st.id),
            requester_user_id=st.created_by,
            org_id=org_id,
            target_permission="inventory.stocktake.approve",
            link=f"/stock-take/{st.id}",
        )
    except Exception:
        pass

    return await get_stocktake(db, stocktake_id, org_id)


async def approve_stocktake(
    db: AsyncSession,
    stocktake_id: UUID,
    *,
    action: str,
    reason: str | None,
    approved_by: UUID,
    org_id: UUID,
) -> dict:
    result = await db.execute(
        select(StockTake)
        .options(selectinload(StockTake.lines))
        .where(
            StockTake.id == stocktake_id,
            StockTake.org_id == org_id,
            StockTake.is_active == True,
        )
    )
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(404, "Stock Take not found")
    if st.status != StockTakeStatus.SUBMITTED:
        raise HTTPException(422, "Can only approve/reject SUBMITTED stock take")

    now = datetime.now(timezone.utc)

    if action == "reject":
        st.status = StockTakeStatus.DRAFT  # BR#ST9: back to DRAFT
        st.approved_by = approved_by
        st.approved_at = now
        st.approved_reason = reason
        await db.commit()

        # Notify creator
        try:
            from app.services.notification import notify_status_change
            await notify_status_change(
                db=db,
                document_type="Stock Take",
                document_number=st.stocktake_number,
                new_status="REJECTED",
                target_user_id=st.created_by,
                org_id=org_id,
                link=f"/stock-take/{st.id}",
            )
        except Exception:
            pass

        return await get_stocktake(db, stocktake_id, org_id)

    # action == "approve" → auto-post ADJUST movements
    from app.services.inventory import create_movement

    try:
        for line in st.lines:
            if line.counted_qty is None:
                continue
            variance = line.system_qty - line.counted_qty
            if variance == 0:
                continue

            if variance > 0:
                adjust_type = "DECREASE"
                qty = variance
            else:
                adjust_type = "INCREASE"
                qty = abs(variance)

            movement = await create_movement(
                db,
                product_id=line.product_id,
                movement_type="ADJUST",
                quantity=qty,
                unit_cost=line.unit_cost or Decimal("0"),
                adjust_type=adjust_type,
                location_id=line.location_id,
                reference=f"ST#{st.stocktake_number}",
                note=f"Stock Take adjustment line #{line.line_number}",
                created_by=approved_by,
                org_id=org_id,
            )
            line.movement_id = movement.id

        st.status = StockTakeStatus.APPROVED
        st.approved_by = approved_by
        st.approved_at = now
        st.approved_reason = reason
        st.posted_at = now
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Stock Take approve failed: %s", e)
        raise HTTPException(500, f"Failed to post adjustments: {str(e)}")

    # Notify creator
    try:
        from app.services.notification import notify_status_change
        await notify_status_change(
            db=db,
            document_type="Stock Take",
            document_number=st.stocktake_number,
            new_status="APPROVED",
            target_user_id=st.created_by,
            org_id=org_id,
            link=f"/stock-take/{st.id}",
        )
    except Exception:
        pass

    return await get_stocktake(db, stocktake_id, org_id)


async def cancel_stocktake(
    db: AsyncSession, stocktake_id: UUID, org_id: UUID
) -> dict:
    result = await db.execute(
        select(StockTake).where(
            StockTake.id == stocktake_id,
            StockTake.org_id == org_id,
            StockTake.is_active == True,
        )
    )
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(404, "Stock Take not found")
    if st.status not in (StockTakeStatus.DRAFT, StockTakeStatus.SUBMITTED):
        raise HTTPException(422, "Can only cancel DRAFT or SUBMITTED stock take")

    st.status = StockTakeStatus.CANCELLED
    await db.commit()
    return await get_stocktake(db, stocktake_id, org_id)


# ============================================================
# HELPER: Products for Stock Take
# ============================================================

async def get_stocktake_products(
    db: AsyncSession,
    *,
    warehouse_id: UUID,
    location_id: UUID | None,
    org_id: UUID,
) -> list[dict]:
    """List products with current stock for auto-populating stock take lines."""
    if location_id:
        q = (
            select(StockByLocation, Product)
            .join(Product, Product.id == StockByLocation.product_id)
            .where(
                StockByLocation.location_id == location_id,
                StockByLocation.on_hand > 0,
                Product.org_id == org_id,
                Product.is_active == True,
                Product.product_type != ProductType.SERVICE,
            )
            .order_by(Product.sku)
        )
        result = await db.execute(q)
        items = []
        for sbl, prod in result.all():
            loc = await db.get(Location, location_id)
            items.append({
                "product_id": prod.id,
                "sku": prod.sku,
                "name": prod.name,
                "unit": prod.unit,
                "product_type": prod.product_type.value,
                "on_hand": prod.on_hand,
                "cost": prod.cost,
                "location_id": location_id,
                "location_name": loc.name if loc else None,
                "location_on_hand": sbl.on_hand,
            })
        return items
    else:
        wh_locations = select(Location.id).where(Location.warehouse_id == warehouse_id)
        q = (
            select(StockByLocation, Product)
            .join(Product, Product.id == StockByLocation.product_id)
            .where(
                StockByLocation.location_id.in_(wh_locations),
                StockByLocation.on_hand > 0,
                Product.org_id == org_id,
                Product.is_active == True,
                Product.product_type != ProductType.SERVICE,
            )
            .order_by(Product.sku)
        )
        result = await db.execute(q)
        items = []
        for sbl, prod in result.all():
            loc = await db.get(Location, sbl.location_id)
            items.append({
                "product_id": prod.id,
                "sku": prod.sku,
                "name": prod.name,
                "unit": prod.unit,
                "product_type": prod.product_type.value,
                "on_hand": prod.on_hand,
                "cost": prod.cost,
                "location_id": sbl.location_id,
                "location_name": loc.name if loc else None,
                "location_on_hand": sbl.on_hand,
            })
        return items
