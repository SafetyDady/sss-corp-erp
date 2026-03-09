"""Phase 13 Round 2: Session Management + Export Audit

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-03-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

# revision identifiers
revision = "r8s9t0u1v2w3"
down_revision = "q7r8s9t0u1v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 13.3 Session Management: extend refresh_tokens ──
    op.add_column("refresh_tokens", sa.Column("device_name", sa.String(255), nullable=True))
    op.add_column("refresh_tokens", sa.Column("ip_address", sa.String(45), nullable=True))
    op.add_column("refresh_tokens", sa.Column("user_agent", sa.String(500), nullable=True))
    op.add_column("refresh_tokens", sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True))

    # ── 13.7 Export Audit Log ──
    op.create_table(
        "export_audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint", sa.String(255), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("record_count", sa.Integer, nullable=True),
        sa.Column("file_format", sa.String(20), server_default="xlsx", nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("filters_used", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_export_audit_logs_org_created", "export_audit_logs", ["org_id", sa.text("created_at DESC")])
    op.create_index("ix_export_audit_logs_user", "export_audit_logs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_export_audit_logs_user", table_name="export_audit_logs")
    op.drop_index("ix_export_audit_logs_org_created", table_name="export_audit_logs")
    op.drop_table("export_audit_logs")

    op.drop_column("refresh_tokens", "last_used_at")
    op.drop_column("refresh_tokens", "user_agent")
    op.drop_column("refresh_tokens", "ip_address")
    op.drop_column("refresh_tokens", "device_name")
