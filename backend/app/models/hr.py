"""
SSS Corp ERP — HR Models
Phase 2: Employee, Timesheet, Leave, PayrollRun
Phase 4.1: Employee + department_id, supervisor_id, pay_type, daily_rate, monthly_salary
Phase 4.3: LeaveBalance + Leave upgrade (leave_type_id, days_count)

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


class PayType(str, enum.Enum):
    DAILY = "DAILY"
    MONTHLY = "MONTHLY"


class DayStatus(str, enum.Enum):
    """Actual status for a standard timesheet day."""
    WORK = "WORK"
    LEAVE_PAID = "LEAVE_PAID"
    LEAVE_UNPAID = "LEAVE_UNPAID"
    ABSENT = "ABSENT"
    HOLIDAY = "HOLIDAY"


# ============================================================
# EMPLOYEE
# ============================================================

class Employee(Base, TimestampMixin, OrgMixin):
    """
    Employee with hourly rate for job costing.
    Links to user account (optional), cost center, department, and supervisor.

    Pay types:
      DAILY   — daily_rate × days worked, hourly_rate = daily_rate / hours_per_day
      MONTHLY — monthly_salary fixed, hourly_rate = monthly_salary / (working_days × hours_per_day)
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
    # Phase 4.1: Department + chain-of-command
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
    )
    supervisor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Phase 4.1: Pay type (daily rate vs monthly salary)
    pay_type: Mapped[PayType] = mapped_column(
        Enum(PayType, name="pay_type_enum"),
        nullable=False,
        default=PayType.DAILY,
    )
    daily_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    monthly_salary: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Phase 5: hire_date for tenure calculation (BR#55)
    hire_date: Mapped[date | None] = mapped_column(
        Date, nullable=True  # nullable for existing employees, new ones should fill
    )

    __table_args__ = (
        UniqueConstraint("org_id", "employee_code", name="uq_employee_org_code"),
        CheckConstraint("hourly_rate >= 0", name="ck_employee_hourly_rate_positive"),
        CheckConstraint(
            "daily_working_hours > 0 AND daily_working_hours <= 24",
            name="ck_employee_daily_hours_range",
        ),
        CheckConstraint("daily_rate IS NULL OR daily_rate >= 0", name="ck_employee_daily_rate_positive"),
        CheckConstraint("monthly_salary IS NULL OR monthly_salary >= 0", name="ck_employee_monthly_salary_positive"),
        Index("ix_employees_department", "department_id"),
        Index("ix_employees_supervisor", "supervisor_id"),
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
    # Phase 4.2: Approval flow — requested approver
    requested_approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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
    # Phase 4.3: FK to leave_types (nullable for backward compat)
    leave_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leave_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
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
    # Phase 4.2: Approval flow — requested approver
    requested_approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_leave_date_range"),
        Index("ix_leaves_employee", "employee_id"),
    )

    def __repr__(self) -> str:
        return f"<Leave emp={self.employee_id} {self.leave_type} {self.status.value}>"


# ============================================================
# LEAVE BALANCE  (Phase 4.3 — BR#36)
# ============================================================

class LeaveBalance(Base, TimestampMixin, OrgMixin):
    """
    Per-employee per-leave-type per-year quota tracking.
    BR#36: Cannot take leave exceeding quota.
    """
    __tablename__ = "leave_balances"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
    )
    leave_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leave_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    quota: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leave_balance_emp_type_year"),
        CheckConstraint("quota >= 0", name="ck_leave_balance_quota_positive"),
        CheckConstraint("used >= 0", name="ck_leave_balance_used_positive"),
        Index("ix_leave_balances_employee", "employee_id"),
    )

    def __repr__(self) -> str:
        return f"<LeaveBalance emp={self.employee_id} year={self.year} used={self.used}/{self.quota}>"


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


# ============================================================
# STANDARD TIMESHEET  (Phase 4.4 — auto-generated per day)
# ============================================================

class StandardTimesheet(Base, TimestampMixin, OrgMixin):
    """
    Auto-generated daily attendance record for each employee.
    Used for payroll — tracks whether employee worked, was on leave, absent, etc.
    WO-specific time entries remain in the Timesheet (WO Time Entry) model.
    """
    __tablename__ = "standard_timesheets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
    )
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    scheduled_hours: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("8.00")
    )
    actual_status: Mapped[DayStatus] = mapped_column(
        Enum(DayStatus, name="day_status_enum"),
        nullable=False,
        default=DayStatus.WORK,
    )
    leave_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leaves.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint("employee_id", "work_date", name="uq_std_timesheet_emp_date"),
        CheckConstraint("scheduled_hours >= 0", name="ck_std_timesheet_hours_positive"),
        Index("ix_std_timesheets_employee_date", "employee_id", "work_date"),
    )

    def __repr__(self) -> str:
        return f"<StandardTimesheet emp={self.employee_id} date={self.work_date} {self.actual_status.value}>"
