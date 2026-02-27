"""phase4_2_approval_overhaul

Phase 4.2: Add requested_approver_id to 5 approvable document tables.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-27 14:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add requested_approver_id to purchase_orders
    op.add_column(
        "purchase_orders",
        sa.Column("requested_approver_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_po_requested_approver",
        "purchase_orders", "users",
        ["requested_approver_id"], ["id"],
        ondelete="SET NULL",
    )

    # Add requested_approver_id to sales_orders
    op.add_column(
        "sales_orders",
        sa.Column("requested_approver_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_so_requested_approver",
        "sales_orders", "users",
        ["requested_approver_id"], ["id"],
        ondelete="SET NULL",
    )

    # Add requested_approver_id to work_orders
    op.add_column(
        "work_orders",
        sa.Column("requested_approver_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_wo_requested_approver",
        "work_orders", "users",
        ["requested_approver_id"], ["id"],
        ondelete="SET NULL",
    )

    # Add requested_approver_id to timesheets
    op.add_column(
        "timesheets",
        sa.Column("requested_approver_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_ts_requested_approver",
        "timesheets", "users",
        ["requested_approver_id"], ["id"],
        ondelete="SET NULL",
    )

    # Add requested_approver_id to leaves
    op.add_column(
        "leaves",
        sa.Column("requested_approver_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_leave_requested_approver",
        "leaves", "users",
        ["requested_approver_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_leave_requested_approver", "leaves", type_="foreignkey")
    op.drop_column("leaves", "requested_approver_id")

    op.drop_constraint("fk_ts_requested_approver", "timesheets", type_="foreignkey")
    op.drop_column("timesheets", "requested_approver_id")

    op.drop_constraint("fk_wo_requested_approver", "work_orders", type_="foreignkey")
    op.drop_column("work_orders", "requested_approver_id")

    op.drop_constraint("fk_so_requested_approver", "sales_orders", type_="foreignkey")
    op.drop_column("sales_orders", "requested_approver_id")

    op.drop_constraint("fk_po_requested_approver", "purchase_orders", type_="foreignkey")
    op.drop_column("purchase_orders", "requested_approver_id")
