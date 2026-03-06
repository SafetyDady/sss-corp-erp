"""
SSS Corp ERP — Fixed Asset Service
Phase C13: Asset Register + Depreciation Calculation

Reuses patterns from:
  - recharge.py (monthly generation)
  - inventory.py (CRUD + validation)
"""

import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import (
    AssetCategory,
    AssetStatus,
    DepreciationEntry,
    DepreciationMethod,
    FixedAsset,
)
from app.models.master import CostCenter
from app.schemas.asset import (
    AssetCategoryCreate,
    AssetCategoryUpdate,
    AssetCreate,
    AssetDisposeRequest,
    AssetSummaryResponse,
    AssetUpdate,
    DepreciationSummaryResponse,
)


# ============================================================
# ASSET CATEGORY CRUD
# ============================================================

async def list_categories(
    db: AsyncSession,
    org_id: UUID,
) -> list[AssetCategory]:
    result = await db.execute(
        select(AssetCategory)
        .where(AssetCategory.org_id == org_id, AssetCategory.is_active == True)
        .order_by(AssetCategory.code)
    )
    return list(result.scalars().all())


async def create_category(
    db: AsyncSession,
    org_id: UUID,
    req: AssetCategoryCreate,
) -> AssetCategory:
    # Check unique code
    existing = await db.execute(
        select(AssetCategory).where(
            AssetCategory.org_id == org_id,
            AssetCategory.code == req.code.upper(),
            AssetCategory.is_active == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Category code '{req.code}' already exists")

    cat = AssetCategory(
        org_id=org_id,
        code=req.code.upper(),
        name=req.name,
        useful_life_years=req.useful_life_years,
        depreciation_rate=req.depreciation_rate,
        depreciation_method=DepreciationMethod.STRAIGHT_LINE,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


async def update_category(
    db: AsyncSession,
    category_id: UUID,
    org_id: UUID,
    req: AssetCategoryUpdate,
) -> AssetCategory:
    result = await db.execute(
        select(AssetCategory).where(
            AssetCategory.id == category_id,
            AssetCategory.org_id == org_id,
            AssetCategory.is_active == True,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if req.name is not None:
        cat.name = req.name
    if req.useful_life_years is not None:
        cat.useful_life_years = req.useful_life_years
    if req.depreciation_rate is not None:
        cat.depreciation_rate = req.depreciation_rate

    await db.commit()
    await db.refresh(cat)
    return cat


async def delete_category(
    db: AsyncSession,
    category_id: UUID,
    org_id: UUID,
) -> None:
    result = await db.execute(
        select(AssetCategory).where(
            AssetCategory.id == category_id,
            AssetCategory.org_id == org_id,
            AssetCategory.is_active == True,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check no assets using this category
    asset_count = await db.execute(
        select(func.count()).where(
            FixedAsset.category_id == category_id,
            FixedAsset.is_active == True,
        )
    )
    if (asset_count.scalar() or 0) > 0:
        raise HTTPException(
            status_code=422,
            detail="Cannot delete category with existing assets"
        )

    cat.is_active = False
    await db.commit()


# ============================================================
# FIXED ASSET CRUD
# ============================================================

async def _next_asset_code(db: AsyncSession, org_id: UUID) -> str:
    """Generate next AST-XXXX code."""
    result = await db.execute(
        select(func.count()).where(
            FixedAsset.org_id == org_id,
        )
    )
    count = (result.scalar() or 0) + 1
    return f"AST-{count:04d}"


async def _enrich_asset(db: AsyncSession, asset: FixedAsset) -> dict:
    """Enrich asset with related names for response."""
    data = {
        "id": asset.id,
        "asset_code": asset.asset_code,
        "asset_name": asset.asset_name,
        "description": asset.description,
        "category_id": asset.category_id,
        "acquisition_date": asset.acquisition_date,
        "acquisition_cost": asset.acquisition_cost,
        "salvage_value": asset.salvage_value,
        "useful_life_years": asset.useful_life_years,
        "depreciation_method": asset.depreciation_method.value if asset.depreciation_method else "STRAIGHT_LINE",
        "accumulated_depreciation": asset.accumulated_depreciation,
        "net_book_value": asset.net_book_value,
        "status": asset.status.value if asset.status else "ACTIVE",
        "disposed_date": asset.disposed_date,
        "disposal_amount": asset.disposal_amount,
        "cost_center_id": asset.cost_center_id,
        "location": asset.location,
        "responsible_employee_id": asset.responsible_employee_id,
        "tool_id": asset.tool_id,
        "po_id": asset.po_id,
        "created_by": asset.created_by,
        "created_at": asset.created_at,
        "is_active": asset.is_active,
    }

    # Category name
    cat = await db.execute(
        select(AssetCategory.name).where(AssetCategory.id == asset.category_id)
    )
    data["category_name"] = cat.scalar_one_or_none()

    # Cost center name
    cc = await db.execute(
        select(CostCenter.name).where(CostCenter.id == asset.cost_center_id)
    )
    data["cost_center_name"] = cc.scalar_one_or_none()

    # Employee name
    if asset.responsible_employee_id:
        from app.models.hr import Employee
        emp = await db.execute(
            select(Employee.full_name).where(Employee.id == asset.responsible_employee_id)
        )
        data["responsible_employee_name"] = emp.scalar_one_or_none()
    else:
        data["responsible_employee_name"] = None

    # Tool code
    if asset.tool_id:
        from app.models.tools import Tool
        tool = await db.execute(
            select(Tool.code).where(Tool.id == asset.tool_id)
        )
        data["tool_code"] = tool.scalar_one_or_none()
    else:
        data["tool_code"] = None

    # PO number
    if asset.po_id:
        from app.models.purchasing import PurchaseOrder
        po = await db.execute(
            select(PurchaseOrder.po_number).where(PurchaseOrder.id == asset.po_id)
        )
        data["po_number"] = po.scalar_one_or_none()
    else:
        data["po_number"] = None

    # Creator name
    from app.models.user import User
    user = await db.execute(
        select(User.full_name).where(User.id == asset.created_by)
    )
    data["created_by_name"] = user.scalar_one_or_none()

    # Monthly depreciation (computed)
    depreciable = Decimal(str(asset.acquisition_cost)) - Decimal(str(asset.salvage_value))
    total_months = int(asset.useful_life_years) * 12
    if total_months > 0 and depreciable > 0:
        data["monthly_depreciation"] = (depreciable / Decimal(str(total_months))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    else:
        data["monthly_depreciation"] = Decimal("0")

    # Remaining life months
    accum = Decimal(str(asset.accumulated_depreciation))
    if data["monthly_depreciation"] and data["monthly_depreciation"] > 0:
        remaining_amount = depreciable - accum
        if remaining_amount > 0:
            data["remaining_life_months"] = int(
                (remaining_amount / data["monthly_depreciation"]).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            )
        else:
            data["remaining_life_months"] = 0
    else:
        data["remaining_life_months"] = 0

    # Disposal gain/loss
    if asset.disposed_date and asset.disposal_amount is not None:
        data["disposal_gain_loss"] = Decimal(str(asset.disposal_amount)) - Decimal(str(asset.net_book_value))
    else:
        data["disposal_gain_loss"] = None

    return data


async def list_assets(
    db: AsyncSession,
    org_id: UUID,
    *,
    search: Optional[str] = None,
    status: Optional[str] = None,
    category_id: Optional[UUID] = None,
    cost_center_id: Optional[UUID] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict], int]:
    query = select(FixedAsset).where(
        FixedAsset.org_id == org_id,
        FixedAsset.is_active == True,
    )

    if search:
        s = f"%{search}%"
        query = query.where(
            (FixedAsset.asset_code.ilike(s)) |
            (FixedAsset.asset_name.ilike(s))
        )
    if status:
        query = query.where(FixedAsset.status == status)
    if category_id:
        query = query.where(FixedAsset.category_id == category_id)
    if cost_center_id:
        query = query.where(FixedAsset.cost_center_id == cost_center_id)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch
    result = await db.execute(
        query.order_by(FixedAsset.asset_code).limit(limit).offset(offset)
    )
    assets = result.scalars().all()

    enriched = []
    for asset in assets:
        enriched.append(await _enrich_asset(db, asset))

    return enriched, total


async def get_asset(
    db: AsyncSession,
    asset_id: UUID,
    org_id: UUID,
) -> dict:
    result = await db.execute(
        select(FixedAsset).where(
            FixedAsset.id == asset_id,
            FixedAsset.org_id == org_id,
            FixedAsset.is_active == True,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return await _enrich_asset(db, asset)


async def create_asset(
    db: AsyncSession,
    org_id: UUID,
    req: AssetCreate,
    created_by: UUID,
) -> dict:
    # Validate category
    cat_result = await db.execute(
        select(AssetCategory).where(
            AssetCategory.id == req.category_id,
            AssetCategory.org_id == org_id,
            AssetCategory.is_active == True,
        )
    )
    category = cat_result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Validate cost center
    cc_result = await db.execute(
        select(CostCenter).where(
            CostCenter.id == req.cost_center_id,
            CostCenter.org_id == org_id,
            CostCenter.is_active == True,
        )
    )
    if not cc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cost center not found")

    # Auto-generate code if not provided
    asset_code = req.asset_code or await _next_asset_code(db, org_id)

    # Check unique code (BR#141)
    existing = await db.execute(
        select(FixedAsset).where(
            FixedAsset.org_id == org_id,
            FixedAsset.asset_code == asset_code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Asset code '{asset_code}' already exists")

    # Check tool_id uniqueness (BR#144)
    if req.tool_id:
        tool_check = await db.execute(
            select(FixedAsset).where(
                FixedAsset.tool_id == req.tool_id,
                FixedAsset.is_active == True,
            )
        )
        if tool_check.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="This tool is already linked to another asset")

    useful_life = req.useful_life_years or category.useful_life_years
    acq_cost = Decimal(str(req.acquisition_cost))
    salvage = Decimal(str(req.salvage_value))

    asset = FixedAsset(
        org_id=org_id,
        asset_code=asset_code,
        asset_name=req.asset_name,
        description=req.description,
        category_id=req.category_id,
        acquisition_date=req.acquisition_date,
        acquisition_cost=acq_cost,
        salvage_value=salvage,
        useful_life_years=useful_life,
        depreciation_method=DepreciationMethod.STRAIGHT_LINE,
        accumulated_depreciation=Decimal("0"),
        net_book_value=acq_cost,
        status=AssetStatus.ACTIVE,
        cost_center_id=req.cost_center_id,
        location=req.location,
        responsible_employee_id=req.responsible_employee_id,
        tool_id=req.tool_id,
        po_id=req.po_id,
        created_by=created_by,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return await _enrich_asset(db, asset)


async def update_asset(
    db: AsyncSession,
    asset_id: UUID,
    org_id: UUID,
    req: AssetUpdate,
) -> dict:
    result = await db.execute(
        select(FixedAsset).where(
            FixedAsset.id == asset_id,
            FixedAsset.org_id == org_id,
            FixedAsset.is_active == True,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if req.asset_name is not None:
        asset.asset_name = req.asset_name
    if req.description is not None:
        asset.description = req.description
    if req.location is not None:
        asset.location = req.location
    if req.responsible_employee_id is not None:
        asset.responsible_employee_id = req.responsible_employee_id
    if req.cost_center_id is not None:
        # Validate CC
        cc = await db.execute(
            select(CostCenter).where(
                CostCenter.id == req.cost_center_id,
                CostCenter.org_id == org_id,
                CostCenter.is_active == True,
            )
        )
        if not cc.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Cost center not found")
        asset.cost_center_id = req.cost_center_id

    if req.salvage_value is not None:
        # Check if has depreciation entries — cannot change salvage after depreciation (BR#140 extended)
        dep_count = await db.execute(
            select(func.count()).where(DepreciationEntry.asset_id == asset_id)
        )
        if (dep_count.scalar() or 0) > 0:
            raise HTTPException(
                status_code=422,
                detail="Cannot change salvage value after depreciation has started"
            )
        asset.salvage_value = req.salvage_value
        asset.net_book_value = Decimal(str(asset.acquisition_cost)) - Decimal(str(asset.accumulated_depreciation))

    if req.tool_id is not None:
        # Check uniqueness (BR#144)
        tool_check = await db.execute(
            select(FixedAsset).where(
                FixedAsset.tool_id == req.tool_id,
                FixedAsset.is_active == True,
                FixedAsset.id != asset_id,
            )
        )
        if tool_check.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="This tool is already linked to another asset")
        asset.tool_id = req.tool_id

    await db.commit()
    await db.refresh(asset)
    return await _enrich_asset(db, asset)


async def delete_asset(
    db: AsyncSession,
    asset_id: UUID,
    org_id: UUID,
) -> None:
    result = await db.execute(
        select(FixedAsset).where(
            FixedAsset.id == asset_id,
            FixedAsset.org_id == org_id,
            FixedAsset.is_active == True,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Check no depreciation entries (BR#142)
    dep_count = await db.execute(
        select(func.count()).where(DepreciationEntry.asset_id == asset_id)
    )
    if (dep_count.scalar() or 0) > 0:
        raise HTTPException(
            status_code=422,
            detail="Cannot delete asset with depreciation entries. Use Dispose instead."
        )

    asset.is_active = False
    await db.commit()


async def dispose_asset(
    db: AsyncSession,
    asset_id: UUID,
    org_id: UUID,
    req: AssetDisposeRequest,
) -> dict:
    """Dispose asset — set status DISPOSED + calc gain/loss (BR#143)."""
    result = await db.execute(
        select(FixedAsset).where(
            FixedAsset.id == asset_id,
            FixedAsset.org_id == org_id,
            FixedAsset.is_active == True,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.status not in (AssetStatus.ACTIVE, AssetStatus.FULLY_DEPRECIATED):
        raise HTTPException(
            status_code=422,
            detail=f"Cannot dispose asset with status {asset.status.value}"
        )

    asset.status = AssetStatus.DISPOSED
    asset.disposed_date = req.disposed_date
    asset.disposal_amount = req.disposal_amount

    await db.commit()
    await db.refresh(asset)
    return await _enrich_asset(db, asset)


async def retire_asset(
    db: AsyncSession,
    asset_id: UUID,
    org_id: UUID,
) -> dict:
    """Retire asset — still owned but not in use."""
    result = await db.execute(
        select(FixedAsset).where(
            FixedAsset.id == asset_id,
            FixedAsset.org_id == org_id,
            FixedAsset.is_active == True,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.status != AssetStatus.ACTIVE:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot retire asset with status {asset.status.value}"
        )

    asset.status = AssetStatus.RETIRED
    await db.commit()
    await db.refresh(asset)
    return await _enrich_asset(db, asset)


# ============================================================
# ASSET SUMMARY
# ============================================================

async def get_asset_summary(
    db: AsyncSession,
    org_id: UUID,
) -> AssetSummaryResponse:
    base = select(FixedAsset).where(
        FixedAsset.org_id == org_id,
        FixedAsset.is_active == True,
    )

    # Total count
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0

    # By status
    for s in [AssetStatus.ACTIVE, AssetStatus.FULLY_DEPRECIATED, AssetStatus.DISPOSED, AssetStatus.RETIRED]:
        pass  # will query individually

    active_q = select(func.count()).where(
        FixedAsset.org_id == org_id, FixedAsset.is_active == True,
        FixedAsset.status == AssetStatus.ACTIVE,
    )
    active = (await db.execute(active_q)).scalar() or 0

    fd_q = select(func.count()).where(
        FixedAsset.org_id == org_id, FixedAsset.is_active == True,
        FixedAsset.status == AssetStatus.FULLY_DEPRECIATED,
    )
    fully_dep = (await db.execute(fd_q)).scalar() or 0

    disposed_q = select(func.count()).where(
        FixedAsset.org_id == org_id, FixedAsset.is_active == True,
        FixedAsset.status == AssetStatus.DISPOSED,
    )
    disposed = (await db.execute(disposed_q)).scalar() or 0

    retired_q = select(func.count()).where(
        FixedAsset.org_id == org_id, FixedAsset.is_active == True,
        FixedAsset.status == AssetStatus.RETIRED,
    )
    retired = (await db.execute(retired_q)).scalar() or 0

    # Totals
    cost_sum = (await db.execute(
        select(func.coalesce(func.sum(FixedAsset.acquisition_cost), 0)).where(
            FixedAsset.org_id == org_id, FixedAsset.is_active == True,
        )
    )).scalar() or Decimal("0")

    accum_sum = (await db.execute(
        select(func.coalesce(func.sum(FixedAsset.accumulated_depreciation), 0)).where(
            FixedAsset.org_id == org_id, FixedAsset.is_active == True,
        )
    )).scalar() or Decimal("0")

    nbv_sum = (await db.execute(
        select(func.coalesce(func.sum(FixedAsset.net_book_value), 0)).where(
            FixedAsset.org_id == org_id, FixedAsset.is_active == True,
        )
    )).scalar() or Decimal("0")

    return AssetSummaryResponse(
        total_assets=total,
        total_active=active,
        total_fully_depreciated=fully_dep,
        total_disposed=disposed,
        total_retired=retired,
        total_acquisition_cost=Decimal(str(cost_sum)),
        total_accumulated_depreciation=Decimal(str(accum_sum)),
        total_net_book_value=Decimal(str(nbv_sum)),
    )


# ============================================================
# DEPRECIATION
# ============================================================

async def generate_depreciation_entries(
    db: AsyncSession,
    org_id: UUID,
    year: int,
    month: int,
    generated_by: UUID,
) -> list[DepreciationEntry]:
    """
    Generate monthly depreciation entries for all ACTIVE assets.
    Straight-Line: monthly_dep = (cost - salvage) / (life × 12)

    BR#137: SL formula
    BR#138: No duplicate period
    BR#139: Skip DISPOSED/RETIRED
    """
    # Check no duplicate for this period (BR#138)
    existing_count = (await db.execute(
        select(func.count()).where(
            DepreciationEntry.org_id == org_id,
            DepreciationEntry.period_year == year,
            DepreciationEntry.period_month == month,
        )
    )).scalar() or 0

    if existing_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Depreciation entries already generated for {year}/{month:02d}"
        )

    # Load all active assets (BR#139)
    result = await db.execute(
        select(FixedAsset).where(
            FixedAsset.org_id == org_id,
            FixedAsset.is_active == True,
            FixedAsset.status == AssetStatus.ACTIVE,
        )
    )
    assets = result.scalars().all()

    period_end = date(year, month, calendar.monthrange(year, month)[1])
    entries = []

    for asset in assets:
        acq_date = asset.acquisition_date
        acq_cost = Decimal(str(asset.acquisition_cost))
        salvage = Decimal(str(asset.salvage_value))
        accum = Decimal(str(asset.accumulated_depreciation))
        depreciable = acq_cost - salvage

        # Skip if acquisition date is after this period
        if acq_date > period_end:
            continue

        # Skip if already fully depreciated
        if accum >= depreciable:
            continue

        total_months = int(asset.useful_life_years) * 12
        if total_months <= 0:
            continue

        monthly_dep = (depreciable / Decimal(str(total_months))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        # Pro-rata for first month
        period_start = date(year, month, 1)
        if acq_date.year == year and acq_date.month == month:
            # Acquired this month — pro-rata
            days_in_month = calendar.monthrange(year, month)[1]
            remaining_days = days_in_month - acq_date.day + 1
            monthly_dep = (monthly_dep * Decimal(str(remaining_days)) / Decimal(str(days_in_month))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        # Cap: don't exceed depreciable amount
        remaining_depreciable = depreciable - accum
        if monthly_dep > remaining_depreciable:
            monthly_dep = remaining_depreciable

        if monthly_dep <= 0:
            continue

        new_accum = accum + monthly_dep
        new_nbv = acq_cost - new_accum

        entry = DepreciationEntry(
            org_id=org_id,
            asset_id=asset.id,
            period_year=year,
            period_month=month,
            depreciation_amount=monthly_dep,
            accumulated_depreciation=new_accum,
            net_book_value=new_nbv,
            generated_by=generated_by,
        )
        entries.append(entry)

        # Update asset denormalized fields
        asset.accumulated_depreciation = new_accum
        asset.net_book_value = new_nbv

        # Check if fully depreciated
        if new_accum >= depreciable:
            asset.status = AssetStatus.FULLY_DEPRECIATED

    if entries:
        db.add_all(entries)
        await db.commit()

        # Refresh entries
        for e in entries:
            await db.refresh(e)

    return entries


async def list_depreciation_entries(
    db: AsyncSession,
    org_id: UUID,
    *,
    asset_id: Optional[UUID] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    query = select(DepreciationEntry).where(
        DepreciationEntry.org_id == org_id,
    )

    if asset_id:
        query = query.where(DepreciationEntry.asset_id == asset_id)
    if year:
        query = query.where(DepreciationEntry.period_year == year)
    if month:
        query = query.where(DepreciationEntry.period_month == month)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    result = await db.execute(
        query.order_by(
            DepreciationEntry.period_year.desc(),
            DepreciationEntry.period_month.desc(),
            DepreciationEntry.asset_id,
        ).limit(limit).offset(offset)
    )
    entries = result.scalars().all()

    # Enrich with asset info
    enriched = []
    for entry in entries:
        asset_info = await db.execute(
            select(
                FixedAsset.asset_code,
                FixedAsset.asset_name,
                FixedAsset.category_id,
            ).where(FixedAsset.id == entry.asset_id)
        )
        row = asset_info.first()
        cat_name = None
        if row and row.category_id:
            cat_result = await db.execute(
                select(AssetCategory.name).where(AssetCategory.id == row.category_id)
            )
            cat_name = cat_result.scalar_one_or_none()

        enriched.append({
            "id": entry.id,
            "asset_id": entry.asset_id,
            "asset_code": row.asset_code if row else None,
            "asset_name": row.asset_name if row else None,
            "category_name": cat_name,
            "period_year": entry.period_year,
            "period_month": entry.period_month,
            "depreciation_amount": entry.depreciation_amount,
            "accumulated_depreciation": entry.accumulated_depreciation,
            "net_book_value": entry.net_book_value,
            "generated_by": entry.generated_by,
            "created_at": entry.created_at,
        })

    return enriched, total


async def get_depreciation_summary(
    db: AsyncSession,
    org_id: UUID,
    year: Optional[int] = None,
) -> list[DepreciationSummaryResponse]:
    """Get monthly depreciation summary — grouped by period."""
    query = select(
        DepreciationEntry.period_year,
        DepreciationEntry.period_month,
        func.count(DepreciationEntry.id).label("total_assets"),
        func.sum(DepreciationEntry.depreciation_amount).label("total_dep"),
    ).where(
        DepreciationEntry.org_id == org_id,
    ).group_by(
        DepreciationEntry.period_year,
        DepreciationEntry.period_month,
    ).order_by(
        DepreciationEntry.period_year.desc(),
        DepreciationEntry.period_month.desc(),
    )

    if year:
        query = query.where(DepreciationEntry.period_year == year)

    result = await db.execute(query)
    rows = result.all()

    summaries = []
    for row in rows:
        # Get max accumulated for this period
        max_accum = (await db.execute(
            select(func.sum(DepreciationEntry.accumulated_depreciation)).where(
                DepreciationEntry.org_id == org_id,
                DepreciationEntry.period_year == row.period_year,
                DepreciationEntry.period_month == row.period_month,
            )
        )).scalar() or Decimal("0")

        summaries.append(DepreciationSummaryResponse(
            period_year=row.period_year,
            period_month=row.period_month,
            total_assets_depreciated=row.total_assets,
            total_depreciation_amount=Decimal(str(row.total_dep or 0)),
            total_accumulated=Decimal(str(max_accum)),
        ))

    return summaries
