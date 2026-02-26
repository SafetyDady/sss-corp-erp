"""add_hr_and_tools_tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-26 13:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- employees table ---
    op.create_table(
        "employees",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("employee_code", sa.String(50), nullable=False, index=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("position", sa.String(100), nullable=True),
        sa.Column("hourly_rate", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("daily_working_hours", sa.Numeric(4, 2), nullable=False, server_default=sa.text("8")),
        sa.Column(
            "cost_center_id", sa.UUID(),
            sa.ForeignKey("cost_centers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "user_id", sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "employee_code", name="uq_employee_org_code"),
        sa.CheckConstraint("hourly_rate >= 0", name="ck_employee_hourly_rate_positive"),
        sa.CheckConstraint(
            "daily_working_hours > 0 AND daily_working_hours <= 24",
            name="ck_employee_daily_hours_range",
        ),
    )

    # --- timesheets table ---
    op.create_table(
        "timesheets",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "employee_id", sa.UUID(),
            sa.ForeignKey("employees.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "work_order_id", sa.UUID(),
            sa.ForeignKey("work_orders.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("regular_hours", sa.Numeric(4, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("ot_hours", sa.Numeric(4, 2), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "ot_type_id", sa.UUID(),
            sa.ForeignKey("ot_types.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.Enum("DRAFT", "SUBMITTED", "APPROVED", "FINAL", "REJECTED",
                     name="timesheet_status_enum", create_type=True),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_by", sa.UUID(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("approved_by", sa.UUID(), nullable=True),
        sa.Column("final_approved_by", sa.UUID(), nullable=True),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("regular_hours >= 0", name="ck_timesheet_regular_hours_positive"),
        sa.CheckConstraint("ot_hours >= 0", name="ck_timesheet_ot_hours_positive"),
    )
    op.create_index("ix_timesheets_employee_date", "timesheets", ["employee_id", "work_date"])
    op.create_index("ix_timesheets_wo", "timesheets", ["work_order_id"])

    # --- leaves table ---
    op.create_table(
        "leaves",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "employee_id", sa.UUID(),
            sa.ForeignKey("employees.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("leave_type", sa.String(50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("PENDING", "APPROVED", "REJECTED",
                     name="leave_status_enum", create_type=True),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column(
            "created_by", sa.UUID(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("approved_by", sa.UUID(), nullable=True),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("end_date >= start_date", name="ck_leave_date_range"),
    )
    op.create_index("ix_leaves_employee", "leaves", ["employee_id"])

    # --- payroll_runs table ---
    op.create_table(
        "payroll_runs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("DRAFT", "EXECUTED", "EXPORTED",
                     name="payroll_status_enum", create_type=True),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("employee_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("executed_by", sa.UUID(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("period_end >= period_start", name="ck_payroll_period_range"),
        sa.CheckConstraint("total_amount >= 0", name="ck_payroll_total_positive"),
    )

    # --- tools table ---
    op.create_table(
        "tools",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("rate_per_hour", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "status",
            sa.Enum("AVAILABLE", "CHECKED_OUT", "MAINTENANCE", "RETIRED",
                     name="tool_status_enum", create_type=True),
            nullable=False,
            server_default="AVAILABLE",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("rate_per_hour >= 0", name="ck_tool_rate_positive"),
    )
    op.create_index("ix_tools_org_code", "tools", ["org_id", "code"], unique=True)

    # --- tool_checkouts table ---
    op.create_table(
        "tool_checkouts",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "tool_id", sa.UUID(),
            sa.ForeignKey("tools.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "employee_id", sa.UUID(),
            sa.ForeignKey("employees.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "work_order_id", sa.UUID(),
            sa.ForeignKey("work_orders.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("checkout_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("checkin_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("charge_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "checked_out_by", sa.UUID(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("checked_in_by", sa.UUID(), nullable=True),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("charge_amount >= 0", name="ck_checkout_charge_positive"),
    )
    op.create_index("ix_tool_checkouts_tool", "tool_checkouts", ["tool_id"])
    op.create_index("ix_tool_checkouts_wo", "tool_checkouts", ["work_order_id"])


def downgrade() -> None:
    op.drop_table("tool_checkouts")
    op.drop_table("tools")
    op.drop_table("payroll_runs")
    op.drop_table("leaves")
    op.drop_table("timesheets")
    op.drop_table("employees")
    op.execute("DROP TYPE IF EXISTS tool_status_enum")
    op.execute("DROP TYPE IF EXISTS payroll_status_enum")
    op.execute("DROP TYPE IF EXISTS leave_status_enum")
    op.execute("DROP TYPE IF EXISTS timesheet_status_enum")
