"""
SSS Corp ERP — Supplier Invoice & Payment Models
Phase C1: Accounts Payable (AP) — Invoice from PO + Payment recording

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

import enum
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# Enums
# ============================================================

class InvoiceStatus(str, enum.Enum):
    """Invoice lifecycle: DRAFT → PENDING → APPROVED → PAID"""
    DRAFT = "DRAFT"
    PENDING = "PENDING"       # Submitted for approval
    APPROVED = "APPROVED"     # Approved, awaiting payment
    PAID = "PAID"             # Fully paid
    CANCELLED = "CANCELLED"


# ============================================================
# SUPPLIER INVOICE  (BR#113-117, BR#120)
# ============================================================

class SupplierInvoice(Base, TimestampMixin, OrgMixin):
    """
    Supplier invoice record linked to a Purchase Order.
    Created after GR (PO status=RECEIVED).
    Tracks amounts, approval, and payment status.
    """
    __tablename__ = "supplier_invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_number: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    po_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Dates
    invoice_date: Mapped[object] = mapped_column(Date, nullable=False)
    due_date: Mapped[object] = mapped_column(Date, nullable=False)

    # Amount fields — pre-filled from PO
    subtotal_amount: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    vat_rate: Mapped[object] = mapped_column(
        Numeric(5, 2), nullable=False, default=0
    )
    vat_amount: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    total_amount: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )

    # WHT — from PO (BR#118: actual deduction at payment time)
    wht_rate: Mapped[object] = mapped_column(
        Numeric(5, 2), nullable=False, default=0
    )
    wht_amount: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    net_payment: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )

    # Payment tracking (BR#119)
    paid_amount: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )

    # Status
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoice_status_enum"),
        nullable=False,
        default=InvoiceStatus.DRAFT,
    )

    # Cost allocation
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Notes
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Audit
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    approved_at: Mapped[object | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    # Relationships
    purchase_order = relationship("PurchaseOrder", lazy="joined")
    supplier = relationship("Supplier", lazy="joined")
    payments = relationship(
        "InvoicePayment",
        back_populates="invoice",
        lazy="selectin",
        order_by="InvoicePayment.payment_date",
    )

    __table_args__ = (
        CheckConstraint(
            "subtotal_amount >= 0",
            name="ck_invoice_subtotal_non_negative",
        ),
        CheckConstraint(
            "total_amount >= 0",
            name="ck_invoice_total_non_negative",
        ),
        CheckConstraint(
            "net_payment >= 0",
            name="ck_invoice_net_payment_non_negative",
        ),
        CheckConstraint(
            "paid_amount >= 0",
            name="ck_invoice_paid_non_negative",
        ),
        CheckConstraint(
            "wht_rate >= 0 AND wht_rate <= 100",
            name="ck_invoice_wht_rate_range",
        ),
        CheckConstraint(
            "vat_rate >= 0 AND vat_rate <= 100",
            name="ck_invoice_vat_rate_range",
        ),
        Index("ix_invoice_org_status", "org_id", "status"),
        Index("ix_invoice_po_id", "po_id"),
        Index("ix_invoice_supplier_id", "supplier_id"),
        Index("ix_invoice_due_date", "due_date"),
    )


# ============================================================
# INVOICE PAYMENT  (BR#118, BR#119)
# ============================================================

class InvoicePayment(Base, TimestampMixin, OrgMixin):
    """
    Individual payment record against a supplier invoice.
    WHT is deducted at this point (BR#118).
    When cumulative payments >= net_payment, invoice auto-marks PAID (BR#119).
    """
    __tablename__ = "invoice_payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("supplier_invoices.id", ondelete="RESTRICT"),
        nullable=False,
    )

    payment_date: Mapped[object] = mapped_column(Date, nullable=False)
    amount: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False  # Actual transfer amount
    )
    wht_deducted: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0  # WHT withheld this payment
    )
    payment_method: Mapped[str | None] = mapped_column(
        String(50), nullable=True  # TRANSFER, CHEQUE, CASH
    )
    reference: Mapped[str | None] = mapped_column(
        String(100), nullable=True  # Bank ref / cheque number
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    paid_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationship
    invoice = relationship("SupplierInvoice", back_populates="payments")

    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_payment_amount_positive",
        ),
        CheckConstraint(
            "wht_deducted >= 0",
            name="ck_payment_wht_non_negative",
        ),
        Index("ix_payment_invoice_id", "invoice_id"),
    )
