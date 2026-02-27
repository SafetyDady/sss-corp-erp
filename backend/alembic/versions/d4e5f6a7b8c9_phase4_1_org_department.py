"""phase4_1_org_department

Phase 4.1: Organization, Department, OrgWorkConfig, OrgApprovalConfig
+ Employee additions (department_id, supervisor_id, pay_type, daily_rate, monthly_salary)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-27 10:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- organizations table ---
    op.create_table(
        "organizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("tax_id", sa.String(20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Insert default organization (matches DEFAULT_ORG_ID)
    op.execute(
        """
        INSERT INTO organizations (id, code, name, is_active)
        VALUES ('00000000-0000-0000-0000-000000000001', 'SSS', 'SSS Corp', true)
        ON CONFLICT (id) DO NOTHING
        """
    )

    # --- departments table ---
    op.create_table(
        "departments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("code", sa.String(50), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("cost_center_id", UUID(as_uuid=True), nullable=False),
        sa.Column("head_id", UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["cost_center_id"], ["cost_centers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["head_id"], ["employees.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("org_id", "code", name="uq_department_org_code"),
        sa.UniqueConstraint("org_id", "cost_center_id", name="uq_department_org_cc"),
    )

    # --- org_work_configs table ---
    op.create_table(
        "org_work_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("working_days", JSON(), nullable=False, server_default='[1,2,3,4,5,6]'),
        sa.Column("hours_per_day", sa.Numeric(4, 2), nullable=False, server_default="8.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
    )

    # --- org_approval_configs table ---
    op.create_table(
        "org_approval_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False),
        sa.Column("module_key", sa.String(50), nullable=False),
        sa.Column("require_approval", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("org_id", "module_key", name="uq_org_approval_module"),
    )
    op.create_index("ix_org_approval_org", "org_approval_configs", ["org_id"])

    # --- Employee additions ---
    # Create pay_type enum
    pay_type_enum = sa.Enum('DAILY', 'MONTHLY', name='pay_type_enum')
    pay_type_enum.create(op.get_bind(), checkfirst=True)

    op.add_column("employees", sa.Column("department_id", UUID(as_uuid=True), nullable=True))
    op.add_column("employees", sa.Column("supervisor_id", UUID(as_uuid=True), nullable=True))
    op.add_column("employees", sa.Column("pay_type", sa.Enum('DAILY', 'MONTHLY', name='pay_type_enum'), nullable=False, server_default='DAILY'))
    op.add_column("employees", sa.Column("daily_rate", sa.Numeric(12, 2), nullable=True))
    op.add_column("employees", sa.Column("monthly_salary", sa.Numeric(12, 2), nullable=True))

    # Foreign keys for employee new columns
    op.create_foreign_key(
        "fk_employee_department", "employees", "departments",
        ["department_id"], ["id"], ondelete="SET NULL"
    )
    op.create_foreign_key(
        "fk_employee_supervisor", "employees", "employees",
        ["supervisor_id"], ["id"], ondelete="SET NULL"
    )

    # Indexes for employee new columns
    op.create_index("ix_employees_department", "employees", ["department_id"])
    op.create_index("ix_employees_supervisor", "employees", ["supervisor_id"])

    # Check constraints for employee pay fields
    op.create_check_constraint(
        "ck_employee_daily_rate_positive", "employees",
        "daily_rate IS NULL OR daily_rate >= 0"
    )
    op.create_check_constraint(
        "ck_employee_monthly_salary_positive", "employees",
        "monthly_salary IS NULL OR monthly_salary >= 0"
    )


def downgrade() -> None:
    # Remove employee new columns
    op.drop_constraint("ck_employee_monthly_salary_positive", "employees", type_="check")
    op.drop_constraint("ck_employee_daily_rate_positive", "employees", type_="check")
    op.drop_index("ix_employees_supervisor", "employees")
    op.drop_index("ix_employees_department", "employees")
    op.drop_constraint("fk_employee_supervisor", "employees", type_="foreignkey")
    op.drop_constraint("fk_employee_department", "employees", type_="foreignkey")
    op.drop_column("employees", "monthly_salary")
    op.drop_column("employees", "daily_rate")
    op.drop_column("employees", "pay_type")
    op.drop_column("employees", "supervisor_id")
    op.drop_column("employees", "department_id")

    # Drop pay_type enum
    sa.Enum(name='pay_type_enum').drop(op.get_bind(), checkfirst=True)

    # Drop new tables
    op.drop_index("ix_org_approval_org", "org_approval_configs")
    op.drop_table("org_approval_configs")
    op.drop_table("org_work_configs")
    op.drop_table("departments")
    op.drop_table("organizations")
