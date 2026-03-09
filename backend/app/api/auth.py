"""
Auth API — Login / Refresh / Me / Register / 2FA / Password Change / Sessions
Rate limited: 5 req/min on /login
Phase 13: Login History + Account Lockout + 2FA TOTP + Password Policy + Session Management
"""

import uuid as _uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID, get_settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_token_payload,
    hash_password,
    verify_password,
)
from app.core.permissions import ROLE_PERMISSIONS, require
from app.models import User, RefreshToken
from app.models.security import LoginStatus
from app.schemas import (
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    UserCreate,
    UserResponse,
    UserMe,
)
from app.schemas.security import (
    LoginResponse,
    PasswordChangeRequest,
    TwoFactorSetupResponse,
    TwoFactorVerifyRequest,
    TwoFactorDisableRequest,
    TwoFactorLoginRequest,
    SessionListResponse,
    SessionResponse,
)
from app.services.security import (
    check_account_locked,
    check_password_expiry,
    create_temp_token,
    verify_temp_token,
    increment_failed_attempts,
    record_login_attempt,
    reset_failed_attempts,
    setup_2fa,
    verify_and_enable_2fa,
    verify_2fa_code,
    disable_2fa,
    change_password,
    validate_password_policy,
    get_or_create_security_config,
    parse_device_name,
    get_active_sessions,
    revoke_session,
    revoke_other_sessions,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _get_client_info(request: Request) -> tuple[str | None, str | None]:
    """Extract IP address and user agent from request."""
    ip = None
    if request.client:
        ip = request.client.host
    # Check for proxy headers
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    user_agent = request.headers.get("user-agent")
    return ip, user_agent


def _create_tokens_and_refresh(user, ip: str | None = None, user_agent: str | None = None):
    """Create access + refresh tokens for user with session metadata.
    Returns (access_token, refresh_token_str, db_refresh_obj, sid).
    """
    org_id_str = str(user.org_id) if user.org_id else str(DEFAULT_ORG_ID)
    token_data = {
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "org_id": org_id_str,
    }

    # Pre-generate RefreshToken UUID for sid
    refresh_id = _uuid.uuid4()
    sid = str(refresh_id)

    access_token = create_access_token(token_data, sid=sid)
    refresh_token = create_refresh_token(token_data)

    db_refresh = RefreshToken(
        id=refresh_id,
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        device_name=parse_device_name(user_agent),
        ip_address=ip,
        user_agent=user_agent[:500] if user_agent and len(user_agent) > 500 else user_agent,
        last_used_at=datetime.now(timezone.utc),
    )
    return access_token, refresh_token, db_refresh, sid


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user. Handles lockout, 2FA, and password expiry."""
    ip, user_agent = _get_client_info(request)

    # Find user (include inactive for recording purposes)
    result = await db.execute(
        select(User).where(User.email == body.email)
    )
    user = result.scalar_one_or_none()

    # User not found
    if not user:
        await record_login_attempt(
            db, body.email, None, None, ip, user_agent,
            LoginStatus.FAILED, "User not found"
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    org_id = user.org_id or DEFAULT_ORG_ID

    # Inactive user
    if not user.is_active:
        await record_login_attempt(
            db, body.email, user.id, org_id, ip, user_agent,
            LoginStatus.FAILED, "Account inactive"
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check account locked
    is_locked, lock_reason = await check_account_locked(db, user, org_id)
    if is_locked:
        await record_login_attempt(
            db, body.email, user.id, org_id, ip, user_agent,
            LoginStatus.LOCKED, lock_reason
        )
        await db.commit()
        raise HTTPException(
            status_code=423,
            detail=lock_reason,
        )

    # Verify password
    if not verify_password(body.password, user.hashed_password):
        was_locked = await increment_failed_attempts(db, user, org_id)
        reason = "Account locked after too many attempts" if was_locked else "Invalid password"
        await record_login_attempt(
            db, body.email, user.id, org_id, ip, user_agent,
            LoginStatus.LOCKED if was_locked else LoginStatus.FAILED, reason
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Password correct — reset failed attempts
    await reset_failed_attempts(db, user)

    # Check password expiry
    password_expired = await check_password_expiry(db, user, org_id)
    if password_expired:
        # Issue real tokens so user can call /change-password endpoint
        access_token, refresh_token, db_refresh, sid = _create_tokens_and_refresh(user, ip, user_agent)
        db.add(db_refresh)
        await record_login_attempt(
            db, body.email, user.id, org_id, ip, user_agent,
            LoginStatus.SUCCESS, "Password expired — change required"
        )
        await db.commit()
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            password_expired=True,
        )

    # Check 2FA
    if user.is_2fa_enabled:
        temp_token = create_temp_token(str(user.id), str(org_id), "2fa_pending")
        await record_login_attempt(
            db, body.email, user.id, org_id, ip, user_agent,
            LoginStatus.SUCCESS, "2FA required"
        )
        await db.commit()
        return LoginResponse(
            requires_2fa=True,
            temp_token=temp_token,
        )

    # Normal login — issue tokens
    access_token, refresh_token, db_refresh, sid = _create_tokens_and_refresh(user, ip, user_agent)
    db.add(db_refresh)

    await record_login_attempt(
        db, body.email, user.id, org_id, ip, user_agent,
        LoginStatus.SUCCESS
    )
    await db.commit()

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/2fa/login", response_model=LoginResponse)
async def login_2fa(
    body: TwoFactorLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Complete 2FA login with OTP or backup code."""
    payload = verify_temp_token(body.temp_token, "2fa_pending")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired temp token")

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    ip, user_agent = _get_client_info(request)

    # Verify 2FA code
    if not await verify_2fa_code(db, user, body.code):
        await record_login_attempt(
            db, user.email, user.id, user.org_id, ip, user_agent,
            LoginStatus.FAILED, "Invalid 2FA code"
        )
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid verification code")

    # Issue tokens with session metadata
    access_token, refresh_token, db_refresh, sid = _create_tokens_and_refresh(user, ip, user_agent)
    db.add(db_refresh)
    await db.commit()

    # Check password expiry after 2FA
    org_id = user.org_id or DEFAULT_ORG_ID
    password_expired = await check_password_expiry(db, user, org_id)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        password_expired=password_expired,
    )


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa_endpoint(
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Initialize 2FA setup. Returns QR code URI and backup codes."""
    user_id = token_payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")

    data = await setup_2fa(db, user)
    await db.commit()

    return TwoFactorSetupResponse(**data)


@router.post("/2fa/verify")
async def verify_2fa_endpoint(
    body: TwoFactorVerifyRequest,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and enable 2FA."""
    user_id = token_payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")

    if not await verify_and_enable_2fa(db, user, body.code):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    await db.commit()
    return {"message": "2FA enabled successfully"}


@router.post("/2fa/disable")
async def disable_2fa_endpoint(
    body: TwoFactorDisableRequest,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Disable 2FA. Requires current OTP for security."""
    user_id = token_payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    if not await disable_2fa(db, user, body.code):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    await db.commit()
    return {"message": "2FA disabled successfully"}


@router.post("/change-password")
async def change_password_endpoint(
    body: PasswordChangeRequest,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Change password. Validates against org policy. Revokes all sessions."""
    user_id = token_payload.get("sub")
    org_id = UUID(token_payload["org_id"])

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    violations = await change_password(db, user, body.current_password, body.new_password, org_id)
    if violations:
        raise HTTPException(status_code=400, detail="; ".join(violations))

    await db.commit()
    return {"message": "Password changed successfully"}


# ============================================================
# SESSION MANAGEMENT (Phase 13.3)
# ============================================================

@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """List all active sessions for current user."""
    user_id = UUID(token_payload["sub"])
    current_sid = token_payload.get("sid")
    sessions = await get_active_sessions(db, user_id, current_sid=current_sid)
    return SessionListResponse(
        items=[SessionResponse(**s) for s in sessions]
    )


@router.delete("/sessions/{session_id}")
async def revoke_session_endpoint(
    session_id: UUID,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a specific session. Cannot revoke current session."""
    user_id = UUID(token_payload["sub"])
    current_sid = token_payload.get("sid")
    await revoke_session(db, user_id, session_id, current_sid=current_sid)
    await db.commit()
    return {"message": "Session revoked successfully"}


@router.delete("/sessions")
async def revoke_all_other_sessions(
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all sessions except the current one."""
    user_id = UUID(token_payload["sub"])
    current_sid = token_payload.get("sid")
    if not current_sid:
        raise HTTPException(status_code=400, detail="Session ID not found in token")
    count = await revoke_other_sessions(db, user_id, current_sid)
    await db.commit()
    return {"message": f"Revoked {count} session(s)", "count": count}


# ============================================================
# TOKEN REFRESH
# ============================================================

@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Exchange refresh token for new access + refresh tokens (rotation)."""
    # Decode refresh token
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    # Find in DB
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == body.refresh_token,
            RefreshToken.is_revoked == False,
        )
    )
    db_token = result.scalar_one_or_none()

    if not db_token:
        raise HTTPException(status_code=401, detail="Refresh token not found or revoked")

    if db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token expired")

    # Revoke old token (rotation)
    db_token.is_revoked = True

    # Get user
    user_result = await db.execute(
        select(User).where(User.id == db_token.user_id, User.is_active == True)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    ip, user_agent = _get_client_info(request)

    # Create new tokens with session metadata (carry over device info from old token)
    access_token, new_refresh, db_new_refresh, sid = _create_tokens_and_refresh(
        user, ip=ip or db_token.ip_address, user_agent=user_agent or db_token.user_agent
    )
    db.add(db_new_refresh)
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=new_refresh)


# ============================================================
# ME / REGISTER / LOGOUT
# ============================================================

@router.get("/me", response_model=UserMe)
async def get_me(
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Get current user info + permissions + employee data."""
    user_id = token_payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    permissions = sorted(ROLE_PERMISSIONS.get(user.role, set()))

    # Phase 5: Query linked employee for Staff Portal
    from app.models.hr import Employee
    from app.models.organization import Department
    emp_result = await db.execute(
        select(Employee).where(
            Employee.user_id == user.id,
            Employee.is_active == True,
        )
    )
    employee = emp_result.scalar_one_or_none()

    # Phase 6: Query department name
    department_name = None
    if employee and employee.department_id:
        dept_result = await db.execute(
            select(Department).where(Department.id == employee.department_id)
        )
        dept = dept_result.scalar_one_or_none()
        department_name = dept.name if dept else None

    # Query OrgWorkConfig for working days
    from app.models.organization import OrgWorkConfig
    org_id = user.org_id or DEFAULT_ORG_ID
    wc_result = await db.execute(
        select(OrgWorkConfig).where(OrgWorkConfig.org_id == org_id)
    )
    work_config = wc_result.scalar_one_or_none()
    working_days = work_config.working_days if work_config else [1, 2, 3, 4, 5]
    hours_per_day = float(work_config.hours_per_day) if work_config and work_config.hours_per_day else 8.0

    # Go-Live G6: Dept menu visibility
    from app.services.organization import get_dept_menu
    dept_menu = await get_dept_menu(
        db, org_id,
        department_id=employee.department_id if employee else None,
    )

    # Phase 10: Organization info for print headers
    from app.models.organization import Organization
    org_result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = org_result.scalar_one_or_none()

    return UserMe(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        permissions=permissions,
        employee_id=employee.id if employee else None,
        employee_name=employee.full_name if employee else None,
        employee_code=employee.employee_code if employee else None,
        department_id=employee.department_id if employee else None,
        department_name=department_name,
        hire_date=employee.hire_date if employee else None,
        work_schedule_id=employee.work_schedule_id if employee else None,
        working_days=working_days,
        hours_per_day=hours_per_day,
        dept_menu=dept_menu,
        org_name=org.name if org else None,
        org_address=org.address if org else None,
        org_tax_id=org.tax_id if org else None,
        is_2fa_enabled=user.is_2fa_enabled,
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require("admin.user.create"))],
)
async def register(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Register a new user (admin only). Validates password against policy."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Validate password against org policy
    config = await get_or_create_security_config(db, org_id)
    violations = validate_password_policy(body.password, config)
    if violations:
        raise HTTPException(status_code=400, detail="; ".join(violations))

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        org_id=org_id,
        password_changed_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Revoke refresh token. No access token required — allows cleanup after token expiry."""
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == body.refresh_token)
    )
    db_token = result.scalar_one_or_none()
    if db_token:
        db_token.is_revoked = True
        await db.commit()
