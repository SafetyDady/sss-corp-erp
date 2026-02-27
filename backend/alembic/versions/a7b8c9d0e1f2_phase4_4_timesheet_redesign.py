"""Phase 4.4: Timesheet Redesign — StandardTimesheet table

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-02-27 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create day_status_enum type
    day_status_enum = sa.Enum(
        "WORK", "LEAVE_PAID", "LEAVE_UNPAID", "ABSENT", "HOLIDAY",
        name="day_status_enum",
    )
    day_status_enum.create(op.get_bind(), checkfirst=True)

    # Create standard_timesheets table
    op.create_table(
        "standard_timesheets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "employee_id",
            UUID(as_uuid=True),
            sa.ForeignKey("employees.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("work_date", sa.Date, nullable=False),
        sa.Column(
            "scheduled_hours",
            sa.Numeric(4, 2),
            nullable=False,
            server_default="8.00",
        ),
        sa.Column(
            "actual_status",
            day_status_enum,
            nullable=False,
            server_default="WORK",
        ),
        sa.Column(
            "leave_id",
            UUID(as_uuid=True),
            sa.ForeignKey("leaves.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "employee_id", "work_date", name="uq_std_timesheet_emp_date"
        ),
        sa.CheckConstraint(
            "scheduled_hours >= 0", name="ck_std_timesheet_hours_positive"
        ),
    )

    op.create_index(
        "ix_std_timesheets_employee_date",
        "standard_timesheets",
        ["employee_id", "work_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_std_timesheets_employee_date", table_name="standard_timesheets")
    op.drop_table("standard_timesheets")
    sa.Enum(name="day_status_enum").drop(op.get_bind(), checkfirst=True)
