"""G6 Dept Menu Template + G7 Payroll Slip

G6: dept_menu_configs — per-department sidebar menu visibility
G7: payroll_slips — individual payslips auto-generated from payroll run

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f7
Create Date: 2026-03-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision = "b2c3d4e5f6g7"
down_revision = "a1b2c3d4e5f7"
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
    # 1. G6: dept_menu_configs table
    # ──────────────────────────────────────────────────────────
    if not _table_exists(conn, "dept_menu_configs"):
        op.create_table(
            "dept_menu_configs",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("departments.id", ondelete="CASCADE"), nullable=True),
            sa.Column("menu_key", sa.String(50), nullable=False),
            sa.Column("is_visible", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.UniqueConstraint("org_id", "department_id", "menu_key", name="uq_dept_menu_org_dept_key"),
            sa.Index("ix_dept_menu_org_dept", "org_id", "department_id"),
        )

    # ──────────────────────────────────────────────────────────
    # 2. G7: payslip_status_enum + payroll_slips table
    # ──────────────────────────────────────────────────────────
    # Create enum (idempotent)
    if not _type_exists(conn, "payslip_status_enum"):
        op.execute("COMMIT")
        op.execute("DO $$ BEGIN CREATE TYPE payslip_status_enum AS ENUM ('DRAFT', 'RELEASED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$")
        op.execute("BEGIN")
        # Re-get connection after transaction restart
        conn = op.get_bind()

    if not _table_exists(conn, "payroll_slips"):
        op.create_table(
            "payroll_slips",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("payroll_run_id", UUID(as_uuid=True), sa.ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("base_salary", sa.Numeric(12, 2), nullable=False),
            sa.Column("regular_hours", sa.Numeric(8, 2), nullable=False, server_default="0"),
            sa.Column("ot_hours", sa.Numeric(8, 2), nullable=False, server_default="0"),
            sa.Column("ot_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("gross_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("deductions", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("net_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column(
                "status",
                sa.Enum("DRAFT", "RELEASED", name="payslip_status_enum", create_type=False),
                nullable=False,
                server_default="DRAFT",
            ),
            sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.UniqueConstraint("payroll_run_id", "employee_id", name="uq_payroll_slip_run_emp"),
            sa.CheckConstraint("base_salary >= 0", name="ck_payroll_slip_base_salary"),
            sa.CheckConstraint("gross_amount >= 0", name="ck_payroll_slip_gross"),
            sa.CheckConstraint("deductions >= 0", name="ck_payroll_slip_deductions"),
            sa.CheckConstraint("net_amount >= 0", name="ck_payroll_slip_net"),
            sa.Index("ix_payroll_slips_run", "payroll_run_id"),
            sa.Index("ix_payroll_slips_employee", "employee_id"),
            sa.Index("ix_payroll_slips_org_employee", "org_id", "employee_id"),
        )


def downgrade() -> None:
    op.drop_table("payroll_slips")
    op.drop_table("dept_menu_configs")
    op.execute("DROP TYPE IF EXISTS payslip_status_enum")
