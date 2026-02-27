"""
SSS Corp ERP — Organization Service (Business Logic)
Phase 4.1: Organization, Department, OrgWorkConfig, OrgApprovalConfig
"""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import (
    Department,
    OrgApprovalConfig,
    OrgWorkConfig,
    Organization,
)
from app.schemas.organization import VALID_APPROVAL_MODULES


# ============================================================
# ORGANIZATION (single org for now — multi-tenant Phase 4.7)
# ============================================================

async def get_organization(db: AsyncSession, org_id: UUID) -> Organization:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org


async def update_organization(
    db: AsyncSession,
    org_id: UUID,
    *,
    update_data: dict,
) -> Organization:
    org = await get_organization(db, org_id)
    for field, value in update_data.items():
        if value is not None:
            setattr(org, field, value)
    await db.commit()
    await db.refresh(org)
    return org


# ============================================================
# DEPARTMENT CRUD
# ============================================================

async def create_department(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    cost_center_id: UUID,
    head_id: Optional[UUID],
    org_id: UUID,
) -> Department:
    # Check code unique per org
    existing = await db.execute(
        select(Department).where(
            Department.org_id == org_id,
            Department.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Department with code '{code}' already exists",
        )

    # Check cost_center 1:1 per org
    cc_exists = await db.execute(
        select(Department).where(
            Department.org_id == org_id,
            Department.cost_center_id == cost_center_id,
            Department.is_active == True,
        )
    )
    if cc_exists.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This cost center is already assigned to another department (1:1 rule)",
        )

    dept = Department(
        code=code,
        name=name,
        cost_center_id=cost_center_id,
        head_id=head_id,
        org_id=org_id,
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


async def get_department(db: AsyncSession, dept_id: UUID, *, org_id: Optional[UUID] = None) -> Department:
    query = select(Department).where(Department.id == dept_id, Department.is_active == True)
    if org_id:
        query = query.where(Department.org_id == org_id)
    result = await db.execute(query)
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found",
        )
    return dept


async def list_departments(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[Department], int]:
    query = select(Department).where(Department.is_active == True)
    if org_id:
        query = query.where(Department.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Department.code.ilike(pattern)) | (Department.name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Department.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_department(
    db: AsyncSession,
    dept_id: UUID,
    *,
    update_data: dict,
    org_id: UUID,
) -> Department:
    dept = await get_department(db, dept_id)

    # If changing cost_center_id, check 1:1
    new_cc = update_data.get("cost_center_id")
    if new_cc is not None and new_cc != dept.cost_center_id:
        cc_exists = await db.execute(
            select(Department).where(
                Department.org_id == org_id,
                Department.cost_center_id == new_cc,
                Department.is_active == True,
                Department.id != dept_id,
            )
        )
        if cc_exists.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This cost center is already assigned to another department (1:1 rule)",
            )

    for field, value in update_data.items():
        if value is not None:
            setattr(dept, field, value)

    await db.commit()
    await db.refresh(dept)
    return dept


async def delete_department(db: AsyncSession, dept_id: UUID) -> None:
    dept = await get_department(db, dept_id)
    dept.is_active = False
    await db.commit()


# ============================================================
# ORG WORK CONFIG
# ============================================================

async def get_or_create_work_config(db: AsyncSession, org_id: UUID) -> OrgWorkConfig:
    result = await db.execute(
        select(OrgWorkConfig).where(OrgWorkConfig.org_id == org_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        config = OrgWorkConfig(
            org_id=org_id,
            working_days=[1, 2, 3, 4, 5, 6],
            hours_per_day=Decimal("8.00"),
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return config


async def update_work_config(
    db: AsyncSession,
    org_id: UUID,
    *,
    update_data: dict,
) -> OrgWorkConfig:
    config = await get_or_create_work_config(db, org_id)
    for field, value in update_data.items():
        if value is not None:
            setattr(config, field, value)
    await db.commit()
    await db.refresh(config)
    return config


# ============================================================
# ORG APPROVAL CONFIG
# ============================================================

async def get_approval_configs(
    db: AsyncSession, org_id: UUID
) -> list[OrgApprovalConfig]:
    result = await db.execute(
        select(OrgApprovalConfig).where(OrgApprovalConfig.org_id == org_id)
    )
    configs = list(result.scalars().all())

    # Ensure all modules are represented (auto-create missing ones)
    existing_keys = {c.module_key for c in configs}
    missing_keys = set(VALID_APPROVAL_MODULES) - existing_keys
    if missing_keys:
        for key in missing_keys:
            new_config = OrgApprovalConfig(
                org_id=org_id,
                module_key=key,
                require_approval=True,
            )
            db.add(new_config)
            configs.append(new_config)
        await db.commit()
        for c in configs:
            await db.refresh(c)

    return configs


async def update_approval_configs(
    db: AsyncSession,
    org_id: UUID,
    *,
    configs: list[dict],
) -> list[OrgApprovalConfig]:
    # Get or create all configs first
    existing = await get_approval_configs(db, org_id)
    existing_map = {c.module_key: c for c in existing}

    for item in configs:
        key = item["module_key"]
        require = item["require_approval"]
        if key in existing_map:
            existing_map[key].require_approval = require
        else:
            new_config = OrgApprovalConfig(
                org_id=org_id,
                module_key=key,
                require_approval=require,
            )
            db.add(new_config)

    await db.commit()

    # Re-fetch all
    result = await db.execute(
        select(OrgApprovalConfig).where(OrgApprovalConfig.org_id == org_id)
    )
    return list(result.scalars().all())


# ============================================================
# APPROVAL BYPASS CHECK  (Phase 4.2)
# ============================================================

async def check_approval_bypass(
    db: AsyncSession,
    org_id: UUID,
    module_key: str,
) -> bool:
    """
    Return True if approval is bypassed (require_approval == False) for this module.
    If no config row exists, approval is required by default.
    """
    result = await db.execute(
        select(OrgApprovalConfig).where(
            OrgApprovalConfig.org_id == org_id,
            OrgApprovalConfig.module_key == module_key,
        )
    )
    config = result.scalar_one_or_none()
    if config is None:
        return False  # Default: approval required
    return not config.require_approval
