"""LINE Login — add line_user_id, line_link_code columns to users

Revision ID: v2w3x4y5z6a7
Revises: u1v2w3x4y5z6
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa

revision = "v2w3x4y5z6a7"
down_revision = "u1v2w3x4y5z6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # LINE Login columns on users table
    op.add_column("users", sa.Column("line_user_id", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("line_link_code", sa.String(6), nullable=True))
    op.add_column(
        "users",
        sa.Column("line_link_code_expires_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Partial unique index: 1 LINE ID per org
    op.execute(
        "CREATE UNIQUE INDEX ix_users_line_org "
        "ON users (line_user_id, org_id) "
        "WHERE line_user_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_line_org")
    op.drop_column("users", "line_link_code_expires_at")
    op.drop_column("users", "line_link_code")
    op.drop_column("users", "line_user_id")
