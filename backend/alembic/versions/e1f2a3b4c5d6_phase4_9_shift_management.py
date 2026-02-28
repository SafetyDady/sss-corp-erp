"""Phase 4.9: Shift Management — ShiftType, WorkSchedule, ShiftRoster + Employee.work_schedule_id

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-03-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1. Create schedule_type_enum ---
    schedule_type_enum = postgresql.ENUM("FIXED", "ROTATING", name="schedule_type_enum", create_type=False)
    schedule_type_enum.create(op.get_bind(), checkfirst=True)

    # --- 2. Create shift_types table ---
    op.create_table(
        "shift_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(50), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("break_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("working_hours", sa.Numeric(4, 2), nullable=False, server_default="8.00"),
        sa.Column("is_overnight", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "code", name="uq_shift_type_org_code"),
        sa.CheckConstraint("break_minutes >= 0", name="ck_shift_type_break_positive"),
        sa.CheckConstraint("working_hours > 0 AND working_hours <= 24", name="ck_shift_type_hours_range"),
    )

    # --- 3. Create work_schedules table ---
    op.create_table(
        "work_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(50), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("schedule_type", sa.Enum("FIXED", "ROTATING", name="schedule_type_enum", create_type=False), nullable=False, server_default="FIXED"),
        sa.Column("working_days", postgresql.JSON(), nullable=True),
        sa.Column("default_shift_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shift_types.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rotation_pattern", postgresql.JSON(), nullable=True),
        sa.Column("cycle_start_date", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "code", name="uq_work_schedule_org_code"),
    )

    # --- 4. Create shift_rosters table ---
    op.create_table(
        "shift_rosters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("roster_date", sa.Date(), nullable=False),
        sa.Column("shift_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shift_types.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_working_day", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_manual_override", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("employee_id", "roster_date", name="uq_shift_roster_emp_date"),
    )
    op.create_index("ix_shift_roster_emp_date", "shift_rosters", ["employee_id", "roster_date"])

    # --- 5. Add work_schedule_id to employees ---
    op.add_column(
        "employees",
        sa.Column(
            "work_schedule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("work_schedules.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    # --- Remove work_schedule_id from employees ---
    op.drop_column("employees", "work_schedule_id")

    # --- Drop shift_rosters ---
    op.drop_index("ix_shift_roster_emp_date", table_name="shift_rosters")
    op.drop_table("shift_rosters")

    # --- Drop work_schedules ---
    op.drop_table("work_schedules")

    # --- Drop shift_types ---
    op.drop_table("shift_types")

    # --- Drop enum ---
    sa.Enum(name="schedule_type_enum").drop(op.get_bind(), checkfirst=True)
