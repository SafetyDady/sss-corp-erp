"""
SSS Corp ERP — Supplier Invoice Service
Phase C1: Accounts Payable (AP)

Business Rules:
  BR#113 — Invoice must link to PO with status RECEIVED
  BR#114 — Sum invoice net_payment <= PO net_payment
  BR#115 — 1 PO can have multiple invoices (partial billing)
  BR#116 — Delete only DRAFT
  BR#117 — Edit only DRAFT/PENDING
  BR#118 — WHT deducted at payment recording time
  BR#119 — paid_amount >= net_payment → auto PAID
  BR#120 — Overdue = APPROVED + due_date < today (computed)
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import SupplierInvoice, InvoicePayment, InvoiceStatus
from app.models.purchasing import PurchaseOrder, POStatus
from app.models.master import CostCenter
from app.models.user import User


# ============================================================
# Helpers
# ============================================================

async def _get_po(db: AsyncSession, po_id: UUID, org_id: UUID) -> PurchaseOrder:
    """Fetch PO and validate org + status."""
    result = await db.execute(
        select(PurchaseOrder).where(
            PurchaseOrder.id == po_id,
            PurchaseOrder.org_id == org_id,
        )
    )
    po = result.scalars().first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    return po


async def _get_invoice(db: AsyncSession, invoice_id: UUID, org_id: UUID) -> SupplierInvoice:
    """Fetch invoice and validate org + active."""
    result = await db.execute(
        select(SupplierInvoice).where(
            SupplierInvoice.id == invoice_id,
            SupplierInvoice.org_id == org_id,
            SupplierInvoice.is_active == True,
        )
    )
    inv = result.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


async def _get_total_invoiced(db: AsyncSession, po_id: UUID, org_id: UUID, exclude_id: UUID = None) -> Decimal:
    """Sum of net_payment for all active invoices on a PO (BR#114)."""
    q = select(func.coalesce(func.sum(SupplierInvoice.net_payment), 0)).where(
        SupplierInvoice.po_id == po_id,
        SupplierInvoice.org_id == org_id,
        SupplierInvoice.is_active == True,
        SupplierInvoice.status != InvoiceStatus.CANCELLED,
    )
    if exclude_id:
        q = q.where(SupplierInvoice.id != exclude_id)
    result = await db.execute(q)
    return Decimal(str(result.scalar() or 0))


# ============================================================
# CRUD
# ============================================================

async def create_invoice(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
    data: dict,
) -> SupplierInvoice:
    """Create a new supplier invoice linked to a PO. (BR#113, BR#114)"""
    po = await _get_po(db, data["po_id"], org_id)

    # BR#113: PO must be RECEIVED
    if po.status != POStatus.RECEIVED:
        raise HTTPException(
            status_code=400,
            detail=f"PO status must be RECEIVED, got {po.status.value}",
        )

    # BR#114: Check total invoiced doesn't exceed PO
    existing_total = await _get_total_invoiced(db, po.id, org_id)
    new_net = Decimal(str(data.get("net_payment", 0)))
    po_net = Decimal(str(po.net_payment or po.total_amount or 0))
    if existing_total + new_net > po_net:
        raise HTTPException(
            status_code=400,
            detail=f"Total invoiced ({existing_total + new_net}) exceeds PO net payment ({po_net})",
        )

    inv = SupplierInvoice(
        org_id=org_id,
        invoice_number=data["invoice_number"],
        po_id=po.id,
        supplier_id=po.supplier_id,
        invoice_date=data["invoice_date"],
        due_date=data["due_date"],
        subtotal_amount=data.get("subtotal_amount", 0),
        vat_rate=data.get("vat_rate", 0),
        vat_amount=data.get("vat_amount", 0),
        total_amount=data.get("total_amount", 0),
        wht_rate=data.get("wht_rate", 0),
        wht_amount=data.get("wht_amount", 0),
        net_payment=data.get("net_payment", 0),
        cost_center_id=data.get("cost_center_id") or po.cost_center_id,
        note=data.get("note"),
        created_by=user_id,
        status=InvoiceStatus.DRAFT,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


async def get_invoice(db: AsyncSession, invoice_id: UUID, org_id: UUID) -> SupplierInvoice:
    """Get single invoice with payments."""
    return await _get_invoice(db, invoice_id, org_id)


async def list_invoices(
    db: AsyncSession,
    org_id: UUID,
    status: Optional[str] = None,
    supplier_id: Optional[UUID] = None,
    search: Optional[str] = None,
    overdue: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[SupplierInvoice], int]:
    """List invoices with filters and pagination."""
    base = select(SupplierInvoice).where(
        SupplierInvoice.org_id == org_id,
        SupplierInvoice.is_active == True,
    )

    if status:
        base = base.where(SupplierInvoice.status == status)
    if supplier_id:
        base = base.where(SupplierInvoice.supplier_id == supplier_id)
    if search:
        base = base.where(SupplierInvoice.invoice_number.ilike(f"%{search}%"))
    if overdue:
        base = base.where(
            SupplierInvoice.status == InvoiceStatus.APPROVED,
            SupplierInvoice.due_date < date.today(),
        )

    # Count
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Items
    items_q = base.order_by(SupplierInvoice.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(items_q)
    items = list(result.scalars().all())

    return items, total


async def update_invoice(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
    data: dict,
) -> SupplierInvoice:
    """Update invoice. (BR#117: DRAFT/PENDING only)"""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status not in (InvoiceStatus.DRAFT, InvoiceStatus.PENDING):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit invoice in {inv.status.value} status",
        )

    # If net_payment changed, re-validate BR#114
    new_net = data.get("net_payment")
    if new_net is not None:
        existing_total = await _get_total_invoiced(db, inv.po_id, org_id, exclude_id=inv.id)
        po = await _get_po(db, inv.po_id, org_id)
        po_net = Decimal(str(po.net_payment or po.total_amount or 0))
        if existing_total + Decimal(str(new_net)) > po_net:
            raise HTTPException(
                status_code=400,
                detail=f"Total invoiced exceeds PO net payment ({po_net})",
            )

    for key, value in data.items():
        if value is not None and hasattr(inv, key):
            setattr(inv, key, value)

    await db.commit()
    await db.refresh(inv)
    return inv


async def delete_invoice(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
) -> None:
    """Soft-delete invoice. (BR#116: DRAFT only)"""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status != InvoiceStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail="Can only delete DRAFT invoices",
        )

    inv.is_active = False
    await db.commit()


# ============================================================
# Status transitions
# ============================================================

async def submit_invoice(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
) -> SupplierInvoice:
    """DRAFT → PENDING"""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status != InvoiceStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit invoice in {inv.status.value} status",
        )

    inv.status = InvoiceStatus.PENDING
    await db.commit()
    await db.refresh(inv)
    return inv


async def approve_invoice(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
    user_id: UUID,
    action: str,
    reason: Optional[str] = None,
) -> SupplierInvoice:
    """PENDING → APPROVED or PENDING → DRAFT (reject)"""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status != InvoiceStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve invoice in {inv.status.value} status",
        )

    if action == "approve":
        inv.status = InvoiceStatus.APPROVED
        inv.approved_by = user_id
        inv.approved_at = datetime.now(timezone.utc)
    elif action == "reject":
        inv.status = InvoiceStatus.DRAFT
        inv.approved_by = None
        inv.approved_at = None
        if reason:
            inv.note = f"[Rejected] {reason}" + (f"\n{inv.note}" if inv.note else "")
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    await db.commit()
    await db.refresh(inv)
    return inv


async def cancel_invoice(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
) -> SupplierInvoice:
    """DRAFT/PENDING → CANCELLED"""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status not in (InvoiceStatus.DRAFT, InvoiceStatus.PENDING):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel invoice in {inv.status.value} status",
        )

    inv.status = InvoiceStatus.CANCELLED
    await db.commit()
    await db.refresh(inv)
    return inv


# ============================================================
# Payment  (BR#118, BR#119)
# ============================================================

async def record_payment(
    db: AsyncSession,
    invoice_id: UUID,
    org_id: UUID,
    user_id: UUID,
    data: dict,
) -> SupplierInvoice:
    """Record a payment against an invoice."""
    inv = await _get_invoice(db, invoice_id, org_id)

    if inv.status != InvoiceStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot record payment for invoice in {inv.status.value} status",
        )

    amount = Decimal(str(data["amount"]))
    wht_deducted = Decimal(str(data.get("wht_deducted", 0)))
    remaining = Decimal(str(inv.net_payment)) - Decimal(str(inv.paid_amount))

    # Payment amount + wht should not exceed remaining
    if amount + wht_deducted > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Payment ({amount} + WHT {wht_deducted}) exceeds remaining ({remaining})",
        )

    # Create payment record
    payment = InvoicePayment(
        org_id=org_id,
        invoice_id=inv.id,
        payment_date=data["payment_date"],
        amount=amount,
        wht_deducted=wht_deducted,
        payment_method=data.get("payment_method"),
        reference=data.get("reference"),
        note=data.get("note"),
        paid_by=user_id,
    )
    db.add(payment)

    # Update paid_amount on invoice (amount + wht = total settled)
    inv.paid_amount = Decimal(str(inv.paid_amount)) + amount + wht_deducted

    # BR#119: Auto PAID when fully settled
    if Decimal(str(inv.paid_amount)) >= Decimal(str(inv.net_payment)):
        inv.status = InvoiceStatus.PAID

    await db.commit()
    await db.refresh(inv)
    return inv


# ============================================================
# AP Summary  (BR#120)
# ============================================================

async def get_ap_summary(db: AsyncSession, org_id: UUID) -> dict:
    """Aggregate AP stats for dashboard."""
    base = select(SupplierInvoice).where(
        SupplierInvoice.org_id == org_id,
        SupplierInvoice.is_active == True,
        SupplierInvoice.status != InvoiceStatus.CANCELLED,
    )

    # Total invoices
    total_q = select(func.count()).select_from(base.subquery())
    total_invoices = (await db.execute(total_q)).scalar() or 0

    # Total payable (net_payment of non-PAID, non-CANCELLED)
    payable_q = select(func.coalesce(func.sum(SupplierInvoice.net_payment), 0)).where(
        SupplierInvoice.org_id == org_id,
        SupplierInvoice.is_active == True,
        SupplierInvoice.status.in_([
            InvoiceStatus.DRAFT, InvoiceStatus.PENDING, InvoiceStatus.APPROVED,
        ]),
    )
    total_payable = (await db.execute(payable_q)).scalar() or 0

    # Total paid
    paid_q = select(func.coalesce(func.sum(SupplierInvoice.paid_amount), 0)).where(
        SupplierInvoice.org_id == org_id,
        SupplierInvoice.is_active == True,
        SupplierInvoice.status != InvoiceStatus.CANCELLED,
    )
    total_paid = (await db.execute(paid_q)).scalar() or 0

    # Overdue count (BR#120)
    overdue_q = select(func.count()).where(
        SupplierInvoice.org_id == org_id,
        SupplierInvoice.is_active == True,
        SupplierInvoice.status == InvoiceStatus.APPROVED,
        SupplierInvoice.due_date < date.today(),
    )
    total_overdue = (await db.execute(overdue_q)).scalar() or 0

    # Pending approval
    pending_q = select(func.count()).where(
        SupplierInvoice.org_id == org_id,
        SupplierInvoice.is_active == True,
        SupplierInvoice.status == InvoiceStatus.PENDING,
    )
    total_pending = (await db.execute(pending_q)).scalar() or 0

    return {
        "total_invoices": total_invoices,
        "total_payable": total_payable,
        "total_paid": total_paid,
        "total_overdue": total_overdue,
        "total_pending_approval": total_pending,
    }


# ============================================================
# Enrichment  (add names from related tables)
# ============================================================

async def enrich_invoices(
    db: AsyncSession,
    invoices: list[SupplierInvoice],
) -> list[dict]:
    """Enrich invoice list with related names."""
    if not invoices:
        return []

    # Collect all IDs
    user_ids = set()
    cc_ids = set()
    for inv in invoices:
        user_ids.add(inv.created_by)
        if inv.approved_by:
            user_ids.add(inv.approved_by)
        if inv.cost_center_id:
            cc_ids.add(inv.cost_center_id)

    # Fetch users
    user_map = {}
    if user_ids:
        result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(user_ids))
        )
        user_map = {row.id: row.full_name for row in result.all()}

    # Fetch cost centers
    cc_map = {}
    if cc_ids:
        result = await db.execute(
            select(CostCenter.id, CostCenter.name).where(CostCenter.id.in_(cc_ids))
        )
        cc_map = {row.id: row.name for row in result.all()}

    today = date.today()
    enriched = []
    for inv in invoices:
        d = {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "po_id": inv.po_id,
            "po_number": inv.purchase_order.po_number if inv.purchase_order else None,
            "supplier_id": inv.supplier_id,
            "supplier_name": inv.supplier.name if inv.supplier else None,
            "supplier_code": inv.supplier.code if inv.supplier else None,
            "invoice_date": inv.invoice_date,
            "due_date": inv.due_date,
            "subtotal_amount": inv.subtotal_amount,
            "vat_rate": inv.vat_rate,
            "vat_amount": inv.vat_amount,
            "total_amount": inv.total_amount,
            "wht_rate": inv.wht_rate,
            "wht_amount": inv.wht_amount,
            "net_payment": inv.net_payment,
            "paid_amount": inv.paid_amount,
            "remaining_amount": Decimal(str(inv.net_payment)) - Decimal(str(inv.paid_amount)),
            "status": inv.status.value if hasattr(inv.status, "value") else inv.status,
            "is_overdue": (
                inv.status == InvoiceStatus.APPROVED
                and inv.due_date is not None
                and inv.due_date < today
            ),
            "cost_center_id": inv.cost_center_id,
            "cost_center_name": cc_map.get(inv.cost_center_id),
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


async def enrich_invoice_detail(
    db: AsyncSession,
    inv: SupplierInvoice,
) -> dict:
    """Enrich single invoice with payments + names."""
    enriched_list = await enrich_invoices(db, [inv])
    d = enriched_list[0]

    # Enrich payments
    if inv.payments:
        pay_user_ids = {p.paid_by for p in inv.payments}
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
                "wht_deducted": p.wht_deducted,
                "payment_method": p.payment_method,
                "reference": p.reference,
                "note": p.note,
                "paid_by": p.paid_by,
                "paid_by_name": pay_user_map.get(p.paid_by),
                "org_id": p.org_id,
                "created_at": p.created_at,
            }
            for p in inv.payments
        ]
    else:
        d["payments"] = []

    return d
