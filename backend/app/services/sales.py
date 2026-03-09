"""
SSS Corp ERP — Sales Service (Business Logic)
Phase 3 + SO Flow Upgrade: CRUD + submit + approve/reject + cancel + edit lines
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sales import SOStatus, SalesOrder, SalesOrderLine
from app.models.user import User
from app.services.organization import get_or_create_tax_config


async def _next_so_number(db: AsyncSession, org_id: UUID) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"SO-{year}-"
    result = await db.execute(
        select(func.count()).where(
            SalesOrder.org_id == org_id,
            SalesOrder.so_number.like(f"{prefix}%"),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


# ============================================================
# CRUD
# ============================================================

async def create_sales_order(
    db: AsyncSession,
    *,
    customer_id: UUID,
    order_date,
    note: Optional[str],
    lines: list[dict],
    created_by: UUID,
    org_id: UUID,
    requested_approver_id: Optional[UUID] = None,
    vat_rate: Optional[Decimal] = None,
) -> SalesOrder:
    so_number = await _next_so_number(db, org_id)

    # C5 Tax: calculate subtotal, VAT, and grand total
    subtotal = sum(Decimal(str(l["quantity"])) * l["unit_price"] for l in lines)

    # Resolve VAT rate: explicit → org default (if VAT enabled) → 0
    if vat_rate is None:
        tax_config = await get_or_create_tax_config(db, org_id)
        if tax_config.vat_enabled:
            vat_rate = tax_config.default_vat_rate
        else:
            vat_rate = Decimal("0.00")

    vat_amount = (subtotal * vat_rate / Decimal("100")).quantize(Decimal("0.01"))
    total = subtotal + vat_amount

    so = SalesOrder(
        so_number=so_number,
        customer_id=customer_id,
        order_date=order_date,
        note=note,
        subtotal_amount=subtotal,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        total_amount=total,
        created_by=created_by,
        org_id=org_id,
        requested_approver_id=requested_approver_id,
    )
    db.add(so)
    await db.flush()

    for l in lines:
        line = SalesOrderLine(
            so_id=so.id,
            product_id=l["product_id"],
            quantity=l["quantity"],
            unit_price=l["unit_price"],
        )
        db.add(line)

    await db.commit()
    return await get_sales_order(db, so.id)


async def get_sales_order(db: AsyncSession, so_id: UUID, *, org_id: Optional[UUID] = None) -> SalesOrder:
    query = (
        select(SalesOrder)
        .options(selectinload(SalesOrder.lines))
        .where(SalesOrder.id == so_id, SalesOrder.is_active == True)
    )
    if org_id:
        query = query.where(SalesOrder.org_id == org_id)
    result = await db.execute(query)
    so = result.scalar_one_or_none()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    return so


async def list_sales_orders(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    so_status: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[SalesOrder], int]:
    query = select(SalesOrder).where(SalesOrder.is_active == True)
    if org_id:
        query = query.where(SalesOrder.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(SalesOrder.so_number.ilike(pattern))
    if so_status:
        query = query.where(SalesOrder.status == so_status)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.options(selectinload(SalesOrder.lines))
        .order_by(SalesOrder.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    items = list(result.scalars().unique().all())
    return items, total


async def update_sales_order(
    db: AsyncSession,
    so_id: UUID,
    *,
    update_data: dict,
    org_id: Optional[UUID] = None,
) -> SalesOrder:
    so = await get_sales_order(db, so_id, org_id=org_id)

    if so.status not in (SOStatus.DRAFT, SOStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot edit SO in {so.status.value} status",
        )

    # Handle line replacement
    new_lines = update_data.pop("lines", None)

    # Update simple fields
    for field, value in update_data.items():
        if value is not None:
            setattr(so, field, value)

    # Replace lines if provided
    if new_lines is not None:
        if len(new_lines) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="SO must have at least one line",
            )

        # Delete old lines
        await db.execute(
            delete(SalesOrderLine).where(SalesOrderLine.so_id == so.id)
        )

        # Create new lines
        for l in new_lines:
            line_data = l if isinstance(l, dict) else l.model_dump()
            line = SalesOrderLine(
                so_id=so.id,
                product_id=line_data["product_id"],
                quantity=line_data["quantity"],
                unit_price=line_data["unit_price"],
            )
            db.add(line)

        # Recalc amounts
        subtotal = sum(
            Decimal(str(ld["quantity"] if isinstance(ld, dict) else ld.quantity))
            * (ld["unit_price"] if isinstance(ld, dict) else ld.unit_price)
            for ld in new_lines
        )
        vat_rate = update_data.get("vat_rate")
        if vat_rate is None:
            vat_rate = so.vat_rate
        vat_amount = (subtotal * Decimal(str(vat_rate)) / Decimal("100")).quantize(Decimal("0.01"))
        so.subtotal_amount = subtotal
        so.vat_rate = vat_rate
        so.vat_amount = vat_amount
        so.total_amount = subtotal + vat_amount
    elif "vat_rate" in update_data and update_data.get("vat_rate") is not None:
        # VAT rate changed without lines — recalc from existing subtotal
        vat_rate = Decimal(str(update_data["vat_rate"]))
        vat_amount = (so.subtotal_amount * vat_rate / Decimal("100")).quantize(Decimal("0.01"))
        so.vat_rate = vat_rate
        so.vat_amount = vat_amount
        so.total_amount = so.subtotal_amount + vat_amount

    await db.commit()
    return await get_sales_order(db, so_id)


async def delete_sales_order(db: AsyncSession, so_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    so = await get_sales_order(db, so_id, org_id=org_id)
    if so.status != SOStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Can only delete DRAFT sales orders",
        )
    so.is_active = False
    await db.commit()


# ============================================================
# Submit (DRAFT → SUBMITTED)
# ============================================================

async def submit_sales_order(
    db: AsyncSession,
    so_id: UUID,
    *,
    org_id: Optional[UUID] = None,
) -> SalesOrder:
    so = await get_sales_order(db, so_id, org_id=org_id)

    if so.status != SOStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot submit SO in {so.status.value} status (DRAFT required)",
        )

    if not so.lines or len(so.lines) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="SO must have at least one line to submit",
        )

    so.status = SOStatus.SUBMITTED
    # Clear rejected_reason when re-submitting
    so.rejected_reason = None
    await db.commit()

    # Phase 9: Notification — APPROVAL_REQUEST for SO approvers
    try:
        from app.services.notification import notify_approval_request, get_user_display_name
        _name = await get_user_display_name(db, so.created_by)
        await notify_approval_request(
            db, org_id=so.org_id, permission="sales.order.approve",
            entity_type="SO", entity_id=so.id, doc_number=so.so_number,
            doc_type_thai="ใบสั่งขาย", link=f"/sales/{so.id}",
            actor_id=so.created_by, actor_name=_name, exclude_user_id=so.created_by,
        )
    except Exception:
        import logging
        logging.getLogger(__name__).warning("Notification failed for SO submit %s", so.so_number, exc_info=True)

    return await get_sales_order(db, so_id)


# ============================================================
# Approve / Reject
# ============================================================

async def approve_sales_order(
    db: AsyncSession,
    so_id: UUID,
    *,
    approved_by: UUID,
    action: str = "approve",
    reason: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> SalesOrder:
    so = await get_sales_order(db, so_id, org_id=org_id)

    if so.status not in (SOStatus.DRAFT, SOStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot approve/reject SO in {so.status.value} status",
        )

    if action == "approve":
        so.status = SOStatus.APPROVED
        so.approved_by = approved_by
        so.approved_at = datetime.now(timezone.utc)
        so.rejected_reason = None
    elif action == "reject":
        if so.status != SOStatus.SUBMITTED:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Can only reject SUBMITTED sales orders",
            )
        so.status = SOStatus.DRAFT
        so.rejected_reason = reason
        so.approved_by = None
        so.approved_at = None
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="action must be 'approve' or 'reject'",
        )

    await db.commit()

    # Phase 9: Notification — APPROVED/REJECTED for SO creator
    try:
        from app.services.notification import notify_status_change, get_user_display_name
        from app.models.notification import NotificationType
        _approver_name = await get_user_display_name(db, approved_by)
        if action == "approve":
            await notify_status_change(
                db, org_id=so.org_id, user_id=so.created_by,
                notification_type=NotificationType.DOCUMENT_APPROVED,
                entity_type="SO", entity_id=so.id, doc_number=so.so_number,
                doc_type_thai="ใบสั่งขาย", link=f"/sales/{so.id}",
                actor_id=approved_by, actor_name=_approver_name,
            )
        elif action == "reject":
            await notify_status_change(
                db, org_id=so.org_id, user_id=so.created_by,
                notification_type=NotificationType.DOCUMENT_REJECTED,
                entity_type="SO", entity_id=so.id, doc_number=so.so_number,
                doc_type_thai="ใบสั่งขาย", link=f"/sales/{so.id}",
                actor_id=approved_by, actor_name=_approver_name, reason=reason,
            )
    except Exception:
        import logging
        logging.getLogger(__name__).warning("Notification failed for SO %s %s", action, so.so_number, exc_info=True)

    return await get_sales_order(db, so_id)


# ============================================================
# Cancel (DRAFT/SUBMITTED → CANCELLED)
# ============================================================

async def cancel_sales_order(
    db: AsyncSession,
    so_id: UUID,
    *,
    org_id: Optional[UUID] = None,
) -> SalesOrder:
    so = await get_sales_order(db, so_id, org_id=org_id)

    if so.status not in (SOStatus.DRAFT, SOStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot cancel SO in {so.status.value} status",
        )

    so.status = SOStatus.CANCELLED
    await db.commit()
    return await get_sales_order(db, so_id)


# ============================================================
# Enrichment  (add names from related tables)
# ============================================================

async def enrich_sales_orders(
    db: AsyncSession,
    orders: list[SalesOrder],
) -> list[dict]:
    """Enrich SO list with creator_name, approver_name, customer_name."""
    if not orders:
        return []

    # Collect user IDs
    user_ids = set()
    for so in orders:
        user_ids.add(so.created_by)
        if so.approved_by:
            user_ids.add(so.approved_by)

    # Fetch user names
    user_map = {}
    if user_ids:
        result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(user_ids))
        )
        user_map = {row.id: row.full_name for row in result.all()}

    enriched = []
    for so in orders:
        d = {
            "id": so.id,
            "so_number": so.so_number,
            "customer_id": so.customer_id,
            "customer_name": so.customer.name if so.customer else None,
            "customer_code": so.customer.code if so.customer else None,
            "status": so.status.value if hasattr(so.status, "value") else so.status,
            "order_date": so.order_date,
            "subtotal_amount": so.subtotal_amount,
            "vat_rate": so.vat_rate,
            "vat_amount": so.vat_amount,
            "total_amount": so.total_amount,
            "note": so.note,
            "created_by": so.created_by,
            "creator_name": user_map.get(so.created_by),
            "approved_by": so.approved_by,
            "approver_name": user_map.get(so.approved_by) if so.approved_by else None,
            "approved_at": so.approved_at,
            "rejected_reason": so.rejected_reason,
            "requested_approver_id": so.requested_approver_id,
            "is_active": so.is_active,
            "lines": [
                {
                    "id": line.id,
                    "so_id": line.so_id,
                    "product_id": line.product_id,
                    "quantity": line.quantity,
                    "unit_price": line.unit_price,
                    "created_at": line.created_at,
                    "updated_at": line.updated_at,
                }
                for line in (so.lines or [])
            ],
            "created_at": so.created_at,
            "updated_at": so.updated_at,
        }
        enriched.append(d)

    return enriched
