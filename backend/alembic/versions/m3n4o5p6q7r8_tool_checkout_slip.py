"""tool checkout slip — header + lines tables

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-03-06

Changes:
  - New enum: tool_checkout_slip_status_enum (DRAFT, PENDING, CHECKED_OUT, PARTIAL_RETURN, RETURNED, CANCELLED)
  - New table: tool_checkout_slips (multi-line tool checkout header)
  - New table: tool_checkout_slip_lines (individual tool lines with return tracking)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "m3n4o5p6q7r8"
down_revision = "l2m3n4o5p6q7"
branch_labels = None
depends_on = None


# ============================================================
# IDEMPOTENT HELPERS (dev mode: metadata.create_all may run first)
# ============================================================

def _table_exists(table_name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"),
        {"t": table_name},
    )
    return result.scalar()


def _index_exists(index_name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :n)"),
        {"n": index_name},
    )
    return result.scalar()


def upgrade() -> None:
    # 1. Create new enum
    tool_checkout_slip_status_enum = postgresql.ENUM(
        "DRAFT", "PENDING", "CHECKED_OUT", "PARTIAL_RETURN", "RETURNED", "CANCELLED",
        name="tool_checkout_slip_status_enum", create_type=False,
    )
    tool_checkout_slip_status_enum.create(op.get_bind(), checkfirst=True)

    # 2. Create tool_checkout_slips table (header)
    if not _table_exists("tool_checkout_slips"):
        op.create_table(
            "tool_checkout_slips",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("slip_number", sa.String(20), nullable=False, index=True),
            sa.Column("status", postgresql.ENUM(
                "DRAFT", "PENDING", "CHECKED_OUT", "PARTIAL_RETURN", "RETURNED", "CANCELLED",
                name="tool_checkout_slip_status_enum", create_type=False,
            ), nullable=False, server_default="DRAFT"),
            # WO link (1 slip = 1 WO)
            sa.Column("work_order_id", postgresql.UUID(as_uuid=True),
                       sa.ForeignKey("work_orders.id", ondelete="RESTRICT"), nullable=False),
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
            sa.UniqueConstraint("org_id", "slip_number", name="uq_tcs_org_number"),
        )
    if not _index_exists("ix_tcs_org_status"):
        op.create_index("ix_tcs_org_status", "tool_checkout_slips", ["org_id", "status"])

    # 3. Create tool_checkout_slip_lines table
    if not _table_exists("tool_checkout_slip_lines"):
        op.create_table(
            "tool_checkout_slip_lines",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("slip_id", postgresql.UUID(as_uuid=True),
                       sa.ForeignKey("tool_checkout_slips.id", ondelete="CASCADE"), nullable=False),
            sa.Column("line_number", sa.Integer, nullable=False, server_default="1"),
            sa.Column("tool_id", postgresql.UUID(as_uuid=True),
                       sa.ForeignKey("tools.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("employee_id", postgresql.UUID(as_uuid=True),
                       sa.ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False),
            # Link to ToolCheckout record (set on issue)
            sa.Column("checkout_id", postgresql.UUID(as_uuid=True),
                       sa.ForeignKey("tool_checkouts.id", ondelete="SET NULL"), nullable=True),
            # Return tracking
            sa.Column("is_returned", sa.Boolean, nullable=False, server_default="false"),
            sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("returned_by", postgresql.UUID(as_uuid=True), nullable=True),
            # Auto charge (hours x rate_per_hour, set on return)
            sa.Column("charge_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
            sa.Column("note", sa.Text, nullable=True),
            # TimestampMixin
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                       onupdate=sa.func.now(), nullable=False),
            sa.CheckConstraint("charge_amount >= 0", name="ck_tcs_line_charge_non_negative"),
        )
    if not _index_exists("ix_tcs_lines_slip_id"):
        op.create_index("ix_tcs_lines_slip_id", "tool_checkout_slip_lines", ["slip_id"])
    if not _index_exists("ix_tcs_lines_tool_id"):
        op.create_index("ix_tcs_lines_tool_id", "tool_checkout_slip_lines", ["tool_id"])


def downgrade() -> None:
    # Drop tables
    op.drop_index("ix_tcs_lines_tool_id", table_name="tool_checkout_slip_lines")
    op.drop_index("ix_tcs_lines_slip_id", table_name="tool_checkout_slip_lines")
    op.drop_table("tool_checkout_slip_lines")
    op.drop_index("ix_tcs_org_status", table_name="tool_checkout_slips")
    op.drop_table("tool_checkout_slips")

    # Drop enum
    sa.Enum(name="tool_checkout_slip_status_enum").drop(op.get_bind(), checkfirst=True)
