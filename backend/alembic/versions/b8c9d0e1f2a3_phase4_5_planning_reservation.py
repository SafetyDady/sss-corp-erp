"""Phase 4.5: WO Planning & Reservation

WO Master Plans, Daily Plans (workers/tools/materials),
Material Reservations, Tool Reservations.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-02-27 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enum types ──────────────────────────────────────────────────────
    plan_line_type_enum = sa.Enum(
        "MANPOWER", "MATERIAL", "TOOL",
        name="plan_line_type_enum",
    )
    plan_line_type_enum.create(op.get_bind(), checkfirst=True)

    reservation_status_enum = sa.Enum(
        "RESERVED", "FULFILLED", "CANCELLED",
        name="reservation_status_enum",
    )
    reservation_status_enum.create(op.get_bind(), checkfirst=True)

    tool_reservation_status_enum = sa.Enum(
        "RESERVED", "CHECKED_OUT", "RETURNED", "CANCELLED",
        name="tool_reservation_status_enum",
    )
    tool_reservation_status_enum.create(op.get_bind(), checkfirst=True)

    # ── 1. wo_master_plans ──────────────────────────────────────────────
    op.create_table(
        "wo_master_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "work_order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("work_orders.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("planned_start", sa.Date, nullable=False),
        sa.Column("planned_end", sa.Date, nullable=False),
        sa.Column(
            "total_manhours",
            sa.Numeric(8, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("note", sa.Text, nullable=True),
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
            "planned_end >= planned_start",
            name="ck_wo_master_plan_dates",
        ),
        sa.CheckConstraint(
            "total_manhours >= 0",
            name="ck_wo_master_plan_manhours_positive",
        ),
    )

    # ── 2. wo_master_plan_lines ─────────────────────────────────────────
    op.create_table(
        "wo_master_plan_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "plan_id",
            UUID(as_uuid=True),
            sa.ForeignKey("wo_master_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("line_type", plan_line_type_enum, nullable=False),
        sa.Column("employee_count", sa.Integer, nullable=True),
        sa.Column("skill_description", sa.String(255), nullable=True),
        sa.Column("estimated_hours", sa.Numeric(8, 2), nullable=True),
        sa.Column(
            "product_id",
            UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("quantity", sa.Integer, nullable=True),
        sa.Column(
            "tool_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tools.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("estimated_days", sa.Integer, nullable=True),
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
    )

    op.create_index(
        "ix_wo_master_plan_lines_plan_id",
        "wo_master_plan_lines",
        ["plan_id"],
    )

    # ── 3. daily_plans ──────────────────────────────────────────────────
    op.create_table(
        "daily_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plan_date", sa.Date, nullable=False),
        sa.Column(
            "work_order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("work_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("note", sa.Text, nullable=True),
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
        sa.UniqueConstraint(
            "org_id", "plan_date", "work_order_id",
            name="uq_daily_plan_org_date_wo",
        ),
    )

    op.create_index(
        "ix_daily_plans_plan_date",
        "daily_plans",
        ["plan_date"],
    )
    op.create_index(
        "ix_daily_plans_work_order_id",
        "daily_plans",
        ["work_order_id"],
    )

    # ── 4. daily_plan_workers ───────────────────────────────────────────
    op.create_table(
        "daily_plan_workers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "daily_plan_id",
            UUID(as_uuid=True),
            sa.ForeignKey("daily_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "employee_id",
            UUID(as_uuid=True),
            sa.ForeignKey("employees.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "planned_hours",
            sa.Numeric(4, 2),
            nullable=False,
            server_default="8.00",
        ),
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
            "planned_hours > 0",
            name="ck_daily_plan_worker_hours_positive",
        ),
    )

    op.create_index(
        "ix_daily_plan_workers_daily_plan_id",
        "daily_plan_workers",
        ["daily_plan_id"],
    )

    # ── 5. daily_plan_tools ─────────────────────────────────────────────
    op.create_table(
        "daily_plan_tools",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "daily_plan_id",
            UUID(as_uuid=True),
            sa.ForeignKey("daily_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tool_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tools.id", ondelete="CASCADE"),
            nullable=False,
        ),
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
    )

    op.create_index(
        "ix_daily_plan_tools_daily_plan_id",
        "daily_plan_tools",
        ["daily_plan_id"],
    )

    # ── 6. daily_plan_materials ─────────────────────────────────────────
    op.create_table(
        "daily_plan_materials",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "daily_plan_id",
            UUID(as_uuid=True),
            sa.ForeignKey("daily_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("planned_qty", sa.Integer, nullable=False),
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
            "planned_qty > 0",
            name="ck_daily_plan_material_qty_positive",
        ),
    )

    op.create_index(
        "ix_daily_plan_materials_daily_plan_id",
        "daily_plan_materials",
        ["daily_plan_id"],
    )

    # ── 7. material_reservations ────────────────────────────────────────
    op.create_table(
        "material_reservations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "work_order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("work_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("reserved_date", sa.Date, nullable=False),
        sa.Column(
            "reserved_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "status",
            reservation_status_enum,
            nullable=False,
            server_default="RESERVED",
        ),
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
            "quantity > 0",
            name="ck_material_reservation_qty_positive",
        ),
    )

    op.create_index(
        "ix_material_reservations_work_order_id",
        "material_reservations",
        ["work_order_id"],
    )
    op.create_index(
        "ix_material_reservations_product_id",
        "material_reservations",
        ["product_id"],
    )

    # ── 8. tool_reservations ────────────────────────────────────────────
    op.create_table(
        "tool_reservations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "work_order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("work_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tool_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tools.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column(
            "reserved_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "status",
            tool_reservation_status_enum,
            nullable=False,
            server_default="RESERVED",
        ),
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
            "end_date >= start_date",
            name="ck_tool_reservation_dates",
        ),
    )

    op.create_index(
        "ix_tool_reservations_work_order_id",
        "tool_reservations",
        ["work_order_id"],
    )
    op.create_index(
        "ix_tool_reservations_tool_id",
        "tool_reservations",
        ["tool_id"],
    )


def downgrade() -> None:
    # ── Drop tables in reverse order ────────────────────────────────────
    op.drop_index("ix_tool_reservations_tool_id", table_name="tool_reservations")
    op.drop_index("ix_tool_reservations_work_order_id", table_name="tool_reservations")
    op.drop_table("tool_reservations")

    op.drop_index("ix_material_reservations_product_id", table_name="material_reservations")
    op.drop_index("ix_material_reservations_work_order_id", table_name="material_reservations")
    op.drop_table("material_reservations")

    op.drop_index("ix_daily_plan_materials_daily_plan_id", table_name="daily_plan_materials")
    op.drop_table("daily_plan_materials")

    op.drop_index("ix_daily_plan_tools_daily_plan_id", table_name="daily_plan_tools")
    op.drop_table("daily_plan_tools")

    op.drop_index("ix_daily_plan_workers_daily_plan_id", table_name="daily_plan_workers")
    op.drop_table("daily_plan_workers")

    op.drop_index("ix_daily_plans_work_order_id", table_name="daily_plans")
    op.drop_index("ix_daily_plans_plan_date", table_name="daily_plans")
    op.drop_table("daily_plans")

    op.drop_index("ix_wo_master_plan_lines_plan_id", table_name="wo_master_plan_lines")
    op.drop_table("wo_master_plan_lines")

    op.drop_table("wo_master_plans")

    # ── Drop enum types ─────────────────────────────────────────────────
    sa.Enum(name="tool_reservation_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="reservation_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="plan_line_type_enum").drop(op.get_bind(), checkfirst=True)
