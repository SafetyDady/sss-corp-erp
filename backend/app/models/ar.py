"""
SSS Corp ERP — Customer Invoice & Payment Models
Phase C2: Accounts Receivable (AR) — Invoice from SO + Payment recording

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

class CustomerInvoiceStatus(str, enum.Enum):
    """Invoice lifecycle: DRAFT → PENDING → APPROVED → PAID"""
    DRAFT = "DRAFT"
    PENDING = "PENDING"       # Submitted for approval
    APPROVED = "APPROVED"     # Approved, awaiting payment
    PAID = "PAID"             # Fully received
    CANCELLED = "CANCELLED"


# ============================================================
# CUSTOMER INVOICE  (BR#121-125, BR#127)
# ============================================================

class CustomerInvoice(Base, TimestampMixin, OrgMixin):
    """
    Customer invoice record linked to a Sales Order.
    Created after SO approval (SO status=APPROVED).
    Tracks amounts, approval, and payment status.
    No WHT — total_amount is the receivable amount (BR#128).
    """
    __tablename__ = "customer_invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_number: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    so_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales_orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Dates
    invoice_date: Mapped[object] = mapped_column(Date, nullable=False)
    due_date: Mapped[object] = mapped_column(Date, nullable=False)

    # Amount fields — pre-filled from SO
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

    # Payment tracking (BR#126) — no WHT, total_amount = receivable
    received_amount: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )

    # Status
    status: Mapped[CustomerInvoiceStatus] = mapped_column(
        Enum(CustomerInvoiceStatus, name="customer_invoice_status_enum"),
        nullable=False,
        default=CustomerInvoiceStatus.DRAFT,
    )

    # Phase C3: Delivery Order link (optional — invoice from SO or DO)
    do_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("delivery_orders.id", ondelete="SET NULL"),
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
    sales_order = relationship("SalesOrder", lazy="joined")
    customer = relationship("Customer", lazy="joined")
    delivery_order = relationship("DeliveryOrder", lazy="joined")
    payments = relationship(
        "CustomerInvoicePayment",
        back_populates="invoice",
        lazy="selectin",
        order_by="CustomerInvoicePayment.payment_date",
    )

    __table_args__ = (
        CheckConstraint(
            "subtotal_amount >= 0",
            name="ck_ci_subtotal_non_negative",
        ),
        CheckConstraint(
            "total_amount >= 0",
            name="ck_ci_total_non_negative",
        ),
        CheckConstraint(
            "received_amount >= 0",
            name="ck_ci_received_non_negative",
        ),
        CheckConstraint(
            "vat_rate >= 0 AND vat_rate <= 100",
            name="ck_ci_vat_rate_range",
        ),
        Index("ix_ci_org_status", "org_id", "status"),
        Index("ix_ci_so_id", "so_id"),
        Index("ix_ci_customer_id", "customer_id"),
        Index("ix_ci_due_date", "due_date"),
    )


# ============================================================
# CUSTOMER INVOICE PAYMENT  (BR#126)
# ============================================================

class CustomerInvoicePayment(Base, TimestampMixin, OrgMixin):
    """
    Individual payment received against a customer invoice.
    No WHT deduction (BR#128).
    When cumulative payments >= total_amount, invoice auto-marks PAID (BR#126).
    """
    __tablename__ = "customer_invoice_payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customer_invoices.id", ondelete="RESTRICT"),
        nullable=False,
    )

    payment_date: Mapped[object] = mapped_column(Date, nullable=False)
    amount: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False  # Actual received amount
    )
    payment_method: Mapped[str | None] = mapped_column(
        String(50), nullable=True  # TRANSFER, CHEQUE, CASH
    )
    reference: Mapped[str | None] = mapped_column(
        String(100), nullable=True  # Bank ref / cheque number
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    received_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationship
    invoice = relationship("CustomerInvoice", back_populates="payments")

    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_ci_payment_amount_positive",
        ),
        Index("ix_ci_payment_invoice_id", "invoice_id"),
    )
