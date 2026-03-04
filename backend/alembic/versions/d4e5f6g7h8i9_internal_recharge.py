"""C9: Internal Recharge — Fixed Recharge Budget + Monthly Entries

New tables:
  - fixed_recharge_budgets: Annual overhead budget per source Cost Center
  - fixed_recharge_entries: Monthly generated allocation per target department

New enum:
  - recharge_status_enum: DRAFT / ACTIVE / CLOSED

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-03-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision = "d4e5f6g7h8i9"
down_revision = "c3d4e5f6g7h8"
branch_labels = None
depends_on = None


def _table_exists(connection, table_name: str) -> bool:
    result = connection.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": table_name})
    return result.scalar()


def _type_exists(connection, type_name: str) -> bool:
    result = connection.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = :t)"
    ), {"t": type_name})
    return result.scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # ──────────────────────────────────────────────────────────
    # 1. Enum: recharge_status_enum
    # ──────────────────────────────────────────────────────────
    if not _type_exists(conn, "recharge_status_enum"):
        op.execute("COMMIT")
        op.execute(
            "DO $$ BEGIN "
            "CREATE TYPE recharge_status_enum AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED'); "
            "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
        )
        op.execute("BEGIN")
        conn = op.get_bind()

    # ──────────────────────────────────────────────────────────
    # 2. Table: fixed_recharge_budgets
    # ──────────────────────────────────────────────────────────
    if not _table_exists(conn, "fixed_recharge_budgets"):
        op.create_table(
            "fixed_recharge_budgets",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", UUID(as_uuid=True),
                       sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("fiscal_year", sa.Integer(), nullable=False),
            sa.Column("source_cost_center_id", UUID(as_uuid=True),
                       sa.ForeignKey("cost_centers.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("annual_budget", sa.Numeric(14, 2), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("status",
                       sa.Enum("DRAFT", "ACTIVE", "CLOSED", name="recharge_status_enum", create_type=False),
                       nullable=False, server_default="DRAFT"),
            sa.Column("created_by", UUID(as_uuid=True),
                       sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                       onupdate=sa.func.now(), nullable=False),
            # Constraints
            sa.UniqueConstraint("org_id", "fiscal_year", "source_cost_center_id",
                                 name="uq_fixed_recharge_org_year_cc"),
            sa.CheckConstraint("annual_budget >= 0", name="ck_recharge_budget_non_negative"),
            sa.CheckConstraint("fiscal_year >= 2020 AND fiscal_year <= 2100",
                                name="ck_recharge_year_range"),
            # Indexes
            sa.Index("ix_recharge_budget_org_year", "org_id", "fiscal_year"),
        )

    # ──────────────────────────────────────────────────────────
    # 3. Table: fixed_recharge_entries
    # ──────────────────────────────────────────────────────────
    if not _table_exists(conn, "fixed_recharge_entries"):
        op.create_table(
            "fixed_recharge_entries",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", UUID(as_uuid=True),
                       sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("budget_id", UUID(as_uuid=True),
                       sa.ForeignKey("fixed_recharge_budgets.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("period_year", sa.Integer(), nullable=False),
            sa.Column("period_month", sa.Integer(), nullable=False),
            sa.Column("source_cost_center_id", UUID(as_uuid=True),
                       sa.ForeignKey("cost_centers.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("target_department_id", UUID(as_uuid=True),
                       sa.ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("target_cost_center_id", UUID(as_uuid=True),
                       sa.ForeignKey("cost_centers.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("headcount", sa.Integer(), nullable=False),
            sa.Column("total_headcount", sa.Integer(), nullable=False),
            sa.Column("allocation_pct", sa.Numeric(7, 4), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("generated_by", UUID(as_uuid=True),
                       sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                       onupdate=sa.func.now(), nullable=False),
            # Constraints
            sa.UniqueConstraint("budget_id", "period_year", "period_month", "target_department_id",
                                 name="uq_recharge_entry_budget_period_dept"),
            sa.CheckConstraint("period_month >= 1 AND period_month <= 12",
                                name="ck_recharge_entry_month_range"),
            sa.CheckConstraint("headcount >= 0", name="ck_recharge_entry_headcount_non_negative"),
            sa.CheckConstraint("amount >= 0", name="ck_recharge_entry_amount_non_negative"),
            # Indexes
            sa.Index("ix_recharge_entry_budget_period", "budget_id", "period_year", "period_month"),
            sa.Index("ix_recharge_entry_target_cc", "target_cost_center_id", "period_year", "period_month"),
            sa.Index("ix_recharge_entry_org_period", "org_id", "period_year", "period_month"),
        )


def downgrade() -> None:
    op.drop_table("fixed_recharge_entries")
    op.drop_table("fixed_recharge_budgets")
    op.execute("DROP TYPE IF EXISTS recharge_status_enum")
