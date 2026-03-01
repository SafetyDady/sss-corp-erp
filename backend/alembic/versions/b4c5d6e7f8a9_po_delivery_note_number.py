"""Add delivery_note_number to purchase_orders

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "purchase_orders",
        sa.Column("delivery_note_number", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("purchase_orders", "delivery_note_number")
