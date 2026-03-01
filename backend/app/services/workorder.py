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

from decimal import Decimal

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
    requested_approver_id: Optional[UUID] = None,
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
        requested_approver_id=requested_approver_id,
    )
    db.add(work_order)
    await db.commit()
    await db.refresh(work_order)
    return work_order


async def get_work_order(db: AsyncSession, wo_id: UUID, *, org_id: Optional[UUID] = None) -> WorkOrder:
    """Get a single work order by ID."""
    query = select(WorkOrder).where(WorkOrder.id == wo_id, WorkOrder.is_active == True)
    if org_id:
        query = query.where(WorkOrder.org_id == org_id)
    result = await db.execute(query)
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
    org_id: Optional[UUID] = None,
) -> tuple[list[WorkOrder], int]:
    """List work orders with pagination, search, and status filter."""
    query = select(WorkOrder).where(WorkOrder.is_active == True)
    if org_id:
        query = query.where(WorkOrder.org_id == org_id)

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
    Calculate WO cost summary — 4 components (BR#14):
      Material Cost    = Σ(CONSUME qty × unit_cost)
      ManHour Cost     = Σ((regular_hrs + ot_hrs × ot_factor) × employee_rate) (BR#15)
      Tools Recharge   = Σ(charge_amount from tool check-ins) (BR#16)
      Admin Overhead   = ManHour Cost × overhead_rate% (per cost center) (BR#17)
    """
    from app.models.hr import Employee, Timesheet, TimesheetStatus
    from app.models.master import CostCenter, OTType
    from app.models.tools import ToolCheckout

    wo = await get_work_order(db, wo_id)

    # 1. Material cost = CONSUME - RETURN (capped at 0)
    consume_result = await db.execute(
        select(
            func.coalesce(func.sum(StockMovement.quantity * StockMovement.unit_cost), 0)
        ).where(
            StockMovement.work_order_id == wo_id,
            StockMovement.movement_type == "CONSUME",
            StockMovement.is_reversed == False,
        )
    )
    consume_cost = Decimal(str(consume_result.scalar() or 0))

    return_result = await db.execute(
        select(
            func.coalesce(func.sum(StockMovement.quantity * StockMovement.unit_cost), 0)
        ).where(
            StockMovement.work_order_id == wo_id,
            StockMovement.movement_type == "RETURN",
            StockMovement.is_reversed == False,
        )
    )
    return_cost = Decimal(str(return_result.scalar() or 0))

    material_cost = max(consume_cost - return_cost, Decimal("0.00"))

    # 2. ManHour cost from FINAL timesheets (BR#15)
    ts_result = await db.execute(
        select(Timesheet).where(
            Timesheet.work_order_id == wo_id,
            Timesheet.status == TimesheetStatus.FINAL,
        )
    )
    timesheets = list(ts_result.scalars().all())

    manhour_cost = Decimal("0.00")
    for ts in timesheets:
        # Get employee rate
        emp_result = await db.execute(
            select(Employee).where(Employee.id == ts.employee_id)
        )
        emp = emp_result.scalar_one_or_none()
        if not emp:
            continue

        rate = emp.hourly_rate or Decimal("0")
        ot_factor = Decimal("1.5")  # default

        if ts.ot_type_id:
            ot_result = await db.execute(
                select(OTType).where(OTType.id == ts.ot_type_id)
            )
            ot_type = ot_result.scalar_one_or_none()
            if ot_type:
                ot_factor = ot_type.factor

        effective_hours = ts.regular_hours + (ts.ot_hours * ot_factor)
        manhour_cost += effective_hours * rate

    manhour_cost = manhour_cost.quantize(Decimal("0.01"))

    # 3. Tools recharge from check-ins (BR#16)
    tools_result = await db.execute(
        select(
            func.coalesce(func.sum(ToolCheckout.charge_amount), 0)
        ).where(
            ToolCheckout.work_order_id == wo_id,
            ToolCheckout.checkin_at.isnot(None),
        )
    )
    tools_recharge = Decimal(str(tools_result.scalar() or 0))

    # 4. Admin overhead (BR#17): ManHour Cost × overhead_rate%
    admin_overhead = Decimal("0.00")
    if wo.cost_center_code:
        cc_result = await db.execute(
            select(CostCenter).where(
                CostCenter.code == wo.cost_center_code,
                CostCenter.is_active == True,
            )
        )
        cc = cc_result.scalar_one_or_none()
        if cc and cc.overhead_rate > 0:
            admin_overhead = (manhour_cost * cc.overhead_rate / Decimal("100")).quantize(Decimal("0.01"))

    total_cost = material_cost + manhour_cost + tools_recharge + admin_overhead

    return {
        "wo_id": wo.id,
        "wo_number": wo.wo_number,
        "material_cost": float(material_cost),
        "manhour_cost": float(manhour_cost),
        "tools_recharge": float(tools_recharge),
        "admin_overhead": float(admin_overhead),
        "total_cost": float(total_cost),
    }


# ============================================================
# MANHOUR SUMMARY (Phase 5 — Step 5)
# ============================================================

async def get_manhour_summary(db: AsyncSession, wo_id: UUID) -> dict:
    """
    Return planned vs actual manhours for a work order.
    - planned: from WOMasterPlan.total_manhours
    - actual: Σ(regular_hours + ot_hours) from FINAL timesheets
    - workers: detail per employee per date
    """
    from app.models.hr import Employee, Timesheet, TimesheetStatus
    from app.models.planning import WOMasterPlan

    # Verify WO exists
    await get_work_order(db, wo_id)

    # 1. Planned manhours from WOMasterPlan
    plan_result = await db.execute(
        select(WOMasterPlan).where(WOMasterPlan.work_order_id == wo_id)
    )
    plan = plan_result.scalar_one_or_none()
    planned = Decimal(str(plan.total_manhours)) if plan else Decimal("0")

    # 2. Actual from FINAL timesheets
    ts_result = await db.execute(
        select(
            Timesheet.employee_id,
            Employee.full_name,
            Employee.employee_code,
            Timesheet.work_date,
            Timesheet.regular_hours,
            Timesheet.ot_hours,
        )
        .join(Employee, Timesheet.employee_id == Employee.id)
        .where(
            Timesheet.work_order_id == wo_id,
            Timesheet.status == TimesheetStatus.FINAL,
        )
        .order_by(Timesheet.work_date.desc())
    )
    rows = ts_result.all()

    actual = sum(Decimal(str(r.regular_hours)) + Decimal(str(r.ot_hours)) for r in rows) if rows else Decimal("0")
    remaining = planned - actual
    progress_pct = (actual / planned * 100) if planned > 0 else Decimal("0")

    workers = [
        {
            "employee_name": r.full_name,
            "employee_code": r.employee_code,
            "work_date": r.work_date.isoformat() if r.work_date else None,
            "regular_hours": float(r.regular_hours),
            "ot_hours": float(r.ot_hours),
            "total_hours": float(Decimal(str(r.regular_hours)) + Decimal(str(r.ot_hours))),
        }
        for r in rows
    ]

    return {
        "planned_manhours": float(planned),
        "actual_manhours": float(actual),
        "remaining_manhours": float(remaining),
        "progress_pct": round(float(progress_pct), 1),
        "workers": workers,
    }
