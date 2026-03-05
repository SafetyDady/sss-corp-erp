"""C2: Customer Invoice (AR) — customer_invoices + customer_invoice_payments

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-03-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "h8i9j0k1l2m3"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None

# Enum
customer_invoice_status_enum = sa.Enum(
    "DRAFT", "PENDING", "APPROVED", "PAID", "CANCELLED",
    name="customer_invoice_status_enum",
)


def _table_exists(conn, table_name: str) -> bool:
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"),
        {"t": table_name},
    )
    return result.scalar()


def _enum_exists(conn, enum_name: str) -> bool:
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = :n)"),
        {"n": enum_name},
    )
    return result.scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # Create enum (idempotent)
    if not _enum_exists(conn, "customer_invoice_status_enum"):
        customer_invoice_status_enum.create(conn, checkfirst=True)

    # ── customer_invoices ──
    if _table_exists(conn, "customer_invoices"):
        return  # Already created by a previous partial run

    op.create_table(
        "customer_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_number", sa.String(50), nullable=False),
        sa.Column("so_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sales_orders.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("invoice_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("subtotal_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("vat_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("received_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("status", customer_invoice_status_enum, nullable=False, server_default="DRAFT"),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        # Check constraints
        sa.CheckConstraint("subtotal_amount >= 0", name="ck_ci_subtotal_non_negative"),
        sa.CheckConstraint("total_amount >= 0", name="ck_ci_total_non_negative"),
        sa.CheckConstraint("received_amount >= 0", name="ck_ci_received_non_negative"),
        sa.CheckConstraint("vat_rate >= 0 AND vat_rate <= 100", name="ck_ci_vat_rate_range"),
    )

    # Indexes for customer_invoices
    op.create_index("ix_ci_org_status", "customer_invoices", ["org_id", "status"])
    op.create_index("ix_ci_so_id", "customer_invoices", ["so_id"])
    op.create_index("ix_ci_customer_id", "customer_invoices", ["customer_id"])
    op.create_index("ix_ci_due_date", "customer_invoices", ["due_date"])

    # ── customer_invoice_payments ──
    op.create_table(
        "customer_invoice_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customer_invoices.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("payment_date", sa.Date, nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_method", sa.String(50), nullable=True),
        sa.Column("reference", sa.String(100), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("received_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        # Check constraints
        sa.CheckConstraint("amount > 0", name="ck_ci_payment_amount_positive"),
    )

    # Index for payments
    op.create_index("ix_ci_payment_invoice_id", "customer_invoice_payments", ["invoice_id"])


def downgrade() -> None:
    op.drop_table("customer_invoice_payments")
    op.drop_table("customer_invoices")
    customer_invoice_status_enum.drop(op.get_bind(), checkfirst=True)
