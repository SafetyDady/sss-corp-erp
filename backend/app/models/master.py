"""
SSS Corp ERP — Master Data Models
Phase 1: CostCenter, CostElement, OTType
Phase 4.3: LeaveType

Business Rules:
  BR#9  — cost_center_id must be integer/UUID (not string)
  BR#17 — Overhead = ManHour Cost × Overhead Rate % (per Cost Center)
  BR#24 — Special OT Factor ≤ Maximum Ceiling (Admin-defined)
  BR#25 — OT defaults: weekday 1.5×, weekend 2.0×, holiday 3.0×
  BR#29 — Admin adjusts Factor + Max Ceiling in Master Data
  BR#30 — Overhead Rate per Cost Center (not one rate for all)
"""

import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# COST CENTER  (BR#9, BR#17, BR#30)
# ============================================================

class CostCenter(Base, TimestampMixin, OrgMixin):
    """
    Cost center for overhead allocation.
    Each cost center has its own overhead_rate (BR#30).
    """
    __tablename__ = "cost_centers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    overhead_rate: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_cost_center_org_code"),
        CheckConstraint(
            "overhead_rate >= 0 AND overhead_rate <= 100",
            name="ck_cost_center_overhead_rate_range",
        ),
    )

    def __repr__(self) -> str:
        return f"<CostCenter {self.code} rate={self.overhead_rate}%>"


# ============================================================
# COST ELEMENT
# ============================================================

class CostElement(Base, TimestampMixin, OrgMixin):
    """
    Cost element categories for financial tracking.
    E.g. MATERIAL, LABOR, OVERHEAD, TOOLS, etc.
    """
    __tablename__ = "cost_elements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_cost_element_org_code"),
    )

    def __repr__(self) -> str:
        return f"<CostElement {self.code}>"


# ============================================================
# OT TYPE  (BR#24, BR#25, BR#29)
# ============================================================

class OTType(Base, TimestampMixin, OrgMixin):
    """
    Overtime type with factor and maximum ceiling.
    Defaults (BR#25): weekday 1.5×, weekend 2.0×, holiday 3.0×
    Admin can adjust factor + max_ceiling (BR#29).
    Special OT factor ≤ max_ceiling (BR#24).
    """
    __tablename__ = "ot_types"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    factor: Mapped[float] = mapped_column(
        Numeric(4, 2), nullable=False, default=1.5
    )
    max_ceiling: Mapped[float] = mapped_column(
        Numeric(4, 2), nullable=False, default=3.0
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_ot_type_org_name"),
        CheckConstraint(
            "factor > 0",
            name="ck_ot_type_factor_positive",
        ),
        CheckConstraint(
            "max_ceiling >= factor",
            name="ck_ot_type_ceiling_gte_factor",
        ),
    )

    def __repr__(self) -> str:
        return f"<OTType {self.name} factor={self.factor}× max={self.max_ceiling}×>"


# ============================================================
# LEAVE TYPE  (Phase 4.3)
# ============================================================

class LeaveType(Base, TimestampMixin, OrgMixin):
    """
    Leave type master data — defines leave categories per org.
    Seed defaults: ANNUAL (6d), SICK (30d), PERSONAL (3d), MATERNITY (98d), UNPAID (unlimited).
    """
    __tablename__ = "leave_types"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_quota: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_leave_type_org_code"),
        CheckConstraint("default_quota IS NULL OR default_quota >= 0", name="ck_leave_type_quota_positive"),
    )

    def __repr__(self) -> str:
        return f"<LeaveType {self.code} paid={self.is_paid} quota={self.default_quota}>"
