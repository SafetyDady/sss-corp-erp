"""Phase 11.14: Stock Take (Cycle Count)

Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
Create Date: 2026-03-11

2 new tables: stock_takes, stock_take_lines
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "u1v2w3x4y5z6"
down_revision = "t0u1v2w3x4y5"
branch_labels = None
depends_on = None


def upgrade():
    # Enum — use raw SQL to handle asyncpg checkfirst limitation
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE stocktake_status_enum AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)
    stocktake_status = sa.Enum(
        "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED",
        name="stocktake_status_enum",
        create_type=False,
    )

    # stock_takes
    op.create_table(
        "stock_takes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stocktake_number", sa.String(20), nullable=False),
        sa.Column("status", stocktake_status, nullable=False, server_default="DRAFT"),
        sa.Column("warehouse_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("counted_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("reference", sa.String(255), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_reason", sa.Text, nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_st_org_number", "stock_takes", ["org_id", "stocktake_number"])
    op.create_index("ix_st_org_status", "stock_takes", ["org_id", "status"])
    op.create_index("ix_st_stocktake_number", "stock_takes", ["stocktake_number"])

    # stock_take_lines
    op.create_table(
        "stock_take_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("stocktake_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stock_takes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_number", sa.Integer, nullable=False, server_default="1"),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("system_qty", sa.Integer, nullable=False, server_default="0"),
        sa.Column("counted_qty", sa.Integer, nullable=True),
        sa.Column("unit_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("movement_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stock_movements.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_st_lines_stocktake_id", "stock_take_lines", ["stocktake_id"])
    op.create_check_constraint("ck_st_line_system_qty_non_neg", "stock_take_lines", "system_qty >= 0")


def downgrade():
    op.drop_table("stock_take_lines")
    op.drop_table("stock_takes")
    sa.Enum(name="stocktake_status_enum").drop(op.get_bind(), checkfirst=True)
