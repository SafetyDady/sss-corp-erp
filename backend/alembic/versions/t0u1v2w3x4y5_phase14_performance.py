"""Phase 14: AI-Powered Performance Monitoring

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "t0u1v2w3x4y5"
down_revision = "s9t0u1v2w3x4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. performance_logs
    op.create_table(
        "performance_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=True),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("response_time_ms", sa.Float(), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("is_slow", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("query_count", sa.Integer(), nullable=True),
        sa.Column("slowest_query_ms", sa.Float(), nullable=True),
        sa.Column("error_detail", sa.String(500), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_perf_log_org_recorded", "performance_logs", ["org_id", "recorded_at"])
    op.create_index("ix_perf_log_path", "performance_logs", ["path", "recorded_at"])
    op.create_index("ix_perf_log_slow", "performance_logs", ["is_slow", "recorded_at"])
    op.create_index("ix_perf_log_status", "performance_logs", ["status_code"])
    op.create_index("ix_perf_log_recorded", "performance_logs", ["recorded_at"])

    # 2. performance_analyses
    op.create_table(
        "performance_analyses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=False),
        sa.Column("period", sa.String(20), nullable=False),
        sa.Column("focus", sa.String(100), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="HEALTHY"),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("details", JSON, nullable=True),
        sa.Column("recommendations", JSON, nullable=True),
        sa.Column("model_used", sa.String(50), nullable=False),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_perf_analysis_org_period", "performance_analyses", ["org_id", "period", "focus"])
    op.create_index("ix_perf_analysis_expires", "performance_analyses", ["expires_at"])

    # 3. web_vital_logs
    op.create_table(
        "web_vital_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("lcp", sa.Float(), nullable=True),
        sa.Column("fid", sa.Float(), nullable=True),
        sa.Column("cls", sa.Float(), nullable=True),
        sa.Column("ttfb", sa.Float(), nullable=True),
        sa.Column("inp", sa.Float(), nullable=True),
        sa.Column("page_url", sa.String(500), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_web_vitals_org_recorded", "web_vital_logs", ["org_id", "recorded_at"])


def downgrade() -> None:
    op.drop_table("web_vital_logs")
    op.drop_table("performance_analyses")
    op.drop_table("performance_logs")
