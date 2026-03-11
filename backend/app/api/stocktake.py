"""
SSS Corp ERP — Stock Take API
Phase 11.14: 9 endpoints
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.stocktake import (
    StockTakeApproveRequest,
    StockTakeCreate,
    StockTakeListResponse,
    StockTakeResponse,
    StockTakeUpdate,
)
from app.services import stocktake as svc

router = APIRouter(prefix="/api/inventory/stock-take", tags=["stocktake"])


@router.get("", response_model=StockTakeListResponse)
async def list_stocktakes(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None),
    status: str | None = Query(None),
    token_payload: dict = Depends(require("inventory.stocktake.read")),
    db: AsyncSession = Depends(get_db),
):
    org_id = UUID(token_payload["org_id"])
    return await svc.list_stocktakes(
        db, org_id=org_id, limit=limit, offset=offset, search=search, status=status,
    )


@router.post("", response_model=StockTakeResponse, status_code=201)
async def create_stocktake(
    body: StockTakeCreate,
    token_payload: dict = Depends(require("inventory.stocktake.create")),
    db: AsyncSession = Depends(get_db),
):
    org_id = UUID(token_payload["org_id"])
    user_id = UUID(token_payload["sub"])
    return await svc.create_stocktake(db, body=body, created_by=user_id, org_id=org_id)


@router.get("/products")
async def get_stocktake_products(
    warehouse_id: UUID = Query(...),
    location_id: UUID | None = Query(None),
    token_payload: dict = Depends(require("inventory.stocktake.create")),
    db: AsyncSession = Depends(get_db),
):
    org_id = UUID(token_payload["org_id"])
    return await svc.get_stocktake_products(
        db, warehouse_id=warehouse_id, location_id=location_id, org_id=org_id,
    )


@router.get("/{stocktake_id}", response_model=StockTakeResponse)
async def get_stocktake(
    stocktake_id: UUID,
    token_payload: dict = Depends(require("inventory.stocktake.read")),
    db: AsyncSession = Depends(get_db),
):
    org_id = UUID(token_payload["org_id"])
    return await svc.get_stocktake(db, stocktake_id, org_id)


@router.put("/{stocktake_id}", response_model=StockTakeResponse)
async def update_stocktake(
    stocktake_id: UUID,
    body: StockTakeUpdate,
    token_payload: dict = Depends(require("inventory.stocktake.update")),
    db: AsyncSession = Depends(get_db),
):
    org_id = UUID(token_payload["org_id"])
    return await svc.update_stocktake(db, stocktake_id, body=body, org_id=org_id)


@router.delete("/{stocktake_id}", status_code=204)
async def delete_stocktake(
    stocktake_id: UUID,
    token_payload: dict = Depends(require("inventory.stocktake.delete")),
    db: AsyncSession = Depends(get_db),
):
    org_id = UUID(token_payload["org_id"])
    await svc.delete_stocktake(db, stocktake_id, org_id)


@router.post("/{stocktake_id}/submit", response_model=StockTakeResponse)
async def submit_stocktake(
    stocktake_id: UUID,
    token_payload: dict = Depends(require("inventory.stocktake.create")),
    db: AsyncSession = Depends(get_db),
):
    org_id = UUID(token_payload["org_id"])
    return await svc.submit_stocktake(db, stocktake_id, org_id)


@router.post("/{stocktake_id}/approve", response_model=StockTakeResponse)
async def approve_stocktake(
    stocktake_id: UUID,
    body: StockTakeApproveRequest,
    token_payload: dict = Depends(require("inventory.stocktake.approve")),
    db: AsyncSession = Depends(get_db),
):
    org_id = UUID(token_payload["org_id"])
    user_id = UUID(token_payload["sub"])
    return await svc.approve_stocktake(
        db, stocktake_id,
        action=body.action, reason=body.reason,
        approved_by=user_id, org_id=org_id,
    )


@router.post("/{stocktake_id}/cancel", response_model=StockTakeResponse)
async def cancel_stocktake(
    stocktake_id: UUID,
    token_payload: dict = Depends(require("inventory.stocktake.update")),
    db: AsyncSession = Depends(get_db),
):
    org_id = UUID(token_payload["org_id"])
    return await svc.cancel_stocktake(db, stocktake_id, org_id)
