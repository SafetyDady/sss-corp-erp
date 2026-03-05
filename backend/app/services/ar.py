"""
SSS Corp ERP — Customer Invoice Service
Phase C2: Accounts Receivable (AR)

Business Rules:
  BR#121 — Invoice must link to SO with status APPROVED
  BR#122 — Sum invoice total_amount <= SO total_amount
  BR#123 — 1 SO can have multiple invoices (partial/installment billing)
  BR#124 — Delete only DRAFT
  BR#125 — Edit only DRAFT/PENDING
  BR#126 — received_amount >= total_amount → auto PAID
  BR#127 — Overdue = APPROVED + due_date < today (computed)
  BR#128 — AR ไม่มี WHT — total_amount = receivable amount
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ar import CustomerInvoice, CustomerInvoicePayment, CustomerInvoiceStatus
from app.models.sales import SalesOrder, SOStatus
from app.models.user import User


# ============================================================
# Helpers
# ============================================================

async def _next_ar_invoice_number(db: AsyncSession, org_id: UUID) -> str:
    """Generate next sequential AR invoice number: INV-AR-{year}-{seq:04d}."""
    year = datetime.now(timezone.utc).year
    prefix = f"INV-AR-{year}-"
    result = await db.execute(
        select(func.count()).where(
            CustomerInvoice.org_id == org_id,
            CustomerInvoice.invoice_number.like(f"{prefix}%"),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


async def _get_so(db: AsyncSession, so_id: UUID, org_id: UUID) -> SalesOrder:
    """Fetch SO and validate org."""
    result = await db.execute(
        select(SalesOrder).where(
            SalesOrder.id == so_id,
            SalesOrder.org_id == org_id,
        )
    )
    so = result.scalars().first()
    if not so:
        raise HTTPException(status_code=404, detail="SO not found")
    return so


async def _get_invoice(db: AsyncSession, invoice_id: UUID, org_id: UUID) -> CustomerInvoice:
    """Fetch customer invoice and validate org + active."""
    result = await db.execute(
        select(CustomerInvoice).where(
            CustomerInvoice.id == invoice_id,
            CustomerInvoice.org_id == org_id,
            CustomerInvoice.is_active == True,
        )
    )
    inv = result.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Customer invoice not found")
    return inv


async def _get_total_invoiced(db: AsyncSession, so_id: UUID, org_id: UUID, exclude_id: UUID = None) -> Decimal:
    """Sum of total_amount for all active invoices on a SO (BR#122)."""
    q = select(func.coalesce(func.sum(CustomerInvoice.total_amount), 0)).where(
        CustomerInvoice.so_id == so_id,
        CustomerInvoice.org_id == org_id,
        CustomerInvoice.is_active == True,
        CustomerInvoice.status != CustomerInvoiceStatus.CANCELLED,
    )
    if exclude_id:
        q = q.where(CustomerInvoice.id != exclude_id)
    result = await db.execute(q)
    return Decimal(str(result.scalar() or 0))


# ============================================================
# CRUD
# ============================================================

async def create_ar_invoice(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
    data: dict,
) -> CustomerInvoice:
    """Create a new customer invoice linked to a SO. (BR#121, BR#122)"""
    so = await _get_so(db, data["so_id"], org_id)

    # BR#121: SO must be APPROVED
    if so.status != SOStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"SO status must be APPROVED, got {so.status.value}",
        )

    # BR#122: Check total invoiced doesn't exceed SO total
    existing_total = await _get_total_invoiced(db, so.id, org_id)
    new_total = Decimal(str(data.get("total_amount", 0)))
    so_total = Decimal(str(so.total_amount or 0))
    if existing_total + new_total > so_total:
        raise HTTPException(
            status_code=400,
            detail=f"Total invoiced ({existing_total + new_total}) exceeds SO total ({so_total})",
        )

    # Auto-generate invoice number if not provided
    invoice_number = data.get("invoice_number") or await _next_ar_invoice_number(db, org_id)

    inv = CustomerInvoice(
        org_id=org_id,
        invoice_number=invoice_number,
        so_id=so.id,
        customer_id=so.customer_id,
        invoice_date=data["invoice_date"],
        due_date=data["due_date"],
        subtotal_amount=data.get("subtotal_amount", 0),
        vat_rate=data.get("vat_rate", 0),
        vat_amount=data.get("vat_amount", 0),
        total_amount=data.get("total_amount", 0),
        note=data.get("note"),
        created_by=user_id,
        status=CustomerInvoiceStatus.DRAFT,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


async def get_ar_invoice(db: AsyncSession, invoice_id: UUID, org_id: UUID) -> CustomerInvoice:
    """Get single customer invoice with payments."""
    return await _get_invoice(db, invoice_id, org_id)


async def list_ar_invoices(
    db: AsyncSession,
    org_id: UUID,
    status: Optional[str] = None,
    customer_id: Optional[UUID] = None,
    search: Optional[str] = None,
    overdue: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[CustomerInvoice], int]:
    """List customer invoices with filters and pagination."""
    base = select(CustomerInvoice).where(
        CustomerInvoice.org_id == org_id,
        CustomerInvoice.is_active == True,
    )

    if status:
        base = base.where(CustomerInvoice.status == status)
    if customer_id:
        base = base.where(CustomerInvoice.customer_id == customer_id)
    if search:
        base = base.where(CustomerInvoice.invoice_number.ilike(f"%{search}%"))
    if overdue:
        base = base.where(
            CustomerInvoice.status == CustomerInvoiceStatus.APPROVED,
            CustomerInvoice.due_date < date.today(),
        )

    # Count
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Items
    items_q = base.order_by(CustomerInvoice.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(items_q)
    items = list(result.scalars().all())

    return items, total


async def update_ar_invoice(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
    data: dict,
) -> CustomerInvoice:
    """Update customer invoice. (BR#125: DRAFT/PENDING only)"""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status not in (CustomerInvoiceStatus.DRAFT, CustomerInvoiceStatus.PENDING):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit invoice in {inv.status.value} status",
        )

    # If total_amount changed, re-validate BR#122
    new_total = data.get("total_amount")
    if new_total is not None:
        existing_total = await _get_total_invoiced(db, inv.so_id, org_id, exclude_id=inv.id)
        so = await _get_so(db, inv.so_id, org_id)
        so_total = Decimal(str(so.total_amount or 0))
        if existing_total + Decimal(str(new_total)) > so_total:
            raise HTTPException(
                status_code=400,
                detail=f"Total invoiced exceeds SO total ({so_total})",
            )

    for key, value in data.items():
        if value is not None and hasattr(inv, key):
            setattr(inv, key, value)

    await db.commit()
    await db.refresh(inv)
    return inv


async def delete_ar_invoice(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
) -> None:
    """Soft-delete customer invoice. (BR#124: DRAFT only)"""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status != CustomerInvoiceStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail="Can only delete DRAFT invoices",
        )

    inv.is_active = False
    await db.commit()


# ============================================================
# Status transitions
# ============================================================

async def submit_ar_invoice(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
) -> CustomerInvoice:
    """DRAFT → PENDING"""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status != CustomerInvoiceStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit invoice in {inv.status.value} status",
        )

    inv.status = CustomerInvoiceStatus.PENDING
    await db.commit()
    await db.refresh(inv)
    return inv


async def approve_ar_invoice(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
    user_id: UUID,
    action: str,
    reason: Optional[str] = None,
) -> CustomerInvoice:
    """PENDING → APPROVED or PENDING → DRAFT (reject)"""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status != CustomerInvoiceStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve invoice in {inv.status.value} status",
        )

    if action == "approve":
        inv.status = CustomerInvoiceStatus.APPROVED
        inv.approved_by = user_id
        inv.approved_at = datetime.now(timezone.utc)
    elif action == "reject":
        inv.status = CustomerInvoiceStatus.DRAFT
        inv.approved_by = None
        inv.approved_at = None
        if reason:
            inv.note = f"[Rejected] {reason}" + (f"\n{inv.note}" if inv.note else "")
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    await db.commit()
    await db.refresh(inv)
    return inv


async def cancel_ar_invoice(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
) -> CustomerInvoice:
    """DRAFT/PENDING → CANCELLED"""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status not in (CustomerInvoiceStatus.DRAFT, CustomerInvoiceStatus.PENDING):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel invoice in {inv.status.value} status",
        )

    inv.status = CustomerInvoiceStatus.CANCELLED
    await db.commit()
    await db.refresh(inv)
    return inv


# ============================================================
# Payment  (BR#126)
# ============================================================

async def receive_payment(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
    user_id: UUID,
    data: dict,
) -> CustomerInvoice:
    """Record a payment received against a customer invoice."""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status != CustomerInvoiceStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot record payment for invoice in {inv.status.value} status",
        )

    amount = Decimal(str(data["amount"]))
    remaining = Decimal(str(inv.total_amount)) - Decimal(str(inv.received_amount))

    # Payment amount should not exceed remaining
    if amount > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Payment ({amount}) exceeds remaining ({remaining})",
        )

    # Create payment record
    payment = CustomerInvoicePayment(
        org_id=org_id,
        invoice_id=inv.id,
        payment_date=data["payment_date"],
        amount=amount,
        payment_method=data.get("payment_method"),
        reference=data.get("reference"),
        note=data.get("note"),
        received_by=user_id,
    )
    db.add(payment)

    # Update received_amount on invoice
    inv.received_amount = Decimal(str(inv.received_amount)) + amount

    # BR#126: Auto PAID when fully received
    if Decimal(str(inv.received_amount)) >= Decimal(str(inv.total_amount)):
        inv.status = CustomerInvoiceStatus.PAID

    await db.commit()
    await db.refresh(inv)
    return inv


# ============================================================
# AR Summary  (BR#127)
# ============================================================

async def get_ar_summary(db: AsyncSession, org_id: UUID) -> dict:
    """Aggregate AR stats for dashboard."""
    base = select(CustomerInvoice).where(
        CustomerInvoice.org_id == org_id,
        CustomerInvoice.is_active == True,
        CustomerInvoice.status != CustomerInvoiceStatus.CANCELLED,
    )

    # Total invoices
    total_q = select(func.count()).select_from(base.subquery())
    total_invoices = (await db.execute(total_q)).scalar() or 0

    # Total receivable (total_amount of non-PAID, non-CANCELLED)
    receivable_q = select(func.coalesce(func.sum(CustomerInvoice.total_amount), 0)).where(
        CustomerInvoice.org_id == org_id,
        CustomerInvoice.is_active == True,
        CustomerInvoice.status.in_([
            CustomerInvoiceStatus.DRAFT, CustomerInvoiceStatus.PENDING, CustomerInvoiceStatus.APPROVED,
        ]),
    )
    total_receivable = (await db.execute(receivable_q)).scalar() or 0

    # Total received
    received_q = select(func.coalesce(func.sum(CustomerInvoice.received_amount), 0)).where(
        CustomerInvoice.org_id == org_id,
        CustomerInvoice.is_active == True,
        CustomerInvoice.status != CustomerInvoiceStatus.CANCELLED,
    )
    total_received = (await db.execute(received_q)).scalar() or 0

    # Overdue count (BR#127)
    overdue_q = select(func.count()).where(
        CustomerInvoice.org_id == org_id,
        CustomerInvoice.is_active == True,
        CustomerInvoice.status == CustomerInvoiceStatus.APPROVED,
        CustomerInvoice.due_date < date.today(),
    )
    total_overdue = (await db.execute(overdue_q)).scalar() or 0

    # Pending approval
    pending_q = select(func.count()).where(
        CustomerInvoice.org_id == org_id,
        CustomerInvoice.is_active == True,
        CustomerInvoice.status == CustomerInvoiceStatus.PENDING,
    )
    total_pending = (await db.execute(pending_q)).scalar() or 0

    return {
        "total_invoices": total_invoices,
        "total_receivable": total_receivable,
        "total_received": total_received,
        "total_overdue": total_overdue,
        "total_pending_approval": total_pending,
    }


# ============================================================
# Enrichment  (add names from related tables)
# ============================================================

async def enrich_ar_invoices(
    db: AsyncSession,
    invoices: list[CustomerInvoice],
) -> list[dict]:
    """Enrich invoice list with related names."""
    if not invoices:
        return []

    # Collect all IDs
    user_ids = set()
    for inv in invoices:
        user_ids.add(inv.created_by)
        if inv.approved_by:
            user_ids.add(inv.approved_by)

    # Fetch users
    user_map = {}
    if user_ids:
        result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(user_ids))
        )
        user_map = {row.id: row.full_name for row in result.all()}

    today = date.today()
    enriched = []
    for inv in invoices:
        d = {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "so_id": inv.so_id,
            "so_number": inv.sales_order.so_number if inv.sales_order else None,
            "customer_id": inv.customer_id,
            "customer_name": inv.customer.name if inv.customer else None,
            "customer_code": inv.customer.code if inv.customer else None,
            "invoice_date": inv.invoice_date,
            "due_date": inv.due_date,
            "subtotal_amount": inv.subtotal_amount,
            "vat_rate": inv.vat_rate,
            "vat_amount": inv.vat_amount,
            "total_amount": inv.total_amount,
            "received_amount": inv.received_amount,
            "remaining_amount": Decimal(str(inv.total_amount)) - Decimal(str(inv.received_amount)),
            "status": inv.status.value if hasattr(inv.status, "value") else inv.status,
            "is_overdue": (
                inv.status == CustomerInvoiceStatus.APPROVED
                and inv.due_date is not None
                and inv.due_date < today
            ),
            "note": inv.note,
            "created_by": inv.created_by,
            "creator_name": user_map.get(inv.created_by),
            "approved_by": inv.approved_by,
            "approver_name": user_map.get(inv.approved_by) if inv.approved_by else None,
            "approved_at": inv.approved_at,
            "is_active": inv.is_active,
            "org_id": inv.org_id,
            "created_at": inv.created_at,
            "updated_at": inv.updated_at,
            "payments": None,  # populated separately for detail view
        }
        enriched.append(d)

    return enriched


async def enrich_ar_invoice_detail(
    db: AsyncSession,
    inv: CustomerInvoice,
) -> dict:
    """Enrich single customer invoice with payments + names."""
    enriched_list = await enrich_ar_invoices(db, [inv])
    d = enriched_list[0]

    # Enrich payments
    if inv.payments:
        pay_user_ids = {p.received_by for p in inv.payments}
        result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(pay_user_ids))
        )
        pay_user_map = {row.id: row.full_name for row in result.all()}

        d["payments"] = [
            {
                "id": p.id,
                "invoice_id": p.invoice_id,
                "payment_date": p.payment_date,
                "amount": p.amount,
                "payment_method": p.payment_method,
                "reference": p.reference,
                "note": p.note,
                "received_by": p.received_by,
                "received_by_name": pay_user_map.get(p.received_by),
                "org_id": p.org_id,
                "created_at": p.created_at,
            }
            for p in inv.payments
        ]
    else:
        d["payments"] = []

    return d
