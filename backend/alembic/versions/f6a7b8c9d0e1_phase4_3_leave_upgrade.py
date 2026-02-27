"""phase4_3_leave_upgrade

Phase 4.3: LeaveType master data + LeaveBalance + Leave model upgrades

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-02-27 16:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- leave_types table ---
    op.create_table(
        "leave_types",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("code", sa.String(50), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_paid", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("default_quota", sa.Integer, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "code", name="uq_leave_type_org_code"),
        sa.CheckConstraint("default_quota IS NULL OR default_quota >= 0", name="ck_leave_type_quota_positive"),
    )

    # --- leave_balances table ---
    op.create_table(
        "leave_balances",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", UUID(as_uuid=True), sa.ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("quota", sa.Integer, nullable=False, server_default="0"),
        sa.Column("used", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leave_balance_emp_type_year"),
        sa.CheckConstraint("quota >= 0", name="ck_leave_balance_quota_positive"),
        sa.CheckConstraint("used >= 0", name="ck_leave_balance_used_positive"),
    )
    op.create_index("ix_leave_balances_employee", "leave_balances", ["employee_id"])

    # --- leaves table upgrades ---
    op.add_column("leaves", sa.Column("leave_type_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_leave_leave_type",
        "leaves", "leave_types",
        ["leave_type_id"], ["id"],
        ondelete="SET NULL",
    )
    op.add_column("leaves", sa.Column("days_count", sa.Integer, nullable=False, server_default="1"))


def downgrade() -> None:
    op.drop_constraint("fk_leave_leave_type", "leaves", type_="foreignkey")
    op.drop_column("leaves", "days_count")
    op.drop_column("leaves", "leave_type_id")
    op.drop_index("ix_leave_balances_employee", "leave_balances")
    op.drop_table("leave_balances")
    op.drop_table("leave_types")
