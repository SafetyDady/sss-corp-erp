"""
SSS Corp ERP — Planning Service (Business Logic)
Phase 4.5: WO Master Plan, Daily Plan, Material & Tool Reservation

Business Rules enforced:
  BR#40 — Daily Plan: 1 employee = 1 WO per day (no double-booking)
  BR#41 — Daily Plan: 1 tool = 1 WO per day
  BR#42 — Daily Plan: employee on leave cannot be assigned
  BR#43 — Daily Plan: plan up to 14 days ahead only
  BR#44 — MaterialReservation: available = on_hand - SUM(active reserved)
  BR#45 — ToolReservation: no overlapping active reservations
  BR#46 — WO Master Plan: 1 plan per WO
"""

from datetime import date, timedelta, timezone
from datetime import datetime as dt_datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession


# ============================================================
# MASTER PLAN  (BR#46 — 1 plan per WO)
# ============================================================

async def create_master_plan(
    db: AsyncSession,
    *,
    work_order_id: UUID,
    planned_start: date,
    planned_end: date,
    total_manhours: Decimal,
    note: Optional[str],
    lines: list[dict],
    org_id: UUID,
) -> "WOMasterPlan":
    """Create a master plan for a work order. One plan per WO (BR#46)."""
    from app.models.planning import WOMasterPlan, WOMasterPlanLine

    # Check WO exists
    from app.models.workorder import WorkOrder
    wo_result = await db.execute(
        select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.is_active == True)
    )
    wo = wo_result.scalar_one_or_none()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found",
        )

    # BR#46: Only 1 plan per WO
    existing = await db.execute(
        select(WOMasterPlan).where(WOMasterPlan.work_order_id == work_order_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Master plan already exists for this work order (BR#46)",
        )

    plan = WOMasterPlan(
        work_order_id=work_order_id,
        planned_start=planned_start,
        planned_end=planned_end,
        total_manhours=total_manhours,
        note=note,
        org_id=org_id,
    )
    db.add(plan)
    await db.flush()

    # Create lines
    for line_data in lines:
        line = WOMasterPlanLine(
            plan_id=plan.id,
            line_type=line_data["line_type"],
            employee_count=line_data.get("employee_count"),
            skill_description=line_data.get("skill_description"),
            estimated_hours=line_data.get("estimated_hours"),
            product_id=line_data.get("product_id"),
            quantity=line_data.get("quantity"),
            tool_id=line_data.get("tool_id"),
            estimated_days=line_data.get("estimated_days"),
        )
        db.add(line)

    await db.commit()
    await db.refresh(plan)

    # Load lines for response
    lines_result = await db.execute(
        select(WOMasterPlanLine).where(WOMasterPlanLine.plan_id == plan.id)
    )
    plan.lines = list(lines_result.scalars().all())
    return plan


async def get_master_plan(
    db: AsyncSession,
    work_order_id: UUID,
) -> "WOMasterPlan":
    """Get the master plan for a work order."""
    from app.models.planning import WOMasterPlan, WOMasterPlanLine

    result = await db.execute(
        select(WOMasterPlan).where(WOMasterPlan.work_order_id == work_order_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master plan not found for this work order",
        )

    # Load lines
    lines_result = await db.execute(
        select(WOMasterPlanLine).where(WOMasterPlanLine.plan_id == plan.id)
    )
    plan.lines = list(lines_result.scalars().all())
    return plan


async def update_master_plan(
    db: AsyncSession,
    work_order_id: UUID,
    *,
    update_data: dict,
    lines: Optional[list[dict]] = None,
) -> "WOMasterPlan":
    """Update the master plan for a work order. Replace lines if provided."""
    from app.models.planning import WOMasterPlan, WOMasterPlanLine

    result = await db.execute(
        select(WOMasterPlan).where(WOMasterPlan.work_order_id == work_order_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master plan not found for this work order",
        )

    # Update scalar fields
    for field, value in update_data.items():
        if value is not None and field != "lines":
            setattr(plan, field, value)

    # Replace lines if provided (delete all + re-create)
    if lines is not None:
        # Delete existing lines
        existing_lines = await db.execute(
            select(WOMasterPlanLine).where(WOMasterPlanLine.plan_id == plan.id)
        )
        for old_line in existing_lines.scalars().all():
            await db.delete(old_line)
        await db.flush()

        # Create new lines
        for line_data in lines:
            line = WOMasterPlanLine(
                plan_id=plan.id,
                line_type=line_data["line_type"],
                employee_count=line_data.get("employee_count"),
                skill_description=line_data.get("skill_description"),
                estimated_hours=line_data.get("estimated_hours"),
                product_id=line_data.get("product_id"),
                quantity=line_data.get("quantity"),
                tool_id=line_data.get("tool_id"),
                estimated_days=line_data.get("estimated_days"),
            )
            db.add(line)

    await db.commit()
    await db.refresh(plan)

    # Reload lines
    lines_result = await db.execute(
        select(WOMasterPlanLine).where(WOMasterPlanLine.plan_id == plan.id)
    )
    plan.lines = list(lines_result.scalars().all())
    return plan


# ============================================================
# DAILY PLAN  (BR#40-43)
# ============================================================

async def _validate_daily_plan_date(plan_date: date) -> None:
    """BR#43: Plan up to 14 days ahead only."""
    today = dt_datetime.now(timezone.utc).date()
    max_date = today + timedelta(days=14)
    if plan_date > max_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot plan more than 14 days ahead (max: {max_date}) (BR#43)",
        )


async def _check_employee_conflicts(
    db: AsyncSession,
    employee_ids: list[UUID],
    plan_date: date,
    exclude_daily_plan_id: Optional[UUID] = None,
) -> None:
    """
    BR#40: 1 employee = 1 WO per day.
    Check if any employee is already assigned to a different daily plan on the same date.
    """
    from app.models.planning import DailyPlan, DailyPlanWorker

    if not employee_ids:
        return

    query = (
        select(DailyPlanWorker.employee_id, DailyPlan.work_order_id)
        .join(DailyPlan, DailyPlanWorker.daily_plan_id == DailyPlan.id)
        .where(
            DailyPlan.plan_date == plan_date,
            DailyPlanWorker.employee_id.in_(employee_ids),
        )
    )
    if exclude_daily_plan_id:
        query = query.where(DailyPlan.id != exclude_daily_plan_id)

    result = await db.execute(query)
    conflicts = result.all()
    if conflicts:
        conflict_ids = [str(row[0]) for row in conflicts]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Employee(s) already assigned on {plan_date}: {', '.join(conflict_ids)} (BR#40)",
        )


async def _check_tool_conflicts(
    db: AsyncSession,
    tool_ids: list[UUID],
    plan_date: date,
    exclude_daily_plan_id: Optional[UUID] = None,
) -> None:
    """
    BR#41: 1 tool = 1 WO per day.
    Check if any tool is already assigned to a different daily plan on the same date.
    """
    from app.models.planning import DailyPlan, DailyPlanTool

    if not tool_ids:
        return

    query = (
        select(DailyPlanTool.tool_id, DailyPlan.work_order_id)
        .join(DailyPlan, DailyPlanTool.daily_plan_id == DailyPlan.id)
        .where(
            DailyPlan.plan_date == plan_date,
            DailyPlanTool.tool_id.in_(tool_ids),
        )
    )
    if exclude_daily_plan_id:
        query = query.where(DailyPlan.id != exclude_daily_plan_id)

    result = await db.execute(query)
    conflicts = result.all()
    if conflicts:
        conflict_ids = [str(row[0]) for row in conflicts]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tool(s) already assigned on {plan_date}: {', '.join(conflict_ids)} (BR#41)",
        )


async def _check_employee_leave(
    db: AsyncSession,
    employee_ids: list[UUID],
    plan_date: date,
) -> None:
    """
    BR#42: Employee on approved leave cannot be assigned.
    Check via Leave model (APPROVED status) covering the plan_date.
    """
    from app.models.hr import Leave, LeaveStatus

    if not employee_ids:
        return

    result = await db.execute(
        select(Leave.employee_id)
        .where(
            Leave.employee_id.in_(employee_ids),
            Leave.status == LeaveStatus.APPROVED,
            Leave.start_date <= plan_date,
            Leave.end_date >= plan_date,
        )
    )
    on_leave = [row[0] for row in result.all()]
    if on_leave:
        leave_ids = [str(eid) for eid in on_leave]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Employee(s) on approved leave on {plan_date}: {', '.join(leave_ids)} (BR#42)",
        )


async def create_daily_plan(
    db: AsyncSession,
    *,
    plan_date: date,
    work_order_id: UUID,
    created_by: UUID,
    org_id: UUID,
    note: Optional[str],
    workers: list[dict],
    tools: list[dict],
    materials: list[dict],
) -> "DailyPlan":
    """Create a daily plan with workers, tools, and materials."""
    from app.models.planning import (
        DailyPlan,
        DailyPlanMaterial,
        DailyPlanTool,
        DailyPlanWorker,
    )
    from app.models.workorder import WorkOrder

    # Validate WO exists and is OPEN
    wo_result = await db.execute(
        select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.is_active == True)
    )
    wo = wo_result.scalar_one_or_none()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found",
        )

    # BR#43: Max 14 days ahead
    await _validate_daily_plan_date(plan_date)

    # BR#40: Employee conflict check
    employee_ids = [w["employee_id"] for w in workers]
    await _check_employee_conflicts(db, employee_ids, plan_date)

    # BR#42: Employee leave check
    await _check_employee_leave(db, employee_ids, plan_date)

    # BR#41: Tool conflict check
    tool_ids = [t["tool_id"] for t in tools]
    await _check_tool_conflicts(db, tool_ids, plan_date)

    # Create daily plan
    daily_plan = DailyPlan(
        plan_date=plan_date,
        work_order_id=work_order_id,
        created_by=created_by,
        org_id=org_id,
        note=note,
    )
    db.add(daily_plan)
    await db.flush()

    # Create workers
    for w in workers:
        db.add(DailyPlanWorker(
            daily_plan_id=daily_plan.id,
            employee_id=w["employee_id"],
            planned_hours=w.get("planned_hours", Decimal("8.00")),
        ))

    # Create tools
    for t in tools:
        db.add(DailyPlanTool(
            daily_plan_id=daily_plan.id,
            tool_id=t["tool_id"],
        ))

    # Create materials
    for m in materials:
        db.add(DailyPlanMaterial(
            daily_plan_id=daily_plan.id,
            product_id=m["product_id"],
            planned_qty=m["planned_qty"],
        ))

    await db.commit()
    await db.refresh(daily_plan)

    # Load children for response
    daily_plan = await _load_daily_plan_children(db, daily_plan)
    return daily_plan


async def _load_daily_plan_children(db: AsyncSession, daily_plan: "DailyPlan") -> "DailyPlan":
    """Load workers, tools, and materials for a daily plan."""
    from app.models.planning import DailyPlanMaterial, DailyPlanTool, DailyPlanWorker

    workers_result = await db.execute(
        select(DailyPlanWorker).where(DailyPlanWorker.daily_plan_id == daily_plan.id)
    )
    daily_plan.workers = list(workers_result.scalars().all())

    tools_result = await db.execute(
        select(DailyPlanTool).where(DailyPlanTool.daily_plan_id == daily_plan.id)
    )
    daily_plan.tools = list(tools_result.scalars().all())

    materials_result = await db.execute(
        select(DailyPlanMaterial).where(DailyPlanMaterial.daily_plan_id == daily_plan.id)
    )
    daily_plan.materials = list(materials_result.scalars().all())

    return daily_plan


async def list_daily_plans(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    plan_date: Optional[date] = None,
    date_end: Optional[date] = None,
    work_order_id: Optional[UUID] = None,
) -> tuple[list, int]:
    """List daily plans with filtering and pagination."""
    from app.models.planning import DailyPlan

    query = select(DailyPlan)

    if plan_date:
        if date_end:
            query = query.where(
                DailyPlan.plan_date >= plan_date,
                DailyPlan.plan_date <= date_end,
            )
        else:
            query = query.where(DailyPlan.plan_date == plan_date)

    if work_order_id:
        query = query.where(DailyPlan.work_order_id == work_order_id)

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginated results
    query = query.order_by(DailyPlan.plan_date.desc(), DailyPlan.created_at.desc())
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())

    # Load children for each plan
    for plan in items:
        await _load_daily_plan_children(db, plan)

    return items, total


async def get_daily_plan(db: AsyncSession, plan_id: UUID) -> "DailyPlan":
    """Get a single daily plan by ID."""
    from app.models.planning import DailyPlan

    result = await db.execute(
        select(DailyPlan).where(DailyPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Daily plan not found",
        )

    await _load_daily_plan_children(db, plan)
    return plan


async def update_daily_plan(
    db: AsyncSession,
    plan_id: UUID,
    *,
    note: Optional[str] = None,
    workers: Optional[list[dict]] = None,
    tools: Optional[list[dict]] = None,
    materials: Optional[list[dict]] = None,
) -> "DailyPlan":
    """Update a daily plan. Replace workers/tools/materials if provided."""
    from app.models.planning import (
        DailyPlan,
        DailyPlanMaterial,
        DailyPlanTool,
        DailyPlanWorker,
    )

    result = await db.execute(
        select(DailyPlan).where(DailyPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Daily plan not found",
        )

    if note is not None:
        plan.note = note

    # Replace workers if provided
    if workers is not None:
        # BR#40: conflict check for new workers
        employee_ids = [w["employee_id"] for w in workers]
        await _check_employee_conflicts(db, employee_ids, plan.plan_date, exclude_daily_plan_id=plan.id)
        # BR#42: leave check
        await _check_employee_leave(db, employee_ids, plan.plan_date)

        # Delete existing workers
        old_workers = await db.execute(
            select(DailyPlanWorker).where(DailyPlanWorker.daily_plan_id == plan.id)
        )
        for ow in old_workers.scalars().all():
            await db.delete(ow)
        await db.flush()

        # Create new workers
        for w in workers:
            db.add(DailyPlanWorker(
                daily_plan_id=plan.id,
                employee_id=w["employee_id"],
                planned_hours=w.get("planned_hours", Decimal("8.00")),
            ))

    # Replace tools if provided
    if tools is not None:
        # BR#41: conflict check for new tools
        tool_ids = [t["tool_id"] for t in tools]
        await _check_tool_conflicts(db, tool_ids, plan.plan_date, exclude_daily_plan_id=plan.id)

        # Delete existing tools
        old_tools = await db.execute(
            select(DailyPlanTool).where(DailyPlanTool.daily_plan_id == plan.id)
        )
        for ot in old_tools.scalars().all():
            await db.delete(ot)
        await db.flush()

        # Create new tools
        for t in tools:
            db.add(DailyPlanTool(
                daily_plan_id=plan.id,
                tool_id=t["tool_id"],
            ))

    # Replace materials if provided
    if materials is not None:
        old_materials = await db.execute(
            select(DailyPlanMaterial).where(DailyPlanMaterial.daily_plan_id == plan.id)
        )
        for om in old_materials.scalars().all():
            await db.delete(om)
        await db.flush()

        for m in materials:
            db.add(DailyPlanMaterial(
                daily_plan_id=plan.id,
                product_id=m["product_id"],
                planned_qty=m["planned_qty"],
            ))

    await db.commit()
    await db.refresh(plan)
    await _load_daily_plan_children(db, plan)
    return plan


async def delete_daily_plan(db: AsyncSession, plan_id: UUID) -> None:
    """Delete a daily plan and all its children (CASCADE)."""
    from app.models.planning import (
        DailyPlan,
        DailyPlanMaterial,
        DailyPlanTool,
        DailyPlanWorker,
    )

    result = await db.execute(
        select(DailyPlan).where(DailyPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Daily plan not found",
        )

    # Delete children first (explicit, in case CASCADE is not set on the ORM level)
    await db.execute(
        select(DailyPlanWorker).where(DailyPlanWorker.daily_plan_id == plan.id)
    )
    for child_cls in [DailyPlanWorker, DailyPlanTool, DailyPlanMaterial]:
        child_result = await db.execute(
            select(child_cls).where(child_cls.daily_plan_id == plan.id)
        )
        for child in child_result.scalars().all():
            await db.delete(child)

    await db.delete(plan)
    await db.commit()


# ============================================================
# CONFLICT CHECK (for UI to show warnings)
# ============================================================

async def check_conflicts(
    db: AsyncSession,
    *,
    plan_date: date,
    employee_id: Optional[UUID] = None,
    tool_id: Optional[UUID] = None,
) -> dict:
    """
    Check if an employee or tool has conflicts on a given date.
    Returns conflict details for the UI to display.
    """
    from app.models.planning import DailyPlan, DailyPlanTool, DailyPlanWorker
    from app.models.hr import Leave, LeaveStatus

    conflicts = {
        "date": str(plan_date),
        "employee_conflicts": [],
        "tool_conflicts": [],
        "employee_on_leave": False,
    }

    # Employee assignment conflicts
    if employee_id:
        emp_result = await db.execute(
            select(DailyPlanWorker.daily_plan_id, DailyPlan.work_order_id)
            .join(DailyPlan, DailyPlanWorker.daily_plan_id == DailyPlan.id)
            .where(
                DailyPlan.plan_date == plan_date,
                DailyPlanWorker.employee_id == employee_id,
            )
        )
        for row in emp_result.all():
            conflicts["employee_conflicts"].append({
                "daily_plan_id": str(row[0]),
                "work_order_id": str(row[1]),
            })

        # Leave check
        leave_result = await db.execute(
            select(func.count())
            .where(
                Leave.employee_id == employee_id,
                Leave.status == LeaveStatus.APPROVED,
                Leave.start_date <= plan_date,
                Leave.end_date >= plan_date,
            )
        )
        conflicts["employee_on_leave"] = (leave_result.scalar() or 0) > 0

    # Tool assignment conflicts
    if tool_id:
        tool_result = await db.execute(
            select(DailyPlanTool.daily_plan_id, DailyPlan.work_order_id)
            .join(DailyPlan, DailyPlanTool.daily_plan_id == DailyPlan.id)
            .where(
                DailyPlan.plan_date == plan_date,
                DailyPlanTool.tool_id == tool_id,
            )
        )
        for row in tool_result.all():
            conflicts["tool_conflicts"].append({
                "daily_plan_id": str(row[0]),
                "work_order_id": str(row[1]),
            })

    return conflicts


# ============================================================
# MATERIAL RESERVATION  (BR#44)
# ============================================================

async def create_material_reservation(
    db: AsyncSession,
    *,
    work_order_id: UUID,
    product_id: UUID,
    quantity: int,
    reserved_date: date,
    reserved_by: UUID,
    org_id: UUID,
) -> "MaterialReservation":
    """
    Reserve materials for a work order.
    BR#44: available = on_hand - SUM(active reserved qty)
    """
    from app.models.inventory import Product
    from app.models.planning import MaterialReservation, ReservationStatus

    # Check product exists
    prod_result = await db.execute(
        select(Product).where(Product.id == product_id, Product.is_active == True)
    )
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    # BR#44: Calculate available stock = on_hand - SUM(active reservations)
    reserved_result = await db.execute(
        select(func.coalesce(func.sum(MaterialReservation.quantity), 0))
        .where(
            MaterialReservation.product_id == product_id,
            MaterialReservation.status == ReservationStatus.RESERVED,
        )
    )
    total_reserved = reserved_result.scalar() or 0
    available = product.on_hand - total_reserved

    if quantity > available:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Insufficient available stock: on_hand={product.on_hand}, "
                   f"reserved={total_reserved}, available={available}, "
                   f"requested={quantity} (BR#44)",
        )

    reservation = MaterialReservation(
        work_order_id=work_order_id,
        product_id=product_id,
        quantity=quantity,
        reserved_date=reserved_date,
        reserved_by=reserved_by,
        org_id=org_id,
        status=ReservationStatus.RESERVED,
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    return reservation


async def list_material_reservations(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    work_order_id: Optional[UUID] = None,
) -> tuple[list, int]:
    """List material reservations with optional WO filter and pagination."""
    from app.models.planning import MaterialReservation

    query = select(MaterialReservation)
    if work_order_id:
        query = query.where(MaterialReservation.work_order_id == work_order_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(MaterialReservation.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def cancel_material_reservation(
    db: AsyncSession,
    reservation_id: UUID,
) -> "MaterialReservation":
    """Cancel a material reservation."""
    from app.models.planning import MaterialReservation, ReservationStatus

    result = await db.execute(
        select(MaterialReservation).where(MaterialReservation.id == reservation_id)
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material reservation not found",
        )

    if reservation.status != ReservationStatus.RESERVED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot cancel reservation with status {reservation.status.value}",
        )

    reservation.status = ReservationStatus.CANCELLED
    await db.commit()
    await db.refresh(reservation)
    return reservation


# ============================================================
# TOOL RESERVATION  (BR#45)
# ============================================================

async def create_tool_reservation(
    db: AsyncSession,
    *,
    work_order_id: UUID,
    tool_id: UUID,
    start_date: date,
    end_date: date,
    reserved_by: UUID,
    org_id: UUID,
) -> "ToolReservation":
    """
    Reserve a tool for a work order over a date range.
    BR#45: No overlapping active reservations for the same tool.
    """
    from app.models.planning import ToolReservation, ToolReservationStatus
    from app.models.tools import Tool

    # Check tool exists
    tool_result = await db.execute(
        select(Tool).where(Tool.id == tool_id, Tool.is_active == True)
    )
    tool = tool_result.scalar_one_or_none()
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found",
        )

    # BR#45: Check for overlapping active reservations
    # Overlap condition: existing.start_date <= end_date AND existing.end_date >= start_date
    active_statuses = [ToolReservationStatus.RESERVED, ToolReservationStatus.CHECKED_OUT]
    overlap_result = await db.execute(
        select(ToolReservation)
        .where(
            ToolReservation.tool_id == tool_id,
            ToolReservation.status.in_(active_statuses),
            ToolReservation.start_date <= end_date,
            ToolReservation.end_date >= start_date,
        )
    )
    overlapping = overlap_result.scalar_one_or_none()
    if overlapping:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tool already reserved from {overlapping.start_date} to "
                   f"{overlapping.end_date} (reservation {overlapping.id}) (BR#45)",
        )

    reservation = ToolReservation(
        work_order_id=work_order_id,
        tool_id=tool_id,
        start_date=start_date,
        end_date=end_date,
        reserved_by=reserved_by,
        org_id=org_id,
        status=ToolReservationStatus.RESERVED,
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    return reservation


async def list_tool_reservations(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    work_order_id: Optional[UUID] = None,
) -> tuple[list, int]:
    """List tool reservations with optional WO filter and pagination."""
    from app.models.planning import ToolReservation

    query = select(ToolReservation)
    if work_order_id:
        query = query.where(ToolReservation.work_order_id == work_order_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(ToolReservation.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def cancel_tool_reservation(
    db: AsyncSession,
    reservation_id: UUID,
) -> "ToolReservation":
    """Cancel a tool reservation."""
    from app.models.planning import ToolReservation, ToolReservationStatus

    result = await db.execute(
        select(ToolReservation).where(ToolReservation.id == reservation_id)
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool reservation not found",
        )

    if reservation.status not in [ToolReservationStatus.RESERVED]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot cancel reservation with status {reservation.status.value}",
        )

    reservation.status = ToolReservationStatus.CANCELLED
    await db.commit()
    await db.refresh(reservation)
    return reservation
