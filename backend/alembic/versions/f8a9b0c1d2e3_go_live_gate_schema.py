"""Go-Live Gate schema — single migration for G1-G5

G1: SPAREPART + FINISHED_GOODS product types, PRODUCE movement type, product.model field
G2: Bin table (3-level warehouse: Warehouse → Location → Bin) + stock_by_bin
G3: Direct PO Cost — work_order_id + cost_center_id on PO lines
G4: Sourcer Tracking — sourcer_id FK on PR
G5: GR 2 Modes — gr_mode enum on PO lines
+ composite indexes (org_id, status)

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-03-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision = "f8a9b0c1d2e3"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def _table_exists(connection, table_name: str) -> bool:
    result = connection.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": table_name})
    return result.scalar()


def _column_exists(connection, table_name: str, column_name: str) -> bool:
    result = connection.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c)"
    ), {"t": table_name, "c": column_name})
    return result.scalar()


def _index_exists(connection, index_name: str) -> bool:
    result = connection.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": index_name})
    return result.scalar()


def _type_exists(connection, type_name: str) -> bool:
    result = connection.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = :t)"
    ), {"t": type_name})
    return result.scalar()


def upgrade() -> None:
    # ──────────────────────────────────────────────────────────
    # 1. Enum alterations (must run outside transaction)
    # ──────────────────────────────────────────────────────────
    # PostgreSQL: ALTER TYPE ADD VALUE cannot be inside a transaction
    op.execute("COMMIT")

    # G1: Add SPAREPART + FINISHED_GOODS to product_type_enum
    op.execute("ALTER TYPE product_type_enum ADD VALUE IF NOT EXISTS 'SPAREPART'")
    op.execute("ALTER TYPE product_type_enum ADD VALUE IF NOT EXISTS 'FINISHED_GOODS'")

    # G1: Add PRODUCE to movement_type_enum
    op.execute("ALTER TYPE movement_type_enum ADD VALUE IF NOT EXISTS 'PRODUCE'")

    # G5: Create gr_mode enum (idempotent)
    op.execute("DO $$ BEGIN CREATE TYPE gr_mode_enum AS ENUM ('STOCK_GR', 'DIRECT_GR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$")

    # Resume transaction for remaining DDL
    op.execute("BEGIN")

    # Get connection for existence checks
    conn = op.get_bind()

    # ──────────────────────────────────────────────────────────
    # 2. Product table — add model field (G1)
    # ──────────────────────────────────────────────────────────
    if not _column_exists(conn, "products", "model"):
        op.add_column("products", sa.Column("model", sa.String(255), nullable=True))
    if not _index_exists(conn, "ix_products_model"):
        op.create_index("ix_products_model", "products", ["model"])

    # ──────────────────────────────────────────────────────────
    # 3. Bins table — 3rd level warehouse hierarchy (G2)
    # ──────────────────────────────────────────────────────────
    if not _table_exists(conn, "bins"):
        op.create_table(
            "bins",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("code", sa.String(50), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.UniqueConstraint("location_id", "code", name="uq_bin_location_code"),
            sa.Index("ix_bins_org_location", "org_id", "location_id"),
        )

    # Stock by Bin tracking (G2)
    if not _table_exists(conn, "stock_by_bin"):
        op.create_table(
            "stock_by_bin",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("bin_id", UUID(as_uuid=True), sa.ForeignKey("bins.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("on_hand", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.CheckConstraint("on_hand >= 0", name="ck_stock_by_bin_on_hand_non_negative"),
            sa.UniqueConstraint("product_id", "bin_id", name="uq_stock_by_bin_product_bin"),
            sa.Index("ix_stock_by_bin_product", "product_id"),
            sa.Index("ix_stock_by_bin_bin", "bin_id"),
        )

    # ──────────────────────────────────────────────────────────
    # 4. StockMovement — add bin_id FK (G2)
    # ──────────────────────────────────────────────────────────
    if not _column_exists(conn, "stock_movements", "bin_id"):
        op.add_column(
            "stock_movements",
            sa.Column("bin_id", UUID(as_uuid=True), sa.ForeignKey("bins.id", ondelete="SET NULL"), nullable=True),
        )
    if not _index_exists(conn, "ix_movements_bin_id"):
        op.create_index("ix_movements_bin_id", "stock_movements", ["bin_id"])

    # ──────────────────────────────────────────────────────────
    # 5. PurchaseRequisition — add sourcer_id FK (G4)
    # ──────────────────────────────────────────────────────────
    if not _column_exists(conn, "purchase_requisitions", "sourcer_id"):
        op.add_column(
            "purchase_requisitions",
            sa.Column("sourcer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        )

    # ──────────────────────────────────────────────────────────
    # 6. PurchaseOrderLine — add gr_mode + direct cost fields (G3, G5)
    # ──────────────────────────────────────────────────────────
    if not _column_exists(conn, "purchase_order_lines", "gr_mode"):
        op.add_column(
            "purchase_order_lines",
            sa.Column(
                "gr_mode",
                sa.Enum("STOCK_GR", "DIRECT_GR", name="gr_mode_enum", create_type=False),
                nullable=False,
                server_default="STOCK_GR",
            ),
        )
    if not _column_exists(conn, "purchase_order_lines", "work_order_id"):
        op.add_column(
            "purchase_order_lines",
            sa.Column("work_order_id", UUID(as_uuid=True), sa.ForeignKey("work_orders.id", ondelete="SET NULL"), nullable=True),
        )
    if not _column_exists(conn, "purchase_order_lines", "direct_cost_center_id"):
        op.add_column(
            "purchase_order_lines",
            sa.Column("direct_cost_center_id", UUID(as_uuid=True), sa.ForeignKey("cost_centers.id", ondelete="SET NULL"), nullable=True),
        )

    # ──────────────────────────────────────────────────────────
    # 7. Composite indexes (org_id, status) — performance
    # ──────────────────────────────────────────────────────────
    if not _index_exists(conn, "ix_work_orders_org_status"):
        op.create_index("ix_work_orders_org_status", "work_orders", ["org_id", "status"])
    if not _index_exists(conn, "ix_purchase_orders_org_status"):
        op.create_index("ix_purchase_orders_org_status", "purchase_orders", ["org_id", "status"])
    # PR already has ix_pr_org_status, SW already has ix_sw_org_status


def downgrade() -> None:
    # Indexes
    op.drop_index("ix_purchase_orders_org_status", table_name="purchase_orders")
    op.drop_index("ix_work_orders_org_status", table_name="work_orders")

    # PO line columns
    op.drop_column("purchase_order_lines", "direct_cost_center_id")
    op.drop_column("purchase_order_lines", "work_order_id")
    op.drop_column("purchase_order_lines", "gr_mode")

    # PR sourcer
    op.drop_column("purchase_requisitions", "sourcer_id")

    # StockMovement bin_id
    op.drop_index("ix_movements_bin_id", table_name="stock_movements")
    op.drop_column("stock_movements", "bin_id")

    # Drop tables
    op.drop_table("stock_by_bin")
    op.drop_table("bins")

    # Product model field
    op.drop_index("ix_products_model", table_name="products")
    op.drop_column("products", "model")

    # Drop gr_mode enum
    op.execute("DROP TYPE IF EXISTS gr_mode_enum")

    # Note: Cannot remove enum values in PostgreSQL (SPAREPART, FINISHED_GOODS, PRODUCE)
    # These are additive-only changes
