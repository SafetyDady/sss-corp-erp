"""PR/PO Redesign: PR tables + PO modifications + SERVICE product type

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-03-01 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add SERVICE to product_type_enum
    op.execute("ALTER TYPE product_type_enum ADD VALUE IF NOT EXISTS 'SERVICE'")

    # 2. Create new enums for PR
    pr_status_enum = postgresql.ENUM(
        "DRAFT", "SUBMITTED", "APPROVED", "PO_CREATED", "REJECTED", "CANCELLED",
        name="pr_status_enum", create_type=False,
    )
    pr_status_enum.create(op.get_bind(), checkfirst=True)

    pr_priority_enum = postgresql.ENUM(
        "NORMAL", "URGENT",
        name="pr_priority_enum", create_type=False,
    )
    pr_priority_enum.create(op.get_bind(), checkfirst=True)

    pr_item_type_enum = postgresql.ENUM(
        "GOODS", "SERVICE",
        name="pr_item_type_enum", create_type=False,
    )
    pr_item_type_enum.create(op.get_bind(), checkfirst=True)

    pr_type_enum = postgresql.ENUM(
        "STANDARD", "BLANKET",
        name="pr_type_enum", create_type=False,
    )
    pr_type_enum.create(op.get_bind(), checkfirst=True)

    # 3. Create purchase_requisitions table
    op.create_table(
        "purchase_requisitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pr_number", sa.String(20), nullable=False, index=True),
        sa.Column("pr_type", postgresql.ENUM("STANDARD", "BLANKET", name="pr_type_enum", create_type=False),
                   nullable=False, server_default="STANDARD"),
        sa.Column("cost_center_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("cost_centers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", postgresql.ENUM("DRAFT", "SUBMITTED", "APPROVED", "PO_CREATED",
                   "REJECTED", "CANCELLED", name="pr_status_enum", create_type=False),
                   nullable=False, server_default="DRAFT"),
        sa.Column("priority", postgresql.ENUM("NORMAL", "URGENT", name="pr_priority_enum", create_type=False),
                   nullable=False, server_default="NORMAL"),
        sa.Column("required_date", sa.Date, nullable=False),
        sa.Column("delivery_date", sa.Date, nullable=True),
        sa.Column("validity_start_date", sa.Date, nullable=True),
        sa.Column("validity_end_date", sa.Date, nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("requested_approver_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_reason", sa.Text, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        # OrgMixin
        sa.Column("org_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                   onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "pr_number", name="uq_pr_org_number"),
    )
    op.create_index("ix_pr_org_status", "purchase_requisitions", ["org_id", "status"])

    # 4. Create purchase_requisition_lines table
    op.create_table(
        "purchase_requisition_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pr_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("purchase_requisitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_number", sa.Integer, nullable=False, server_default="1"),
        sa.Column("item_type", postgresql.ENUM("GOODS", "SERVICE", name="pr_item_type_enum", create_type=False),
                   nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit", sa.String(50), nullable=False, server_default="PCS"),
        sa.Column("estimated_unit_cost", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("cost_element_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("cost_elements.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("note", sa.Text, nullable=True),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                   onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_pr_line_qty_positive"),
        sa.CheckConstraint("estimated_unit_cost >= 0", name="ck_pr_line_cost_positive"),
    )
    op.create_index("ix_pr_lines_pr_id", "purchase_requisition_lines", ["pr_id"])

    # 5. Add new columns to purchase_orders (all nullable for backward compat)
    op.add_column("purchase_orders", sa.Column(
        "pr_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("purchase_requisitions.id", ondelete="SET NULL"), nullable=True,
    ))
    op.add_column("purchase_orders", sa.Column(
        "cost_center_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("cost_centers.id", ondelete="SET NULL"), nullable=True,
    ))
    op.create_unique_constraint("uq_po_pr_id", "purchase_orders", ["pr_id"])

    # 6. Add new columns to purchase_order_lines (all nullable for backward compat)
    op.add_column("purchase_order_lines", sa.Column(
        "pr_line_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("purchase_requisition_lines.id", ondelete="SET NULL"), nullable=True,
    ))
    op.add_column("purchase_order_lines", sa.Column(
        "item_type", postgresql.ENUM("GOODS", "SERVICE", name="pr_item_type_enum", create_type=False),
        nullable=False, server_default="GOODS",
    ))
    op.add_column("purchase_order_lines", sa.Column(
        "description", sa.Text, nullable=True,
    ))
    op.add_column("purchase_order_lines", sa.Column(
        "unit", sa.String(50), nullable=False, server_default="PCS",
    ))
    op.add_column("purchase_order_lines", sa.Column(
        "cost_element_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("cost_elements.id", ondelete="SET NULL"), nullable=True,
    ))
    op.add_column("purchase_order_lines", sa.Column(
        "received_by", postgresql.UUID(as_uuid=True), nullable=True,
    ))
    op.add_column("purchase_order_lines", sa.Column(
        "received_at", sa.DateTime(timezone=True), nullable=True,
    ))

    # Make product_id nullable on PO lines (SERVICE lines may not have a product)
    op.alter_column("purchase_order_lines", "product_id", nullable=True)


def downgrade() -> None:
    # Remove PO line columns
    op.drop_column("purchase_order_lines", "received_at")
    op.drop_column("purchase_order_lines", "received_by")
    op.drop_column("purchase_order_lines", "cost_element_id")
    op.drop_column("purchase_order_lines", "unit")
    op.drop_column("purchase_order_lines", "description")
    op.drop_column("purchase_order_lines", "item_type")
    op.drop_column("purchase_order_lines", "pr_line_id")

    # Make product_id NOT NULL again
    op.alter_column("purchase_order_lines", "product_id", nullable=False)

    # Remove PO columns
    op.drop_constraint("uq_po_pr_id", "purchase_orders", type_="unique")
    op.drop_column("purchase_orders", "cost_center_id")
    op.drop_column("purchase_orders", "pr_id")

    # Drop PR tables
    op.drop_index("ix_pr_lines_pr_id", table_name="purchase_requisition_lines")
    op.drop_table("purchase_requisition_lines")
    op.drop_index("ix_pr_org_status", table_name="purchase_requisitions")
    op.drop_table("purchase_requisitions")

    # Drop PR enums
    op.execute("DROP TYPE IF EXISTS pr_type_enum")
    op.execute("DROP TYPE IF EXISTS pr_item_type_enum")
    op.execute("DROP TYPE IF EXISTS pr_priority_enum")
    op.execute("DROP TYPE IF EXISTS pr_status_enum")

    # Note: Cannot remove SERVICE from product_type_enum easily in PG
