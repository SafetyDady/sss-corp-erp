"""add_warehouse_and_location_tables

Revision ID: 9601f4969f76
Revises: 8e4d5f2d2bad
Create Date: 2026-02-26 08:26:55.846456
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '9601f4969f76'
down_revision: Union[str, None] = '8e4d5f2d2bad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "warehouses",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "code", name="uq_warehouse_org_code"),
    )
    op.create_index("ix_warehouses_org_code", "warehouses", ["org_id", "code"])

    op.create_table(
        "locations",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "warehouse_id",
            sa.UUID(),
            sa.ForeignKey("warehouses.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("code", sa.String(50), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("zone_type", sa.String(50), nullable=False, server_default="GENERAL"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("warehouse_id", "code", name="uq_location_warehouse_code"),
        sa.UniqueConstraint("warehouse_id", "zone_type", name="uq_location_warehouse_zone_type"),
    )
    op.create_index("ix_locations_warehouse_code", "locations", ["warehouse_id", "code"])


def downgrade() -> None:
    op.drop_table("locations")
    op.drop_table("warehouses")
