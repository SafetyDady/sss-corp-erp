"""Add unique constraint on employees.user_id (1 User : 1 Employee)

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-03-03
"""
from alembic import op


# revision identifiers
revision = "c3d4e5f6g7h8"
down_revision = "b2c3d4e5f6g7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1 User : 1 Employee — prevent duplicate linking
    op.create_unique_constraint("uq_employee_user_id", "employees", ["user_id"])


def downgrade() -> None:
    op.drop_constraint("uq_employee_user_id", "employees", type_="unique")
