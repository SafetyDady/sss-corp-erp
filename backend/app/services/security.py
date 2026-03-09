"""
SSS Corp ERP — Security Service
Phase 13: Login History, Password Policy, 2FA TOTP
"""

import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import pyotp
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.security import LoginHistory, LoginStatus, OrgSecurityConfig
from app.models.user import User, RefreshToken


# ============================================================
# TOTP ENCRYPTION
# ============================================================

def _get_fernet() -> Fernet:
    """Get Fernet cipher using TOTP_ENCRYPTION_KEY."""
    settings = get_settings()
    key = settings.TOTP_ENCRYPTION_KEY
    # Pad/derive a valid Fernet key from the config string
    # Use first 32 bytes base64-url-safe encoded
    import base64
    import hashlib
    derived = hashlib.sha256(key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(derived)
    return Fernet(fernet_key)


def encrypt_totp_secret(secret: str) -> str:
    """Encrypt TOTP secret for storage."""
    f = _get_fernet()
    return f.encrypt(secret.encode()).decode()


def decrypt_totp_secret(encrypted: str) -> str:
    """Decrypt stored TOTP secret."""
    f = _get_fernet()
    try:
        return f.decrypt(encrypted.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt TOTP secret")


# ============================================================
# PASSWORD POLICY
# ============================================================

async def get_or_create_security_config(
    db: AsyncSession, org_id: uuid.UUID
) -> OrgSecurityConfig:
    """Get or create org security config (auto-creates with defaults)."""
    result = await db.execute(
        select(OrgSecurityConfig).where(OrgSecurityConfig.org_id == org_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        config = OrgSecurityConfig(org_id=org_id, require_2fa_roles=[])
        db.add(config)
        await db.flush()
    return config


async def update_security_config(
    db: AsyncSession, org_id: uuid.UUID, update_data: dict
) -> OrgSecurityConfig:
    """Update org security config."""
    config = await get_or_create_security_config(db, org_id)
    for key, value in update_data.items():
        if value is not None and hasattr(config, key):
            setattr(config, key, value)
    await db.flush()
    return config


def validate_password_policy(
    password: str, config: OrgSecurityConfig
) -> list[str]:
    """Validate password against org policy. Returns list of violations (empty = valid)."""
    violations = []

    if len(password) < config.min_password_length:
        violations.append(f"ต้องมีอย่างน้อย {config.min_password_length} ตัวอักษร")

    if config.require_uppercase and not re.search(r"[A-Z]", password):
        violations.append("ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว")

    if config.require_lowercase and not re.search(r"[a-z]", password):
        violations.append("ต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว")

    if config.require_digits and not re.search(r"\d", password):
        violations.append("ต้องมีตัวเลขอย่างน้อย 1 ตัว")

    if config.require_special_chars and not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        violations.append("ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว")

    return violations


async def check_password_expiry(
    db: AsyncSession, user: User, org_id: uuid.UUID
) -> bool:
    """Check if user's password is expired. Returns True if expired."""
    config = await get_or_create_security_config(db, org_id)
    if config.password_expiry_days == 0:
        return False  # Never expires

    if not user.password_changed_at:
        return True  # Never changed = expired if policy requires

    expiry_date = user.password_changed_at + timedelta(days=config.password_expiry_days)
    return datetime.now(timezone.utc) > expiry_date


async def change_password(
    db: AsyncSession, user: User, current_password: str, new_password: str, org_id: uuid.UUID
) -> list[str]:
    """
    Change user password. Returns list of policy violations (empty = success).
    Also revokes all refresh tokens.
    """
    # Verify current password
    if not verify_password(current_password, user.hashed_password):
        return ["รหัสผ่านปัจจุบันไม่ถูกต้อง"]

    # Validate new password against policy
    config = await get_or_create_security_config(db, org_id)
    violations = validate_password_policy(new_password, config)
    if violations:
        return violations

    # Update password
    user.hashed_password = hash_password(new_password)
    user.password_changed_at = datetime.now(timezone.utc)

    # Revoke all refresh tokens (force re-login everywhere)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.is_revoked == False)
        .values(is_revoked=True)
    )

    await db.flush()
    return []


# ============================================================
# LOGIN HISTORY & LOCKOUT
# ============================================================

async def record_login_attempt(
    db: AsyncSession,
    email: str,
    user_id: uuid.UUID | None,
    org_id: uuid.UUID | None,
    ip_address: str | None,
    user_agent: str | None,
    status: LoginStatus,
    failure_reason: str | None = None,
) -> LoginHistory:
    """Record a login attempt."""
    entry = LoginHistory(
        email=email,
        user_id=user_id,
        org_id=org_id,
        ip_address=ip_address,
        user_agent=user_agent[:500] if user_agent and len(user_agent) > 500 else user_agent,
        status=status,
        failure_reason=failure_reason,
    )
    db.add(entry)
    await db.flush()
    return entry


async def check_account_locked(
    db: AsyncSession, user: User, org_id: uuid.UUID
) -> tuple[bool, str | None]:
    """
    Check if account is locked. Returns (is_locked, reason).
    Auto-unlocks if lock duration has passed.
    """
    if not user.locked_until:
        return False, None

    now = datetime.now(timezone.utc)
    if user.locked_until > now:
        remaining = int((user.locked_until - now).total_seconds() / 60) + 1
        return True, f"บัญชีถูกล็อค กรุณาลองใหม่ใน {remaining} นาที"

    # Lock expired — auto-unlock
    user.failed_login_count = 0
    user.locked_until = None
    await db.flush()
    return False, None


async def increment_failed_attempts(
    db: AsyncSession, user: User, org_id: uuid.UUID
) -> bool:
    """
    Increment failed login counter. Returns True if account was just locked.
    """
    config = await get_or_create_security_config(db, org_id)
    user.failed_login_count = (user.failed_login_count or 0) + 1

    if user.failed_login_count >= config.max_failed_attempts:
        user.locked_until = datetime.now(timezone.utc) + timedelta(
            minutes=config.lockout_duration_minutes
        )
        await db.flush()
        return True

    await db.flush()
    return False


async def reset_failed_attempts(db: AsyncSession, user: User) -> None:
    """Reset failed login counter on successful login."""
    if user.failed_login_count > 0 or user.locked_until:
        user.failed_login_count = 0
        user.locked_until = None
        await db.flush()


async def get_login_history(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[LoginHistory], int]:
    """Get login history for admin view."""
    base_q = select(LoginHistory).where(LoginHistory.org_id == org_id)
    if user_id:
        base_q = base_q.where(LoginHistory.user_id == user_id)

    # Count
    count_q = select(func.count()).select_from(base_q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Items
    items_q = base_q.order_by(LoginHistory.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(items_q)
    items = list(result.scalars().all())

    return items, total


async def admin_unlock_user(
    db: AsyncSession, user_id: uuid.UUID, org_id: uuid.UUID
) -> None:
    """Admin manually unlocks a user account."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    user.failed_login_count = 0
    user.locked_until = None
    await db.flush()


# ============================================================
# 2FA TOTP
# ============================================================

def generate_backup_codes(count: int = 10) -> list[str]:
    """Generate random backup codes (8 chars alphanumeric each)."""
    return [secrets.token_hex(4).upper() for _ in range(count)]


async def setup_2fa(db: AsyncSession, user: User) -> dict:
    """
    Initialize 2FA setup. Returns secret + QR URI + backup codes.
    Does NOT enable 2FA yet — user must verify first.
    """
    # Generate TOTP secret
    secret = pyotp.random_base32()

    # Generate backup codes
    backup_codes = generate_backup_codes(10)

    # Hash backup codes for storage
    hashed_codes = [hash_password(code) for code in backup_codes]

    # Store encrypted secret + hashed backup codes (not enabled yet)
    user.totp_secret = encrypt_totp_secret(secret)
    user.backup_codes_hash = hashed_codes
    await db.flush()

    # Build QR URI
    settings = get_settings()
    totp = pyotp.TOTP(secret)
    qr_uri = totp.provisioning_uri(
        name=user.email,
        issuer_name=settings.APP_NAME,
    )

    return {
        "secret": secret,
        "qr_uri": qr_uri,
        "backup_codes": backup_codes,
    }


async def verify_and_enable_2fa(
    db: AsyncSession, user: User, code: str
) -> bool:
    """Verify TOTP code and enable 2FA if correct."""
    if not user.totp_secret:
        return False

    secret = decrypt_totp_secret(user.totp_secret)
    totp = pyotp.TOTP(secret)

    if totp.verify(code, valid_window=1):
        user.is_2fa_enabled = True
        await db.flush()
        return True

    return False


async def verify_2fa_code(
    db: AsyncSession, user: User, code: str
) -> bool:
    """
    Verify 2FA code. Tries TOTP first, then backup codes.
    Backup codes are consumed on use.
    """
    if not user.totp_secret:
        return False

    # Try TOTP
    secret = decrypt_totp_secret(user.totp_secret)
    totp = pyotp.TOTP(secret)
    if totp.verify(code, valid_window=1):
        return True

    # Try backup codes (for 8-char codes)
    if user.backup_codes_hash and len(code) == 8:
        for i, hashed_code in enumerate(user.backup_codes_hash):
            if verify_password(code, hashed_code):
                # Consume the backup code
                remaining = list(user.backup_codes_hash)
                remaining.pop(i)
                user.backup_codes_hash = remaining
                await db.flush()
                return True

    return False


async def disable_2fa(
    db: AsyncSession, user: User, code: str
) -> bool:
    """Disable 2FA. Requires valid OTP or backup code."""
    if not user.is_2fa_enabled:
        return False

    if not await verify_2fa_code(db, user, code):
        return False

    user.totp_secret = None
    user.is_2fa_enabled = False
    user.backup_codes_hash = None
    await db.flush()
    return True


def create_temp_token(
    user_id: str, org_id: str, purpose: str = "2fa_pending"
) -> str:
    """Create a short-lived JWT for 2FA or password change flow."""
    from jose import jwt
    settings = get_settings()

    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    payload = {
        "sub": user_id,
        "org_id": org_id,
        "type": purpose,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def verify_temp_token(token: str, expected_type: str = "2fa_pending") -> dict | None:
    """Verify and decode a temp token. Returns payload or None."""
    from jose import jwt, JWTError
    settings = get_settings()

    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != expected_type:
            return None
        return payload
    except JWTError:
        return None


# ============================================================
# SESSION MANAGEMENT (Phase 13.3)
# ============================================================

def parse_device_name(user_agent: str | None) -> str:
    """
    Lightweight UA parser — regex-based, no dependency.
    Returns e.g. "Chrome on Windows", "Safari on iPhone", "Unknown Device".
    """
    if not user_agent:
        return "Unknown Device"

    ua = user_agent.lower()

    # Detect browser
    browser = "Unknown Browser"
    if "edg/" in ua or "edge/" in ua:
        browser = "Edge"
    elif "opr/" in ua or "opera" in ua:
        browser = "Opera"
    elif "chrome/" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "safari/" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "msie" in ua or "trident" in ua:
        browser = "Internet Explorer"

    # Detect OS/device
    device = "Unknown OS"
    if "iphone" in ua:
        device = "iPhone"
    elif "ipad" in ua:
        device = "iPad"
    elif "android" in ua:
        if "mobile" in ua:
            device = "Android Phone"
        else:
            device = "Android Tablet"
    elif "macintosh" in ua or "mac os" in ua:
        device = "Mac"
    elif "windows" in ua:
        device = "Windows"
    elif "linux" in ua:
        device = "Linux"
    elif "cros" in ua:
        device = "ChromeOS"

    return f"{browser} on {device}"


async def get_active_sessions(
    db: AsyncSession, user_id: uuid.UUID, current_sid: str | None = None
) -> list[dict]:
    """List all non-expired, non-revoked refresh tokens for user."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked == False,
            RefreshToken.expires_at > now,
        ).order_by(RefreshToken.created_at.desc())
    )
    tokens = list(result.scalars().all())

    sessions = []
    for t in tokens:
        sessions.append({
            "id": str(t.id),
            "device_name": t.device_name,
            "ip_address": t.ip_address,
            "last_used_at": t.last_used_at,
            "created_at": t.created_at,
            "is_current": str(t.id) == current_sid if current_sid else False,
        })
    return sessions


async def revoke_session(
    db: AsyncSession, user_id: uuid.UUID, session_id: uuid.UUID, current_sid: str | None = None
) -> None:
    """Revoke a specific session. Cannot revoke current session."""
    from fastapi import HTTPException

    if current_sid and str(session_id) == current_sid:
        raise HTTPException(status_code=400, detail="Cannot revoke current session")

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.id == session_id,
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked == False,
        )
    )
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=404, detail="Session not found")

    token.is_revoked = True
    await db.flush()


async def revoke_other_sessions(
    db: AsyncSession, user_id: uuid.UUID, current_sid: str
) -> int:
    """Revoke all refresh tokens except current session. Returns count revoked."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked == False,
            RefreshToken.expires_at > now,
            RefreshToken.id != uuid.UUID(current_sid),
        )
    )
    tokens = list(result.scalars().all())
    for t in tokens:
        t.is_revoked = True
    await db.flush()
    return len(tokens)


# ============================================================
# EXPORT AUDIT LOG (Phase 13.7)
# ============================================================

async def log_export(
    db: AsyncSession,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    endpoint: str,
    resource_type: str,
    record_count: int | None = None,
    file_format: str = "xlsx",
    ip_address: str | None = None,
    user_agent: str | None = None,
    filters_used: dict | None = None,
) -> None:
    """Fire-and-forget export audit log. Errors silenced to not break exports."""
    try:
        from app.models.security import ExportAuditLog
        entry = ExportAuditLog(
            user_id=user_id,
            org_id=org_id,
            endpoint=endpoint,
            resource_type=resource_type,
            record_count=record_count,
            file_format=file_format,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent and len(user_agent) > 500 else user_agent,
            filters_used=filters_used,
        )
        db.add(entry)
        await db.commit()
    except Exception:
        pass  # Never break an export due to audit logging failure


async def get_export_audit_log(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    resource_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list, int]:
    """Admin query for export audit log with filters + pagination."""
    from app.models.security import ExportAuditLog

    base_q = select(ExportAuditLog).where(ExportAuditLog.org_id == org_id)
    if user_id:
        base_q = base_q.where(ExportAuditLog.user_id == user_id)
    if resource_type:
        base_q = base_q.where(ExportAuditLog.resource_type == resource_type)

    # Count
    count_q = select(func.count()).select_from(base_q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Items with user info
    items_q = (
        base_q
        .order_by(ExportAuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(items_q)
    items = list(result.scalars().all())

    # Enrich with user email/name
    enriched = []
    user_cache = {}
    for item in items:
        if item.user_id not in user_cache:
            u_result = await db.execute(
                select(User.email, User.full_name).where(User.id == item.user_id)
            )
            u_row = u_result.one_or_none()
            user_cache[item.user_id] = (u_row[0] if u_row else None, u_row[1] if u_row else None)

        email, name = user_cache[item.user_id]
        enriched.append({
            "id": item.id,
            "user_id": item.user_id,
            "user_email": email,
            "user_name": name,
            "endpoint": item.endpoint,
            "resource_type": item.resource_type,
            "record_count": item.record_count,
            "file_format": item.file_format,
            "ip_address": item.ip_address,
            "filters_used": item.filters_used,
            "created_at": item.created_at,
        })

    return enriched, total
