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
from app.services.organization import get_or_create_tax_config


# ============================================================
# TENANCY HELPERS
# ============================================================

async def _validate_sourcer_tenancy(db: AsyncSession, sourcer_id: UUID, org_id: UUID) -> None:
    """§6: Validate sourcer_id belongs to same org."""
    from app.models.user import User
    result = await db.execute(
        select(User).where(User.id == sourcer_id, User.org_id == org_id, User.is_active == True)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Sourcer user not found or does not belong to this organization",
        )


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

    # §6: Validate sourcer_id tenancy
    sourcer_id = body.get("sourcer_id")
    if sourcer_id:
        await _validate_sourcer_tenancy(db, sourcer_id, org_id)

    pr = PurchaseRequisition(
        pr_number=pr_number,
        pr_type=body.get("pr_type", "STANDARD"),
        cost_center_id=body["cost_center_id"],
        department_id=body.get("department_id"),
        requester_id=requester_id,
        sourcer_id=sourcer_id,
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

    # §6: Validate sourcer_id tenancy on update
    if update_data.get("sourcer_id"):
        await _validate_sourcer_tenancy(db, update_data["sourcer_id"], org_id)

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

    # Phase 9: Notification — APPROVAL_REQUEST for PR approvers
    try:
        from app.services.notification import notify_approval_request, get_user_display_name
        _name = await get_user_display_name(db, pr.created_by)
        await notify_approval_request(
            db, org_id=org_id, permission="purchasing.pr.approve",
            entity_type="PR", entity_id=pr.id, doc_number=pr.pr_number,
            doc_type_thai="ใบขอซื้อ", link=f"/purchasing/pr/{pr.id}",
            actor_id=pr.created_by, actor_name=_name, exclude_user_id=pr.created_by,
        )
    except Exception:
        import logging
        logging.getLogger(__name__).warning("Notification failed for PR submit %s", pr.pr_number, exc_info=True)

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

    # Phase 9: Notification — APPROVED/REJECTED for PR creator
    try:
        from app.services.notification import notify_status_change, get_user_display_name
        from app.models.notification import NotificationType
        _approver_name = await get_user_display_name(db, approved_by)
        if action == "approve":
            await notify_status_change(
                db, org_id=org_id, user_id=pr.created_by,
                notification_type=NotificationType.DOCUMENT_APPROVED,
                entity_type="PR", entity_id=pr.id, doc_number=pr.pr_number,
                doc_type_thai="ใบขอซื้อ", link=f"/purchasing/pr/{pr.id}",
                actor_id=approved_by, actor_name=_approver_name,
            )
        elif action == "reject":
            await notify_status_change(
                db, org_id=org_id, user_id=pr.created_by,
                notification_type=NotificationType.DOCUMENT_REJECTED,
                entity_type="PR", entity_id=pr.id, doc_number=pr.pr_number,
                doc_type_thai="ใบขอซื้อ", link=f"/purchasing/pr/{pr.id}",
                actor_id=approved_by, actor_name=_approver_name, reason=reason,
            )
    except Exception:
        import logging
        logging.getLogger(__name__).warning("Notification failed for PR %s %s", action, pr.pr_number, exc_info=True)

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
    """Convert an approved PR to a PO (auto-approved).
    Wrapped in try/except to ensure rollback on failure (multi-step atomic).
    """
    try:
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
        subtotal = Decimal("0.00")

        for cl in convert_lines:
            pr_line = pr_lines_by_id[cl["pr_line_id"]]
            subtotal += Decimal(str(pr_line.quantity)) * Decimal(str(cl["unit_cost"]))

        # C5 Tax: resolve VAT rate → calculate vat_amount → grand total
        tax_config = await get_or_create_tax_config(db, org_id)
        vat_rate = body.get("vat_rate")
        if vat_rate is None:
            if tax_config.vat_enabled:
                vat_rate = tax_config.default_vat_rate
            else:
                vat_rate = Decimal("0.00")
        else:
            vat_rate = Decimal(str(vat_rate))

        vat_amount = (subtotal * vat_rate / Decimal("100")).quantize(Decimal("0.01"))
        total_amount = subtotal + vat_amount

        # C5.2 WHT: resolve WHT type → calc wht_amount → net_payment
        # BR#111: WHT base = subtotal (ก่อน VAT) ตามกฎหมายไทย
        wht_type_id = body.get("wht_type_id")
        wht_rate = Decimal("0.00")

        # Check org wht_enabled
        if tax_config.wht_enabled:
            if wht_type_id:
                # User explicitly chose a WHT type
                from app.models.master import WHTType
                wht_result = await db.execute(
                    select(WHTType).where(WHTType.id == wht_type_id, WHTType.org_id == org_id, WHTType.is_active == True)
                )
                wht_type = wht_result.scalar_one_or_none()
                if wht_type:
                    wht_rate = Decimal(str(wht_type.rate))
                else:
                    wht_type_id = None  # Invalid WHT type → skip
            elif body.get("supplier_id"):
                # BR#112: Auto-fill from supplier default
                from app.models.master import Supplier, WHTType
                sup_result = await db.execute(
                    select(Supplier).where(Supplier.id == body["supplier_id"], Supplier.org_id == org_id)
                )
                supplier_obj = sup_result.scalar_one_or_none()
                if supplier_obj and supplier_obj.default_wht_type_id:
                    wht_result = await db.execute(
                        select(WHTType).where(WHTType.id == supplier_obj.default_wht_type_id, WHTType.is_active == True)
                    )
                    wht_type = wht_result.scalar_one_or_none()
                    if wht_type:
                        wht_type_id = wht_type.id
                        wht_rate = Decimal(str(wht_type.rate))
        else:
            # WHT disabled at org level
            wht_type_id = None
            wht_rate = Decimal("0.00")

        wht_amount = (subtotal * wht_rate / Decimal("100")).quantize(Decimal("0.01"))
        net_payment = total_amount - wht_amount

        po = PurchaseOrder(
            po_number=po_number,
            pr_id=pr.id,
            supplier_name=body["supplier_name"],
            supplier_id=body.get("supplier_id"),
            status=POStatus.APPROVED,  # Auto-approved since PR is approved
            order_date=date.today(),
            expected_date=body.get("expected_date"),
            subtotal_amount=subtotal,
            vat_rate=vat_rate,
            vat_amount=vat_amount,
            total_amount=total_amount,
            wht_type_id=wht_type_id,
            wht_rate=wht_rate,
            wht_amount=wht_amount,
            net_payment=net_payment,
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

            # §5: Validate DIRECT_GR allocation at service layer
            gr_mode = cl.get("gr_mode", "STOCK_GR")
            wo_id = cl.get("work_order_id")
            cc_id = cl.get("direct_cost_center_id")
            if gr_mode == "DIRECT_GR":
                if not wo_id and not cc_id:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"DIRECT_GR requires work_order_id or direct_cost_center_id (PR line {pr_line.line_number})",
                    )
                if wo_id and cc_id:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"DIRECT_GR: provide work_order_id OR direct_cost_center_id, not both (PR line {pr_line.line_number})",
                    )
            elif gr_mode == "STOCK_GR":
                # STOCK_GR must not have allocation fields
                wo_id = None
                cc_id = None

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
                gr_mode=gr_mode,
                work_order_id=wo_id,
                direct_cost_center_id=cc_id,
            )
            db.add(po_line)

        # Update PR status
        pr.status = PRStatus.PO_CREATED

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        raise
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
    delivery_note_number: str | None = None,
) -> PurchaseOrder:
    """
    Goods Receipt: receive items from PO.
    GOODS items → creates RECEIVE stock movements.
    SERVICE items → marks received (no stock movement).
    Wrapped in try/except to ensure rollback on failure (multi-step atomic).
    """
    try:
        po = await get_purchase_order(db, po_id, org_id=org_id)

        if po.status != POStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Can only receive goods for APPROVED purchase orders",
            )

        # Store delivery note number if provided
        if delivery_note_number:
            po.delivery_note_number = delivery_note_number

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
                # Check GR mode — STOCK_GR vs DIRECT_GR (§5)
                gr_mode = getattr(line, "gr_mode", None)
                if gr_mode and hasattr(gr_mode, "value"):
                    gr_mode = gr_mode.value
                gr_mode = gr_mode or "STOCK_GR"

                if gr_mode == "STOCK_GR":
                    # STOCK_GR → create RECEIVE stock movement (normal flow)
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
                        location_id=rl.get("location_id"),
                        batch_number=rl.get("batch_number"),
                    )
                else:
                    # DIRECT_GR → no stock movement, cost charges WO or CostCenter directly
                    # Log as reference on PO line (no inventory impact)
                    pass
            # SERVICE → no stock movement, just update received_qty

            line.received_qty += rl["received_qty"]
            line.received_by = received_by
            line.received_at = datetime.now(timezone.utc)

        # Check if all lines fully received
        all_received = all(l.received_qty >= l.quantity for l in po.lines)
        if all_received:
            po.status = POStatus.RECEIVED

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        raise

    # Phase 9: Notification — PO_RECEIVED when all lines received
    if all_received:
        try:
            from app.services.notification import notify_po_received, get_user_display_name
            _receiver_name = await get_user_display_name(db, received_by)
            # Notify PR creator (original requester)
            if po.pr_id:
                _pr = await get_purchase_requisition(db, po.pr_id, org_id=org_id)
                _target_user = _pr.created_by
            else:
                _target_user = po.created_by
            await notify_po_received(
                db, org_id=org_id, user_id=_target_user,
                po_number=po.po_number, po_id=po.id,
                link=f"/purchasing/po/{po.id}",
                actor_id=received_by, actor_name=_receiver_name,
            )
        except Exception:
            import logging
            logging.getLogger(__name__).warning("Notification failed for PO receive %s", po.po_number, exc_info=True)

    return await get_purchase_order(db, po_id, org_id=org_id)
