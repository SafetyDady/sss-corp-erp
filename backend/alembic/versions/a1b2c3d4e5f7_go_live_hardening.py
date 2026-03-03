"""Go-Live Gate hardening — additional constraints + indexes

§2: stock_by_bin → UNIQUE(org_id, product_id, bin_id), INDEX(org_id, bin_id)
§3: stock_movements → composite index (org_id, product_id, bin_id, created_at DESC) for ledger queries
§6: purchase_requisitions → INDEX(org_id, sourcer_id) for tenancy filtering
§7: purchase_order_lines → backfill gr_mode default for any NULL rows (shouldn't exist, safety net)

Revision ID: a1b2c3d4e5f7
Revises: f8a9b0c1d2e3
Create Date: 2026-03-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision = "a1b2c3d4e5f7"
down_revision = "f8a9b0c1d2e3"
branch_labels = None
depends_on = None


def _index_exists(connection, index_name: str) -> bool:
    result = connection.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": index_name})
    return result.scalar()


def _constraint_exists(connection, constraint_name: str) -> bool:
    result = connection.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = :c)"
    ), {"c": constraint_name})
    return result.scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # ──────────────────────────────────────────────────────────
    # §2: stock_by_bin — tenant-safe unique + index
    # ──────────────────────────────────────────────────────────
    # Replace (product_id, bin_id) unique with (org_id, product_id, bin_id)
    # The original uq_stock_by_bin_product_bin is still valid, but we add
    # a broader composite for multi-tenant query support
    if not _index_exists(conn, "ix_stock_by_bin_org_product_bin"):
        op.create_index(
            "ix_stock_by_bin_org_product_bin",
            "stock_by_bin",
            ["org_id", "product_id", "bin_id"],
            unique=True,
        )
    if not _index_exists(conn, "ix_stock_by_bin_org_bin"):
        op.create_index(
            "ix_stock_by_bin_org_bin",
            "stock_by_bin",
            ["org_id", "bin_id"],
        )

    # ──────────────────────────────────────────────────────────
    # §3: stock_movements — composite index for bin-level ledger
    # ──────────────────────────────────────────────────────────
    if not _index_exists(conn, "ix_movements_org_product_bin_created"):
        op.create_index(
            "ix_movements_org_product_bin_created",
            "stock_movements",
            ["org_id", "product_id", "bin_id", sa.text("created_at DESC")],
        )

    # Also: composite for location-level queries (already used but no index)
    if not _index_exists(conn, "ix_movements_org_product_location_created"):
        op.create_index(
            "ix_movements_org_product_location_created",
            "stock_movements",
            ["org_id", "product_id", "location_id", sa.text("created_at DESC")],
        )

    # ──────────────────────────────────────────────────────────
    # §6: purchase_requisitions — sourcer_id tenancy index
    # ──────────────────────────────────────────────────────────
    if not _index_exists(conn, "ix_pr_org_sourcer"):
        op.create_index(
            "ix_pr_org_sourcer",
            "purchase_requisitions",
            ["org_id", "sourcer_id"],
        )

    # ──────────────────────────────────────────────────────────
    # §7: Backfill NULL gr_mode rows to STOCK_GR (safety net)
    # ──────────────────────────────────────────────────────────
    op.execute(
        "UPDATE purchase_order_lines SET gr_mode = 'STOCK_GR' WHERE gr_mode IS NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_pr_org_sourcer", table_name="purchase_requisitions")
    op.drop_index("ix_movements_org_product_location_created", table_name="stock_movements")
    op.drop_index("ix_movements_org_product_bin_created", table_name="stock_movements")
    op.drop_index("ix_stock_by_bin_org_bin", table_name="stock_by_bin")
    op.drop_index("ix_stock_by_bin_org_product_bin", table_name="stock_by_bin")
