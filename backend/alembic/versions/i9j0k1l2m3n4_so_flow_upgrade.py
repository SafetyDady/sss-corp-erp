"""SO flow upgrade: approved_at + rejected_reason

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa

revision = "i9j0k1l2m3n4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_orders",
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "sales_orders",
        sa.Column("rejected_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sales_orders", "rejected_reason")
    op.drop_column("sales_orders", "approved_at")
