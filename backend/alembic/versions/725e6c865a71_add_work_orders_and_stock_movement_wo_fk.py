"""add_work_orders_and_stock_movement_wo_fk

Revision ID: 725e6c865a71
Revises: 9601f4969f76
Create Date: 2026-02-26 08:39:39.732254
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '725e6c865a71'
down_revision: Union[str, None] = '9601f4969f76'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- work_orders table ---
    op.create_table(
        "work_orders",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("wo_number", sa.String(20), nullable=False, index=True),
        sa.Column(
            "status",
            sa.Enum("DRAFT", "OPEN", "CLOSED", name="wo_status_enum", create_type=False),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("customer_name", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cost_center_code", sa.String(50), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "wo_number", name="uq_wo_org_number"),
    )
    op.create_index("ix_work_orders_org_number", "work_orders", ["org_id", "wo_number"])
    op.create_index("ix_work_orders_status", "work_orders", ["status"])

    # --- stock_movements.work_order_id FK ---
    op.add_column("stock_movements", sa.Column("work_order_id", sa.UUID(), nullable=True))
    op.create_index(
        op.f("ix_stock_movements_work_order_id"), "stock_movements", ["work_order_id"], unique=False
    )
    op.create_foreign_key(
        "fk_stock_movements_work_order_id",
        "stock_movements",
        "work_orders",
        ["work_order_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("fk_stock_movements_work_order_id", "stock_movements", type_="foreignkey")
    op.drop_index(op.f("ix_stock_movements_work_order_id"), table_name="stock_movements")
    op.drop_column("stock_movements", "work_order_id")
    op.drop_table("work_orders")
    op.execute("DROP TYPE IF EXISTS wo_status_enum")
