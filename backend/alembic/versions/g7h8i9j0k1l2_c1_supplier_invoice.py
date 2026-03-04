"""C1: Supplier Invoice + Payment (AP Module)

New tables:
  - supplier_invoices: Supplier invoice linked to PO (after GR)
  - invoice_payments: Payment records against invoices

New enum:
  - invoice_status_enum: DRAFT / PENDING / APPROVED / PAID / CANCELLED

Business Rules: BR#113-120

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-03-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision = "g7h8i9j0k1l2"
down_revision = "f6g7h8i9j0k1"
branch_labels = None
depends_on = None


def _table_exists(conn, table_name: str) -> bool:
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"),
        {"t": table_name},
    )
    return result.scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Create invoice_status_enum ──
    invoice_status = sa.Enum(
        "DRAFT", "PENDING", "APPROVED", "PAID", "CANCELLED",
        name="invoice_status_enum",
    )
    invoice_status.create(conn, checkfirst=True)

    # ── 2. Create supplier_invoices table ──
    if not _table_exists(conn, "supplier_invoices"):
        op.create_table(
            "supplier_invoices",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("invoice_number", sa.String(50), nullable=False),
            sa.Column("po_id", UUID(as_uuid=True), sa.ForeignKey("purchase_orders.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("supplier_id", UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True),
            sa.Column("invoice_date", sa.Date, nullable=False),
            sa.Column("due_date", sa.Date, nullable=False),
            sa.Column("subtotal_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
            sa.Column("vat_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("wht_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
            sa.Column("wht_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("net_payment", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("paid_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("status", sa.Enum("DRAFT", "PENDING", "APPROVED", "PAID", "CANCELLED", name="invoice_status_enum", create_type=False), nullable=False, server_default="DRAFT"),
            sa.Column("cost_center_id", UUID(as_uuid=True), sa.ForeignKey("cost_centers.id", ondelete="SET NULL"), nullable=True),
            sa.Column("note", sa.Text, nullable=True),
            sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("approved_by", UUID(as_uuid=True), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

        # Check constraints
        op.create_check_constraint("ck_invoice_subtotal_non_negative", "supplier_invoices", "subtotal_amount >= 0")
        op.create_check_constraint("ck_invoice_total_non_negative", "supplier_invoices", "total_amount >= 0")
        op.create_check_constraint("ck_invoice_net_payment_non_negative", "supplier_invoices", "net_payment >= 0")
        op.create_check_constraint("ck_invoice_paid_non_negative", "supplier_invoices", "paid_amount >= 0")
        op.create_check_constraint("ck_invoice_wht_rate_range", "supplier_invoices", "wht_rate >= 0 AND wht_rate <= 100")
        op.create_check_constraint("ck_invoice_vat_rate_range", "supplier_invoices", "vat_rate >= 0 AND vat_rate <= 100")

        # Indexes
        op.create_index("ix_invoice_org_status", "supplier_invoices", ["org_id", "status"])
        op.create_index("ix_invoice_po_id", "supplier_invoices", ["po_id"])
        op.create_index("ix_invoice_supplier_id", "supplier_invoices", ["supplier_id"])
        op.create_index("ix_invoice_due_date", "supplier_invoices", ["due_date"])

    # ── 3. Create invoice_payments table ──
    if not _table_exists(conn, "invoice_payments"):
        op.create_table(
            "invoice_payments",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("supplier_invoices.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("payment_date", sa.Date, nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("wht_deducted", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("payment_method", sa.String(50), nullable=True),
            sa.Column("reference", sa.String(100), nullable=True),
            sa.Column("note", sa.Text, nullable=True),
            sa.Column("paid_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

        # Check constraints
        op.create_check_constraint("ck_payment_amount_positive", "invoice_payments", "amount > 0")
        op.create_check_constraint("ck_payment_wht_non_negative", "invoice_payments", "wht_deducted >= 0")

        # Indexes
        op.create_index("ix_payment_invoice_id", "invoice_payments", ["invoice_id"])


def downgrade() -> None:
    op.drop_table("invoice_payments")
    op.drop_table("supplier_invoices")
    sa.Enum(name="invoice_status_enum").drop(op.get_bind(), checkfirst=True)
