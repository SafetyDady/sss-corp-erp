"""Phase 13: Login History + Password Policy + 2FA

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-03-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON, ENUM

# revision identifiers
revision = "q7r8s9t0u1v2"
down_revision = "p6q7r8s9t0u1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create login_status_enum (use raw SQL for async driver compatibility)
    op.execute("DO $$ BEGIN CREATE TYPE login_status_enum AS ENUM ('SUCCESS', 'FAILED', 'LOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;")

    # Use dialect-level ENUM with create_type=False to prevent duplicate creation
    login_status_type = ENUM("SUCCESS", "FAILED", "LOCKED", name="login_status_enum", create_type=False)

    # 2. Create login_history table
    op.create_table(
        "login_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("status", login_status_type, nullable=False),
        sa.Column("failure_reason", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_login_history_user_id", "login_history", ["user_id"])
    op.create_index("ix_login_history_email", "login_history", ["email"])
    op.create_index("ix_login_history_org_created", "login_history", ["org_id", "created_at"])

    # 3. Create org_security_configs table
    op.create_table(
        "org_security_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), unique=True, nullable=False),
        sa.Column("min_password_length", sa.Integer, default=8, nullable=False, server_default="8"),
        sa.Column("require_uppercase", sa.Boolean, default=True, nullable=False, server_default="true"),
        sa.Column("require_lowercase", sa.Boolean, default=True, nullable=False, server_default="true"),
        sa.Column("require_digits", sa.Boolean, default=True, nullable=False, server_default="true"),
        sa.Column("require_special_chars", sa.Boolean, default=False, nullable=False, server_default="false"),
        sa.Column("password_expiry_days", sa.Integer, default=0, nullable=False, server_default="0"),
        sa.Column("max_failed_attempts", sa.Integer, default=5, nullable=False, server_default="5"),
        sa.Column("lockout_duration_minutes", sa.Integer, default=15, nullable=False, server_default="15"),
        sa.Column("require_2fa_roles", JSON, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("min_password_length >= 6 AND min_password_length <= 128", name="ck_security_min_password_length"),
        sa.CheckConstraint("max_failed_attempts >= 1 AND max_failed_attempts <= 100", name="ck_security_max_failed_attempts"),
        sa.CheckConstraint("lockout_duration_minutes >= 1 AND lockout_duration_minutes <= 1440", name="ck_security_lockout_duration"),
        sa.CheckConstraint("password_expiry_days >= 0 AND password_expiry_days <= 3650", name="ck_security_password_expiry"),
    )

    # 4. Add columns to users table
    op.add_column("users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("failed_login_count", sa.Integer, nullable=False, server_default="0"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("totp_secret", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("is_2fa_enabled", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("users", sa.Column("backup_codes_hash", JSON, nullable=True))


def downgrade() -> None:
    # Drop user columns
    op.drop_column("users", "backup_codes_hash")
    op.drop_column("users", "is_2fa_enabled")
    op.drop_column("users", "totp_secret")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_count")
    op.drop_column("users", "password_changed_at")

    # Drop tables
    op.drop_table("org_security_configs")
    op.drop_index("ix_login_history_org_created", table_name="login_history")
    op.drop_index("ix_login_history_email", table_name="login_history")
    op.drop_index("ix_login_history_user_id", table_name="login_history")
    op.drop_table("login_history")

    # Drop enum
    sa.Enum(name="login_status_enum").drop(op.get_bind(), checkfirst=True)
