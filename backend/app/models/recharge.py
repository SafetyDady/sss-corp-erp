"""
SSS Corp ERP — Internal Recharge Models
Phase C9: Fixed Recharge (Budget-based monthly allocation)

Business Rules:
  BR#89 — 1 budget per org per fiscal year per source CC
  BR#90 — Edit only DRAFT budget
  BR#92 — Budget status: DRAFT → ACTIVE → CLOSED
  BR#93 — Generate only for ACTIVE budget
  BR#94 — Cannot regenerate same month (UNIQUE constraint)
  BR#95 — Headcount = active employees per dept (snapshot)
  BR#96 — Skip source CC's own department
  BR#97 — Rounding adjustment ensures sum = monthly_budget
  BR#98 — amount Numeric(12,2), budget Numeric(14,2)
"""

import enum
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# Enums
# ============================================================

class RechargeStatus(str, enum.Enum):
    """Budget lifecycle: DRAFT → ACTIVE → CLOSED"""
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


# ============================================================
# FIXED RECHARGE BUDGET  (BR#89, BR#90, BR#92, BR#98)
# ============================================================

class FixedRechargeBudget(Base, TimestampMixin, OrgMixin):
    """
    Annual overhead budget for a source Cost Center.
    Allocated monthly to target departments based on headcount.

    Example: Central Admin CC = 1,000,000 THB/year
    → monthly = 83,333.33 THB → split by headcount per dept
    """
    __tablename__ = "fixed_recharge_budgets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    fiscal_year: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    source_cost_center_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    annual_budget: Mapped[object] = mapped_column(
        Numeric(14, 2), nullable=False  # up to 999,999,999,999.99
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RechargeStatus] = mapped_column(
        Enum(RechargeStatus, name="recharge_status_enum"),
        nullable=False,
        default=RechargeStatus.DRAFT,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "org_id", "fiscal_year", "source_cost_center_id",
            name="uq_fixed_recharge_org_year_cc",
        ),
        CheckConstraint(
            "annual_budget >= 0",
            name="ck_recharge_budget_non_negative",
        ),
        CheckConstraint(
            "fiscal_year >= 2020 AND fiscal_year <= 2100",
            name="ck_recharge_year_range",
        ),
        Index("ix_recharge_budget_org_year", "org_id", "fiscal_year"),
    )


# ============================================================
# FIXED RECHARGE ENTRY  (BR#94, BR#95, BR#96, BR#97)
# ============================================================

class FixedRechargeEntry(Base, TimestampMixin, OrgMixin):
    """
    Monthly generated allocation record.
    One entry per target department per month per budget.

    headcount and total_headcount are frozen snapshots at generation time.
    """
    __tablename__ = "fixed_recharge_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    budget_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fixed_recharge_budgets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)

    # Source — the overhead CC being allocated FROM
    source_cost_center_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # Target — the department being allocated TO
    target_department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="RESTRICT"),
        nullable=False,
    )
    target_cost_center_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_centers.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Allocation calculation (snapshot)
    headcount: Mapped[int] = mapped_column(Integer, nullable=False)
    total_headcount: Mapped[int] = mapped_column(Integer, nullable=False)
    allocation_pct: Mapped[object] = mapped_column(
        Numeric(7, 4), nullable=False  # e.g. 50.0000%
    )
    amount: Mapped[object] = mapped_column(
        Numeric(12, 2), nullable=False
    )

    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "budget_id", "period_year", "period_month", "target_department_id",
            name="uq_recharge_entry_budget_period_dept",
        ),
        CheckConstraint(
            "period_month >= 1 AND period_month <= 12",
            name="ck_recharge_entry_month_range",
        ),
        CheckConstraint(
            "headcount >= 0",
            name="ck_recharge_entry_headcount_non_negative",
        ),
        CheckConstraint(
            "amount >= 0",
            name="ck_recharge_entry_amount_non_negative",
        ),
        Index(
            "ix_recharge_entry_budget_period",
            "budget_id", "period_year", "period_month",
        ),
        Index(
            "ix_recharge_entry_target_cc",
            "target_cost_center_id", "period_year", "period_month",
        ),
        Index(
            "ix_recharge_entry_org_period",
            "org_id", "period_year", "period_month",
        ),
    )
