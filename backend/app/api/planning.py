"""
SSS Corp ERP — Planning API Routes
Phase 4.5: WO Master Plan, Daily Plan, Material & Tool Reservation

Endpoints:
  # Master Plan (nested under work-orders)
  GET    /api/work-orders/{wo_id}/plan           workorder.plan.read
  POST   /api/work-orders/{wo_id}/plan           workorder.plan.create
  PUT    /api/work-orders/{wo_id}/plan           workorder.plan.update

  # Daily Plan
  GET    /api/planning/daily                      workorder.plan.read
  POST   /api/planning/daily                      workorder.plan.create
  PUT    /api/planning/daily/{id}                 workorder.plan.update
  DELETE /api/planning/daily/{id}                 workorder.plan.delete

  # Conflict check
  GET    /api/planning/conflicts                  workorder.plan.read

  # Material Reservation
  GET    /api/planning/reservations/material      workorder.reservation.read
  POST   /api/planning/reservations/material      workorder.reservation.create
  PUT    /api/planning/reservations/{id}/cancel   workorder.reservation.create

  # Tool Reservation
  GET    /api/planning/reservations/tool          workorder.reservation.read
  POST   /api/planning/reservations/tool          workorder.reservation.create
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.planning import (
    DailyPlanCreate,
    DailyPlanListResponse,
    DailyPlanResponse,
    DailyPlanUpdate,
    MasterPlanCreate,
    MasterPlanResponse,
    MasterPlanUpdate,
    MaterialReservationCreate,
    MaterialReservationListResponse,
    MaterialReservationResponse,
    ToolReservationCreate,
    ToolReservationListResponse,
    ToolReservationResponse,
)
from app.services.planning import (
    cancel_material_reservation,
    cancel_tool_reservation,
    check_conflicts,
    create_daily_plan,
    create_master_plan,
    create_material_reservation,
    create_tool_reservation,
    delete_daily_plan,
    get_daily_plan,
    get_master_plan,
    list_daily_plans,
    list_material_reservations,
    list_tool_reservations,
    update_daily_plan,
    update_master_plan,
)


# ============================================================
# ROUTERS
# ============================================================

# Master plan routes are nested under /api/work-orders
master_plan_router = APIRouter(prefix="/api/work-orders", tags=["planning"])

# Planning routes for daily plans, conflicts, and reservations
planning_router = APIRouter(prefix="/api/planning", tags=["planning"])


# ============================================================
# MASTER PLAN (nested under work-orders)
# ============================================================

@master_plan_router.get(
    "/{wo_id}/plan",
    response_model=Optional[MasterPlanResponse],
    dependencies=[Depends(require("workorder.plan.read"))],
)
async def api_get_master_plan(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get the master plan for a work order (returns null if no plan exists)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_master_plan(db, wo_id, org_id=org_id)


@master_plan_router.post(
    "/{wo_id}/plan",
    response_model=MasterPlanResponse,
    status_code=201,
    dependencies=[Depends(require("workorder.plan.create"))],
)
async def api_create_master_plan(
    wo_id: UUID,
    body: MasterPlanCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a master plan for a work order (1 per WO)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    lines_data = [line.model_dump() for line in body.lines]
    return await create_master_plan(
        db,
        work_order_id=wo_id,
        planned_start=body.planned_start,
        planned_end=body.planned_end,
        total_manhours=body.total_manhours,
        note=body.note,
        lines=lines_data,
        org_id=org_id,
    )


@master_plan_router.put(
    "/{wo_id}/plan",
    response_model=MasterPlanResponse,
    dependencies=[Depends(require("workorder.plan.update"))],
)
async def api_update_master_plan(
    wo_id: UUID,
    body: MasterPlanUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update the master plan for a work order. Lines are replaced if provided."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True, exclude={"lines"})
    lines_data = None
    if body.lines is not None:
        lines_data = [line.model_dump() for line in body.lines]

    return await update_master_plan(
        db,
        wo_id,
        update_data=update_data,
        lines=lines_data,
        org_id=org_id,
    )


# ============================================================
# DAILY PLAN
# ============================================================

@planning_router.get(
    "/daily",
    response_model=DailyPlanListResponse,
    dependencies=[Depends(require("workorder.plan.read"))],
)
async def api_list_daily_plans(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    plan_date: Optional[date] = Query(default=None, alias="date"),
    date_end: Optional[date] = Query(default=None),
    work_order_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List daily plans with optional date range and WO filter."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_daily_plans(
        db,
        limit=limit,
        offset=offset,
        plan_date=plan_date,
        date_end=date_end,
        work_order_id=work_order_id,
        org_id=org_id,
    )
    return DailyPlanListResponse(items=items, total=total)


@planning_router.post(
    "/daily",
    response_model=DailyPlanResponse,
    status_code=201,
    dependencies=[Depends(require("workorder.plan.create"))],
)
async def api_create_daily_plan(
    body: DailyPlanCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a daily plan with workers, tools, and materials."""
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    workers_data = [w.model_dump() for w in body.workers]
    tools_data = [t.model_dump() for t in body.tools]
    materials_data = [m.model_dump() for m in body.materials]

    return await create_daily_plan(
        db,
        plan_date=body.plan_date,
        work_order_id=body.work_order_id,
        created_by=user_id,
        org_id=org_id,
        note=body.note,
        workers=workers_data,
        tools=tools_data,
        materials=materials_data,
    )


@planning_router.put(
    "/daily/{plan_id}",
    response_model=DailyPlanResponse,
    dependencies=[Depends(require("workorder.plan.update"))],
)
async def api_update_daily_plan(
    plan_id: UUID,
    body: DailyPlanUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update a daily plan. Workers/tools/materials are replaced if provided."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    workers_data = None
    if body.workers is not None:
        workers_data = [w.model_dump() for w in body.workers]

    tools_data = None
    if body.tools is not None:
        tools_data = [t.model_dump() for t in body.tools]

    materials_data = None
    if body.materials is not None:
        materials_data = [m.model_dump() for m in body.materials]

    return await update_daily_plan(
        db,
        plan_id,
        note=body.note,
        workers=workers_data,
        tools=tools_data,
        materials=materials_data,
        org_id=org_id,
    )


@planning_router.delete(
    "/daily/{plan_id}",
    status_code=204,
    dependencies=[Depends(require("workorder.plan.delete"))],
)
async def api_delete_daily_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Delete a daily plan and all its children."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_daily_plan(db, plan_id, org_id=org_id)


# ============================================================
# CONFLICT CHECK
# ============================================================

@planning_router.get(
    "/conflicts",
    dependencies=[Depends(require("workorder.plan.read"))],
)
async def api_check_conflicts(
    plan_date: date = Query(..., alias="date"),
    employee_id: Optional[UUID] = Query(default=None),
    tool_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Check employee/tool conflicts on a given date."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await check_conflicts(
        db,
        plan_date=plan_date,
        employee_id=employee_id,
        tool_id=tool_id,
        org_id=org_id,
    )


# ============================================================
# MATERIAL RESERVATION
# ============================================================

@planning_router.get(
    "/reservations/material",
    response_model=MaterialReservationListResponse,
    dependencies=[Depends(require("workorder.reservation.read"))],
)
async def api_list_material_reservations(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    work_order_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List material reservations with optional WO filter."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_material_reservations(
        db, limit=limit, offset=offset, work_order_id=work_order_id, org_id=org_id,
    )
    return MaterialReservationListResponse(items=items, total=total)


@planning_router.post(
    "/reservations/material",
    response_model=MaterialReservationResponse,
    status_code=201,
    dependencies=[Depends(require("workorder.reservation.create"))],
)
async def api_create_material_reservation(
    body: MaterialReservationCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Reserve materials for a work order (BR#44)."""
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    return await create_material_reservation(
        db,
        work_order_id=body.work_order_id,
        product_id=body.product_id,
        quantity=body.quantity,
        reserved_date=body.reserved_date,
        reserved_by=user_id,
        org_id=org_id,
    )


@planning_router.put(
    "/reservations/{reservation_id}/cancel",
    response_model=MaterialReservationResponse,
    dependencies=[Depends(require("workorder.reservation.create"))],
)
async def api_cancel_material_reservation(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Cancel a material reservation."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await cancel_material_reservation(db, reservation_id, org_id=org_id)


# ============================================================
# TOOL RESERVATION
# ============================================================

@planning_router.get(
    "/reservations/tool",
    response_model=ToolReservationListResponse,
    dependencies=[Depends(require("workorder.reservation.read"))],
)
async def api_list_tool_reservations(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    work_order_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List tool reservations with optional WO filter."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_tool_reservations(
        db, limit=limit, offset=offset, work_order_id=work_order_id, org_id=org_id,
    )
    return ToolReservationListResponse(items=items, total=total)


@planning_router.post(
    "/reservations/tool",
    response_model=ToolReservationResponse,
    status_code=201,
    dependencies=[Depends(require("workorder.reservation.create"))],
)
async def api_create_tool_reservation(
    body: ToolReservationCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Reserve a tool for a work order (BR#45)."""
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    return await create_tool_reservation(
        db,
        work_order_id=body.work_order_id,
        tool_id=body.tool_id,
        start_date=body.start_date,
        end_date=body.end_date,
        reserved_by=user_id,
        org_id=org_id,
    )
