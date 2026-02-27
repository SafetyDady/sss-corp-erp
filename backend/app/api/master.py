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
)
from app.schemas.organization import (
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.services.master import (
    create_cost_center,
    create_cost_element,
    create_leave_type,
    create_ot_type,
    delete_cost_center,
    delete_cost_element,
    delete_leave_type,
    delete_ot_type,
    get_cost_center,
    get_cost_element,
    get_leave_type,
    get_ot_type,
    list_cost_centers,
    list_cost_elements,
    list_leave_types,
    list_ot_types,
    update_cost_center,
    update_cost_element,
    update_leave_type,
    update_ot_type,
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
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """List cost centers with pagination and search."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_cost_centers(db, limit=limit, offset=offset, search=search, org_id=org_id)
    return CostCenterListResponse(items=items, total=total, limit=limit, offset=offset)


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
    return await create_cost_center(
        db,
        code=body.code,
        name=body.name,
        description=body.description,
        overhead_rate=body.overhead_rate,
        org_id=org_id,
    )


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
    return await get_cost_center(db, cc_id, org_id=org_id)


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
    return await update_cost_center(db, cc_id, update_data=update_data)


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
    limit: int = Query(default=20, ge=1, le=100),
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
    limit: int = Query(default=20, ge=1, le=100),
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
    limit: int = Query(default=20, ge=1, le=100),
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
    limit: int = Query(default=20, ge=1, le=100),
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
