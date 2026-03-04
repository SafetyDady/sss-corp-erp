"""C5.1 VAT Foundation — OrgTaxConfig + VAT fields on SO + PO

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-03-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "e5f6g7h8i9j0"
down_revision = "d4e5f6g7h8i9"
branch_labels = None
depends_on = None

# Default org ID from config
DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"


def _table_exists(conn, table_name: str) -> bool:
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
        ),
        {"t": table_name},
    )
    return result.scalar()


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c)"
        ),
        {"t": table_name, "c": column_name},
    )
    return result.scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # ─── 1. Create org_tax_configs table ───
    if not _table_exists(conn, "org_tax_configs"):
        op.create_table(
            "org_tax_configs",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "org_id",
                UUID(as_uuid=True),
                sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                unique=True,
                nullable=False,
            ),
            sa.Column("vat_enabled", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column(
                "default_vat_rate",
                sa.Numeric(5, 2),
                nullable=False,
                server_default="7.00",
            ),
            sa.Column("wht_enabled", sa.Boolean(), nullable=False, server_default="false"),
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
            sa.CheckConstraint(
                "default_vat_rate >= 0 AND default_vat_rate <= 100",
                name="ck_org_tax_vat_range",
            ),
        )

    # ─── 2. Add VAT columns to sales_orders ───
    if not _column_exists(conn, "sales_orders", "subtotal_amount"):
        op.add_column(
            "sales_orders",
            sa.Column("subtotal_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        )
    if not _column_exists(conn, "sales_orders", "vat_rate"):
        op.add_column(
            "sales_orders",
            sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
        )
    if not _column_exists(conn, "sales_orders", "vat_amount"):
        op.add_column(
            "sales_orders",
            sa.Column("vat_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        )

    # ─── 3. Add VAT columns to purchase_orders ───
    if not _column_exists(conn, "purchase_orders", "subtotal_amount"):
        op.add_column(
            "purchase_orders",
            sa.Column("subtotal_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        )
    if not _column_exists(conn, "purchase_orders", "vat_rate"):
        op.add_column(
            "purchase_orders",
            sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
        )
    if not _column_exists(conn, "purchase_orders", "vat_amount"):
        op.add_column(
            "purchase_orders",
            sa.Column("vat_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        )

    # ─── 4. Backfill: subtotal_amount = total_amount for existing records ───
    conn.execute(
        sa.text(
            "UPDATE sales_orders SET subtotal_amount = total_amount "
            "WHERE subtotal_amount = 0 AND total_amount > 0"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE purchase_orders SET subtotal_amount = total_amount "
            "WHERE subtotal_amount = 0 AND total_amount > 0"
        )
    )

    # ─── 5. Add CHECK constraints (idempotent: catch if already exists) ───
    for name, table, expr in [
        ("ck_so_subtotal_positive", "sales_orders", "subtotal_amount >= 0"),
        ("ck_so_vat_amount_positive", "sales_orders", "vat_amount >= 0"),
        ("ck_so_vat_rate_range", "sales_orders", "vat_rate >= 0 AND vat_rate <= 100"),
        ("ck_po_subtotal_positive", "purchase_orders", "subtotal_amount >= 0"),
        ("ck_po_vat_amount_positive", "purchase_orders", "vat_amount >= 0"),
        ("ck_po_vat_rate_range", "purchase_orders", "vat_rate >= 0 AND vat_rate <= 100"),
    ]:
        try:
            op.create_check_constraint(name, table, expr)
        except Exception:
            pass  # Already exists

    # ─── 6. Insert default OrgTaxConfig for seed org ───
    import uuid as _uuid

    existing = conn.execute(
        sa.text("SELECT 1 FROM org_tax_configs WHERE org_id = :oid"),
        {"oid": DEFAULT_ORG_ID},
    ).scalar()
    if not existing:
        conn.execute(
            sa.text(
                "INSERT INTO org_tax_configs (id, org_id, vat_enabled, default_vat_rate, wht_enabled) "
                "VALUES (:id, :org_id, true, 7.00, false)"
            ),
            {"id": str(_uuid.uuid4()), "org_id": DEFAULT_ORG_ID},
        )


def downgrade() -> None:
    # Remove CHECK constraints
    for name, table in [
        ("ck_so_subtotal_positive", "sales_orders"),
        ("ck_so_vat_amount_positive", "sales_orders"),
        ("ck_so_vat_rate_range", "sales_orders"),
        ("ck_po_subtotal_positive", "purchase_orders"),
        ("ck_po_vat_amount_positive", "purchase_orders"),
        ("ck_po_vat_rate_range", "purchase_orders"),
    ]:
        try:
            op.drop_constraint(name, table, type_="check")
        except Exception:
            pass

    # Remove VAT columns from purchase_orders
    op.drop_column("purchase_orders", "vat_amount")
    op.drop_column("purchase_orders", "vat_rate")
    op.drop_column("purchase_orders", "subtotal_amount")

    # Remove VAT columns from sales_orders
    op.drop_column("sales_orders", "vat_amount")
    op.drop_column("sales_orders", "vat_rate")
    op.drop_column("sales_orders", "subtotal_amount")

    # Drop org_tax_configs table
    op.drop_table("org_tax_configs")
