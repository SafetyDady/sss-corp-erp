"""Phase 13 Round 3: Enhanced Audit Trail + Rate Limiting

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-03-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers, used by Alembic.
revision = "s9t0u1v2w3x4"
down_revision = "r8s9t0u1v2w3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ============================================================
    # 13.1 — AUDIT LOGS TABLE
    # ============================================================
    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("changes", JSON, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_org_created", "audit_logs", ["org_id", sa.text("created_at DESC")])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_resource", "audit_logs", ["resource_type", "resource_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])

    # ============================================================
    # 13.6 — RATE LIMIT COLUMNS on org_security_configs
    # ============================================================
    op.add_column("org_security_configs", sa.Column(
        "api_rate_limit_per_minute", sa.Integer, server_default="120", nullable=False,
    ))
    op.add_column("org_security_configs", sa.Column(
        "api_rate_limit_login", sa.Integer, server_default="5", nullable=False,
    ))
    op.create_check_constraint(
        "ck_security_api_rate_limit", "org_security_configs",
        "api_rate_limit_per_minute >= 10 AND api_rate_limit_per_minute <= 600",
    )
    op.create_check_constraint(
        "ck_security_login_rate_limit", "org_security_configs",
        "api_rate_limit_login >= 1 AND api_rate_limit_login <= 60",
    )


def downgrade() -> None:
    op.drop_constraint("ck_security_login_rate_limit", "org_security_configs", type_="check")
    op.drop_constraint("ck_security_api_rate_limit", "org_security_configs", type_="check")
    op.drop_column("org_security_configs", "api_rate_limit_login")
    op.drop_column("org_security_configs", "api_rate_limit_per_minute")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_org_created", table_name="audit_logs")
    op.drop_table("audit_logs")
