"""
SSS Corp ERP — Master Data API Routes
Phase 1.2: CostCenter, CostElement, OTType

Endpoints (from CLAUDE.md):
  GET    /api/master/cost-centers             master.costcenter.read
  POST   /api/master/cost-centers             master.costcenter.create
  PUT    /api/master/cost-centers/{id}        master.costcenter.update
  DELETE /api/master/cost-centers/{id}        master.costcenter.delete

  GET    /api/master/cost-elements            master.costelement.read
  POST   /api/master/cost-elements            master.costelement.create
  PUT    /api/master/cost-elements/{id}       master.costelement.update
  DELETE /api/master/cost-elements/{id}       master.costelement.delete

  GET    /api/master/ot-types                 master.ottype.read
  POST   /api/master/ot-types                 master.ottype.create
  PUT    /api/master/ot-types/{id}            master.ottype.update
  DELETE /api/master/ot-types/{id}            master.ottype.delete
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.master import (
    CostCenterCreate,
    CostCenterListResponse,
    CostCenterResponse,
    CostCenterUpdate,
    CostElementCreate,
    CostElementListResponse,
    CostElementResponse,
    CostElementUpdate,
    LeaveTypeCreate,
    LeaveTypeListResponse,
    LeaveTypeResponse,
    LeaveTypeUpdate,
    OTTypeCreate,
    OTTypeListResponse,
    OTTypeResponse,
    OTTypeUpdate,
    ShiftTypeCreate,
    ShiftTypeListResponse,
    ShiftTypeResponse,
    ShiftTypeUpdate,
    SupplierCreate,
    SupplierListResponse,
    SupplierResponse,
    SupplierUpdate,
    WHTTypeCreate,
    WHTTypeListResponse,
    WHTTypeResponse,
    WHTTypeUpdate,
    WorkScheduleCreate,
    WorkScheduleListResponse,
    WorkScheduleResponse,
    WorkScheduleUpdate,
)
from app.schemas.organization import (
    CompanyCreate,
    CompanyListResponse,
    CompanyResponse,
    CompanyUpdate,
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.services.master import (
    create_company,
    create_cost_center,
    create_cost_element,
    create_leave_type,
    create_ot_type,
    create_shift_type,
    create_supplier,
    create_wht_type,
    create_work_schedule,
    delete_company,
    delete_cost_center,
    delete_cost_element,
    delete_leave_type,
    delete_ot_type,
    delete_shift_type,
    delete_supplier,
    delete_wht_type,
    delete_work_schedule,
    get_company,
    get_cost_center,
    get_cost_element,
    get_leave_type,
    get_ot_type,
    get_shift_type,
    get_supplier,
    get_wht_type,
    get_work_schedule,
    list_companies,
    list_cost_centers,
    list_cost_elements,
    list_leave_types,
    list_ot_types,
    list_shift_types,
    list_suppliers,
    list_wht_types,
    list_work_schedules,
    update_company,
    update_cost_center,
    update_cost_element,
    update_leave_type,
    update_ot_type,
    update_shift_type,
    update_supplier,
    update_wht_type,
    update_work_schedule,
)
from app.services.organization import (
    create_department,
    delete_department,
    get_department,
    list_departments,
    update_department,
)

master_router = APIRouter(prefix="/api/master", tags=["master-data"])


# ============================================================
# COST CENTER ROUTES
# ============================================================

@master_router.get(
    "/cost-centers",
    response_model=CostCenterListResponse,
    dependencies=[Depends(require("master.costcenter.read"))],
)
async def api_list_cost_centers(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    company_id: Optional[UUID] = Query(default=None, description="Filter by company"),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List cost centers with pagination and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_cost_centers(db, limit=limit, offset=offset, search=search, org_id=org_id, company_id=company_id)
    response_items = [await _cost_center_to_response(db, cc) for cc in items]
    return CostCenterListResponse(items=response_items, total=total, limit=limit, offset=offset)


@master_router.post(
    "/cost-centers",
    response_model=CostCenterResponse,
    status_code=201,
    dependencies=[Depends(require("master.costcenter.create"))],
)
async def api_create_cost_center(
    body: CostCenterCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new cost center."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    cc = await create_cost_center(
        db,
        code=body.code,
        name=body.name,
        description=body.description,
        overhead_rate=body.overhead_rate,
        org_id=org_id,
        company_id=body.company_id,
    )
    return await _cost_center_to_response(db, cc)


@master_router.get(
    "/cost-centers/{cc_id}",
    response_model=CostCenterResponse,
    dependencies=[Depends(require("master.costcenter.read"))],
)
async def api_get_cost_center(
    cc_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single cost center by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    cc = await get_cost_center(db, cc_id, org_id=org_id)
    return await _cost_center_to_response(db, cc)


@master_router.put(
    "/cost-centers/{cc_id}",
    response_model=CostCenterResponse,
    dependencies=[Depends(require("master.costcenter.update"))],
)
async def api_update_cost_center(
    cc_id: UUID,
    body: CostCenterUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a cost center (BR#30: overhead rate per cost center)."""
    update_data = body.model_dump(exclude_unset=True)
    cc = await update_cost_center(db, cc_id, update_data=update_data)
    return await _cost_center_to_response(db, cc)


@master_router.delete(
    "/cost-centers/{cc_id}",
    status_code=204,
    dependencies=[Depends(require("master.costcenter.delete"))],
)
async def api_delete_cost_center(
    cc_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a cost center."""
    await delete_cost_center(db, cc_id)


# ============================================================
# COST ELEMENT ROUTES
# ============================================================

@master_router.get(
    "/cost-elements",
    response_model=CostElementListResponse,
    dependencies=[Depends(require("master.costelement.read"))],
)
async def api_list_cost_elements(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List cost elements with pagination and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_cost_elements(db, limit=limit, offset=offset, search=search, org_id=org_id)
    return CostElementListResponse(items=items, total=total, limit=limit, offset=offset)


@master_router.post(
    "/cost-elements",
    response_model=CostElementResponse,
    status_code=201,
    dependencies=[Depends(require("master.costelement.create"))],
)
async def api_create_cost_element(
    body: CostElementCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new cost element."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_cost_element(
        db,
        code=body.code,
        name=body.name,
        description=body.description,
        org_id=org_id,
    )


@master_router.get(
    "/cost-elements/{ce_id}",
    response_model=CostElementResponse,
    dependencies=[Depends(require("master.costelement.read"))],
)
async def api_get_cost_element(
    ce_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single cost element by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_cost_element(db, ce_id, org_id=org_id)


@master_router.put(
    "/cost-elements/{ce_id}",
    response_model=CostElementResponse,
    dependencies=[Depends(require("master.costelement.update"))],
)
async def api_update_cost_element(
    ce_id: UUID,
    body: CostElementUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a cost element."""
    update_data = body.model_dump(exclude_unset=True)
    return await update_cost_element(db, ce_id, update_data=update_data)


@master_router.delete(
    "/cost-elements/{ce_id}",
    status_code=204,
    dependencies=[Depends(require("master.costelement.delete"))],
)
async def api_delete_cost_element(
    ce_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a cost element."""
    await delete_cost_element(db, ce_id)


# ============================================================
# OT TYPE ROUTES  (BR#24, BR#29)
# ============================================================

@master_router.get(
    "/ot-types",
    response_model=OTTypeListResponse,
    dependencies=[Depends(require("master.ottype.read"))],
)
async def api_list_ot_types(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List OT types with pagination and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_ot_types(db, limit=limit, offset=offset, search=search, org_id=org_id)
    return OTTypeListResponse(items=items, total=total, limit=limit, offset=offset)


@master_router.post(
    "/ot-types",
    response_model=OTTypeResponse,
    status_code=201,
    dependencies=[Depends(require("master.ottype.create"))],
)
async def api_create_ot_type(
    body: OTTypeCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new OT type (BR#29: Admin adjusts factor + ceiling)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_ot_type(
        db,
        name=body.name,
        factor=body.factor,
        max_ceiling=body.max_ceiling,
        description=body.description,
        org_id=org_id,
    )


@master_router.get(
    "/ot-types/{ot_id}",
    response_model=OTTypeResponse,
    dependencies=[Depends(require("master.ottype.read"))],
)
async def api_get_ot_type(
    ot_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single OT type by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_ot_type(db, ot_id, org_id=org_id)


@master_router.put(
    "/ot-types/{ot_id}",
    response_model=OTTypeResponse,
    dependencies=[Depends(require("master.ottype.update"))],
)
async def api_update_ot_type(
    ot_id: UUID,
    body: OTTypeUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an OT type (BR#24: factor ≤ max_ceiling, BR#29)."""
    update_data = body.model_dump(exclude_unset=True)
    return await update_ot_type(db, ot_id, update_data=update_data)


@master_router.delete(
    "/ot-types/{ot_id}",
    status_code=204,
    dependencies=[Depends(require("master.ottype.delete"))],
)
async def api_delete_ot_type(
    ot_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete an OT type."""
    await delete_ot_type(db, ot_id)


# ============================================================
# DEPARTMENT ROUTES  (Phase 4.1)
# ============================================================

@master_router.get(
    "/departments",
    response_model=DepartmentListResponse,
    dependencies=[Depends(require("master.department.read"))],
)
async def api_list_departments(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List departments with pagination and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_departments(db, limit=limit, offset=offset, search=search, org_id=org_id)
    return DepartmentListResponse(items=items, total=total, limit=limit, offset=offset)


@master_router.post(
    "/departments",
    response_model=DepartmentResponse,
    status_code=201,
    dependencies=[Depends(require("master.department.create"))],
)
async def api_create_department(
    body: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new department (1:1 with cost center)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_department(
        db,
        code=body.code,
        name=body.name,
        cost_center_id=body.cost_center_id,
        head_id=body.head_id,
        org_id=org_id,
    )


@master_router.get(
    "/departments/{dept_id}",
    response_model=DepartmentResponse,
    dependencies=[Depends(require("master.department.read"))],
)
async def api_get_department(
    dept_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single department by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_department(db, dept_id, org_id=org_id)


@master_router.put(
    "/departments/{dept_id}",
    response_model=DepartmentResponse,
    dependencies=[Depends(require("master.department.update"))],
)
async def api_update_department(
    dept_id: UUID,
    body: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update a department."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    return await update_department(db, dept_id, update_data=update_data, org_id=org_id)


@master_router.delete(
    "/departments/{dept_id}",
    status_code=204,
    dependencies=[Depends(require("master.department.delete"))],
)
async def api_delete_department(
    dept_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a department."""
    await delete_department(db, dept_id)


# ============================================================
# LEAVE TYPE ROUTES  (Phase 4.3)
# ============================================================

@master_router.get(
    "/leave-types",
    response_model=LeaveTypeListResponse,
    dependencies=[Depends(require("master.leavetype.read"))],
)
async def api_list_leave_types(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_leave_types(db, limit=limit, offset=offset, search=search, org_id=org_id)
    return LeaveTypeListResponse(items=items, total=total, limit=limit, offset=offset)


@master_router.post(
    "/leave-types",
    response_model=LeaveTypeResponse,
    status_code=201,
    dependencies=[Depends(require("master.leavetype.create"))],
)
async def api_create_leave_type(
    body: LeaveTypeCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_leave_type(
        db,
        code=body.code,
        name=body.name,
        is_paid=body.is_paid,
        default_quota=body.default_quota,
        org_id=org_id,
    )


@master_router.get(
    "/leave-types/{lt_id}",
    response_model=LeaveTypeResponse,
    dependencies=[Depends(require("master.leavetype.read"))],
)
async def api_get_leave_type(
    lt_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_leave_type(db, lt_id, org_id=org_id)


@master_router.put(
    "/leave-types/{lt_id}",
    response_model=LeaveTypeResponse,
    dependencies=[Depends(require("master.leavetype.update"))],
)
async def api_update_leave_type(
    lt_id: UUID,
    body: LeaveTypeUpdate,
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    return await update_leave_type(db, lt_id, update_data=update_data)


@master_router.delete(
    "/leave-types/{lt_id}",
    status_code=204,
    dependencies=[Depends(require("master.leavetype.delete"))],
)
async def api_delete_leave_type(
    lt_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    await delete_leave_type(db, lt_id)


# ============================================================
# SHIFT TYPE ROUTES  (Phase 4.9 — Shift Management)
# ============================================================

@master_router.get(
    "/shift-types",
    response_model=ShiftTypeListResponse,
    dependencies=[Depends(require("master.shifttype.read"))],
)
async def api_list_shift_types(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List shift types with pagination and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_shift_types(db, limit=limit, offset=offset, search=search, org_id=org_id)
    return ShiftTypeListResponse(items=items, total=total, limit=limit, offset=offset)


@master_router.post(
    "/shift-types",
    response_model=ShiftTypeResponse,
    status_code=201,
    dependencies=[Depends(require("master.shifttype.create"))],
)
async def api_create_shift_type(
    body: ShiftTypeCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new shift type."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_shift_type(
        db,
        code=body.code,
        name=body.name,
        start_time=body.start_time,
        end_time=body.end_time,
        break_minutes=body.break_minutes,
        working_hours=body.working_hours,
        is_overnight=body.is_overnight,
        description=body.description,
        org_id=org_id,
    )


@master_router.get(
    "/shift-types/{st_id}",
    response_model=ShiftTypeResponse,
    dependencies=[Depends(require("master.shifttype.read"))],
)
async def api_get_shift_type(
    st_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single shift type by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_shift_type(db, st_id, org_id=org_id)


@master_router.put(
    "/shift-types/{st_id}",
    response_model=ShiftTypeResponse,
    dependencies=[Depends(require("master.shifttype.update"))],
)
async def api_update_shift_type(
    st_id: UUID,
    body: ShiftTypeUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update a shift type."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    return await update_shift_type(db, st_id, update_data=update_data, org_id=org_id)


@master_router.delete(
    "/shift-types/{st_id}",
    status_code=204,
    dependencies=[Depends(require("master.shifttype.delete"))],
)
async def api_delete_shift_type(
    st_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Soft-delete a shift type."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_shift_type(db, st_id, org_id=org_id)


# ============================================================
# WORK SCHEDULE ROUTES  (Phase 4.9 — Shift Management)
# ============================================================

@master_router.get(
    "/work-schedules",
    response_model=WorkScheduleListResponse,
    dependencies=[Depends(require("master.schedule.read"))],
)
async def api_list_work_schedules(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List work schedules with pagination and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_work_schedules(db, limit=limit, offset=offset, search=search, org_id=org_id)
    return WorkScheduleListResponse(items=items, total=total, limit=limit, offset=offset)


@master_router.post(
    "/work-schedules",
    response_model=WorkScheduleResponse,
    status_code=201,
    dependencies=[Depends(require("master.schedule.create"))],
)
async def api_create_work_schedule(
    body: WorkScheduleCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new work schedule (FIXED or ROTATING)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_work_schedule(
        db,
        code=body.code,
        name=body.name,
        schedule_type=body.schedule_type.value,
        working_days=body.working_days,
        default_shift_type_id=body.default_shift_type_id,
        rotation_pattern=body.rotation_pattern,
        cycle_start_date=body.cycle_start_date,
        description=body.description,
        org_id=org_id,
    )


@master_router.get(
    "/work-schedules/{ws_id}",
    response_model=WorkScheduleResponse,
    dependencies=[Depends(require("master.schedule.read"))],
)
async def api_get_work_schedule(
    ws_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single work schedule by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_work_schedule(db, ws_id, org_id=org_id)


@master_router.put(
    "/work-schedules/{ws_id}",
    response_model=WorkScheduleResponse,
    dependencies=[Depends(require("master.schedule.update"))],
)
async def api_update_work_schedule(
    ws_id: UUID,
    body: WorkScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update a work schedule."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    if "schedule_type" in update_data and update_data["schedule_type"] is not None:
        update_data["schedule_type"] = update_data["schedule_type"].value if hasattr(update_data["schedule_type"], "value") else update_data["schedule_type"]
    return await update_work_schedule(db, ws_id, update_data=update_data, org_id=org_id)


@master_router.delete(
    "/work-schedules/{ws_id}",
    status_code=204,
    dependencies=[Depends(require("master.schedule.delete"))],
)
async def api_delete_work_schedule(
    ws_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Soft-delete a work schedule (fails if employees are using it)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_work_schedule(db, ws_id, org_id=org_id)


# ============================================================
# WHT TYPE ROUTES  (Phase C5.2 — Withholding Tax)
# ============================================================

@master_router.get(
    "/wht-types",
    response_model=WHTTypeListResponse,
    dependencies=[Depends(require("master.whttype.read"))],
)
async def api_list_wht_types(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List WHT types with pagination and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_wht_types(db, limit=limit, offset=offset, search=search, org_id=org_id)
    return WHTTypeListResponse(items=items, total=total, limit=limit, offset=offset)


@master_router.post(
    "/wht-types",
    response_model=WHTTypeResponse,
    status_code=201,
    dependencies=[Depends(require("master.whttype.create"))],
)
async def api_create_wht_type(
    body: WHTTypeCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new WHT type (BR#107: WHT rates managed via master data)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_wht_type(
        db,
        code=body.code,
        name=body.name,
        section=body.section,
        rate=body.rate,
        description=body.description,
        org_id=org_id,
    )


@master_router.get(
    "/wht-types/{wht_id}",
    response_model=WHTTypeResponse,
    dependencies=[Depends(require("master.whttype.read"))],
)
async def api_get_wht_type(
    wht_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single WHT type by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_wht_type(db, wht_id, org_id=org_id)


@master_router.put(
    "/wht-types/{wht_id}",
    response_model=WHTTypeResponse,
    dependencies=[Depends(require("master.whttype.update"))],
)
async def api_update_wht_type(
    wht_id: UUID,
    body: WHTTypeUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update a WHT type."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    return await update_wht_type(db, wht_id, update_data=update_data, org_id=org_id)


@master_router.delete(
    "/wht-types/{wht_id}",
    status_code=204,
    dependencies=[Depends(require("master.whttype.delete"))],
)
async def api_delete_wht_type(
    wht_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Soft-delete a WHT type."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_wht_type(db, wht_id, org_id=org_id)


# ============================================================
# SUPPLIER ROUTES  (Phase 11 — Supplier Master Data)
# ============================================================

@master_router.get(
    "/suppliers",
    response_model=SupplierListResponse,
    dependencies=[Depends(require("master.supplier.read"))],
)
async def api_list_suppliers(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List suppliers with pagination and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_suppliers(db, limit=limit, offset=offset, search=search, org_id=org_id)
    response_items = [await _supplier_to_response(db, s) for s in items]
    return SupplierListResponse(items=response_items, total=total, limit=limit, offset=offset)


@master_router.post(
    "/suppliers",
    response_model=SupplierResponse,
    status_code=201,
    dependencies=[Depends(require("master.supplier.create"))],
)
async def api_create_supplier(
    body: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Create a new supplier."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    supplier = await create_supplier(
        db,
        code=body.code,
        name=body.name,
        contact_name=body.contact_name,
        email=body.email,
        phone=body.phone,
        address=body.address,
        tax_id=body.tax_id,
        default_wht_type_id=body.default_wht_type_id,
        org_id=org_id,
    )
    return await _supplier_to_response(db, supplier)


@master_router.get(
    "/suppliers/{supplier_id}",
    response_model=SupplierResponse,
    dependencies=[Depends(require("master.supplier.read"))],
)
async def api_get_supplier(
    supplier_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get a single supplier by ID."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    supplier = await get_supplier(db, supplier_id, org_id=org_id)
    return await _supplier_to_response(db, supplier)


@master_router.put(
    "/suppliers/{supplier_id}",
    response_model=SupplierResponse,
    dependencies=[Depends(require("master.supplier.update"))],
)
async def api_update_supplier(
    supplier_id: UUID,
    body: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Update a supplier."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    supplier = await update_supplier(db, supplier_id, update_data=update_data, org_id=org_id)
    return await _supplier_to_response(db, supplier)


@master_router.delete(
    "/suppliers/{supplier_id}",
    status_code=204,
    dependencies=[Depends(require("master.supplier.delete"))],
)
async def api_delete_supplier(
    supplier_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Soft-delete a supplier."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_supplier(db, supplier_id, org_id=org_id)


# ============================================================
# RESPONSE HELPERS
# ============================================================

async def _cost_center_to_response(db: AsyncSession, cc) -> dict:
    """Enrich cost center with Company info for response."""
    company_code = None
    company_name = None
    if cc.company_id:
        try:
            company = await get_company(db, cc.company_id)
            company_code = company.code
            company_name = company.name
        except Exception:
            pass

    return {
        "id": cc.id,
        "code": cc.code,
        "name": cc.name,
        "description": cc.description,
        "overhead_rate": cc.overhead_rate,
        "company_id": cc.company_id,
        "company_code": company_code,
        "company_name": company_name,
        "is_active": cc.is_active,
        "created_at": cc.created_at,
        "updated_at": cc.updated_at,
    }


async def _supplier_to_response(db: AsyncSession, supplier) -> dict:
    """Enrich supplier with WHT type info for response."""
    wht_code = None
    wht_name = None
    if supplier.default_wht_type_id:
        try:
            wht = await get_wht_type(db, supplier.default_wht_type_id)
            wht_code = wht.code
            wht_name = wht.name
        except Exception:
            pass

    return {
        "id": supplier.id,
        "code": supplier.code,
        "name": supplier.name,
        "contact_name": supplier.contact_name,
        "email": supplier.email,
        "phone": supplier.phone,
        "address": supplier.address,
        "tax_id": supplier.tax_id,
        "default_wht_type_id": supplier.default_wht_type_id,
        "default_wht_type_code": wht_code,
        "default_wht_type_name": wht_name,
        "is_active": supplier.is_active,
        "created_at": supplier.created_at,
        "updated_at": supplier.updated_at,
    }


# ============================================================
# COMPANY ROUTES  (C11 — admin.config.update for write, JWT-only for read)
# ============================================================

@master_router.get(
    "/companies",
    response_model=CompanyListResponse,
    # JWT-only: any authenticated user can list companies (reference data for forms)
)
async def api_list_companies(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    items, total = await list_companies(
        db, limit=limit, offset=offset, search=search, org_id=org_id,
    )
    return CompanyListResponse(
        items=[CompanyResponse.model_validate(c) for c in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@master_router.post(
    "/companies",
    response_model=CompanyResponse,
    status_code=201,
    dependencies=[Depends(require("admin.config.update"))],
)
async def api_create_company(
    data: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    company = await create_company(
        db,
        code=data.code,
        name=data.name,
        tax_id=data.tax_id,
        address=data.address,
        org_id=org_id,
    )
    return CompanyResponse.model_validate(company)


@master_router.put(
    "/companies/{company_id}",
    response_model=CompanyResponse,
    dependencies=[Depends(require("admin.config.update"))],
)
async def api_update_company(
    company_id: UUID,
    data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    company = await update_company(
        db,
        company_id,
        name=data.name,
        tax_id=data.tax_id,
        address=data.address,
        is_active=data.is_active,
        org_id=org_id,
    )
    return CompanyResponse.model_validate(company)


@master_router.delete(
    "/companies/{company_id}",
    status_code=204,
    dependencies=[Depends(require("admin.config.update"))],
)
async def api_delete_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    await delete_company(db, company_id, org_id=org_id)
