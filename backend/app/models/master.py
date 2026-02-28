"""
SSS Corp ERP — Master Data Models
Phase 1: CostCenter, CostElement, OTType
Phase 4.3: LeaveType
Phase 4.9: ShiftType, WorkSchedule (Shift Management)

Business Rules:
  BR#9  — cost_center_id must be integer/UUID (not string)
  BR#17 — Overhead = ManHour Cost × Overhead Rate % (per Cost Center)
  BR#24 — Special OT Factor ≤ Maximum Ceiling (Admin-defined)
  BR#25 — OT defaults: weekday 1.5×, weekend 2.0×, holiday 3.0×
  BR#29 — Admin adjusts Factor + Max Ceiling in Master Data
  BR#30 — Overhead Rate per Cost Center (not one rate for all)
"""

import enum
import uuid
from datetime import time, date

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
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


# ============================================================
# SCHEDULE TYPE ENUM  (Phase 4.9 — Shift Management)
# ============================================================

class ScheduleType(str, enum.Enum):
    FIXED = "FIXED"
    ROTATING = "ROTATING"


# ============================================================
# SHIFT TYPE  (Phase 4.9 — Shift Management)
# ============================================================

class ShiftType(Base, TimestampMixin, OrgMixin):
    """
    Master data for shift definitions (e.g. morning, afternoon, night).
    Each shift defines start/end times, break duration, and working hours.
    """
    __tablename__ = "shift_types"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    break_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60
    )
    working_hours: Mapped[float] = mapped_column(
        Numeric(4, 2), nullable=False, default=8.00
    )
    is_overnight: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_shift_type_org_code"),
        CheckConstraint("break_minutes >= 0", name="ck_shift_type_break_positive"),
        CheckConstraint(
            "working_hours > 0 AND working_hours <= 24",
            name="ck_shift_type_hours_range",
        ),
    )

    def __repr__(self) -> str:
        return f"<ShiftType {self.code} {self.start_time}-{self.end_time}>"


# ============================================================
# WORK SCHEDULE  (Phase 4.9 — Shift Management)
# ============================================================

class WorkSchedule(Base, TimestampMixin, OrgMixin):
    """
    Work schedule template — either FIXED (specific weekdays) or ROTATING (cyclic pattern).
    FIXED: working_days=[1,2,3,4,5] + default_shift_type_id
    ROTATING: rotation_pattern=["MORNING","MORNING","OFF",...] + cycle_start_date
    """
    __tablename__ = "work_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    schedule_type: Mapped[ScheduleType] = mapped_column(
        Enum(ScheduleType, name="schedule_type_enum"),
        nullable=False,
        default=ScheduleType.FIXED,
    )
    # FIXED schedule fields
    working_days: Mapped[list | None] = mapped_column(
        JSON, nullable=True  # e.g. [1,2,3,4,5] = Mon-Fri
    )
    default_shift_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shift_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    # ROTATING schedule fields
    rotation_pattern: Mapped[list | None] = mapped_column(
        JSON, nullable=True  # e.g. ["MORNING","MORNING","AFTERNOON","AFTERNOON","NIGHT","NIGHT","OFF","OFF"]
    )
    cycle_start_date: Mapped[date | None] = mapped_column(
        Date, nullable=True  # anchor date for calculating rotation position
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_work_schedule_org_code"),
    )

    def __repr__(self) -> str:
        return f"<WorkSchedule {self.code} {self.schedule_type.value}>"
