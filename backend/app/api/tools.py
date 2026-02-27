"""
SSS Corp ERP — Tools API Routes
Phase 2: Tool CRUD + Check-out/Check-in

Endpoints (from CLAUDE.md):
  GET    /api/tools                           tools.tool.read
  POST   /api/tools                           tools.tool.create
  PUT    /api/tools/{id}                      tools.tool.update
  DELETE /api/tools/{id}                      tools.tool.delete
  POST   /api/tools/{id}/checkout             tools.tool.execute
  POST   /api/tools/{id}/checkin              tools.tool.execute
  GET    /api/tools/{id}/history              tools.tool.read
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.tools import (
    ToolCheckoutRequest,
    ToolCheckoutResponse,
    ToolCheckoutListResponse,
    ToolCreate,
    ToolListResponse,
    ToolResponse,
    ToolUpdate,
)
from app.services.tools import (
    checkin_tool,
    checkout_tool,
    create_tool,
    delete_tool,
    get_tool,
    list_tool_checkouts,
    list_tools,
    update_tool,
)

tools_router = APIRouter(prefix="/api/tools", tags=["tools"])


# ============================================================
# TOOL CRUD ROUTES
# ============================================================

@tools_router.get(
    "",
    response_model=ToolListResponse,
    dependencies=[Depends(require("tools.tool.read"))],
)
async def api_list_tools(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_tools(db, limit=limit, offset=offset, search=search, org_id=org_id)
    return ToolListResponse(items=items, total=total, limit=limit, offset=offset)


@tools_router.post(
    "",
    response_model=ToolResponse,
    status_code=201,
    dependencies=[Depends(require("tools.tool.create"))],
)
async def api_create_tool(
    body: ToolCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_tool(
        db,
        code=body.code,
        name=body.name,
        description=body.description,
        rate_per_hour=body.rate_per_hour,
        org_id=org_id,
    )


@tools_router.get(
    "/{tool_id}",
    response_model=ToolResponse,
    dependencies=[Depends(require("tools.tool.read"))],
)
async def api_get_tool(
    tool_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await get_tool(db, tool_id, org_id=org_id)


@tools_router.put(
    "/{tool_id}",
    response_model=ToolResponse,
    dependencies=[Depends(require("tools.tool.update"))],
)
async def api_update_tool(
    tool_id: UUID,
    body: ToolUpdate,
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    return await update_tool(db, tool_id, update_data=update_data)


@tools_router.delete(
    "/{tool_id}",
    status_code=204,
    dependencies=[Depends(require("tools.tool.delete"))],
)
async def api_delete_tool(
    tool_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    await delete_tool(db, tool_id)


# ============================================================
# CHECK-OUT / CHECK-IN ROUTES (BR#27, BR#28)
# ============================================================

@tools_router.post(
    "/{tool_id}/checkout",
    response_model=ToolCheckoutResponse,
    status_code=201,
    dependencies=[Depends(require("tools.tool.execute"))],
)
async def api_checkout_tool(
    tool_id: UUID,
    body: ToolCheckoutRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Check out a tool for a work order (BR#27: 1 person at a time)."""
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await checkout_tool(
        db,
        tool_id,
        employee_id=body.employee_id,
        work_order_id=body.work_order_id,
        checked_out_by=user_id,
        org_id=org_id,
    )


@tools_router.post(
    "/{tool_id}/checkin",
    response_model=ToolCheckoutResponse,
    dependencies=[Depends(require("tools.tool.execute"))],
)
async def api_checkin_tool(
    tool_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Check in a tool — auto charges hours × rate (BR#28)."""
    user_id = UUID(token["sub"])
    return await checkin_tool(db, tool_id, checked_in_by=user_id)


@tools_router.get(
    "/{tool_id}/history",
    response_model=ToolCheckoutListResponse,
    dependencies=[Depends(require("tools.tool.read"))],
)
async def api_tool_history(
    tool_id: UUID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Get checkout/checkin history for a tool."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    items, total = await list_tool_checkouts(db, tool_id, limit=limit, offset=offset, org_id=org_id)
    return ToolCheckoutListResponse(items=items, total=total, limit=limit, offset=offset)
