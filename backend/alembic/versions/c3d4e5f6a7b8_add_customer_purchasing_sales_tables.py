"""add_customer_purchasing_sales_tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-26 14:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- customers table ---
    op.create_table(
        "customers",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("tax_id", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "code", name="uq_customer_org_code"),
    )

    # --- purchase_orders table ---
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("po_number", sa.String(20), nullable=False, index=True),
        sa.Column("supplier_name", sa.String(255), nullable=False),
        sa.Column(
            "status",
            sa.Enum("DRAFT", "SUBMITTED", "APPROVED", "RECEIVED", "CANCELLED",
                     name="po_status_enum", create_type=True),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("expected_date", sa.Date(), nullable=True),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_by", sa.UUID(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("approved_by", sa.UUID(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "po_number", name="uq_po_org_number"),
        sa.CheckConstraint("total_amount >= 0", name="ck_po_total_positive"),
    )

    # --- purchase_order_lines table ---
    op.create_table(
        "purchase_order_lines",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "po_id", sa.UUID(),
            sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id", sa.UUID(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_cost", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("received_qty", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("quantity > 0", name="ck_po_line_qty_positive"),
        sa.CheckConstraint("unit_cost >= 0", name="ck_po_line_cost_positive"),
        sa.CheckConstraint("received_qty >= 0", name="ck_po_line_received_positive"),
    )
    op.create_index("ix_po_lines_po_id", "purchase_order_lines", ["po_id"])

    # --- sales_orders table ---
    op.create_table(
        "sales_orders",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("so_number", sa.String(20), nullable=False, index=True),
        sa.Column(
            "customer_id", sa.UUID(),
            sa.ForeignKey("customers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("DRAFT", "SUBMITTED", "APPROVED", "INVOICED", "CANCELLED",
                     name="so_status_enum", create_type=True),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_by", sa.UUID(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("approved_by", sa.UUID(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("org_id", sa.UUID(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "so_number", name="uq_so_org_number"),
        sa.CheckConstraint("total_amount >= 0", name="ck_so_total_positive"),
    )

    # --- sales_order_lines table ---
    op.create_table(
        "sales_order_lines",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "so_id", sa.UUID(),
            sa.ForeignKey("sales_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id", sa.UUID(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("quantity > 0", name="ck_so_line_qty_positive"),
        sa.CheckConstraint("unit_price >= 0", name="ck_so_line_price_positive"),
    )
    op.create_index("ix_so_lines_so_id", "sales_order_lines", ["so_id"])


def downgrade() -> None:
    op.drop_table("sales_order_lines")
    op.drop_table("sales_orders")
    op.drop_table("purchase_order_lines")
    op.drop_table("purchase_orders")
    op.drop_table("customers")
    op.execute("DROP TYPE IF EXISTS so_status_enum")
    op.execute("DROP TYPE IF EXISTS po_status_enum")
