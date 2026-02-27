"""
SSS Corp ERP — Planning Models
Phase 4.5: WO Master Plan, Daily Plan, Material & Tool Reservation

Business Rules:
  BR#40 — Daily Plan: 1 person = 1 WO per day
  BR#41 — Daily Plan: 1 tool = 1 WO per day
  BR#42 — Daily Plan: employee on leave cannot be assigned
  BR#43 — Daily Plan: plan up to 14 days ahead, editable
  BR#44 — MaterialReservation: available = on_hand - SUM(reserved)
  BR#45 — ToolReservation: no overlapping reservations
  BR#46 — WO Master Plan: 1 plan per WO, created during DRAFT
"""

import enum
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Index,
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
# ENUMS
# ============================================================

class PlanLineType(str, enum.Enum):
    MANPOWER = "MANPOWER"
    MATERIAL = "MATERIAL"
    TOOL = "TOOL"


class ReservationStatus(str, enum.Enum):
    RESERVED = "RESERVED"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"


class ToolReservationStatus(str, enum.Enum):
    RESERVED = "RESERVED"
    CHECKED_OUT = "CHECKED_OUT"
    RETURNED = "RETURNED"
    CANCELLED = "CANCELLED"


# ============================================================
# WO MASTER PLAN  (BR#46 — 1 plan per WO)
# ============================================================

class WOMasterPlan(Base, TimestampMixin, OrgMixin):
    """
    High-level plan for a work order: timeline, resource estimates.
    One plan per WO (enforced by UNIQUE on work_order_id).
    """
    __tablename__ = "wo_master_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    planned_start: Mapped[date] = mapped_column(Date, nullable=False)
    planned_end: Mapped[date] = mapped_column(Date, nullable=False)
    total_manhours: Mapped[Decimal] = mapped_column(
        Numeric(8, 2), nullable=False, default=Decimal("0.00")
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("planned_end >= planned_start", name="ck_master_plan_date_range"),
        CheckConstraint("total_manhours >= 0", name="ck_master_plan_manhours_positive"),
    )

    def __repr__(self) -> str:
        return f"<WOMasterPlan wo={self.work_order_id} {self.planned_start}~{self.planned_end}>"


class WOMasterPlanLine(Base, TimestampMixin):
    """
    Line item in a master plan: manpower estimate, material need, or tool requirement.
    """
    __tablename__ = "wo_master_plan_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wo_master_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    line_type: Mapped[PlanLineType] = mapped_column(
        Enum(PlanLineType, name="plan_line_type_enum"),
        nullable=False,
    )
    # MANPOWER fields
    employee_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skill_description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    estimated_hours: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 2), nullable=True
    )
    # MATERIAL fields
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # TOOL fields
    tool_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tools.id", ondelete="SET NULL"),
        nullable=True,
    )
    estimated_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        Index("ix_master_plan_lines_plan", "plan_id"),
    )

    def __repr__(self) -> str:
        return f"<WOMasterPlanLine plan={self.plan_id} type={self.line_type.value}>"


# ============================================================
# DAILY PLAN  (BR#40-43)
# ============================================================

class DailyPlan(Base, TimestampMixin, OrgMixin):
    """
    Daily work plan: which WO is being worked on, on which date.
    One record per (org, date, WO) combination.
    """
    __tablename__ = "daily_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("org_id", "plan_date", "work_order_id", name="uq_daily_plan_org_date_wo"),
        Index("ix_daily_plans_date", "plan_date"),
        Index("ix_daily_plans_wo", "work_order_id"),
    )

    def __repr__(self) -> str:
        return f"<DailyPlan date={self.plan_date} wo={self.work_order_id}>"


class DailyPlanWorker(Base, TimestampMixin):
    """
    Worker assigned to a daily plan.
    BR#40: 1 employee can only be assigned to 1 WO per day.
    """
    __tablename__ = "daily_plan_workers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    daily_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("daily_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
    )
    planned_hours: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("8.00")
    )

    __table_args__ = (
        Index("ix_daily_plan_workers_plan", "daily_plan_id"),
        CheckConstraint("planned_hours > 0", name="ck_daily_plan_worker_hours_positive"),
    )

    def __repr__(self) -> str:
        return f"<DailyPlanWorker plan={self.daily_plan_id} emp={self.employee_id}>"


class DailyPlanTool(Base, TimestampMixin):
    """
    Tool assigned to a daily plan.
    BR#41: 1 tool can only be assigned to 1 WO per day.
    """
    __tablename__ = "daily_plan_tools"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    daily_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("daily_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    tool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tools.id", ondelete="CASCADE"),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_daily_plan_tools_plan", "daily_plan_id"),
    )

    def __repr__(self) -> str:
        return f"<DailyPlanTool plan={self.daily_plan_id} tool={self.tool_id}>"


class DailyPlanMaterial(Base, TimestampMixin):
    """Material planned for use in a daily plan."""
    __tablename__ = "daily_plan_materials"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    daily_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("daily_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    planned_qty: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        Index("ix_daily_plan_materials_plan", "daily_plan_id"),
        CheckConstraint("planned_qty > 0", name="ck_daily_plan_material_qty_positive"),
    )

    def __repr__(self) -> str:
        return f"<DailyPlanMaterial plan={self.daily_plan_id} product={self.product_id}>"


# ============================================================
# MATERIAL RESERVATION  (BR#44)
# ============================================================

class MaterialReservation(Base, TimestampMixin, OrgMixin):
    """
    Reserve materials for a work order.
    BR#44: available = on_hand - SUM(reserved qty)
    """
    __tablename__ = "material_reservations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reserved_date: Mapped[date] = mapped_column(Date, nullable=False)
    reserved_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[ReservationStatus] = mapped_column(
        Enum(ReservationStatus, name="reservation_status_enum"),
        nullable=False,
        default=ReservationStatus.RESERVED,
    )

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_material_reservation_qty_positive"),
        Index("ix_material_reservations_wo", "work_order_id"),
        Index("ix_material_reservations_product", "product_id"),
    )

    def __repr__(self) -> str:
        return f"<MaterialReservation wo={self.work_order_id} product={self.product_id} qty={self.quantity}>"


# ============================================================
# TOOL RESERVATION  (BR#45)
# ============================================================

class ToolReservation(Base, TimestampMixin, OrgMixin):
    """
    Reserve a tool for a work order over a date range.
    BR#45: no overlapping reservations for the same tool.
    """
    __tablename__ = "tool_reservations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    tool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tools.id", ondelete="RESTRICT"),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reserved_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[ToolReservationStatus] = mapped_column(
        Enum(ToolReservationStatus, name="tool_reservation_status_enum"),
        nullable=False,
        default=ToolReservationStatus.RESERVED,
    )

    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_tool_reservation_date_range"),
        Index("ix_tool_reservations_wo", "work_order_id"),
        Index("ix_tool_reservations_tool", "tool_id"),
    )

    def __repr__(self) -> str:
        return f"<ToolReservation tool={self.tool_id} wo={self.work_order_id} {self.start_date}~{self.end_date}>"
