"""
SSS Corp ERP — Master Data Service (Business Logic)
CostCenter, CostElement, OTType

Business Rules enforced:
  BR#24 — Special OT Factor ≤ Maximum Ceiling
  BR#29 — Admin adjusts Factor + Max Ceiling in Master Data
  BR#30 — Overhead Rate per Cost Center (not one rate for all)
"""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.master import CostCenter, CostElement, OTType


# ============================================================
# COST CENTER CRUD
# ============================================================

async def create_cost_center(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    description: Optional[str],
    overhead_rate: Decimal,
    org_id: UUID,
) -> CostCenter:
    existing = await db.execute(
        select(CostCenter).where(
            CostCenter.org_id == org_id,
            CostCenter.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cost center with code '{code}' already exists",
        )

    cc = CostCenter(
        code=code,
        name=name,
        description=description,
        overhead_rate=overhead_rate,
        org_id=org_id,
    )
    db.add(cc)
    await db.commit()
    await db.refresh(cc)
    return cc


async def get_cost_center(db: AsyncSession, cc_id: UUID) -> CostCenter:
    result = await db.execute(
        select(CostCenter).where(CostCenter.id == cc_id, CostCenter.is_active == True)
    )
    cc = result.scalar_one_or_none()
    if not cc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cost center not found",
        )
    return cc


async def list_cost_centers(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
) -> tuple[list[CostCenter], int]:
    query = select(CostCenter).where(CostCenter.is_active == True)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (CostCenter.code.ilike(pattern)) | (CostCenter.name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(CostCenter.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_cost_center(
    db: AsyncSession,
    cc_id: UUID,
    *,
    update_data: dict,
) -> CostCenter:
    cc = await get_cost_center(db, cc_id)

    for field, value in update_data.items():
        if value is not None:
            setattr(cc, field, value)

    await db.commit()
    await db.refresh(cc)
    return cc


async def delete_cost_center(db: AsyncSession, cc_id: UUID) -> None:
    cc = await get_cost_center(db, cc_id)
    cc.is_active = False
    await db.commit()


# ============================================================
# COST ELEMENT CRUD
# ============================================================

async def create_cost_element(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    description: Optional[str],
    org_id: UUID,
) -> CostElement:
    existing = await db.execute(
        select(CostElement).where(
            CostElement.org_id == org_id,
            CostElement.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cost element with code '{code}' already exists",
        )

    ce = CostElement(
        code=code,
        name=name,
        description=description,
        org_id=org_id,
    )
    db.add(ce)
    await db.commit()
    await db.refresh(ce)
    return ce


async def get_cost_element(db: AsyncSession, ce_id: UUID) -> CostElement:
    result = await db.execute(
        select(CostElement).where(CostElement.id == ce_id, CostElement.is_active == True)
    )
    ce = result.scalar_one_or_none()
    if not ce:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cost element not found",
        )
    return ce


async def list_cost_elements(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
) -> tuple[list[CostElement], int]:
    query = select(CostElement).where(CostElement.is_active == True)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (CostElement.code.ilike(pattern)) | (CostElement.name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(CostElement.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_cost_element(
    db: AsyncSession,
    ce_id: UUID,
    *,
    update_data: dict,
) -> CostElement:
    ce = await get_cost_element(db, ce_id)

    for field, value in update_data.items():
        if value is not None:
            setattr(ce, field, value)

    await db.commit()
    await db.refresh(ce)
    return ce


async def delete_cost_element(db: AsyncSession, ce_id: UUID) -> None:
    ce = await get_cost_element(db, ce_id)
    ce.is_active = False
    await db.commit()


# ============================================================
# OT TYPE CRUD  (BR#24, BR#29)
# ============================================================

async def create_ot_type(
    db: AsyncSession,
    *,
    name: str,
    factor: Decimal,
    max_ceiling: Decimal,
    description: Optional[str],
    org_id: UUID,
) -> OTType:
    # BR#24: factor ≤ max_ceiling
    if factor > max_ceiling:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OT factor must be ≤ max_ceiling (BR#24)",
        )

    existing = await db.execute(
        select(OTType).where(
            OTType.org_id == org_id,
            OTType.name == name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"OT type with name '{name}' already exists",
        )

    ot = OTType(
        name=name,
        factor=factor,
        max_ceiling=max_ceiling,
        description=description,
        org_id=org_id,
    )
    db.add(ot)
    await db.commit()
    await db.refresh(ot)
    return ot


async def get_ot_type(db: AsyncSession, ot_id: UUID) -> OTType:
    result = await db.execute(
        select(OTType).where(OTType.id == ot_id, OTType.is_active == True)
    )
    ot = result.scalar_one_or_none()
    if not ot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OT type not found",
        )
    return ot


async def list_ot_types(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
) -> tuple[list[OTType], int]:
    query = select(OTType).where(OTType.is_active == True)

    if search:
        pattern = f"%{search}%"
        query = query.where(OTType.name.ilike(pattern))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(OTType.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_ot_type(
    db: AsyncSession,
    ot_id: UUID,
    *,
    update_data: dict,
) -> OTType:
    ot = await get_ot_type(db, ot_id)

    for field, value in update_data.items():
        if value is not None:
            setattr(ot, field, value)

    # BR#24: re-validate factor ≤ max_ceiling after update
    if ot.factor > ot.max_ceiling:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OT factor must be ≤ max_ceiling (BR#24)",
        )

    await db.commit()
    await db.refresh(ot)
    return ot


async def delete_ot_type(db: AsyncSession, ot_id: UUID) -> None:
    ot = await get_ot_type(db, ot_id)
    ot.is_active = False
    await db.commit()
