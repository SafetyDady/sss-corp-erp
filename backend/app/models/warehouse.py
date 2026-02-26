"""
SSS Corp ERP — Warehouse Models
Phase 1: Warehouse + Location
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
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
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    locations: Mapped[list["Location"]] = relationship(
        back_populates="warehouse", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_warehouse_org_code"),
        Index("ix_warehouses_org_code", "org_id", "code"),
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

    __table_args__ = (
        # Location code unique per warehouse
        UniqueConstraint("warehouse_id", "code", name="uq_location_warehouse_code"),
        # 1 zone type per warehouse (BR#34)
        UniqueConstraint("warehouse_id", "zone_type", name="uq_location_warehouse_zone_type"),
        Index("ix_locations_warehouse_code", "warehouse_id", "code"),
    )

    def __repr__(self) -> str:
        return f"<Location {self.code} @ warehouse={self.warehouse_id}>"
