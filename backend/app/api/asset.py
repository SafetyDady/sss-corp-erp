"""
SSS Corp ERP — Fixed Asset API
Phase C13: 16 endpoints (Category 4 + Asset 7 + Depreciation 5)
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
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
    request: Request,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    cat = await asset_service.create_category(db, org_id, req)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="CREATE", resource_type="asset_category",
        resource_id=str(cat.id),
        description=f"สร้างหมวดหมู่สินทรัพย์ {cat.name}",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return AssetCategoryResponse.model_validate(cat)


@router.put(
    "/categories/{category_id}",
    dependencies=[Depends(require("asset.category.update"))],
)
async def update_category(
    category_id: UUID,
    req: AssetCategoryUpdate,
    request: Request,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    update_data = req.model_dump(exclude_unset=True)
    cat = await asset_service.update_category(db, category_id, org_id, req)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="UPDATE", resource_type="asset_category",
        resource_id=str(category_id),
        description=f"แก้ไขหมวดหมู่สินทรัพย์ {category_id}",
        changes=update_data,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return AssetCategoryResponse.model_validate(cat)


@router.delete(
    "/categories/{category_id}",
    dependencies=[Depends(require("asset.category.delete"))],
    status_code=204,
)
async def delete_category(
    category_id: UUID,
    request: Request,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    await asset_service.delete_category(db, category_id, org_id)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="DELETE", resource_type="asset_category",
        resource_id=str(category_id),
        description=f"ลบหมวดหมู่สินทรัพย์ {category_id}",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()


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
    request: Request,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    asset = await asset_service.create_asset(db, org_id, req, user_id)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="CREATE", resource_type="fixed_asset",
        resource_id=str(asset.get("id", "")),
        description=f"สร้างสินทรัพย์ {asset.get('asset_code', '')} {asset.get('name', '')}",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return asset


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
    request: Request,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    update_data = req.model_dump(exclude_unset=True)
    result = await asset_service.update_asset(db, asset_id, org_id, req)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="UPDATE", resource_type="fixed_asset",
        resource_id=str(asset_id),
        description=f"แก้ไขสินทรัพย์ {asset_id}",
        changes=update_data,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return result


@router.delete(
    "/assets/{asset_id}",
    dependencies=[Depends(require("asset.asset.delete"))],
    status_code=204,
)
async def delete_asset(
    asset_id: UUID,
    request: Request,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    await asset_service.delete_asset(db, asset_id, org_id)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="DELETE", resource_type="fixed_asset",
        resource_id=str(asset_id),
        description=f"ลบสินทรัพย์ {asset_id}",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()


@router.post(
    "/assets/{asset_id}/dispose",
    dependencies=[Depends(require("asset.asset.delete"))],
)
async def dispose_asset(
    asset_id: UUID,
    req: AssetDisposeRequest,
    request: Request,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    result = await asset_service.dispose_asset(db, asset_id, org_id, req)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="delete", resource_type="asset",
        resource_id=str(asset_id),
        description=f"Disposed asset {asset_id}, amount={req.disposal_amount}",
        changes={"disposal_amount": str(req.disposal_amount), "disposed_date": str(req.disposed_date)},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return result


@router.post(
    "/assets/{asset_id}/retire",
    dependencies=[Depends(require("asset.asset.update"))],
)
async def retire_asset(
    asset_id: UUID,
    request: Request,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    result = await asset_service.retire_asset(db, asset_id, org_id)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="STATUS_CHANGE", resource_type="fixed_asset",
        resource_id=str(asset_id),
        description=f"ปลดสินทรัพย์ {asset_id}",
        changes={"status": {"old": "ACTIVE", "new": "RETIRED"}},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return result


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
    request: Request,
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    org_id = token_payload.get("org_id")
    user_id = UUID(token_payload.get("sub"))
    entries = await asset_service.generate_depreciation_entries(
        db, org_id, req.year, req.month, user_id
    )
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id, org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="execute", resource_type="depreciation",
        description=f"Generated {len(entries)} depreciation entries for {req.year}/{req.month:02d}",
        changes={"year": req.year, "month": req.month, "count": len(entries)},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
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
