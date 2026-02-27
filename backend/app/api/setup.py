"""
SSS Corp ERP — Setup Wizard API
Phase 4.7: Initial system setup (create first org + owner user)

Endpoint:
  POST /api/setup    (no auth required — only works once)

This endpoint is used for initial system setup. It:
1. Checks if any organization already exists (if yes, returns 400)
2. Creates a new Organization
3. Creates the first User with role='owner' and org_id=new_org.id
4. Returns login tokens (access + refresh) so the user can proceed
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
)
from app.models.organization import Organization
from app.models.user import RefreshToken, User


router = APIRouter(prefix="/api/setup", tags=["setup"])
settings = get_settings()


# ============================================================
# SCHEMAS
# ============================================================

class SetupRequest(BaseModel):
    org_name: str = Field(min_length=1, max_length=255)
    org_code: str = Field(min_length=1, max_length=50)
    admin_email: EmailStr
    admin_password: str = Field(min_length=6, max_length=128)
    admin_full_name: str = Field(min_length=1, max_length=255)


class SetupResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    org_id: str
    org_name: str
    user_id: str
    message: str


# ============================================================
# SETUP ENDPOINT
# ============================================================

@router.post("", response_model=SetupResponse, status_code=201)
async def api_setup(
    body: SetupRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Initial system setup — create first organization and owner user.
    This endpoint only works ONCE. If any organization exists, it returns 400.
    """
    # 1. Check if any organization already exists
    org_count_result = await db.execute(
        select(func.count()).select_from(Organization)
    )
    org_count = org_count_result.scalar() or 0
    if org_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup already completed — an organization already exists",
        )

    # 2. Check if org_code is unique (redundant since no orgs exist, but safe)
    existing_org = await db.execute(
        select(Organization).where(Organization.code == body.org_code)
    )
    if existing_org.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Organization with code '{body.org_code}' already exists",
        )

    # 3. Check if email is unique
    existing_user = await db.execute(
        select(User).where(User.email == body.admin_email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{body.admin_email}' already exists",
        )

    # 4. Create Organization
    org = Organization(
        code=body.org_code,
        name=body.org_name,
    )
    db.add(org)
    await db.flush()  # Get org.id

    # 5. Create Owner User
    user = User(
        email=body.admin_email,
        hashed_password=hash_password(body.admin_password),
        full_name=body.admin_full_name,
        role="owner",
        org_id=org.id,
    )
    db.add(user)
    await db.flush()  # Get user.id

    # 6. Create tokens
    token_data = {
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "org_id": str(org.id),
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # 7. Store refresh token in DB
    db_refresh = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(db_refresh)

    await db.commit()

    return SetupResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        org_id=str(org.id),
        org_name=org.name,
        user_id=str(user.id),
        message="Setup completed successfully — organization and owner user created",
    )
