"""Phase 11.12 — Batch/Lot Tracking (MVP)

Add batch_number column on stock_movements + stock_batches table
for optional per-batch inventory tracking.

Revision ID: x4y5z6a7b8c9
Revises: w3x4y5z6a7b8
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "x4y5z6a7b8c9"
down_revision = "w3x4y5z6a7b8"
branch_labels = None
depends_on = None


# ── Idempotent helpers (create_all may have pre-created objects) ──
def _q(conn, sql):
    return conn.execute(sa.text(sql)).scalar() is not None

def _table_ok(conn, n):
    return _q(conn, f"SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='{n}'")

def _column_ok(conn, t, c):
    return _q(conn, f"SELECT 1 FROM information_schema.columns WHERE table_name='{t}' AND column_name='{c}'")

def _index_ok(conn, n):
    return _q(conn, f"SELECT 1 FROM pg_indexes WHERE indexname='{n}'")


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add batch_number column on stock_movements (nullable, optional)
    if not _column_ok(conn, "stock_movements", "batch_number"):
        op.add_column(
            "stock_movements",
            sa.Column("batch_number", sa.String(50), nullable=True),
        )
    if not _index_ok(conn, "ix_stock_movements_batch_number"):
        op.create_index(
            "ix_stock_movements_batch_number",
            "stock_movements",
            ["batch_number"],
            postgresql_where=sa.text("batch_number IS NOT NULL"),
        )

    # 2. Create stock_batches table
    if not _table_ok(conn, "stock_batches"):
        op.create_table(
            "stock_batches",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "product_id",
                UUID(as_uuid=True),
                sa.ForeignKey("products.id", ondelete="RESTRICT"),
                nullable=False,
            ),
            sa.Column(
                "location_id",
                UUID(as_uuid=True),
                sa.ForeignKey("locations.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("batch_number", sa.String(50), nullable=False),
            sa.Column("on_hand", sa.Integer, nullable=False, server_default="0"),
            sa.Column(
                "unit_cost",
                sa.Numeric(12, 2),
                nullable=False,
                server_default="0",
            ),
            sa.Column("received_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("org_id", UUID(as_uuid=True), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                onupdate=sa.func.now(),
                nullable=False,
            ),
            # CHECK constraint: on_hand >= 0
            sa.CheckConstraint("on_hand >= 0", name="ck_stock_batch_on_hand_non_negative"),
        )

    # Partial unique indexes — create if missing
    if not _index_ok(conn, "uq_stock_batch_with_location"):
        op.create_index(
            "uq_stock_batch_with_location",
            "stock_batches",
            ["product_id", "location_id", "batch_number", "org_id"],
            unique=True,
            postgresql_where=sa.text("location_id IS NOT NULL"),
        )
    if not _index_ok(conn, "uq_stock_batch_without_location"):
        op.create_index(
            "uq_stock_batch_without_location",
            "stock_batches",
            ["product_id", "batch_number", "org_id"],
            unique=True,
            postgresql_where=sa.text("location_id IS NULL"),
        )

    # Query indexes
    if not _index_ok(conn, "ix_stock_batches_product_id"):
        op.create_index(
            "ix_stock_batches_product_id",
            "stock_batches",
            ["product_id"],
        )
    if not _index_ok(conn, "ix_stock_batches_org_product"):
        op.create_index(
            "ix_stock_batches_org_product",
            "stock_batches",
            ["org_id", "product_id"],
        )
    if not _index_ok(conn, "ix_stock_batches_batch_number"):
        op.create_index(
            "ix_stock_batches_batch_number",
            "stock_batches",
            ["batch_number"],
        )


def downgrade() -> None:
    # Drop stock_batches indexes
    op.drop_index("ix_stock_batches_batch_number", table_name="stock_batches")
    op.drop_index("ix_stock_batches_org_product", table_name="stock_batches")
    op.drop_index("ix_stock_batches_product_id", table_name="stock_batches")
    op.drop_index("uq_stock_batch_without_location", table_name="stock_batches")
    op.drop_index("uq_stock_batch_with_location", table_name="stock_batches")

    # Drop stock_batches table
    op.drop_table("stock_batches")

    # Drop batch_number from stock_movements
    op.drop_index("ix_stock_movements_batch_number", table_name="stock_movements")
    op.drop_column("stock_movements", "batch_number")
