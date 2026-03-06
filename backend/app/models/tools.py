"""
SSS Corp ERP — Tools Models
Phase 2: Tool CRUD + ToolCheckout (check-in/out tracking)
+ ToolCheckoutSlip (multi-line tool checkout document)

Business Rules:
  BR#16 — Tools Recharge = Σ(Hours × Tool Rate baht/hr)
  BR#27 — Tool checked out to 1 person at a time
  BR#28 — Auto charge on check-in (not check-out)
"""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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
# ENUMS
# ============================================================

class ToolStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    CHECKED_OUT = "CHECKED_OUT"
    MAINTENANCE = "MAINTENANCE"
    RETIRED = "RETIRED"


class ToolCheckoutSlipStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    CHECKED_OUT = "CHECKED_OUT"        # Cut-off at issue: selected lines issued, rest skipped
    PARTIAL_RETURN = "PARTIAL_RETURN"
    RETURNED = "RETURNED"
    CANCELLED = "CANCELLED"


# ============================================================
# TOOL
# ============================================================

class Tool(Base, TimestampMixin, OrgMixin):
    __tablename__ = "tools"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    rate_per_hour: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    status: Mapped[ToolStatus] = mapped_column(
        Enum(ToolStatus, name="tool_status_enum"),
        nullable=False,
        default=ToolStatus.AVAILABLE,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        CheckConstraint("rate_per_hour >= 0", name="ck_tool_rate_positive"),
        Index("ix_tools_org_code", "org_id", "code", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Tool {self.code} {self.name} [{self.status.value}]>"


# ============================================================
# TOOL CHECKOUT  (BR#27, BR#28)
# ============================================================

class ToolCheckout(Base, TimestampMixin, OrgMixin):
    """
    Tracks tool check-out/check-in for a work order.
    charge_amount is calculated on check-in: hours × rate_per_hour.
    """
    __tablename__ = "tool_checkouts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tools.id", ondelete="RESTRICT"),
        nullable=False,
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        nullable=False,
    )
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    checkout_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    checkin_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    charge_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    checked_out_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    checked_in_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint("charge_amount >= 0", name="ck_checkout_charge_positive"),
        Index("ix_tool_checkouts_tool", "tool_id"),
        Index("ix_tool_checkouts_wo", "work_order_id"),
    )

    def __repr__(self) -> str:
        return f"<ToolCheckout tool={self.tool_id} emp={self.employee_id}>"


# ============================================================
# TOOL CHECKOUT SLIP (header + lines)
# Multi-line tool checkout document similar to StockWithdrawalSlip
# Flow: DRAFT → PENDING → CHECKED_OUT → PARTIAL_RETURN/RETURNED (+CANCELLED)
# ============================================================

class ToolCheckoutSlip(Base, TimestampMixin, OrgMixin):
    """
    Multi-line tool checkout document.
    1 slip = 1 WO, multiple tools per slip.
    When issued, creates individual ToolCheckout per line via existing checkout_tool().
    Per-line return via existing checkin_tool() with auto-charge (BR#28).
    """
    __tablename__ = "tool_checkout_slips"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slip_number: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )
    status: Mapped[ToolCheckoutSlipStatus] = mapped_column(
        Enum(ToolCheckoutSlipStatus, name="tool_checkout_slip_status_enum"),
        nullable=False,
        default=ToolCheckoutSlipStatus.DRAFT,
    )

    # 1 slip = 1 WO
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Tracking
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    issued_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    issued_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    lines: Mapped[list["ToolCheckoutSlipLine"]] = relationship(
        back_populates="slip", cascade="all, delete-orphan",
        order_by="ToolCheckoutSlipLine.line_number",
    )

    __table_args__ = (
        UniqueConstraint("org_id", "slip_number", name="uq_tcs_org_number"),
        Index("ix_tcs_org_status", "org_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<ToolCheckoutSlip {self.slip_number} ({self.status.value})>"


class ToolCheckoutSlipLine(Base, TimestampMixin):
    """Line item for ToolCheckoutSlip. No org_id (inherited from header)."""
    __tablename__ = "tool_checkout_slip_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tool_checkout_slips.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    tool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tools.id", ondelete="RESTRICT"),
        nullable=False,
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Link to ToolCheckout record (set on issue)
    checkout_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tool_checkouts.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Return tracking
    is_returned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    returned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    returned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Auto charge (hours x rate_per_hour, calculated on return via BR#28)
    charge_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    slip: Mapped["ToolCheckoutSlip"] = relationship(back_populates="lines")

    __table_args__ = (
        CheckConstraint("charge_amount >= 0", name="ck_tcs_line_charge_non_negative"),
        Index("ix_tcs_lines_slip_id", "slip_id"),
        Index("ix_tcs_lines_tool_id", "tool_id"),
    )

    def __repr__(self) -> str:
        return f"<TCSLine #{self.line_number} tool={self.tool_id} returned={self.is_returned}>"
