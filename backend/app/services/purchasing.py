"""
SSS Corp ERP — Purchasing Service (Business Logic)
PR/PO Redesign: PR CRUD + approve + convert to PO + goods receipt

Flow:
  Staff creates PR → Submit → Approve → Convert to PO → Goods Receipt
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.purchasing import (
    POStatus,
    PRItemType,
    PRStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequisition,
    PurchaseRequisitionLine,
)
from app.services.inventory import create_movement


# ============================================================
# PR NUMBER GENERATOR
# ============================================================

async def _next_pr_number(db: AsyncSession, org_id: UUID) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"PR-{year}-"
    result = await db.execute(
        select(func.count()).where(
            PurchaseRequisition.org_id == org_id,
            PurchaseRequisition.pr_number.like(f"{prefix}%"),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


# ============================================================
# PR SERVICES
# ============================================================

async def create_purchase_requisition(
    db: AsyncSession,
    *,
    body: dict,
    created_by: UUID,
    org_id: UUID,
    requester_id: Optional[UUID] = None,
) -> PurchaseRequisition:
    pr_number = await _next_pr_number(db, org_id)

    pr = PurchaseRequisition(
        pr_number=pr_number,
        pr_type=body.get("pr_type", "STANDARD"),
        cost_center_id=body["cost_center_id"],
        department_id=body.get("department_id"),
        requester_id=requester_id,
        priority=body.get("priority", "NORMAL"),
        required_date=body["required_date"],
        delivery_date=body.get("delivery_date"),
        validity_start_date=body.get("validity_start_date"),
        validity_end_date=body.get("validity_end_date"),
        note=body.get("note"),
        requested_approver_id=body.get("requested_approver_id"),
        created_by=created_by,
        org_id=org_id,
    )
    db.add(pr)
    await db.flush()

    for idx, line_data in enumerate(body["lines"], 1):
        line = PurchaseRequisitionLine(
            pr_id=pr.id,
            line_number=idx,
            item_type=line_data["item_type"],
            product_id=line_data.get("product_id"),
            description=line_data.get("description"),
            quantity=line_data["quantity"],
            unit=line_data.get("unit", "PCS"),
            estimated_unit_cost=line_data.get("estimated_unit_cost", Decimal("0.00")),
            cost_element_id=line_data["cost_element_id"],
            note=line_data.get("note"),
        )
        db.add(line)

    await db.commit()
    return await get_purchase_requisition(db, pr.id, org_id=org_id)


async def get_purchase_requisition(
    db: AsyncSession,
    pr_id: UUID,
    *,
    org_id: Optional[UUID] = None,
) -> PurchaseRequisition:
    query = (
        select(PurchaseRequisition)
        .options(selectinload(PurchaseRequisition.lines))
        .where(PurchaseRequisition.id == pr_id, PurchaseRequisition.is_active == True)
    )
    if org_id:
        query = query.where(PurchaseRequisition.org_id == org_id)
    result = await db.execute(query)
    pr = result.scalar_one_or_none()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
    return pr


async def list_purchase_requisitions(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    pr_status: Optional[str] = None,
    pr_type: Optional[str] = None,
    org_id: Optional[UUID] = None,
    created_by_filter: Optional[UUID] = None,
    department_filter: Optional[list[UUID]] = None,
) -> tuple[list[PurchaseRequisition], int]:
    query = select(PurchaseRequisition).where(PurchaseRequisition.is_active == True)

    if org_id:
        query = query.where(PurchaseRequisition.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (PurchaseRequisition.pr_number.ilike(pattern))
            | (PurchaseRequisition.note.ilike(pattern))
        )
    if pr_status:
        query = query.where(PurchaseRequisition.status == pr_status)
    if pr_type:
        query = query.where(PurchaseRequisition.pr_type == pr_type)

    # Data Scope filters
    if created_by_filter:
        query = query.where(PurchaseRequisition.created_by == created_by_filter)
    elif department_filter:
        query = query.where(PurchaseRequisition.department_id.in_(department_filter))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.options(selectinload(PurchaseRequisition.lines))
        .order_by(PurchaseRequisition.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    items = list(result.scalars().unique().all())
    return items, total


async def update_purchase_requisition(
    db: AsyncSession,
    pr_id: UUID,
    *,
    update_data: dict,
    org_id: UUID,
) -> PurchaseRequisition:
    pr = await get_purchase_requisition(db, pr_id, org_id=org_id)

    if pr.status not in (PRStatus.DRAFT, PRStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot edit PR in {pr.status.value} status",
        )

    # Handle line replacement
    new_lines = update_data.pop("lines", None)

    for field, value in update_data.items():
        if value is not None:
            setattr(pr, field, value)

    if new_lines is not None:
        # Delete old lines
        for old_line in pr.lines:
            await db.delete(old_line)
        await db.flush()

        # Create new lines
        for idx, line_data in enumerate(new_lines, 1):
            line = PurchaseRequisitionLine(
                pr_id=pr.id,
                line_number=idx,
                item_type=line_data["item_type"],
                product_id=line_data.get("product_id"),
                description=line_data.get("description"),
                quantity=line_data["quantity"],
                unit=line_data.get("unit", "PCS"),
                estimated_unit_cost=line_data.get("estimated_unit_cost", Decimal("0.00")),
                cost_element_id=line_data["cost_element_id"],
                note=line_data.get("note"),
            )
            db.add(line)

    await db.commit()
    return await get_purchase_requisition(db, pr_id, org_id=org_id)


async def delete_purchase_requisition(db: AsyncSession, pr_id: UUID, *, org_id: UUID) -> None:
    pr = await get_purchase_requisition(db, pr_id, org_id=org_id)
    if pr.status != PRStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Can only delete DRAFT purchase requisitions",
        )
    pr.is_active = False
    await db.commit()


async def submit_purchase_requisition(
    db: AsyncSession, pr_id: UUID, *, org_id: UUID
) -> PurchaseRequisition:
    pr = await get_purchase_requisition(db, pr_id, org_id=org_id)
    if pr.status != PRStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only submit DRAFT PR (current: {pr.status.value})",
        )
    pr.status = PRStatus.SUBMITTED
    await db.commit()
    return await get_purchase_requisition(db, pr_id, org_id=org_id)


async def approve_purchase_requisition(
    db: AsyncSession,
    pr_id: UUID,
    *,
    action: str,
    reason: Optional[str] = None,
    approved_by: UUID,
    org_id: UUID,
) -> PurchaseRequisition:
    pr = await get_purchase_requisition(db, pr_id, org_id=org_id)

    if pr.status != PRStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only approve/reject SUBMITTED PR (current: {pr.status.value})",
        )

    if action == "approve":
        pr.status = PRStatus.APPROVED
        pr.approved_by = approved_by
        pr.approved_at = datetime.now(timezone.utc)
    elif action == "reject":
        pr.status = PRStatus.REJECTED
        pr.approved_by = approved_by
        pr.approved_at = datetime.now(timezone.utc)
        pr.rejected_reason = reason

    await db.commit()
    return await get_purchase_requisition(db, pr_id, org_id=org_id)


async def cancel_purchase_requisition(
    db: AsyncSession, pr_id: UUID, *, org_id: UUID
) -> PurchaseRequisition:
    pr = await get_purchase_requisition(db, pr_id, org_id=org_id)
    if pr.status not in (PRStatus.DRAFT, PRStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only cancel DRAFT/SUBMITTED PR (current: {pr.status.value})",
        )
    pr.status = PRStatus.CANCELLED
    await db.commit()
    return await get_purchase_requisition(db, pr_id, org_id=org_id)


async def convert_pr_to_po(
    db: AsyncSession,
    pr_id: UUID,
    *,
    body: dict,
    created_by: UUID,
    org_id: UUID,
) -> PurchaseOrder:
    """Convert an approved PR to a PO (auto-approved)."""
    pr = await get_purchase_requisition(db, pr_id, org_id=org_id)

    if pr.status != PRStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only convert APPROVED PR (current: {pr.status.value})",
        )

    # Check PR not already converted
    existing_po = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.pr_id == pr_id, PurchaseOrder.is_active == True)
    )
    if existing_po.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This PR has already been converted to a PO",
        )

    # Build PR line lookup
    pr_lines_by_id = {line.id: line for line in pr.lines}
    convert_lines = body["lines"]

    # Validate all PR lines are covered
    convert_line_ids = {cl["pr_line_id"] for cl in convert_lines}
    for line_id in convert_line_ids:
        if line_id not in pr_lines_by_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"PR line {line_id} not found in this PR",
            )

    # Create PO
    po_number = await _next_po_number(db, org_id)
    total_amount = Decimal("0.00")

    for cl in convert_lines:
        pr_line = pr_lines_by_id[cl["pr_line_id"]]
        total_amount += Decimal(str(pr_line.quantity)) * Decimal(str(cl["unit_cost"]))

    po = PurchaseOrder(
        po_number=po_number,
        pr_id=pr.id,
        supplier_name=body["supplier_name"],
        status=POStatus.APPROVED,  # Auto-approved since PR is approved
        order_date=date.today(),
        expected_date=body.get("expected_date"),
        total_amount=total_amount,
        cost_center_id=pr.cost_center_id,
        note=body.get("note"),
        created_by=created_by,
        approved_by=created_by,
        org_id=org_id,
    )
    db.add(po)
    await db.flush()

    # Create PO Lines from PR Lines
    for cl in convert_lines:
        pr_line = pr_lines_by_id[cl["pr_line_id"]]
        po_line = PurchaseOrderLine(
            po_id=po.id,
            pr_line_id=pr_line.id,
            product_id=pr_line.product_id,
            item_type=pr_line.item_type,
            description=pr_line.description,
            quantity=pr_line.quantity,
            unit=pr_line.unit,
            unit_cost=cl["unit_cost"],
            cost_element_id=pr_line.cost_element_id,
        )
        db.add(po_line)

    # Update PR status
    pr.status = PRStatus.PO_CREATED

    await db.commit()
    return await get_purchase_order(db, po.id, org_id=org_id)


# ============================================================
# PO NUMBER GENERATOR
# ============================================================

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


# ============================================================
# PO SERVICES (Modified)
# ============================================================

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
    """Legacy PO creation (kept for backward compat, but new POs should use convert_pr_to_po)."""
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
    created_by_filter: Optional[UUID] = None,
    department_filter: Optional[list[UUID]] = None,
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

    # Data Scope filters (consistent with PR list — Phase 6 compliance)
    if created_by_filter:
        query = query.where(PurchaseOrder.created_by == created_by_filter)
    elif department_filter:
        # Filter PO by department via linked PR
        query = query.where(
            PurchaseOrder.pr_id.isnot(None),
            PurchaseOrder.pr_id.in_(
                select(PurchaseRequisition.id).where(
                    PurchaseRequisition.department_id.in_(department_filter)
                )
            )
        )

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
    org_id: Optional[UUID] = None,
) -> PurchaseOrder:
    po = await get_purchase_order(db, po_id, org_id=org_id)

    if po.status not in (POStatus.DRAFT, POStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot edit PO in {po.status.value} status",
        )

    for field, value in update_data.items():
        if value is not None:
            setattr(po, field, value)

    await db.commit()
    return await get_purchase_order(db, po_id, org_id=org_id)


async def delete_purchase_order(db: AsyncSession, po_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    po = await get_purchase_order(db, po_id, org_id=org_id)
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
    org_id: Optional[UUID] = None,
) -> PurchaseOrder:
    po = await get_purchase_order(db, po_id, org_id=org_id)

    if po.status not in (POStatus.DRAFT, POStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot approve PO in {po.status.value} status",
        )

    po.status = POStatus.APPROVED
    po.approved_by = approved_by
    await db.commit()
    return await get_purchase_order(db, po_id, org_id=org_id)


async def receive_goods(
    db: AsyncSession,
    po_id: UUID,
    *,
    receipt_lines: list[dict],
    received_by: UUID,
    org_id: UUID,
) -> PurchaseOrder:
    """
    Goods Receipt: receive items from PO.
    GOODS items → creates RECEIVE stock movements.
    SERVICE items → marks received (no stock movement).
    """
    po = await get_purchase_order(db, po_id, org_id=org_id)

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

        # Handle by item type
        item_type = getattr(line, "item_type", PRItemType.GOODS)
        if isinstance(item_type, str):
            item_type = PRItemType(item_type)

        if item_type == PRItemType.GOODS and line.product_id:
            # GOODS → create RECEIVE stock movement
            await create_movement(
                db,
                product_id=line.product_id,
                movement_type="RECEIVE",
                quantity=rl["received_qty"],
                unit_cost=line.unit_cost,
                reference=f"GR from {po.po_number}",
                note=rl.get("note"),
                created_by=received_by,
                org_id=org_id,
            )
        # SERVICE → no stock movement, just update received_qty

        line.received_qty += rl["received_qty"]
        line.received_by = received_by
        line.received_at = datetime.now(timezone.utc)

    # Check if all lines fully received
    all_received = all(l.received_qty >= l.quantity for l in po.lines)
    if all_received:
        po.status = POStatus.RECEIVED

    await db.commit()
    return await get_purchase_order(db, po_id, org_id=org_id)
