"""add_master_data_tables

Revision ID: a1b2c3d4e5f6
Revises: 725e6c865a71
Create Date: 2026-02-26 12:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '725e6c865a71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- cost_centers table ---
    op.create_table(
        "cost_centers",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "overhead_rate",
            sa.Numeric(5, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "code", name="uq_cost_center_org_code"),
        sa.CheckConstraint(
            "overhead_rate >= 0 AND overhead_rate <= 100",
            name="ck_cost_center_overhead_rate_range",
        ),
    )

    # --- cost_elements table ---
    op.create_table(
        "cost_elements",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "code", name="uq_cost_element_org_code"),
    )

    # --- ot_types table ---
    op.create_table(
        "ot_types",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "factor",
            sa.Numeric(4, 2),
            nullable=False,
            server_default=sa.text("1.5"),
        ),
        sa.Column(
            "max_ceiling",
            sa.Numeric(4, 2),
            nullable=False,
            server_default=sa.text("3.0"),
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "name", name="uq_ot_type_org_name"),
        sa.CheckConstraint("factor > 0", name="ck_ot_type_factor_positive"),
        sa.CheckConstraint("max_ceiling >= factor", name="ck_ot_type_ceiling_gte_factor"),
    )


def downgrade() -> None:
    op.drop_table("ot_types")
    op.drop_table("cost_elements")
    op.drop_table("cost_centers")
