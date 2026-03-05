"""
SSS Corp ERP — Sales Models
Phase 3: SalesOrder + SalesOrderLine
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


class SOStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    INVOICED = "INVOICED"
    CANCELLED = "CANCELLED"


class SalesOrder(Base, TimestampMixin, OrgMixin):
    __tablename__ = "sales_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    so_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[SOStatus] = mapped_column(
        Enum(SOStatus, name="so_status_enum"),
        nullable=False,
        default=SOStatus.DRAFT,
    )
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    # --- Amount fields (C5 Tax) ---
    subtotal_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0.00")
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Phase 4.2: Approval flow — requested approver
    requested_approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    lines: Mapped[list["SalesOrderLine"]] = relationship(
        back_populates="sales_order", cascade="all, delete-orphan"
    )
    customer: Mapped["Customer"] = relationship(
        foreign_keys=[customer_id], lazy="joined"
    )

    __table_args__ = (
        UniqueConstraint("org_id", "so_number", name="uq_so_org_number"),
        CheckConstraint("total_amount >= 0", name="ck_so_total_positive"),
        CheckConstraint("subtotal_amount >= 0", name="ck_so_subtotal_positive"),
        CheckConstraint("vat_amount >= 0", name="ck_so_vat_amount_positive"),
        CheckConstraint("vat_rate >= 0 AND vat_rate <= 100", name="ck_so_vat_rate_range"),
    )

    def __repr__(self) -> str:
        return f"<SO {self.so_number} [{self.status.value}]>"


class SalesOrderLine(Base, TimestampMixin):
    __tablename__ = "sales_order_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    so_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )

    sales_order: Mapped["SalesOrder"] = relationship(back_populates="lines")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_so_line_qty_positive"),
        CheckConstraint("unit_price >= 0", name="ck_so_line_price_positive"),
        Index("ix_so_lines_so_id", "so_id"),
    )

    def __repr__(self) -> str:
        return f"<SOLine so={self.so_id} product={self.product_id} qty={self.quantity}>"
