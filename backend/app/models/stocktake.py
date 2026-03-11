"""
SSS Corp ERP — Stock Take (Cycle Count) Models
Phase 11.14: Stock Take document with header + lines
"""

import enum
import uuid

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
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


class StockTakeStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class StockTake(Base, TimestampMixin, OrgMixin):
    __tablename__ = "stock_takes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    stocktake_number: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )
    status: Mapped[StockTakeStatus] = mapped_column(
        Enum(StockTakeStatus, name="stocktake_status_enum"),
        nullable=False,
        default=StockTakeStatus.DRAFT,
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    counted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    approved_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    posted_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    lines: Mapped[list["StockTakeLine"]] = relationship(
        back_populates="stocktake",
        cascade="all, delete-orphan",
        order_by="StockTakeLine.line_number",
    )

    __table_args__ = (
        UniqueConstraint("org_id", "stocktake_number", name="uq_st_org_number"),
        Index("ix_st_org_status", "org_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<StockTake {self.stocktake_number} ({self.status.value})>"


class StockTakeLine(Base, TimestampMixin):
    __tablename__ = "stock_take_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    stocktake_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stock_takes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    system_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    counted_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    unit_cost: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    movement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stock_movements.id", ondelete="SET NULL"),
        nullable=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    stocktake: Mapped["StockTake"] = relationship(back_populates="lines")

    __table_args__ = (
        CheckConstraint("system_qty >= 0", name="ck_st_line_system_qty_non_neg"),
    )
