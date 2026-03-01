"""stock withdrawal slip — header + lines tables

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-03-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create new enums
    withdrawal_type_enum = postgresql.ENUM(
        "WO_CONSUME", "CC_ISSUE",
        name="withdrawal_type_enum", create_type=False,
    )
    withdrawal_type_enum.create(op.get_bind(), checkfirst=True)

    withdrawal_status_enum = postgresql.ENUM(
        "DRAFT", "PENDING", "ISSUED", "CANCELLED",
        name="withdrawal_status_enum", create_type=False,
    )
    withdrawal_status_enum.create(op.get_bind(), checkfirst=True)

    # 2. Create stock_withdrawal_slips table
    op.create_table(
        "stock_withdrawal_slips",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slip_number", sa.String(20), nullable=False, index=True),
        sa.Column("withdrawal_type", postgresql.ENUM(
            "WO_CONSUME", "CC_ISSUE",
            name="withdrawal_type_enum", create_type=False,
        ), nullable=False),
        sa.Column("status", postgresql.ENUM(
            "DRAFT", "PENDING", "ISSUED", "CANCELLED",
            name="withdrawal_status_enum", create_type=False,
        ), nullable=False, server_default="DRAFT"),
        # WO_CONSUME target
        sa.Column("work_order_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("work_orders.id", ondelete="RESTRICT"), nullable=True),
        # CC_ISSUE target
        sa.Column("cost_center_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("cost_centers.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("cost_element_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("cost_elements.id", ondelete="SET NULL"), nullable=True),
        # Tracking
        sa.Column("requested_by", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("issued_by", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("reference", sa.String(255), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        # OrgMixin
        sa.Column("org_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                   onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "slip_number", name="uq_sw_org_number"),
    )
    op.create_index("ix_sw_org_status", "stock_withdrawal_slips", ["org_id", "status"])

    # 3. Create stock_withdrawal_slip_lines table
    op.create_table(
        "stock_withdrawal_slip_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slip_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("stock_withdrawal_slips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_number", sa.Integer, nullable=False, server_default="1"),
        sa.Column("product_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("issued_qty", sa.Integer, nullable=False, server_default="0"),
        sa.Column("location_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("movement_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("stock_movements.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                   onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_sw_line_qty_positive"),
        sa.CheckConstraint("issued_qty >= 0", name="ck_sw_line_issued_qty_non_negative"),
    )
    op.create_index("ix_sw_lines_slip_id", "stock_withdrawal_slip_lines", ["slip_id"])


def downgrade() -> None:
    # Drop tables
    op.drop_index("ix_sw_lines_slip_id", table_name="stock_withdrawal_slip_lines")
    op.drop_table("stock_withdrawal_slip_lines")
    op.drop_index("ix_sw_org_status", table_name="stock_withdrawal_slips")
    op.drop_table("stock_withdrawal_slips")

    # Drop enums
    sa.Enum(name="withdrawal_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="withdrawal_type_enum").drop(op.get_bind(), checkfirst=True)
