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

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import ALL_PERMISSIONS, ROLE_PERMISSIONS, require
from app.core.security import get_token_payload
from app.models.user import User
from app.schemas.organization import (
    OrgApprovalConfigListResponse,
    OrgApprovalConfigUpdate,
    OrganizationResponse,
    OrganizationUpdate,
    OrgWorkConfigResponse,
    OrgWorkConfigUpdate,
)
from app.services.organization import (
    get_approval_configs,
    get_or_create_work_config,
    get_organization,
    update_approval_configs,
    update_organization,
    update_work_config,
)

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_ACTIONS = {"create", "read", "update", "delete", "approve", "export", "execute"}
VALID_ROLES = {"owner", "manager", "supervisor", "staff", "viewer"}

# Module key → approve permission mapping
APPROVAL_PERMISSION_MAP = {
    "purchasing.po": "purchasing.po.approve",
    "sales.order": "sales.order.approve",
    "hr.timesheet": "hr.timesheet.approve",
    "hr.leave": "hr.leave.approve",
    "workorder.order": "workorder.order.approve",
}


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
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    from sqlalchemy import func
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    base_query = select(User).where(User.org_id == org_id)
    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        base_query.order_by(User.created_at.desc()).limit(limit).offset(offset)
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
    token: dict = Depends(get_token_payload),
):
    """
    Audit log placeholder — returns recent user activity.
    Full audit logging would use a dedicated audit_logs table.
    """
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    result = await db.execute(
        select(User)
        .where(User.org_id == org_id)
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


# ============================================================
# ORGANIZATION CONFIG ROUTES  (Phase 4.1)
# ============================================================

@admin_router.get(
    "/organization",
    response_model=OrganizationResponse,
    dependencies=[Depends(require("admin.config.read"))],
)
async def api_get_organization(
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get current organization details."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_organization(db, org_id)


@admin_router.put(
    "/organization",
    response_model=OrganizationResponse,
    dependencies=[Depends(require("admin.config.update"))],
)
async def api_update_organization(
    body: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update organization details (name, tax_id, address)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    return await update_organization(db, org_id, update_data=update_data)


@admin_router.get(
    "/config/work",
    response_model=OrgWorkConfigResponse,
    dependencies=[Depends(require("admin.config.read"))],
)
async def api_get_work_config(
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get org work configuration (working days, hours per day)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_or_create_work_config(db, org_id)


@admin_router.put(
    "/config/work",
    response_model=OrgWorkConfigResponse,
    dependencies=[Depends(require("admin.config.update"))],
)
async def api_update_work_config(
    body: OrgWorkConfigUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update org work configuration."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    return await update_work_config(db, org_id, update_data=update_data)


@admin_router.get(
    "/config/approval",
    response_model=OrgApprovalConfigListResponse,
    dependencies=[Depends(require("admin.config.read"))],
)
async def api_get_approval_config(
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get approval bypass config for all modules."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items = await get_approval_configs(db, org_id)
    return OrgApprovalConfigListResponse(items=items)


@admin_router.put(
    "/config/approval",
    response_model=OrgApprovalConfigListResponse,
    dependencies=[Depends(require("admin.config.update"))],
)
async def api_update_approval_config(
    body: OrgApprovalConfigUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update approval bypass config per module."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    configs_data = [item.model_dump() for item in body.configs]
    items = await update_approval_configs(db, org_id, configs=configs_data)
    return OrgApprovalConfigListResponse(items=items)


# ============================================================
# APPROVER LIST ENDPOINT  (Phase 4.2)
# ============================================================

class ApproverResponse(BaseModel):
    id: UUID
    full_name: str
    email: str
    role: str

    class Config:
        from_attributes = True


@admin_router.get(
    "/approvers",
    response_model=list[ApproverResponse],
)
async def api_list_approvers(
    module: str = Query(..., description="Module key e.g. purchasing.po, sales.order"),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """
    Get users eligible to approve a given module.
    Any authenticated user can call this — no specific permission needed.
    Returns active users whose role grants the module's approve permission.
    """
    approve_perm = APPROVAL_PERMISSION_MAP.get(module)
    if not approve_perm:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown approval module: {module}. Valid: {list(APPROVAL_PERMISSION_MAP.keys())}",
        )

    # Find roles that have this approve permission
    eligible_roles = [
        role for role, perms in ROLE_PERMISSIONS.items()
        if approve_perm in perms
    ]

    if not eligible_roles:
        return []

    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    result = await db.execute(
        select(User).where(
            User.is_active == True,
            User.role.in_(eligible_roles),
            User.org_id == org_id,
        ).order_by(User.full_name)
    )
    users = list(result.scalars().all())
    return users
