"""A5: Role permission persistence — role_permission_overrides table

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-03-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    """Check if a table already exists (idempotent guard for dev mode)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM information_schema.tables WHERE table_name = :t"),
        {"t": name},
    )
    return result.scalar() is not None


def upgrade() -> None:
    if _table_exists("role_permission_overrides"):
        return

    op.create_table(
        "role_permission_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role_name", sa.String(50), nullable=False),
        sa.Column("permissions_json", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint("org_id", "role_name", name="uq_role_perm_org_role"),
    )
    op.create_index("ix_role_perm_org", "role_permission_overrides", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_role_perm_org", table_name="role_permission_overrides")
    op.drop_table("role_permission_overrides")
