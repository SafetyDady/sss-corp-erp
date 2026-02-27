"""
Auth API — Login / Refresh / Me / Register
Rate limited: 5 req/min on /login
"""

from datetime import datetime, timedelta, timezone

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
from app.schemas import (
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    UserCreate,
    UserResponse,
    UserMe,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return access + refresh tokens."""
    # Find user
    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Create tokens (include org_id for multi-tenant filtering)
    token_data = {
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "org_id": str(user.org_id) if user.org_id else str(DEFAULT_ORG_ID),
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Store refresh token in DB
    db_refresh = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(db_refresh)
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
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

    # Create new tokens (include org_id for multi-tenant filtering)
    token_data = {
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "org_id": str(user.org_id) if user.org_id else str(DEFAULT_ORG_ID),
    }
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    # Store new refresh token
    db_new_refresh = RefreshToken(
        token=new_refresh,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(db_new_refresh)
    await db.commit()

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


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
    emp_result = await db.execute(
        select(Employee).where(
            Employee.user_id == user.id,
            Employee.is_active == True,
        )
    )
    employee = emp_result.scalar_one_or_none()

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
        hire_date=employee.hire_date if employee else None,
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
):
    """Register a new user (admin only)."""
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Revoke refresh token."""
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == body.refresh_token)
    )
    db_token = result.scalar_one_or_none()
    if db_token:
        db_token.is_revoked = True
        await db.commit()
