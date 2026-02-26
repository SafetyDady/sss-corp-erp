"""
SSS Corp ERP — Admin API Routes
Phase 3.5: Role/Permission management + User management + Audit log

Endpoints (from CLAUDE.md):
  GET    /api/admin/roles                     admin.role.read
  PUT    /api/admin/roles/{role}/permissions   admin.role.update
  GET    /api/admin/users                     admin.user.read
  PATCH  /api/admin/users/{id}/role           admin.user.update
  GET    /api/admin/audit-log                 admin.role.read
  POST   /api/admin/seed-permissions          admin.role.update

Business Rules:
  BR#31 — Owner cannot demote themselves
  BR#32 — Permission must be in master list (fail-fast)
  BR#33 — Action must be one of 7: create/read/update/delete/approve/export/execute
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import ALL_PERMISSIONS, ROLE_PERMISSIONS, require
from app.core.security import get_token_payload
from app.models.user import User

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_ACTIONS = {"create", "read", "update", "delete", "approve", "export", "execute"}
VALID_ROLES = {"owner", "manager", "supervisor", "staff", "viewer"}


# ============================================================
# SCHEMAS
# ============================================================

class RolePermissionUpdate(BaseModel):
    permissions: list[str] = Field(min_length=0)


class UserRoleUpdate(BaseModel):
    role: str = Field(min_length=1, max_length=50)


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int


# ============================================================
# ROLE + PERMISSION ROUTES
# ============================================================

@admin_router.get(
    "/roles",
    dependencies=[Depends(require("admin.role.read"))],
)
async def api_list_roles():
    """List all roles with their current permissions."""
    return {
        role: sorted(list(perms))
        for role, perms in ROLE_PERMISSIONS.items()
    }


@admin_router.put(
    "/roles/{role_name}/permissions",
    dependencies=[Depends(require("admin.role.update"))],
)
async def api_update_role_permissions(
    role_name: str,
    body: RolePermissionUpdate,
):
    """Update permissions for a role. BR#32: all must be in master list."""
    if role_name not in VALID_ROLES:
        raise HTTPException(status_code=404, detail=f"Unknown role: {role_name}")

    if role_name == "owner":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot modify owner permissions — owner always has all",
        )

    # BR#32 + BR#33: validate every permission
    for perm in body.permissions:
        if perm not in ALL_PERMISSIONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown permission: {perm} (BR#32)",
            )
        parts = perm.split(".")
        if len(parts) != 3:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Permission must be 3-part: {perm}",
            )
        if parts[2] not in VALID_ACTIONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid action '{parts[2]}' in permission {perm} (BR#33)",
            )

    # Update in-memory (runtime-only — persisting would require a DB table)
    ROLE_PERMISSIONS[role_name] = set(body.permissions)

    return {"role": role_name, "permissions": sorted(body.permissions)}


# ============================================================
# USER MANAGEMENT ROUTES
# ============================================================

@admin_router.get(
    "/users",
    response_model=UserListResponse,
    dependencies=[Depends(require("admin.user.read"))],
)
async def api_list_users(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    count_result = await db.execute(select(func.count()).select_from(User))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    items = list(result.scalars().all())
    return UserListResponse(items=items, total=total)


@admin_router.patch(
    "/users/{user_id}/role",
    response_model=UserResponse,
    dependencies=[Depends(require("admin.user.update"))],
)
async def api_update_user_role(
    user_id: UUID,
    body: UserRoleUpdate,
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's role. BR#31: Owner cannot demote themselves."""
    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role: {body.role}. Must be one of: {VALID_ROLES}",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # BR#31: Owner cannot demote themselves
    current_user_id = UUID(token["sub"])
    if user.id == current_user_id and user.role == "owner" and body.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Owner cannot demote themselves (BR#31)",
        )

    user.role = body.role
    await db.commit()
    await db.refresh(user)
    return user


@admin_router.get(
    "/audit-log",
    dependencies=[Depends(require("admin.role.read"))],
)
async def api_audit_log(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Audit log placeholder — returns recent user activity.
    Full audit logging would use a dedicated audit_logs table.
    """
    result = await db.execute(
        select(User)
        .order_by(User.updated_at.desc())
        .limit(limit)
    )
    users = list(result.scalars().all())
    return {
        "entries": [
            {
                "user_id": str(u.id),
                "email": u.email,
                "role": u.role,
                "last_activity": u.updated_at.isoformat() if u.updated_at else None,
            }
            for u in users
        ],
        "total": len(users),
    }


@admin_router.post(
    "/seed-permissions",
    dependencies=[Depends(require("admin.role.update"))],
)
async def api_seed_permissions():
    """Return the full permission list (for UI sync)."""
    return {
        "all_permissions": ALL_PERMISSIONS,
        "total": len(ALL_PERMISSIONS),
        "roles": {
            role: sorted(list(perms))
            for role, perms in ROLE_PERMISSIONS.items()
        },
    }
