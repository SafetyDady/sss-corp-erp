"""
SSS Corp ERP — Warehouse API Routes
Phase 1: Warehouse + Location CRUD

Endpoints (from CLAUDE.md):
  GET    /api/warehouse/warehouses            warehouse.warehouse.read
  POST   /api/warehouse/warehouses            warehouse.warehouse.create
  GET    /api/warehouse/warehouses/{id}       warehouse.warehouse.read
  PUT    /api/warehouse/warehouses/{id}       warehouse.warehouse.update
  DELETE /api/warehouse/warehouses/{id}       warehouse.warehouse.delete

  GET    /api/warehouse/locations             warehouse.location.read
  POST   /api/warehouse/locations             warehouse.location.create
  GET    /api/warehouse/locations/{id}        warehouse.location.read
  PUT    /api/warehouse/locations/{id}        warehouse.location.update
  DELETE /api/warehouse/locations/{id}        warehouse.location.delete
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.warehouse import (
    LocationCreate,
    LocationListResponse,
    LocationResponse,
    LocationUpdate,
    WarehouseCreate,
    WarehouseListResponse,
    WarehouseResponse,
    WarehouseUpdate,
)
from app.services.warehouse import (
    create_location,
    create_warehouse,
    delete_location,
    delete_warehouse,
    get_location,
    get_warehouse,
    list_locations,
    list_warehouses,
    update_location,
    update_warehouse,
)


# ============================================================
# WAREHOUSE ROUTES
# ============================================================

warehouse_router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


@warehouse_router.get(
    "/warehouses",
    response_model=WarehouseListResponse,
    dependencies=[Depends(require("warehouse.warehouse.read"))],
)
async def api_list_warehouses(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List warehouses with pagination and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_warehouses(db, limit=limit, offset=offset, search=search, org_id=org_id)
    return WarehouseListResponse(items=items, total=total, limit=limit, offset=offset)


@warehouse_router.post(
    "/warehouses",
    response_model=WarehouseResponse,
    status_code=201,
    dependencies=[Depends(require("warehouse.warehouse.create"))],
)
async def api_create_warehouse(
    body: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new warehouse."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    return await create_warehouse(
        db,
        code=body.code,
        name=body.name,
        description=body.description,
        address=body.address,
        org_id=org_id,
    )


@warehouse_router.get(
    "/warehouses/{warehouse_id}",
    response_model=WarehouseResponse,
    dependencies=[Depends(require("warehouse.warehouse.read"))],
)
async def api_get_warehouse(
    warehouse_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single warehouse by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_warehouse(db, warehouse_id, org_id=org_id)


@warehouse_router.put(
    "/warehouses/{warehouse_id}",
    response_model=WarehouseResponse,
    dependencies=[Depends(require("warehouse.warehouse.update"))],
)
async def api_update_warehouse(
    warehouse_id: UUID,
    body: WarehouseUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing warehouse."""
    update_data = body.model_dump(exclude_unset=True)
    return await update_warehouse(db, warehouse_id, update_data=update_data)


@warehouse_router.delete(
    "/warehouses/{warehouse_id}",
    status_code=204,
    dependencies=[Depends(require("warehouse.warehouse.delete"))],
)
async def api_delete_warehouse(
    warehouse_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a warehouse."""
    await delete_warehouse(db, warehouse_id)


# ============================================================
# LOCATION ROUTES
# ============================================================

@warehouse_router.get(
    "/locations",
    response_model=LocationListResponse,
    dependencies=[Depends(require("warehouse.location.read"))],
)
async def api_list_locations(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    warehouse_id: Optional[UUID] = Query(default=None),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List locations with pagination, warehouse filter, and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_locations(
        db, limit=limit, offset=offset, warehouse_id=warehouse_id, search=search, org_id=org_id
    )
    return LocationListResponse(items=items, total=total, limit=limit, offset=offset)


@warehouse_router.post(
    "/locations",
    response_model=LocationResponse,
    status_code=201,
    dependencies=[Depends(require("warehouse.location.create"))],
)
async def api_create_location(
    body: LocationCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new location within a warehouse."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    return await create_location(
        db,
        warehouse_id=body.warehouse_id,
        code=body.code,
        name=body.name,
        zone_type=body.zone_type,
        description=body.description,
        org_id=org_id,
    )


@warehouse_router.get(
    "/locations/{location_id}",
    response_model=LocationResponse,
    dependencies=[Depends(require("warehouse.location.read"))],
)
async def api_get_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single location by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_location(db, location_id, org_id=org_id)


@warehouse_router.put(
    "/locations/{location_id}",
    response_model=LocationResponse,
    dependencies=[Depends(require("warehouse.location.update"))],
)
async def api_update_location(
    location_id: UUID,
    body: LocationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing location."""
    update_data = body.model_dump(exclude_unset=True)
    return await update_location(db, location_id, update_data=update_data)


@warehouse_router.delete(
    "/locations/{location_id}",
    status_code=204,
    dependencies=[Depends(require("warehouse.location.delete"))],
)
async def api_delete_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a location."""
    await delete_location(db, location_id)
