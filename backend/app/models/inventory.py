"""
SSS Corp ERP — Inventory Models
Phase 1: Product + StockMovement + StockBalance
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
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# ENUMS
# ============================================================

class ProductType(str, enum.Enum):
    MATERIAL = "MATERIAL"
    CONSUMABLE = "CONSUMABLE"
    SERVICE = "SERVICE"          # No stock tracking (on_hand=0 always)


class MovementType(str, enum.Enum):
    RECEIVE = "RECEIVE"
    ISSUE = "ISSUE"
    TRANSFER = "TRANSFER"
    ADJUST = "ADJUST"
    CONSUME = "CONSUME"       # WO consumption
    RETURN = "RETURN"         # Return unused material to stock from WO
    REVERSAL = "REVERSAL"


class WithdrawalType(str, enum.Enum):
    WO_CONSUME = "WO_CONSUME"   # Withdraw for Work Order (generates CONSUME movements)
    CC_ISSUE = "CC_ISSUE"       # Withdraw for Cost Center (generates ISSUE movements)


class WithdrawalStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    ISSUED = "ISSUED"
    CANCELLED = "CANCELLED"


# ============================================================
# PRODUCT
# ============================================================

class Product(Base, TimestampMixin, OrgMixin):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sku: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_type: Mapped[ProductType] = mapped_column(
        Enum(ProductType, name="product_type_enum"),
        nullable=False,
        default=ProductType.MATERIAL,
    )
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="PCS")
    cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    on_hand: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    min_stock: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    movements: Mapped[list["StockMovement"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("on_hand >= 0", name="ck_product_on_hand_non_negative"),
        CheckConstraint(
            "(product_type != 'MATERIAL') OR (cost >= 1.00)",
            name="ck_product_material_min_cost",
        ),
        Index("ix_products_org_sku", "org_id", "sku"),
    )

    def __repr__(self) -> str:
        return f"<Product {self.sku} ({self.product_type.value})>"


# ============================================================
# STOCK MOVEMENT (immutable — corrections via REVERSAL only)
# ============================================================

class StockMovement(Base, TimestampMixin, OrgMixin):
    __tablename__ = "stock_movements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    movement_type: Mapped[MovementType] = mapped_column(
        Enum(MovementType, name="movement_type_enum"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    reference: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reversed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stock_movements.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_reversed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # Relationships
    product: Mapped["Product"] = relationship(back_populates="movements")

    __table_args__ = (
        CheckConstraint("quantity != 0", name="ck_movement_qty_nonzero"),
        Index("ix_movements_product_type", "product_id", "movement_type"),
    )

    # Location link (nullable — backward compatible with existing movements)
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ISSUE → cost tracking
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    cost_element_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_elements.id", ondelete="SET NULL"),
        nullable=True,
    )

    # TRANSFER → destination location
    to_location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<StockMovement {self.movement_type.value} qty={self.quantity}>"


# ============================================================
# STOCK BY LOCATION (per-location on_hand tracking)
# ============================================================

class StockByLocation(Base, TimestampMixin, OrgMixin):
    """Track on_hand per product per location."""
    __tablename__ = "stock_by_location"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    on_hand: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    __table_args__ = (
        CheckConstraint("on_hand >= 0", name="ck_stock_by_location_on_hand_non_negative"),
        UniqueConstraint("product_id", "location_id", name="uq_stock_by_location_product_location"),
        Index("ix_stock_by_location_product", "product_id"),
        Index("ix_stock_by_location_location", "location_id"),
    )

    def __repr__(self) -> str:
        return f"<StockByLocation product={self.product_id} location={self.location_id} on_hand={self.on_hand}>"


# ============================================================
# STOCK WITHDRAWAL SLIP (header + lines, Phase 11 Part B)
# ============================================================

class StockWithdrawalSlip(Base, TimestampMixin, OrgMixin):
    """
    Multi-line stock withdrawal document.
    Flow: DRAFT → PENDING → ISSUED (+ CANCELLED)
    When ISSUED, generates individual StockMovement per line.
    """
    __tablename__ = "stock_withdrawal_slips"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slip_number: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )
    withdrawal_type: Mapped[WithdrawalType] = mapped_column(
        Enum(WithdrawalType, name="withdrawal_type_enum"),
        nullable=False,
    )
    status: Mapped[WithdrawalStatus] = mapped_column(
        Enum(WithdrawalStatus, name="withdrawal_status_enum"),
        nullable=False,
        default=WithdrawalStatus.DRAFT,
    )

    # WO_CONSUME target
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="RESTRICT"),
        nullable=True,
    )
    # CC_ISSUE target
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="RESTRICT"),
        nullable=True,
    )
    cost_element_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_elements.id", ondelete="SET NULL"),
        nullable=True,
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
    lines: Mapped[list["StockWithdrawalSlipLine"]] = relationship(
        back_populates="slip", cascade="all, delete-orphan",
        order_by="StockWithdrawalSlipLine.line_number",
    )

    __table_args__ = (
        UniqueConstraint("org_id", "slip_number", name="uq_sw_org_number"),
        Index("ix_sw_org_status", "org_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<StockWithdrawalSlip {self.slip_number} ({self.status.value})>"


class StockWithdrawalSlipLine(Base, TimestampMixin):
    """Line item for StockWithdrawalSlip. No org_id (inherited from header)."""
    __tablename__ = "stock_withdrawal_slip_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stock_withdrawal_slips.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    issued_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    movement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stock_movements.id", ondelete="SET NULL"),
        nullable=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    slip: Mapped["StockWithdrawalSlip"] = relationship(back_populates="lines")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sw_line_qty_positive"),
        CheckConstraint("issued_qty >= 0", name="ck_sw_line_issued_qty_non_negative"),
        Index("ix_sw_lines_slip_id", "slip_id"),
    )

    def __repr__(self) -> str:
        return f"<SWLine #{self.line_number} product={self.product_id} qty={self.quantity}>"
