"""
SSS Corp ERP — Work Order Models
Phase 1: WorkOrder with status machine (DRAFT → OPEN → CLOSED)

Business Rules enforced:
  - wo_number auto-generated "WO-{YYYY}-{NNNN}", unique per org, immutable
  - Status flow: DRAFT → OPEN → CLOSED (no reverse)
  - CLOSED WO cannot be edited
  - Cannot delete WO with stock movements
  - Delete only DRAFT + owner only
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# ENUMS
# ============================================================

class WOStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    CLOSED = "CLOSED"


# Valid status transitions
VALID_TRANSITIONS: dict[WOStatus, list[WOStatus]] = {
    WOStatus.DRAFT: [WOStatus.OPEN],
    WOStatus.OPEN: [WOStatus.CLOSED],
    WOStatus.CLOSED: [],  # terminal state
}


# ============================================================
# WORK ORDER
# ============================================================

class WorkOrder(Base, TimestampMixin, OrgMixin):
    __tablename__ = "work_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    wo_number: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )
    status: Mapped[WOStatus] = mapped_column(
        Enum(WOStatus, name="wo_status_enum"),
        nullable=False,
        default=WOStatus.DRAFT,
    )
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_center_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Timestamps for status changes
    opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Who created this WO
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # Phase 4.2: Approval flow — requested approver for close
    requested_approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "wo_number", name="uq_wo_org_number"),
        Index("ix_work_orders_org_number", "org_id", "wo_number"),
        Index("ix_work_orders_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<WorkOrder {self.wo_number} [{self.status.value}]>"
