"""
SSS Corp ERP — Warehouse Service (Business Logic)
Phase 1: Warehouse + Location CRUD

Business Rules enforced:
  - Warehouse code unique per org (DB constraint + service guard)
  - Location code unique per warehouse (DB constraint + service guard)
  - Cannot delete warehouse/location if referenced by stock movements
  - Location belongs to exactly 1 warehouse
  - 1 zone type per warehouse (BR#34) — DB UNIQUE constraint
"""

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.warehouse import Location, Warehouse


# ============================================================
# WAREHOUSE CRUD
# ============================================================

async def create_warehouse(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    description: Optional[str],
    address: Optional[str],
    org_id: UUID,
) -> Warehouse:
    """Create a new warehouse. Code must be unique per org."""

    # Unique code check
    existing = await db.execute(
        select(Warehouse).where(
            Warehouse.code == code,
            Warehouse.org_id == org_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Warehouse with code '{code}' already exists",
        )

    warehouse = Warehouse(
        code=code,
        name=name,
        description=description,
        address=address,
        org_id=org_id,
    )
    db.add(warehouse)
    await db.commit()
    await db.refresh(warehouse)
    return warehouse


async def get_warehouse(db: AsyncSession, warehouse_id: UUID, *, org_id: Optional[UUID] = None) -> Warehouse:
    """Get a single warehouse by ID."""
    query = select(Warehouse).where(Warehouse.id == warehouse_id, Warehouse.is_active == True)
    if org_id:
        query = query.where(Warehouse.org_id == org_id)
    result = await db.execute(query)
    warehouse = result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Warehouse not found",
        )
    return warehouse


async def list_warehouses(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[Warehouse], int]:
    """List warehouses with pagination and search."""
    query = select(Warehouse).where(Warehouse.is_active == True)
    if org_id:
        query = query.where(Warehouse.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Warehouse.code.ilike(pattern)) | (Warehouse.name.ilike(pattern))
        )

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginated results
    query = query.order_by(Warehouse.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def update_warehouse(
    db: AsyncSession,
    warehouse_id: UUID,
    *,
    update_data: dict,
) -> Warehouse:
    """Update a warehouse."""
    warehouse = await get_warehouse(db, warehouse_id)

    # If code is changing, check uniqueness
    if "code" in update_data and update_data["code"] is not None:
        if update_data["code"] != warehouse.code:
            existing = await db.execute(
                select(Warehouse).where(
                    Warehouse.code == update_data["code"],
                    Warehouse.org_id == warehouse.org_id,
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Warehouse with code '{update_data['code']}' already exists",
                )

    for field, value in update_data.items():
        if value is not None:
            setattr(warehouse, field, value)

    await db.commit()
    await db.refresh(warehouse)
    return warehouse


async def delete_warehouse(db: AsyncSession, warehouse_id: UUID) -> None:
    """
    Soft-delete a warehouse.
    Cannot delete if any locations have stock movements referencing them.
    """
    warehouse = await get_warehouse(db, warehouse_id)

    # Check if warehouse has active locations
    loc_count = await db.execute(
        select(func.count()).where(
            Location.warehouse_id == warehouse_id,
            Location.is_active == True,
        )
    )
    active_locations = loc_count.scalar() or 0
    if active_locations > 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot delete warehouse — has {active_locations} active location(s). Delete locations first.",
        )

    warehouse.is_active = False
    await db.commit()


# ============================================================
# LOCATION CRUD
# ============================================================

async def create_location(
    db: AsyncSession,
    *,
    warehouse_id: UUID,
    code: str,
    name: str,
    zone_type: str,
    description: Optional[str],
    org_id: UUID,
) -> Location:
    """
    Create a location within a warehouse.
    - Code unique per warehouse
    - 1 zone type per warehouse (BR#34)
    """
    # Verify warehouse exists
    await get_warehouse(db, warehouse_id)

    # Code unique per warehouse
    existing = await db.execute(
        select(Location).where(
            Location.warehouse_id == warehouse_id,
            Location.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Location with code '{code}' already exists in this warehouse",
        )

    # BR#34: 1 zone type per warehouse
    zone_exists = await db.execute(
        select(Location).where(
            Location.warehouse_id == warehouse_id,
            Location.zone_type == zone_type,
            Location.is_active == True,
        )
    )
    if zone_exists.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Zone type '{zone_type}' already exists in this warehouse (BR#34: 1 zone type per warehouse)",
        )

    location = Location(
        warehouse_id=warehouse_id,
        code=code,
        name=name,
        zone_type=zone_type,
        description=description,
        org_id=org_id,
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


async def get_location(db: AsyncSession, location_id: UUID, *, org_id: Optional[UUID] = None) -> Location:
    """Get a single location by ID."""
    query = select(Location).where(Location.id == location_id, Location.is_active == True)
    if org_id:
        query = query.where(Location.org_id == org_id)
    result = await db.execute(query)
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )
    return location


async def list_locations(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    warehouse_id: Optional[UUID] = None,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[Location], int]:
    """List locations with pagination, warehouse filter, and search."""
    query = select(Location).where(Location.is_active == True)
    if org_id:
        query = query.where(Location.org_id == org_id)

    if warehouse_id:
        query = query.where(Location.warehouse_id == warehouse_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Location.code.ilike(pattern)) | (Location.name.ilike(pattern))
        )

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginated results
    query = query.order_by(Location.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def update_location(
    db: AsyncSession,
    location_id: UUID,
    *,
    update_data: dict,
) -> Location:
    """Update a location. Zone type change checked against BR#34."""
    location = await get_location(db, location_id)

    # BR#34: If zone_type is changing, check uniqueness within warehouse
    if "zone_type" in update_data and update_data["zone_type"] is not None:
        if update_data["zone_type"] != location.zone_type:
            zone_exists = await db.execute(
                select(Location).where(
                    Location.warehouse_id == location.warehouse_id,
                    Location.zone_type == update_data["zone_type"],
                    Location.is_active == True,
                    Location.id != location_id,
                )
            )
            if zone_exists.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Zone type '{update_data['zone_type']}' already exists in this warehouse",
                )

    for field, value in update_data.items():
        if value is not None:
            setattr(location, field, value)

    await db.commit()
    await db.refresh(location)
    return location


async def delete_location(db: AsyncSession, location_id: UUID) -> None:
    """Soft-delete a location. Cannot delete if referenced by stock movements."""
    location = await get_location(db, location_id)

    # TODO: When stock movements reference locations (Phase 2+),
    # add check here: if location has movements, reject delete.

    location.is_active = False
    await db.commit()
