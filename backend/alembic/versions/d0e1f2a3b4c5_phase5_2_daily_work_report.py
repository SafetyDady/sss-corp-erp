"""Phase 5.2: Daily Work Report tables + StandardTimesheet ot_hours

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-02-27 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "d0e1f2a3b4c5"
down_revision: str = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables daily_work_reports and daily_work_report_lines are created by
    # SQLAlchemy create_all on startup (since models are imported).
    # This migration only handles what create_all doesn't cover:

    # === Alter: standard_timesheets add ot_hours ===
    op.add_column(
        "standard_timesheets",
        sa.Column("ot_hours", sa.Numeric(4, 2), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_std_timesheet_ot_positive",
        "standard_timesheets",
        "ot_hours >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_std_timesheet_ot_positive", "standard_timesheets", type_="check")
    op.drop_column("standard_timesheets", "ot_hours")
