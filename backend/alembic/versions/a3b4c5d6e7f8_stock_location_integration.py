"""Stock-Location Integration: stock_by_location table + location_id on stock_movements

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-03-01 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create stock_by_location table
    op.create_table(
        "stock_by_location",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("on_hand", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint("on_hand >= 0", name="ck_stock_by_location_on_hand_non_negative"),
        sa.UniqueConstraint("product_id", "location_id", name="uq_stock_by_location_product_location"),
    )
    op.create_index("ix_stock_by_location_product", "stock_by_location", ["product_id"])
    op.create_index("ix_stock_by_location_location", "stock_by_location", ["location_id"])

    # 2. Add location_id to stock_movements (nullable — backward compatible)
    op.add_column(
        "stock_movements",
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_stock_movements_location_id", "stock_movements", ["location_id"])


def downgrade() -> None:
    # Remove location_id from stock_movements
    op.drop_index("ix_stock_movements_location_id", table_name="stock_movements")
    op.drop_column("stock_movements", "location_id")

    # Drop stock_by_location table
    op.drop_index("ix_stock_by_location_location", table_name="stock_by_location")
    op.drop_index("ix_stock_by_location_product", table_name="stock_by_location")
    op.drop_table("stock_by_location")
