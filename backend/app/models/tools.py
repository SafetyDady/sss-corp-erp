"""
SSS Corp ERP — Tools Models
Phase 2: Tool CRUD + ToolCheckout (check-in/out tracking)

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
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

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
