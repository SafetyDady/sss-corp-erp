"""
SSS Corp ERP — Daily Work Report Models (Phase 5)
DailyWorkReport + DailyWorkReportLine

Business Rules:
  BR#50 — 1 report per employee per day (UNIQUE)
  BR#51 — Time overlap validation within same day
  BR#52 — Auto-create Timesheet on approve
  BR#53 — Auto-update StandardTimesheet OT on approve
  BR#54 — Edit only DRAFT/REJECTED
"""

import enum
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# ENUMS
# ============================================================

class ReportStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class LineType(str, enum.Enum):
    REGULAR = "REGULAR"
    OT = "OT"


# ============================================================
# DAILY WORK REPORT  (BR#50, BR#54)
# ============================================================

class DailyWorkReport(Base, TimestampMixin, OrgMixin):
    """
    Daily work report: 1 report per employee per day.
    Staff fill → submit → Supervisor approve → auto-record Timesheet + WO ManHour.
    """
    __tablename__ = "daily_work_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
    )
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, name="report_status_enum"),
        nullable=False,
        default=ReportStatus.DRAFT,
    )

    # Summary hours (calculated from lines)
    total_regular_hours: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0.00")
    )
    total_ot_hours: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0.00")
    )

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Submission
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Approval
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Audit
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "employee_id", "report_date", "org_id",
            name="uq_daily_report_emp_date_org",
        ),
        CheckConstraint(
            "total_regular_hours >= 0",
            name="ck_daily_report_regular_positive",
        ),
        CheckConstraint(
            "total_ot_hours >= 0",
            name="ck_daily_report_ot_positive",
        ),
        Index("ix_daily_reports_employee_date", "employee_id", "report_date"),
        Index("ix_daily_reports_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<DailyWorkReport {self.employee_id} {self.report_date} {self.status.value}>"


# ============================================================
# DAILY WORK REPORT LINE  (BR#51)
# ============================================================

class DailyWorkReportLine(Base, TimestampMixin):
    """
    Each line of a Daily Work Report.
    Stores: time range + WO + hours + type (regular/OT).
    """
    __tablename__ = "daily_work_report_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("daily_work_reports.id", ondelete="CASCADE"),
        nullable=False,
    )

    line_type: Mapped[LineType] = mapped_column(
        Enum(LineType, name="report_line_type_enum"),
        nullable=False,
    )
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="SET NULL"),
        nullable=True,
    )

    hours: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False
    )

    ot_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ot_types.id", ondelete="SET NULL"),
        nullable=True,
    )

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("hours > 0", name="ck_report_line_hours_positive"),
        Index("ix_report_lines_report", "report_id"),
    )

    def __repr__(self) -> str:
        return f"<DailyWorkReportLine {self.line_type.value} {self.start_time}-{self.end_time} {self.hours}h>"
