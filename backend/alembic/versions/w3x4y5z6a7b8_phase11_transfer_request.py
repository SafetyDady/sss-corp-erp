"""Phase 11.15: Multi-warehouse Transfer Request

Revision ID: w3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Create Date: 2026-03-13

2 new tables: transfer_requests, transfer_request_lines
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "w3x4y5z6a7b8"
down_revision = "v2w3x4y5z6a7"
branch_labels = None
depends_on = None


# ── Idempotent helpers (create_all may have pre-created objects) ──
def _q(conn, sql):
    return conn.execute(sa.text(sql)).scalar() is not None

def _type_ok(conn, n):
    return _q(conn, f"SELECT 1 FROM pg_type WHERE typname='{n}'")

def _table_ok(conn, n):
    return _q(conn, f"SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='{n}'")

def _index_ok(conn, n):
    return _q(conn, f"SELECT 1 FROM pg_indexes WHERE indexname='{n}'")

def _constraint_ok(conn, n):
    return _q(conn, f"SELECT 1 FROM pg_constraint WHERE conname='{n}'")


def upgrade():
    conn = op.get_bind()

    # ── Enum ──
    if not _type_ok(conn, "transfer_request_status_enum"):
        op.execute("CREATE TYPE transfer_request_status_enum AS ENUM ('DRAFT', 'PENDING', 'TRANSFERRED', 'CANCELLED')")
    tf_status = sa.Enum(
        "DRAFT", "PENDING", "TRANSFERRED", "CANCELLED",
        name="transfer_request_status_enum",
        create_type=False,
    )

    # ── transfer_requests ──
    if not _table_ok(conn, "transfer_requests"):
        op.create_table(
            "transfer_requests",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("transfer_number", sa.String(20), nullable=False),
            sa.Column("status", tf_status, nullable=False, server_default="DRAFT"),
            sa.Column("source_warehouse_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("source_location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
            sa.Column("dest_warehouse_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("dest_location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
            sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
            sa.Column("transferred_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("transferred_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("note", sa.Text, nullable=True),
            sa.Column("reference", sa.String(255), nullable=True),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    if not _constraint_ok(conn, "uq_tf_org_number"):
        op.create_unique_constraint("uq_tf_org_number", "transfer_requests", ["org_id", "transfer_number"])
    if not _index_ok(conn, "ix_tf_org_status"):
        op.create_index("ix_tf_org_status", "transfer_requests", ["org_id", "status"])
    if not _index_ok(conn, "ix_tf_transfer_number"):
        op.create_index("ix_tf_transfer_number", "transfer_requests", ["transfer_number"])

    # ── transfer_request_lines ──
    if not _table_ok(conn, "transfer_request_lines"):
        op.create_table(
            "transfer_request_lines",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("transfer_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("transfer_requests.id", ondelete="CASCADE"), nullable=False),
            sa.Column("line_number", sa.Integer, nullable=False, server_default="1"),
            sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("quantity", sa.Integer, nullable=False),
            sa.Column("transferred_qty", sa.Integer, nullable=False, server_default="0"),
            sa.Column("movement_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stock_movements.id", ondelete="SET NULL"), nullable=True),
            sa.Column("note", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    if not _index_ok(conn, "ix_tf_lines_request_id"):
        op.create_index("ix_tf_lines_request_id", "transfer_request_lines", ["transfer_request_id"])
    if not _constraint_ok(conn, "ck_tf_line_qty_positive"):
        op.create_check_constraint("ck_tf_line_qty_positive", "transfer_request_lines", "quantity > 0")
    if not _constraint_ok(conn, "ck_tf_line_transferred_qty_non_neg"):
        op.create_check_constraint("ck_tf_line_transferred_qty_non_neg", "transfer_request_lines", "transferred_qty >= 0")


def downgrade():
    op.drop_table("transfer_request_lines")
    op.drop_table("transfer_requests")
    sa.Enum(name="transfer_request_status_enum").drop(op.get_bind(), checkfirst=True)
