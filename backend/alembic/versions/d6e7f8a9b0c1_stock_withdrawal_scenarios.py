"""stock withdrawal scenarios — RETURN type + cost_center_id + cost_element_id + to_location_id

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-03-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add RETURN to movement_type_enum (must be outside transaction for PG)
    op.execute("ALTER TYPE movement_type_enum ADD VALUE IF NOT EXISTS 'RETURN'")

    # 2. Add cost_center_id FK on stock_movements
    op.add_column(
        "stock_movements",
        sa.Column("cost_center_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_stock_movements_cost_center_id",
        "stock_movements",
        "cost_centers",
        ["cost_center_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_stock_movements_cost_center_id",
        "stock_movements",
        ["cost_center_id"],
    )

    # 3. Add cost_element_id FK on stock_movements
    op.add_column(
        "stock_movements",
        sa.Column("cost_element_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_stock_movements_cost_element_id",
        "stock_movements",
        "cost_elements",
        ["cost_element_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 4. Add to_location_id FK on stock_movements
    op.add_column(
        "stock_movements",
        sa.Column("to_location_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_stock_movements_to_location_id",
        "stock_movements",
        "locations",
        ["to_location_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_stock_movements_to_location_id",
        "stock_movements",
        ["to_location_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_stock_movements_to_location_id", table_name="stock_movements")
    op.drop_constraint("fk_stock_movements_to_location_id", "stock_movements", type_="foreignkey")
    op.drop_column("stock_movements", "to_location_id")

    op.drop_constraint("fk_stock_movements_cost_element_id", "stock_movements", type_="foreignkey")
    op.drop_column("stock_movements", "cost_element_id")

    op.drop_index("ix_stock_movements_cost_center_id", table_name="stock_movements")
    op.drop_constraint("fk_stock_movements_cost_center_id", "stock_movements", type_="foreignkey")
    op.drop_column("stock_movements", "cost_center_id")

    # NOTE: Cannot remove enum value in PG — RETURN stays in type
