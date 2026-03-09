"""
Phase 9: Notification Center — notifications table

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-03-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "p6q7r8s9t0u1"
down_revision = "o5p6q7r8s9t0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create notification_type_enum
    notification_type_enum = postgresql.ENUM(
        "APPROVAL_REQUEST",
        "DOCUMENT_APPROVED",
        "DOCUMENT_REJECTED",
        "LOW_STOCK_ALERT",
        "LEAVE_APPROVED",
        "LEAVE_REJECTED",
        "TIMESHEET_APPROVED",
        "TIMESHEET_FINAL",
        "PO_RECEIVED",
        "SYSTEM",
        name="notification_type_enum",
        create_type=True,
    )
    notification_type_enum.create(op.get_bind(), checkfirst=True)

    # 2. Create notifications table
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notification_type", notification_type_enum, nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("link", sa.String(500), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_name", sa.String(255), nullable=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. Create indexes
    op.create_index("ix_notif_user_read", "notifications", ["user_id", "is_read"])
    op.create_index("ix_notif_user_created", "notifications", ["user_id", "created_at"])
    op.create_index("ix_notif_org", "notifications", ["org_id"])
    op.create_index("ix_notif_entity", "notifications", ["entity_type", "entity_id"])


def downgrade() -> None:
    op.drop_index("ix_notif_entity", table_name="notifications")
    op.drop_index("ix_notif_org", table_name="notifications")
    op.drop_index("ix_notif_user_created", table_name="notifications")
    op.drop_index("ix_notif_user_read", table_name="notifications")
    op.drop_table("notifications")

    notification_type_enum = postgresql.ENUM(name="notification_type_enum")
    notification_type_enum.drop(op.get_bind(), checkfirst=True)
