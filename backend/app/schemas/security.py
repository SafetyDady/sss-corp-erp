"""
SSS Corp ERP — Security Schemas
Phase 13: Login History, Password Policy, 2FA
"""

import re
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================
# LOGIN HISTORY
# ============================================================

class LoginHistoryResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    email: str
    org_id: Optional[UUID] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str
    failure_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoginHistoryListResponse(BaseModel):
    items: list[LoginHistoryResponse]
    total: int


# ============================================================
# ORG SECURITY CONFIG
# ============================================================

class OrgSecurityConfigResponse(BaseModel):
    id: UUID
    org_id: UUID
    min_password_length: int
    require_uppercase: bool
    require_lowercase: bool
    require_digits: bool
    require_special_chars: bool
    password_expiry_days: int
    max_failed_attempts: int
    lockout_duration_minutes: int
    require_2fa_roles: list[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrgSecurityConfigUpdate(BaseModel):
    min_password_length: Optional[int] = Field(default=None, ge=6, le=128)
    require_uppercase: Optional[bool] = None
    require_lowercase: Optional[bool] = None
    require_digits: Optional[bool] = None
    require_special_chars: Optional[bool] = None
    password_expiry_days: Optional[int] = Field(default=None, ge=0, le=3650)
    max_failed_attempts: Optional[int] = Field(default=None, ge=1, le=100)
    lockout_duration_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    require_2fa_roles: Optional[list[str]] = None

    @field_validator("require_2fa_roles")
    @classmethod
    def validate_roles(cls, v):
        if v is not None:
            valid = {"owner", "manager", "supervisor", "staff", "viewer"}
            for role in v:
                if role not in valid:
                    raise ValueError(f"Invalid role: {role}")
        return v


# ============================================================
# PASSWORD
# ============================================================

class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


# ============================================================
# 2FA
# ============================================================

class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_uri: str
    backup_codes: list[str]


class TwoFactorVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def validate_code(cls, v):
        if not re.match(r"^\d{6}$", v):
            raise ValueError("Code must be exactly 6 digits")
        return v


class TwoFactorDisableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def validate_code(cls, v):
        if not re.match(r"^\d{6}$", v):
            raise ValueError("Code must be exactly 6 digits")
        return v


class TwoFactorLoginRequest(BaseModel):
    temp_token: str
    code: str = Field(min_length=6, max_length=8)  # 6 for OTP, 8 for backup


# ============================================================
# LOGIN RESPONSE (extends normal token response)
# ============================================================

class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    requires_2fa: bool = False
    temp_token: Optional[str] = None
    password_expired: bool = False


# ============================================================
# SESSION MANAGEMENT (Phase 13.3)
# ============================================================

class SessionResponse(BaseModel):
    id: str
    device_name: Optional[str] = None
    ip_address: Optional[str] = None
    last_used_at: Optional[datetime] = None
    created_at: datetime
    is_current: bool = False

    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    items: list[SessionResponse]


# ============================================================
# EXPORT AUDIT LOG (Phase 13.7)
# ============================================================

class ExportAuditLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    endpoint: str
    resource_type: str
    record_count: Optional[int] = None
    file_format: str
    ip_address: Optional[str] = None
    filters_used: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExportAuditListResponse(BaseModel):
    items: list[ExportAuditLogResponse]
    total: int
