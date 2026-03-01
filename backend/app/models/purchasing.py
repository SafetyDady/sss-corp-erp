"""
SSS Corp ERP — Purchasing Models
PR/PO Redesign: PurchaseRequisition + PurchaseOrder + Lines

Flow:
  Staff creates PR (ใบขอซื้อ) → Submit → Approve → Convert to PO → Goods Receipt
  PR is mandatory before PO (1:1 mapping)
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# ENUMS — Purchase Requisition
# ============================================================

class PRStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    PO_CREATED = "PO_CREATED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class PRPriority(str, enum.Enum):
    NORMAL = "NORMAL"
    URGENT = "URGENT"


class PRItemType(str, enum.Enum):
    GOODS = "GOODS"
    SERVICE = "SERVICE"


class PRType(str, enum.Enum):
    STANDARD = "STANDARD"       # Normal purchase requisition
    BLANKET = "BLANKET"         # Long-term contract (has validity period)


# ============================================================
# ENUMS — Purchase Order (existing)
# ============================================================

class POStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


# ============================================================
# PURCHASE REQUISITION (PR)
# ============================================================

class PurchaseRequisition(Base, TimestampMixin, OrgMixin):
    __tablename__ = "purchase_requisitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    pr_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    pr_type: Mapped[PRType] = mapped_column(
        Enum(PRType, name="pr_type_enum"),
        nullable=False,
        default=PRType.STANDARD,
    )
    cost_center_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
    )
    requester_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[PRStatus] = mapped_column(
        Enum(PRStatus, name="pr_status_enum"),
        nullable=False,
        default=PRStatus.DRAFT,
    )
    priority: Mapped[PRPriority] = mapped_column(
        Enum(PRPriority, name="pr_priority_enum"),
        nullable=False,
        default=PRPriority.NORMAL,
    )
    required_date: Mapped[date] = mapped_column(Date, nullable=False)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Blanket PR only
    validity_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    validity_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Approval flow (Phase 4.2 pattern)
    requested_approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    lines: Mapped[list["PurchaseRequisitionLine"]] = relationship(
        back_populates="purchase_requisition", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("org_id", "pr_number", name="uq_pr_org_number"),
        Index("ix_pr_org_status", "org_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<PR {self.pr_number} [{self.status.value}]>"


class PurchaseRequisitionLine(Base, TimestampMixin):
    __tablename__ = "purchase_requisition_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    pr_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_requisitions.id", ondelete="CASCADE"),
        nullable=False,
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    item_type: Mapped[PRItemType] = mapped_column(
        Enum(PRItemType, name="pr_item_type_enum"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="PCS")
    estimated_unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    cost_element_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_elements.id", ondelete="RESTRICT"),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    purchase_requisition: Mapped["PurchaseRequisition"] = relationship(back_populates="lines")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_pr_line_qty_positive"),
        CheckConstraint("estimated_unit_cost >= 0", name="ck_pr_line_cost_positive"),
        Index("ix_pr_lines_pr_id", "pr_id"),
    )

    def __repr__(self) -> str:
        return f"<PRLine pr={self.pr_id} type={self.item_type.value} qty={self.quantity}>"


# ============================================================
# PURCHASE ORDER (PO) — Modified with PR link
# ============================================================

class PurchaseOrder(Base, TimestampMixin, OrgMixin):
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    po_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # PR link (1:1)
    pr_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_requisitions.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[POStatus] = mapped_column(
        Enum(POStatus, name="po_status_enum"),
        nullable=False,
        default=POStatus.DRAFT,
    )
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    # Cost tracking (inherited from PR)
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="SET NULL"),
        nullable=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_note_number: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Phase 4.2: Approval flow — requested approver
    requested_approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    lines: Mapped[list["PurchaseOrderLine"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan"
    )
    purchase_requisition: Mapped["PurchaseRequisition | None"] = relationship(
        foreign_keys=[pr_id], lazy="joined"
    )

    __table_args__ = (
        UniqueConstraint("org_id", "po_number", name="uq_po_org_number"),
        CheckConstraint("total_amount >= 0", name="ck_po_total_positive"),
    )

    def __repr__(self) -> str:
        return f"<PO {self.po_number} [{self.status.value}]>"


class PurchaseOrderLine(Base, TimestampMixin):
    __tablename__ = "purchase_order_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    po_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    # PR line link
    pr_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_requisition_lines.id", ondelete="SET NULL"),
        nullable=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=True,
    )
    item_type: Mapped[PRItemType] = mapped_column(
        Enum(PRItemType, name="pr_item_type_enum", create_type=False),
        nullable=False,
        default=PRItemType.GOODS,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="PCS")
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    cost_element_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_elements.id", ondelete="SET NULL"),
        nullable=True,
    )
    received_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    received_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="lines")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_po_line_qty_positive"),
        CheckConstraint("unit_cost >= 0", name="ck_po_line_cost_positive"),
        CheckConstraint("received_qty >= 0", name="ck_po_line_received_positive"),
        Index("ix_po_lines_po_id", "po_id"),
    )

    def __repr__(self) -> str:
        return f"<POLine po={self.po_id} type={self.item_type.value} qty={self.quantity}>"
