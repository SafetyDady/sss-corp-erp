"""
SSS Corp ERP — Work Order Service (Business Logic)
Phase 1: Work Order CRUD + Status Machine + Cost Summary

Business Rules enforced:
  - wo_number auto = "WO-{YYYY}-{NNNN}" unique per org, immutable
  - Status: DRAFT → OPEN → CLOSED (no reverse, no skip)
  - CLOSED WO cannot be edited
  - Cannot delete WO with stock movements
  - Delete only DRAFT (soft-delete)
  - Cost Summary: Material + ManHour + Tools + Overhead (Phase 2 will populate latter 3)
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import StockMovement
from app.models.workorder import VALID_TRANSITIONS, WOStatus, WorkOrder


# ============================================================
# WO NUMBER GENERATOR
# ============================================================

async def _next_wo_number(db: AsyncSession, org_id: UUID) -> str:
    """Generate next WO number: WO-{YYYY}-{NNNN}."""
    year = datetime.now(timezone.utc).year

    prefix = f"WO-{year}-"
    result = await db.execute(
        select(func.count())
        .where(
            WorkOrder.org_id == org_id,
            WorkOrder.wo_number.like(f"{prefix}%"),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


# ============================================================
# WORK ORDER CRUD
# ============================================================

async def create_work_order(
    db: AsyncSession,
    *,
    customer_name: Optional[str],
    description: Optional[str],
    cost_center_code: Optional[str],
    created_by: UUID,
    org_id: UUID,
) -> WorkOrder:
    """Create a new Work Order in DRAFT status with auto-generated wo_number."""

    wo_number = await _next_wo_number(db, org_id)

    work_order = WorkOrder(
        wo_number=wo_number,
        status=WOStatus.DRAFT,
        customer_name=customer_name,
        description=description,
        cost_center_code=cost_center_code,
        created_by=created_by,
        org_id=org_id,
    )
    db.add(work_order)
    await db.commit()
    await db.refresh(work_order)
    return work_order


async def get_work_order(db: AsyncSession, wo_id: UUID) -> WorkOrder:
    """Get a single work order by ID."""
    result = await db.execute(
        select(WorkOrder).where(WorkOrder.id == wo_id, WorkOrder.is_active == True)
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found",
        )
    return wo


async def list_work_orders(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    wo_status: Optional[str] = None,
) -> tuple[list[WorkOrder], int]:
    """List work orders with pagination, search, and status filter."""
    query = select(WorkOrder).where(WorkOrder.is_active == True)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (WorkOrder.wo_number.ilike(pattern))
            | (WorkOrder.customer_name.ilike(pattern))
            | (WorkOrder.description.ilike(pattern))
        )

    if wo_status:
        query = query.where(WorkOrder.status == wo_status)

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginated results
    query = query.order_by(WorkOrder.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def update_work_order(
    db: AsyncSession,
    wo_id: UUID,
    *,
    update_data: dict,
) -> WorkOrder:
    """
    Update a work order.
    - CLOSED WO cannot be edited.
    - wo_number is immutable (not in update schema).
    """
    wo = await get_work_order(db, wo_id)

    if wo.status == WOStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot edit a CLOSED work order",
        )

    for field, value in update_data.items():
        if value is not None:
            setattr(wo, field, value)

    await db.commit()
    await db.refresh(wo)
    return wo


async def delete_work_order(
    db: AsyncSession,
    wo_id: UUID,
    *,
    user_id: UUID,
    user_role: str,
) -> None:
    """
    Soft-delete a work order.
    - Only DRAFT status
    - Cannot delete if stock movements reference this WO
    - Owner of the WO or user with owner role
    """
    wo = await get_work_order(db, wo_id)

    if wo.status != WOStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot delete work order in {wo.status.value} status — only DRAFT can be deleted",
        )

    # Check stock movements referencing this WO
    movement_count = await db.execute(
        select(func.count()).where(
            StockMovement.work_order_id == wo_id,
            StockMovement.is_reversed == False,
        )
    )
    if (movement_count.scalar() or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot delete work order — has stock movements referencing it",
        )

    # Owner of the WO or owner role
    if wo.created_by != user_id and user_role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the WO creator or owner role can delete a work order",
        )

    wo.is_active = False
    await db.commit()


# ============================================================
# STATUS TRANSITIONS
# ============================================================

async def open_work_order(db: AsyncSession, wo_id: UUID) -> WorkOrder:
    """Transition: DRAFT → OPEN. Sets opened_at timestamp."""
    wo = await get_work_order(db, wo_id)

    if WOStatus.OPEN not in VALID_TRANSITIONS.get(wo.status, []):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from {wo.status.value} to OPEN — "
                   f"valid transitions: {[t.value for t in VALID_TRANSITIONS.get(wo.status, [])]}",
        )

    wo.status = WOStatus.OPEN
    wo.opened_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wo)
    return wo


async def close_work_order(db: AsyncSession, wo_id: UUID) -> WorkOrder:
    """Transition: OPEN → CLOSED. Sets closed_at timestamp."""
    wo = await get_work_order(db, wo_id)

    if WOStatus.CLOSED not in VALID_TRANSITIONS.get(wo.status, []):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from {wo.status.value} to CLOSED — "
                   f"valid transitions: {[t.value for t in VALID_TRANSITIONS.get(wo.status, [])]}",
        )

    wo.status = WOStatus.CLOSED
    wo.closed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wo)
    return wo


# ============================================================
# COST SUMMARY
# ============================================================

async def get_cost_summary(db: AsyncSession, wo_id: UUID) -> dict:
    """
    Calculate WO cost summary (4 components).
    Phase 1: Only material_cost from CONSUME movements is implemented.
    Phase 2 will add: manhour_cost, tools_recharge, admin_overhead.

    material_cost = Σ(CONSUME qty × unit_cost) for this WO
    """
    wo = await get_work_order(db, wo_id)

    # Material cost from stock movements linked to this WO
    mat_result = await db.execute(
        select(
            func.coalesce(func.sum(StockMovement.quantity * StockMovement.unit_cost), 0)
        ).where(
            StockMovement.work_order_id == wo_id,
            StockMovement.movement_type == "CONSUME",
            StockMovement.is_reversed == False,
        )
    )
    material_cost = float(mat_result.scalar() or 0)

    # Phase 2 placeholders
    manhour_cost = 0.0
    tools_recharge = 0.0
    admin_overhead = 0.0

    total_cost = material_cost + manhour_cost + tools_recharge + admin_overhead

    return {
        "wo_id": wo.id,
        "wo_number": wo.wo_number,
        "material_cost": material_cost,
        "manhour_cost": manhour_cost,
        "tools_recharge": tools_recharge,
        "admin_overhead": admin_overhead,
        "total_cost": total_cost,
    }
