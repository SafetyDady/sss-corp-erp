"""
SSS Corp ERP — Warehouse Models
Phase 1: Warehouse + Location
Go-Live Gate: Bin (3-level hierarchy: Warehouse → Location → Bin)
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
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
# WAREHOUSE
# ============================================================

class Warehouse(Base, TimestampMixin, OrgMixin):
    __tablename__ = "warehouses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    # C11: Company + Department affiliation — warehouse belongs to a Company and is managed by a Department
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    locations: Mapped[list["Location"]] = relationship(
        back_populates="warehouse", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_warehouse_org_code"),
        Index("ix_warehouses_org_code", "org_id", "code"),
        Index("ix_warehouse_company", "company_id"),
        Index("ix_warehouse_department", "department_id"),
    )

    def __repr__(self) -> str:
        return f"<Warehouse {self.code}: {self.name}>"


# ============================================================
# LOCATION (belongs to 1 warehouse)
# ============================================================

class Location(Base, TimestampMixin, OrgMixin):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    zone_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="GENERAL"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    warehouse: Mapped["Warehouse"] = relationship(back_populates="locations")
    bins: Mapped[list["Bin"]] = relationship(
        back_populates="location", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # Location code unique per warehouse
        UniqueConstraint("warehouse_id", "code", name="uq_location_warehouse_code"),
        # 1 zone type per warehouse (BR#34)
        UniqueConstraint("warehouse_id", "zone_type", name="uq_location_warehouse_zone_type"),
        Index("ix_locations_warehouse_code", "warehouse_id", "code"),
    )

    def __repr__(self) -> str:
        return f"<Location {self.code} @ warehouse={self.warehouse_id}>"


# ============================================================
# BIN (belongs to 1 location — 3rd level: Warehouse → Location → Bin)
# ============================================================

class Bin(Base, TimestampMixin, OrgMixin):
    __tablename__ = "bins"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    location: Mapped["Location"] = relationship(back_populates="bins")

    __table_args__ = (
        UniqueConstraint("location_id", "code", name="uq_bin_location_code"),
        Index("ix_bins_org_location", "org_id", "location_id"),
    )

    def __repr__(self) -> str:
        return f"<Bin {self.code} @ location={self.location_id}>"


# ============================================================
# STOCK BY BIN (per-product per-bin on_hand tracking)
# ============================================================

class StockByBin(Base, TimestampMixin, OrgMixin):
    """Track on_hand per product per bin (3rd level granularity)."""
    __tablename__ = "stock_by_bin"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    bin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bins.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    on_hand: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    __table_args__ = (
        CheckConstraint("on_hand >= 0", name="ck_stock_by_bin_on_hand_non_negative"),
        UniqueConstraint("product_id", "bin_id", name="uq_stock_by_bin_product_bin"),
        Index("ix_stock_by_bin_product", "product_id"),
        Index("ix_stock_by_bin_bin", "bin_id"),
        # Hardening: tenant-safe composite unique + query index
        Index("ix_stock_by_bin_org_product_bin", "org_id", "product_id", "bin_id", unique=True),
        Index("ix_stock_by_bin_org_bin", "org_id", "bin_id"),
    )
