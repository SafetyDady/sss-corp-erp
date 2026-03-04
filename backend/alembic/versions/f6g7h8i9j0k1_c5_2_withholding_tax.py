"""C5.2 Withholding Tax — WHTType master + Supplier default + PO WHT fields

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-03-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "f6g7h8i9j0k1"
down_revision = "e5f6g7h8i9j0"
branch_labels = None
depends_on = None

DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"


def _table_exists(conn, table_name: str) -> bool:
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"),
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

    # 1. CREATE TABLE wht_types (idempotent)
    if not _table_exists(conn, "wht_types"):
        op.create_table(
            "wht_types",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("code", sa.String(50), nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("section", sa.String(100), nullable=True, comment="Legal section reference e.g. มาตรา 3 เตรส"),
            sa.Column("rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.UniqueConstraint("org_id", "code", name="uq_wht_type_org_code"),
            sa.CheckConstraint("rate >= 0 AND rate <= 100", name="ck_wht_type_rate_range"),
        )

    # 2. ADD default_wht_type_id on suppliers
    if not _column_exists(conn, "suppliers", "default_wht_type_id"):
        op.add_column(
            "suppliers",
            sa.Column("default_wht_type_id", UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            "fk_supplier_default_wht_type",
            "suppliers",
            "wht_types",
            ["default_wht_type_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # 3. ADD WHT fields on purchase_orders
    if not _column_exists(conn, "purchase_orders", "wht_type_id"):
        op.add_column(
            "purchase_orders",
            sa.Column("wht_type_id", UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            "fk_po_wht_type",
            "purchase_orders",
            "wht_types",
            ["wht_type_id"],
            ["id"],
            ondelete="SET NULL",
        )
    if not _column_exists(conn, "purchase_orders", "wht_rate"):
        op.add_column(
            "purchase_orders",
            sa.Column("wht_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
        )
    if not _column_exists(conn, "purchase_orders", "wht_amount"):
        op.add_column(
            "purchase_orders",
            sa.Column("wht_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        )
    if not _column_exists(conn, "purchase_orders", "net_payment"):
        op.add_column(
            "purchase_orders",
            sa.Column("net_payment", sa.Numeric(12, 2), nullable=False, server_default="0"),
        )

    # 4. Backfill: net_payment = total_amount for existing POs
    conn.execute(
        sa.text("UPDATE purchase_orders SET net_payment = total_amount WHERE net_payment = 0 AND total_amount > 0")
    )

    # 5. ADD CHECK constraints (idempotent)
    for name, table, expr in [
        ("ck_po_wht_rate_range", "purchase_orders", "wht_rate >= 0 AND wht_rate <= 100"),
        ("ck_po_wht_amount_positive", "purchase_orders", "wht_amount >= 0"),
        ("ck_po_net_payment_positive", "purchase_orders", "net_payment >= 0"),
    ]:
        try:
            op.create_check_constraint(name, table, expr)
        except Exception:
            pass  # Already exists

    # 6. Seed default WHT types for DEFAULT_ORG_ID
    conn.execute(sa.text(f"""
        INSERT INTO wht_types (id, org_id, code, name, section, rate, is_active)
        VALUES
            (gen_random_uuid(), '{DEFAULT_ORG_ID}', 'WHT1', 'ค่าขนส่ง 1%', 'มาตรา 3 เตรส (6)', 1.00, true),
            (gen_random_uuid(), '{DEFAULT_ORG_ID}', 'WHT2', 'ค่าโฆษณา 2%', 'มาตรา 3 เตรส (10)', 2.00, true),
            (gen_random_uuid(), '{DEFAULT_ORG_ID}', 'WHT3', 'ค่าบริการ 3%', 'มาตรา 3 เตรส (8)', 3.00, true),
            (gen_random_uuid(), '{DEFAULT_ORG_ID}', 'WHT5', 'ค่าเช่า 5%', 'มาตรา 3 เตรส (5)', 5.00, true)
        ON CONFLICT DO NOTHING
    """))


def downgrade() -> None:
    # Remove CHECK constraints
    op.drop_constraint("ck_po_net_payment_positive", "purchase_orders", type_="check")
    op.drop_constraint("ck_po_wht_amount_positive", "purchase_orders", type_="check")
    op.drop_constraint("ck_po_wht_rate_range", "purchase_orders", type_="check")

    # Remove PO WHT columns
    op.drop_constraint("fk_po_wht_type", "purchase_orders", type_="foreignkey")
    op.drop_column("purchase_orders", "net_payment")
    op.drop_column("purchase_orders", "wht_amount")
    op.drop_column("purchase_orders", "wht_rate")
    op.drop_column("purchase_orders", "wht_type_id")

    # Remove Supplier default_wht_type_id
    op.drop_constraint("fk_supplier_default_wht_type", "suppliers", type_="foreignkey")
    op.drop_column("suppliers", "default_wht_type_id")

    # Drop wht_types table
    op.drop_table("wht_types")
