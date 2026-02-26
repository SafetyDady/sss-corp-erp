"""
SSS Corp ERP — HR Models
Phase 2: Employee, Timesheet, Leave, PayrollRun

Business Rules:
  BR#15 — ManHour Cost = Σ((Regular + OT × Factor) × Rate)
  BR#18 — 1 hour = 1 WO only (no overlap)
  BR#19 — Lock period 7 days
  BR#20 — Daily hours ≤ working hours
  BR#21 — Supervisor can fill on behalf
  BR#22 — HR unlock before editing past lock period
  BR#23 — OT Flow: staff → supervisor approve → HR final
  BR#26 — HR is final authority before payroll
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
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
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# ENUMS
# ============================================================

class TimesheetStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"       # Supervisor approved
    FINAL = "FINAL"             # HR final approved
    REJECTED = "REJECTED"


class LeaveStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class PayrollStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    EXECUTED = "EXECUTED"
    EXPORTED = "EXPORTED"


# ============================================================
# EMPLOYEE
# ============================================================

class Employee(Base, TimestampMixin, OrgMixin):
    """
    Employee with hourly rate for job costing.
    Links to user account (optional) and cost center.
    """
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    employee_code: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    daily_working_hours: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("8.00")
    )
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "employee_code", name="uq_employee_org_code"),
        CheckConstraint("hourly_rate >= 0", name="ck_employee_hourly_rate_positive"),
        CheckConstraint(
            "daily_working_hours > 0 AND daily_working_hours <= 24",
            name="ck_employee_daily_hours_range",
        ),
    )

    def __repr__(self) -> str:
        return f"<Employee {self.employee_code} {self.full_name}>"


# ============================================================
# TIMESHEET  (BR#18-22, BR#26)
# ============================================================

class Timesheet(Base, TimestampMixin, OrgMixin):
    """
    Daily timesheet entry linking employee to work order.
    Tracks regular hours + OT hours for job costing.
    """
    __tablename__ = "timesheets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
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
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    regular_hours: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("0.00")
    )
    ot_hours: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("0.00")
    )
    ot_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ot_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[TimesheetStatus] = mapped_column(
        Enum(TimesheetStatus, name="timesheet_status_enum"),
        nullable=False,
        default=TimesheetStatus.DRAFT,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    final_approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        CheckConstraint("regular_hours >= 0", name="ck_timesheet_regular_hours_positive"),
        CheckConstraint("ot_hours >= 0", name="ck_timesheet_ot_hours_positive"),
        Index("ix_timesheets_employee_date", "employee_id", "work_date"),
        Index("ix_timesheets_wo", "work_order_id"),
    )

    def __repr__(self) -> str:
        return f"<Timesheet emp={self.employee_id} date={self.work_date} {self.status.value}>"


# ============================================================
# LEAVE
# ============================================================

class Leave(Base, TimestampMixin, OrgMixin):
    __tablename__ = "leaves"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        nullable=False,
    )
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[LeaveStatus] = mapped_column(
        Enum(LeaveStatus, name="leave_status_enum"),
        nullable=False,
        default=LeaveStatus.PENDING,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_leave_date_range"),
        Index("ix_leaves_employee", "employee_id"),
    )

    def __repr__(self) -> str:
        return f"<Leave emp={self.employee_id} {self.leave_type} {self.status.value}>"


# ============================================================
# PAYROLL RUN
# ============================================================

class PayrollRun(Base, TimestampMixin, OrgMixin):
    __tablename__ = "payroll_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[PayrollStatus] = mapped_column(
        Enum(PayrollStatus, name="payroll_status_enum"),
        nullable=False,
        default=PayrollStatus.DRAFT,
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    employee_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    executed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("period_end >= period_start", name="ck_payroll_period_range"),
        CheckConstraint("total_amount >= 0", name="ck_payroll_total_positive"),
    )

    def __repr__(self) -> str:
        return f"<PayrollRun {self.period_start}~{self.period_end} {self.status.value}>"
