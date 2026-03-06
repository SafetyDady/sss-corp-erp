"""
SSS Corp ERP — Fixed Asset API
Phase C13: 16 endpoints (Category 4 + Asset 7 + Depreciation 5)
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.asset import (
    AssetCategoryCreate,
    AssetCategoryResponse,
    AssetCategoryUpdate,
    AssetCreate,
    AssetDisposeRequest,
    AssetResponse,
    AssetSummaryResponse,
    AssetUpdate,
    DepreciationEntryResponse,
    DepreciationGenerateRequest,
    DepreciationSummaryResponse,
)
from app.services import asset as asset_service

router = APIRouter(prefix="/api/asset", tags=["asset"])


# ============================================================
# ASSET CATEGORY
# ============================================================

@router.get(
    "/categories",
    dependencies=[Depends(require("asset.category.read"))],
)
async def list_categories(
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    categories = await asset_service.list_categories(db, org_id)
    return {"items": [AssetCategoryResponse.model_validate(c) for c in categories]}


@router.post(
    "/categories",
    dependencies=[Depends(require("asset.category.create"))],
    status_code=201,
)
async def create_category(
    req: AssetCategoryCreate,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    cat = await asset_service.create_category(db, org_id, req)
    return AssetCategoryResponse.model_validate(cat)


@router.put(
    "/categories/{category_id}",
    dependencies=[Depends(require("asset.category.update"))],
)
async def update_category(
    category_id: UUID,
    req: AssetCategoryUpdate,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    cat = await asset_service.update_category(db, category_id, org_id, req)
    return AssetCategoryResponse.model_validate(cat)


@router.delete(
    "/categories/{category_id}",
    dependencies=[Depends(require("asset.category.delete"))],
    status_code=204,
)
async def delete_category(
    category_id: UUID,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    await asset_service.delete_category(db, category_id, org_id)


# ============================================================
# FIXED ASSET
# ============================================================

@router.get(
    "/assets",
    dependencies=[Depends(require("asset.asset.read"))],
)
async def list_assets(
    search: Optional[str] = None,
    status: Optional[str] = None,
    category_id: Optional[UUID] = None,
    cost_center_id: Optional[UUID] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    items, total = await asset_service.list_assets(
        db, org_id,
        search=search, status=status,
        category_id=category_id, cost_center_id=cost_center_id,
        limit=limit, offset=offset,
    )
    return {"items": items, "total": total}


@router.get(
    "/assets/summary",
    dependencies=[Depends(require("asset.asset.read"))],
)
async def get_asset_summary(
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    return await asset_service.get_asset_summary(db, org_id)


@router.post(
    "/assets",
    dependencies=[Depends(require("asset.asset.create"))],
    status_code=201,
)
async def create_asset(
    req: AssetCreate,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    return await asset_service.create_asset(db, org_id, req, user_id)


@router.get(
    "/assets/{asset_id}",
    dependencies=[Depends(require("asset.asset.read"))],
)
async def get_asset(
    asset_id: UUID,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    return await asset_service.get_asset(db, asset_id, org_id)


@router.put(
    "/assets/{asset_id}",
    dependencies=[Depends(require("asset.asset.update"))],
)
async def update_asset(
    asset_id: UUID,
    req: AssetUpdate,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    return await asset_service.update_asset(db, asset_id, org_id, req)


@router.delete(
    "/assets/{asset_id}",
    dependencies=[Depends(require("asset.asset.delete"))],
    status_code=204,
)
async def delete_asset(
    asset_id: UUID,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    await asset_service.delete_asset(db, asset_id, org_id)


@router.post(
    "/assets/{asset_id}/dispose",
    dependencies=[Depends(require("asset.asset.delete"))],
)
async def dispose_asset(
    asset_id: UUID,
    req: AssetDisposeRequest,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    return await asset_service.dispose_asset(db, asset_id, org_id, req)


@router.post(
    "/assets/{asset_id}/retire",
    dependencies=[Depends(require("asset.asset.update"))],
)
async def retire_asset(
    asset_id: UUID,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    return await asset_service.retire_asset(db, asset_id, org_id)


# ============================================================
# DEPRECIATION
# ============================================================

@router.get(
    "/depreciation",
    dependencies=[Depends(require("asset.depreciation.read"))],
)
async def list_depreciation(
    asset_id: Optional[UUID] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    items, total = await asset_service.list_depreciation_entries(
        db, org_id,
        asset_id=asset_id, year=year, month=month,
        limit=limit, offset=offset,
    )
    return {"items": items, "total": total}


@router.post(
    "/depreciation/generate",
    dependencies=[Depends(require("asset.depreciation.execute"))],
    status_code=201,
)
async def generate_depreciation(
    req: DepreciationGenerateRequest,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    entries = await asset_service.generate_depreciation_entries(
        db, org_id, req.year, req.month, user_id
    )
    return {
        "message": f"Generated {len(entries)} depreciation entries for {req.year}/{req.month:02d}",
        "count": len(entries),
    }


@router.get(
    "/depreciation/summary",
    dependencies=[Depends(require("asset.depreciation.read"))],
)
async def get_depreciation_summary(
    year: Optional[int] = None,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    summaries = await asset_service.get_depreciation_summary(db, org_id, year)
    return {"items": summaries}
