"""Add PARTIAL_ISSUED to tool_checkout_slip_status_enum

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-03-06

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "n4o5p6q7r8s9"
down_revision = "m3n4o5p6q7r8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add PARTIAL_ISSUED value to existing enum
    # PostgreSQL 16 supports ADD VALUE IF NOT EXISTS inside transactions
    op.execute(
        "ALTER TYPE tool_checkout_slip_status_enum ADD VALUE IF NOT EXISTS 'PARTIAL_ISSUED'"
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    # Downgrade would require: create new enum without PARTIAL_ISSUED,
    # update rows using PARTIAL_ISSUED → CHECKED_OUT, then swap.
    # For simplicity, we leave the enum value in place on downgrade.
    pass
