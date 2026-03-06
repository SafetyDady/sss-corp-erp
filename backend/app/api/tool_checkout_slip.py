"""
SSS Corp ERP — Tool Checkout Slip API Routes
Multi-line tool checkout document: DRAFT → PENDING → CHECKED_OUT → PARTIAL_RETURN/RETURNED

Endpoints:
  GET    /api/tools/checkout-slips              tools.tool.read
  POST   /api/tools/checkout-slips              tools.tool.create
  GET    /api/tools/checkout-slips/{id}         tools.tool.read
  PUT    /api/tools/checkout-slips/{id}         tools.tool.update  (DRAFT)
  DELETE /api/tools/checkout-slips/{id}         tools.tool.delete  (DRAFT)
  POST   /api/tools/checkout-slips/{id}/submit  tools.tool.create  (DRAFT→PENDING)
  POST   /api/tools/checkout-slips/{id}/issue   tools.tool.execute (PENDING→CHECKED_OUT)
  POST   /api/tools/checkout-slips/{id}/return  tools.tool.execute (per-line return)
  POST   /api/tools/checkout-slips/{id}/cancel  tools.tool.update  (DRAFT/PENDING→CANCELLED)
"""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.tool_checkout_slip import (
    ToolCheckoutSlipCreate,
    ToolCheckoutSlipIssueRequest,
    ToolCheckoutSlipListResponse,
    ToolCheckoutSlipResponse,
    ToolCheckoutSlipReturnRequest,
    ToolCheckoutSlipUpdate,
)
from app.services.tool_checkout_slip import (
    cancel_tool_checkout_slip,
    create_tool_checkout_slip,
    delete_tool_checkout_slip,
    get_line_enrichment_info,
    get_slip_enrichment_info,
    get_tool_checkout_slip,
    issue_tool_checkout_slip,
    list_tool_checkout_slips,
    return_tool_checkout_slip_lines,
    submit_tool_checkout_slip,
    update_tool_checkout_slip,
)

tool_checkout_slip_router = APIRouter(
    prefix="/api/tools/checkout-slips", tags=["tool-checkout-slips"]
)


# ============================================================
# HELPERS
# ============================================================

async def _slip_to_response(db, slip) -> dict:
    """Convert a slip ORM object to response dict with enrichment."""
    enrichment = await get_slip_enrichment_info(db, [slip])
    line_enrichment = await get_line_enrichment_info(db, list(slip.lines))
    slip_info = enrichment.get(slip.id, {})

    lines = []
    returned_count = 0
    total_charge = Decimal("0.00")

    for line in sorted(slip.lines, key=lambda x: x.line_number):
        le = line_enrichment.get(line.id, {})
        if line.is_returned:
            returned_count += 1
        total_charge += line.charge_amount
        lines.append({
            "id": line.id,
            "slip_id": line.slip_id,
            "line_number": line.line_number,
            "tool_id": line.tool_id,
            "tool_code": le.get("tool_code"),
            "tool_name": le.get("tool_name"),
            "rate_per_hour": le.get("rate_per_hour"),
            "employee_id": line.employee_id,
            "employee_name": le.get("employee_name"),
            "checkout_id": line.checkout_id,
            "is_returned": line.is_returned,
            "returned_at": line.returned_at,
            "returned_by": line.returned_by,
            "returned_by_name": le.get("returned_by_name"),
            "charge_amount": line.charge_amount,
            "note": line.note,
            "created_at": line.created_at,
            "updated_at": line.updated_at,
        })

    return {
        "id": slip.id,
        "slip_number": slip.slip_number,
        "status": slip.status.value if hasattr(slip.status, 'value') else slip.status,
        "work_order_id": slip.work_order_id,
        "work_order_number": slip_info.get("work_order_number"),
        "requested_by": slip.requested_by,
        "requester_name": slip_info.get("requester_name"),
        "issued_by": slip.issued_by,
        "issuer_name": slip_info.get("issuer_name"),
        "issued_at": slip.issued_at,
        "note": slip.note,
        "reference": slip.reference,
        "created_by": slip.created_by,
        "is_active": slip.is_active,
        "lines": lines,
        "line_count": len(lines),
        "returned_count": returned_count,
        "total_charge": total_charge,
        "created_at": slip.created_at,
        "updated_at": slip.updated_at,
    }


# ============================================================
# LIST
# ============================================================

@tool_checkout_slip_router.get(
    "",
    response_model=ToolCheckoutSlipListResponse,
    dependencies=[Depends(require("tools.tool.read"))],
)
async def api_list_tool_checkout_slips(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    requested_by: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("tools.tool.read")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    items, total = await list_tool_checkout_slips(
        db, limit=limit, offset=offset, search=search,
        slip_status=status, requested_by=requested_by, org_id=org_id,
    )

    enrichment = await get_slip_enrichment_info(db, items)
    all_lines = []
    for slip in items:
        all_lines.extend(slip.lines)
    line_enrichment = await get_line_enrichment_info(db, all_lines)

    result_items = []
    for slip in items:
        slip_info = enrichment.get(slip.id, {})
        lines = []
        returned_count = 0
        total_charge = Decimal("0.00")

        for line in sorted(slip.lines, key=lambda x: x.line_number):
            le = line_enrichment.get(line.id, {})
            if line.is_returned:
                returned_count += 1
            total_charge += line.charge_amount
            lines.append({
                "id": line.id,
                "slip_id": line.slip_id,
                "line_number": line.line_number,
                "tool_id": line.tool_id,
                "tool_code": le.get("tool_code"),
                "tool_name": le.get("tool_name"),
                "rate_per_hour": le.get("rate_per_hour"),
                "employee_id": line.employee_id,
                "employee_name": le.get("employee_name"),
                "checkout_id": line.checkout_id,
                "is_returned": line.is_returned,
                "returned_at": line.returned_at,
                "returned_by": line.returned_by,
                "returned_by_name": le.get("returned_by_name"),
                "charge_amount": line.charge_amount,
                "note": line.note,
                "created_at": line.created_at,
                "updated_at": line.updated_at,
            })

        result_items.append({
            "id": slip.id,
            "slip_number": slip.slip_number,
            "status": slip.status.value if hasattr(slip.status, 'value') else slip.status,
            "work_order_id": slip.work_order_id,
            "work_order_number": slip_info.get("work_order_number"),
            "requested_by": slip.requested_by,
            "requester_name": slip_info.get("requester_name"),
            "issued_by": slip.issued_by,
            "issuer_name": slip_info.get("issuer_name"),
            "issued_at": slip.issued_at,
            "note": slip.note,
            "reference": slip.reference,
            "created_by": slip.created_by,
            "is_active": slip.is_active,
            "lines": lines,
            "line_count": len(lines),
            "returned_count": returned_count,
            "total_charge": total_charge,
            "created_at": slip.created_at,
            "updated_at": slip.updated_at,
        })

    return {"items": result_items, "total": total, "limit": limit, "offset": offset}


# ============================================================
# CREATE
# ============================================================

@tool_checkout_slip_router.post(
    "",
    response_model=ToolCheckoutSlipResponse,
    dependencies=[Depends(require("tools.tool.create"))],
)
async def api_create_tool_checkout_slip(
    body: ToolCheckoutSlipCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("tools.tool.create")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    slip = await create_tool_checkout_slip(
        db, body=body.model_dump(), created_by=user_id, org_id=org_id,
    )
    return await _slip_to_response(db, slip)


# ============================================================
# GET DETAIL
# ============================================================

@tool_checkout_slip_router.get(
    "/{slip_id}",
    response_model=ToolCheckoutSlipResponse,
    dependencies=[Depends(require("tools.tool.read"))],
)
async def api_get_tool_checkout_slip(
    slip_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("tools.tool.read")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    slip = await get_tool_checkout_slip(db, slip_id, org_id=org_id)
    return await _slip_to_response(db, slip)


# ============================================================
# UPDATE (DRAFT only)
# ============================================================

@tool_checkout_slip_router.put(
    "/{slip_id}",
    response_model=ToolCheckoutSlipResponse,
    dependencies=[Depends(require("tools.tool.update"))],
)
async def api_update_tool_checkout_slip(
    slip_id: UUID,
    body: ToolCheckoutSlipUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("tools.tool.update")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    slip = await update_tool_checkout_slip(
        db, slip_id, body=body.model_dump(exclude_unset=True), org_id=org_id,
    )
    return await _slip_to_response(db, slip)


# ============================================================
# DELETE (DRAFT only)
# ============================================================

@tool_checkout_slip_router.delete(
    "/{slip_id}",
    dependencies=[Depends(require("tools.tool.delete"))],
)
async def api_delete_tool_checkout_slip(
    slip_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("tools.tool.delete")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    await delete_tool_checkout_slip(db, slip_id, org_id=org_id)
    return {"detail": "Tool checkout slip deleted"}


# ============================================================
# SUBMIT (DRAFT → PENDING)
# ============================================================

@tool_checkout_slip_router.post(
    "/{slip_id}/submit",
    response_model=ToolCheckoutSlipResponse,
    dependencies=[Depends(require("tools.tool.create"))],
)
async def api_submit_tool_checkout_slip(
    slip_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("tools.tool.create")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    slip = await submit_tool_checkout_slip(db, slip_id, org_id=org_id)
    return await _slip_to_response(db, slip)


# ============================================================
# ISSUE (PENDING → CHECKED_OUT) — creates ToolCheckout per line
# ============================================================

@tool_checkout_slip_router.post(
    "/{slip_id}/issue",
    response_model=ToolCheckoutSlipResponse,
    dependencies=[Depends(require("tools.tool.execute"))],
)
async def api_issue_tool_checkout_slip(
    slip_id: UUID,
    body: ToolCheckoutSlipIssueRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("tools.tool.execute")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    slip = await issue_tool_checkout_slip(
        db, slip_id, issue_data=body.model_dump(),
        issued_by=user_id, org_id=org_id,
    )
    return await _slip_to_response(db, slip)


# ============================================================
# RETURN (per-line, CHECKED_OUT/PARTIAL → PARTIAL/RETURNED)
# ============================================================

@tool_checkout_slip_router.post(
    "/{slip_id}/return",
    response_model=ToolCheckoutSlipResponse,
    dependencies=[Depends(require("tools.tool.execute"))],
)
async def api_return_tool_checkout_slip(
    slip_id: UUID,
    body: ToolCheckoutSlipReturnRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("tools.tool.execute")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    slip = await return_tool_checkout_slip_lines(
        db, slip_id, return_data=body.model_dump(),
        returned_by=user_id, org_id=org_id,
    )
    return await _slip_to_response(db, slip)


# ============================================================
# CANCEL (DRAFT/PENDING → CANCELLED)
# ============================================================

@tool_checkout_slip_router.post(
    "/{slip_id}/cancel",
    response_model=ToolCheckoutSlipResponse,
    dependencies=[Depends(require("tools.tool.update"))],
)
async def api_cancel_tool_checkout_slip(
    slip_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("tools.tool.update")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    slip = await cancel_tool_checkout_slip(db, slip_id, org_id=org_id)
    return await _slip_to_response(db, slip)
