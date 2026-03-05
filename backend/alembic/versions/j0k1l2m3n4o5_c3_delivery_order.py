"""C3: Delivery Order tables + AR do_id

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def _enum_exists(name: str) -> bool:
    """Check if a PostgreSQL enum type exists (async-safe)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_type WHERE typname = :name"),
        {"name": name},
    )
    return result.scalar() is not None


def _table_exists(name: str) -> bool:
    """Check if a table exists (async-safe)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :name AND table_schema = 'public'"
        ),
        {"name": name},
    )
    return result.scalar() is not None


def upgrade() -> None:
    # --- DO status enum (idempotent) ---
    if not _enum_exists("do_status_enum"):
        sa.Enum("DRAFT", "SHIPPED", "CANCELLED", name="do_status_enum").create(op.get_bind())

    # --- delivery_orders (idempotent) ---
    if _table_exists("delivery_orders"):
        # Tables already created (e.g. by SQLAlchemy metadata auto-create)
        # Just add the do_id column to customer_invoices if missing
        conn = op.get_bind()
        result = conn.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'customer_invoices' AND column_name = 'do_id'"
            )
        )
        if not result.scalar():
            op.add_column(
                "customer_invoices",
                sa.Column(
                    "do_id",
                    UUID(as_uuid=True),
                    sa.ForeignKey("delivery_orders.id", ondelete="SET NULL"),
                    nullable=True,
                ),
            )
            op.create_index("ix_ci_do_id", "customer_invoices", ["do_id"])
        return

    op.create_table(
        "delivery_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False),
        sa.Column("do_number", sa.String(20), nullable=False),
        sa.Column(
            "so_id",
            UUID(as_uuid=True),
            sa.ForeignKey("sales_orders.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "customer_id",
            UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("delivery_date", sa.Date, nullable=False),
        sa.Column("shipping_address", sa.Text, nullable=True),
        sa.Column("shipping_method", sa.String(100), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "status",
            do_status_enum,
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("shipped_by", UUID(as_uuid=True), nullable=True),
        sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        # Constraints
        sa.UniqueConstraint("org_id", "do_number", name="uq_do_org_number"),
    )
    op.create_index("ix_do_org_status", "delivery_orders", ["org_id", "status"])
    op.create_index("ix_do_so_id", "delivery_orders", ["so_id"])
    op.create_index("ix_do_customer_id", "delivery_orders", ["customer_id"])

    # --- delivery_order_lines ---
    op.create_table(
        "delivery_order_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "do_id",
            UUID(as_uuid=True),
            sa.ForeignKey("delivery_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "so_line_id",
            UUID(as_uuid=True),
            sa.ForeignKey("sales_order_lines.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "product_id",
            UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("line_number", sa.Integer, nullable=False),
        sa.Column("ordered_qty", sa.Integer, nullable=False),
        sa.Column("shipped_qty", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "location_id",
            UUID(as_uuid=True),
            sa.ForeignKey("locations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "movement_id",
            UUID(as_uuid=True),
            sa.ForeignKey("stock_movements.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        # Constraints
        sa.CheckConstraint("ordered_qty > 0", name="ck_do_line_ordered_qty_positive"),
        sa.CheckConstraint("shipped_qty >= 0", name="ck_do_line_shipped_qty_non_negative"),
    )
    op.create_index("ix_do_lines_do_id", "delivery_order_lines", ["do_id"])

    # --- ALTER customer_invoices: add do_id FK ---
    op.add_column(
        "customer_invoices",
        sa.Column(
            "do_id",
            UUID(as_uuid=True),
            sa.ForeignKey("delivery_orders.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_ci_do_id", "customer_invoices", ["do_id"])


def downgrade() -> None:
    op.drop_index("ix_ci_do_id", table_name="customer_invoices")
    op.drop_column("customer_invoices", "do_id")
    op.drop_index("ix_do_lines_do_id", table_name="delivery_order_lines")
    op.drop_table("delivery_order_lines")
    op.drop_index("ix_do_customer_id", table_name="delivery_orders")
    op.drop_index("ix_do_so_id", table_name="delivery_orders")
    op.drop_index("ix_do_org_status", table_name="delivery_orders")
    op.drop_table("delivery_orders")
    sa.Enum(name="do_status_enum").drop(op.get_bind(), checkfirst=True)
