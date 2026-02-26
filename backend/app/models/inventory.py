"""
SSS Corp ERP — Inventory Models
Phase 1: Product + StockMovement + StockBalance
"""

import enum
import uuid
from datetime import datetime

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


class MovementType(str, enum.Enum):
    RECEIVE = "RECEIVE"
    ISSUE = "ISSUE"
    TRANSFER = "TRANSFER"
    ADJUST = "ADJUST"
    CONSUME = "CONSUME"       # WO consumption
    REVERSAL = "REVERSAL"


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
    cost: Mapped[float] = mapped_column(
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
    unit_cost: Mapped[float] = mapped_column(
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

    def __repr__(self) -> str:
        return f"<StockMovement {self.movement_type.value} qty={self.quantity}>"
