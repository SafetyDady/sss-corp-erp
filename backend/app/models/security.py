"""
SSS Corp ERP — Security Models
Phase 13: Login History + OrgSecurityConfig + Audit Trail
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin


# ============================================================
# ENUMS
# ============================================================

class LoginStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    LOCKED = "LOCKED"


class AuditAction(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    STATUS_CHANGE = "STATUS_CHANGE"


# ============================================================
# LOGIN HISTORY
# ============================================================

class LoginHistory(Base, TimestampMixin):
    """Records every login attempt (success + failure)."""
    __tablename__ = "login_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        ENUM(LoginStatus, name="login_status_enum", create_type=False),
        nullable=False,
    )
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        Index("ix_login_history_user_id", "user_id"),
        Index("ix_login_history_email", "email"),
        Index("ix_login_history_org_created", "org_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<LoginHistory {self.email} {self.status}>"


# ============================================================
# ORG SECURITY CONFIG
# ============================================================

class OrgSecurityConfig(Base, TimestampMixin):
    """Organization-level security policy: password rules, lockout, 2FA enforcement."""
    __tablename__ = "org_security_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False
    )

    # Password policy
    min_password_length: Mapped[int] = mapped_column(
        Integer, default=8, nullable=False
    )
    require_uppercase: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    require_lowercase: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    require_digits: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    require_special_chars: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    password_expiry_days: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False  # 0 = never
    )

    # Account lockout
    max_failed_attempts: Mapped[int] = mapped_column(
        Integer, default=5, nullable=False
    )
    lockout_duration_minutes: Mapped[int] = mapped_column(
        Integer, default=15, nullable=False
    )

    # 2FA enforcement
    require_2fa_roles: Mapped[dict | None] = mapped_column(
        JSON, default=list, nullable=False  # e.g. ["owner", "manager"]
    )

    # Rate limiting (Phase 13.6)
    api_rate_limit_per_minute: Mapped[int] = mapped_column(
        Integer, default=120, nullable=False, server_default="120"
    )
    api_rate_limit_login: Mapped[int] = mapped_column(
        Integer, default=5, nullable=False, server_default="5"
    )

    __table_args__ = (
        CheckConstraint(
            "min_password_length >= 6 AND min_password_length <= 128",
            name="ck_security_min_password_length",
        ),
        CheckConstraint(
            "max_failed_attempts >= 1 AND max_failed_attempts <= 100",
            name="ck_security_max_failed_attempts",
        ),
        CheckConstraint(
            "lockout_duration_minutes >= 1 AND lockout_duration_minutes <= 1440",
            name="ck_security_lockout_duration",
        ),
        CheckConstraint(
            "password_expiry_days >= 0 AND password_expiry_days <= 3650",
            name="ck_security_password_expiry",
        ),
        CheckConstraint(
            "api_rate_limit_per_minute >= 10 AND api_rate_limit_per_minute <= 600",
            name="ck_security_api_rate_limit",
        ),
        CheckConstraint(
            "api_rate_limit_login >= 1 AND api_rate_limit_login <= 60",
            name="ck_security_login_rate_limit",
        ),
    )

    def __repr__(self) -> str:
        return f"<OrgSecurityConfig org={self.org_id}>"


# ============================================================
# EXPORT AUDIT LOG (Phase 13.7)
# ============================================================

class ExportAuditLog(Base, TimestampMixin):
    """Records every data export action for compliance."""
    __tablename__ = "export_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    record_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_format: Mapped[str] = mapped_column(
        String(20), default="xlsx", nullable=False, server_default="xlsx"
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    filters_used: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_export_audit_logs_org_created", "org_id", "created_at"),
        Index("ix_export_audit_logs_user", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<ExportAuditLog {self.resource_type} by user={self.user_id}>"


# ============================================================
# AUDIT LOG (Phase 13.1 — Enhanced Audit Trail)
# ============================================================

class AuditLog(Base, TimestampMixin):
    """Generic audit trail for all CRUD and status change events."""
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    changes: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("ix_audit_logs_org_created", "org_id", "created_at"),
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
        Index("ix_audit_logs_action", "action"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.resource_type} by user={self.user_id}>"
