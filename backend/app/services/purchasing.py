"""
SSS Corp ERP — Purchasing Service (Business Logic)
Phase 3: PO CRUD + approve + goods receipt

Flow (CLAUDE.md Flow 8):
  Staff+ creates PO → Submit → Manager+ Approve → Goods Receipt → RECEIVE movement
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.purchasing import POStatus, PurchaseOrder, PurchaseOrderLine
from app.services.inventory import create_movement


async def _next_po_number(db: AsyncSession, org_id: UUID) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"PO-{year}-"
    result = await db.execute(
        select(func.count()).where(
            PurchaseOrder.org_id == org_id,
            PurchaseOrder.po_number.like(f"{prefix}%"),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


async def create_purchase_order(
    db: AsyncSession,
    *,
    supplier_name: str,
    order_date,
    expected_date,
    note: Optional[str],
    lines: list[dict],
    created_by: UUID,
    org_id: UUID,
    requested_approver_id: Optional[UUID] = None,
) -> PurchaseOrder:
    po_number = await _next_po_number(db, org_id)

    total = sum(Decimal(str(l["quantity"])) * l["unit_cost"] for l in lines)

    po = PurchaseOrder(
        po_number=po_number,
        supplier_name=supplier_name,
        order_date=order_date,
        expected_date=expected_date,
        note=note,
        total_amount=total,
        created_by=created_by,
        org_id=org_id,
        requested_approver_id=requested_approver_id,
    )
    db.add(po)
    await db.flush()

    for l in lines:
        line = PurchaseOrderLine(
            po_id=po.id,
            product_id=l["product_id"],
            quantity=l["quantity"],
            unit_cost=l["unit_cost"],
        )
        db.add(line)

    await db.commit()
    return await get_purchase_order(db, po.id)


async def get_purchase_order(db: AsyncSession, po_id: UUID, *, org_id: Optional[UUID] = None) -> PurchaseOrder:
    query = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po_id, PurchaseOrder.is_active == True)
    )
    if org_id:
        query = query.where(PurchaseOrder.org_id == org_id)
    result = await db.execute(query)
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


async def list_purchase_orders(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    po_status: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[PurchaseOrder], int]:
    query = select(PurchaseOrder).where(PurchaseOrder.is_active == True)
    if org_id:
        query = query.where(PurchaseOrder.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (PurchaseOrder.po_number.ilike(pattern))
            | (PurchaseOrder.supplier_name.ilike(pattern))
        )
    if po_status:
        query = query.where(PurchaseOrder.status == po_status)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.options(selectinload(PurchaseOrder.lines))
        .order_by(PurchaseOrder.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    items = list(result.scalars().unique().all())
    return items, total


async def update_purchase_order(
    db: AsyncSession,
    po_id: UUID,
    *,
    update_data: dict,
) -> PurchaseOrder:
    po = await get_purchase_order(db, po_id)

    if po.status not in (POStatus.DRAFT, POStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot edit PO in {po.status.value} status",
        )

    for field, value in update_data.items():
        if value is not None:
            setattr(po, field, value)

    await db.commit()
    return await get_purchase_order(db, po_id)


async def delete_purchase_order(db: AsyncSession, po_id: UUID) -> None:
    po = await get_purchase_order(db, po_id)
    if po.status != POStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Can only delete DRAFT purchase orders",
        )
    po.is_active = False
    await db.commit()


async def approve_purchase_order(
    db: AsyncSession,
    po_id: UUID,
    *,
    approved_by: UUID,
) -> PurchaseOrder:
    po = await get_purchase_order(db, po_id)

    if po.status not in (POStatus.DRAFT, POStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot approve PO in {po.status.value} status",
        )

    po.status = POStatus.APPROVED
    po.approved_by = approved_by
    await db.commit()
    return await get_purchase_order(db, po_id)


async def receive_goods(
    db: AsyncSession,
    po_id: UUID,
    *,
    receipt_lines: list[dict],
    received_by: UUID,
    org_id: UUID,
) -> PurchaseOrder:
    """
    Goods Receipt: receive items from PO → creates RECEIVE stock movements.
    """
    po = await get_purchase_order(db, po_id)

    if po.status != POStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Can only receive goods for APPROVED purchase orders",
        )

    lines_by_id = {line.id: line for line in po.lines}

    for rl in receipt_lines:
        line = lines_by_id.get(rl["line_id"])
        if not line:
            raise HTTPException(status_code=404, detail=f"PO line {rl['line_id']} not found")

        remaining = line.quantity - line.received_qty
        if rl["received_qty"] > remaining:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Received qty ({rl['received_qty']}) exceeds remaining ({remaining})",
            )

        # Create RECEIVE stock movement
        await create_movement(
            db,
            product_id=line.product_id,
            movement_type="RECEIVE",
            quantity=rl["received_qty"],
            unit_cost=line.unit_cost,
            reference=f"GR from {po.po_number}",
            note=None,
            created_by=received_by,
            org_id=org_id,
        )

        line.received_qty += rl["received_qty"]

    # Check if all lines fully received
    all_received = all(l.received_qty >= l.quantity for l in po.lines)
    if all_received:
        po.status = POStatus.RECEIVED

    await db.commit()
    return await get_purchase_order(db, po_id)
