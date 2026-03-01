"""
SSS Corp ERP — Stock Withdrawal Slip API Routes
Multi-line withdrawal document: DRAFT → PENDING → ISSUED

Endpoints:
  GET    /api/inventory/withdrawal-slips              inventory.withdrawal.read
  POST   /api/inventory/withdrawal-slips              inventory.withdrawal.create
  GET    /api/inventory/withdrawal-slips/{id}         inventory.withdrawal.read
  PUT    /api/inventory/withdrawal-slips/{id}         inventory.withdrawal.update  (DRAFT)
  DELETE /api/inventory/withdrawal-slips/{id}         inventory.withdrawal.delete  (DRAFT)
  POST   /api/inventory/withdrawal-slips/{id}/submit  inventory.withdrawal.create  (DRAFT→PENDING)
  POST   /api/inventory/withdrawal-slips/{id}/issue   inventory.withdrawal.approve (PENDING→ISSUED)
  POST   /api/inventory/withdrawal-slips/{id}/cancel  inventory.withdrawal.update  (→CANCELLED)
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.withdrawal import (
    WithdrawalSlipCreate,
    WithdrawalSlipIssueRequest,
    WithdrawalSlipListResponse,
    WithdrawalSlipResponse,
    WithdrawalSlipUpdate,
)
from app.services.withdrawal import (
    cancel_withdrawal_slip,
    create_withdrawal_slip,
    delete_withdrawal_slip,
    get_line_enrichment_info,
    get_slip_enrichment_info,
    get_withdrawal_slip,
    issue_withdrawal_slip,
    list_withdrawal_slips,
    submit_withdrawal_slip,
    update_withdrawal_slip,
)

withdrawal_router = APIRouter(
    prefix="/api/inventory/withdrawal-slips", tags=["withdrawal"]
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
    for line in sorted(slip.lines, key=lambda x: x.line_number):
        le = line_enrichment.get(line.id, {})
        lines.append({
            "id": line.id,
            "slip_id": line.slip_id,
            "line_number": line.line_number,
            "product_id": line.product_id,
            "product_sku": le.get("product_sku"),
            "product_name": le.get("product_name"),
            "product_unit": le.get("product_unit"),
            "quantity": line.quantity,
            "issued_qty": line.issued_qty,
            "location_id": line.location_id,
            "location_name": le.get("location_name"),
            "warehouse_name": le.get("warehouse_name"),
            "movement_id": line.movement_id,
            "note": line.note,
            "created_at": line.created_at,
            "updated_at": line.updated_at,
        })

    return {
        "id": slip.id,
        "slip_number": slip.slip_number,
        "withdrawal_type": slip.withdrawal_type.value if hasattr(slip.withdrawal_type, 'value') else slip.withdrawal_type,
        "status": slip.status.value if hasattr(slip.status, 'value') else slip.status,
        "work_order_id": slip.work_order_id,
        "work_order_number": slip_info.get("work_order_number"),
        "cost_center_id": slip.cost_center_id,
        "cost_center_name": slip_info.get("cost_center_name"),
        "cost_element_id": slip.cost_element_id,
        "cost_element_name": slip_info.get("cost_element_name"),
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
        "created_at": slip.created_at,
        "updated_at": slip.updated_at,
    }


# ============================================================
# LIST
# ============================================================

@withdrawal_router.get(
    "",
    response_model=WithdrawalSlipListResponse,
    dependencies=[Depends(require("inventory.withdrawal.read"))],
)
async def api_list_withdrawal_slips(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    withdrawal_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.withdrawal.read")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    items, total = await list_withdrawal_slips(
        db, limit=limit, offset=offset, search=search,
        slip_status=status, withdrawal_type=withdrawal_type, org_id=org_id,
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
        for line in sorted(slip.lines, key=lambda x: x.line_number):
            le = line_enrichment.get(line.id, {})
            lines.append({
                "id": line.id,
                "slip_id": line.slip_id,
                "line_number": line.line_number,
                "product_id": line.product_id,
                "product_sku": le.get("product_sku"),
                "product_name": le.get("product_name"),
                "product_unit": le.get("product_unit"),
                "quantity": line.quantity,
                "issued_qty": line.issued_qty,
                "location_id": line.location_id,
                "location_name": le.get("location_name"),
                "warehouse_name": le.get("warehouse_name"),
                "movement_id": line.movement_id,
                "note": line.note,
                "created_at": line.created_at,
                "updated_at": line.updated_at,
            })
        result_items.append({
            "id": slip.id,
            "slip_number": slip.slip_number,
            "withdrawal_type": slip.withdrawal_type.value if hasattr(slip.withdrawal_type, 'value') else slip.withdrawal_type,
            "status": slip.status.value if hasattr(slip.status, 'value') else slip.status,
            "work_order_id": slip.work_order_id,
            "work_order_number": slip_info.get("work_order_number"),
            "cost_center_id": slip.cost_center_id,
            "cost_center_name": slip_info.get("cost_center_name"),
            "cost_element_id": slip.cost_element_id,
            "cost_element_name": slip_info.get("cost_element_name"),
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
            "created_at": slip.created_at,
            "updated_at": slip.updated_at,
        })

    return {"items": result_items, "total": total, "limit": limit, "offset": offset}


# ============================================================
# CREATE
# ============================================================

@withdrawal_router.post(
    "",
    response_model=WithdrawalSlipResponse,
    dependencies=[Depends(require("inventory.withdrawal.create"))],
)
async def api_create_withdrawal_slip(
    body: WithdrawalSlipCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.withdrawal.create")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    slip = await create_withdrawal_slip(
        db, body=body.model_dump(), created_by=user_id, org_id=org_id,
    )
    return await _slip_to_response(db, slip)


# ============================================================
# GET DETAIL
# ============================================================

@withdrawal_router.get(
    "/{slip_id}",
    response_model=WithdrawalSlipResponse,
    dependencies=[Depends(require("inventory.withdrawal.read"))],
)
async def api_get_withdrawal_slip(
    slip_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.withdrawal.read")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    slip = await get_withdrawal_slip(db, slip_id, org_id=org_id)
    return await _slip_to_response(db, slip)


# ============================================================
# UPDATE (DRAFT only)
# ============================================================

@withdrawal_router.put(
    "/{slip_id}",
    response_model=WithdrawalSlipResponse,
    dependencies=[Depends(require("inventory.withdrawal.update"))],
)
async def api_update_withdrawal_slip(
    slip_id: UUID,
    body: WithdrawalSlipUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.withdrawal.update")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    slip = await update_withdrawal_slip(
        db, slip_id, body=body.model_dump(exclude_unset=True), org_id=org_id,
    )
    return await _slip_to_response(db, slip)


# ============================================================
# DELETE (DRAFT only)
# ============================================================

@withdrawal_router.delete(
    "/{slip_id}",
    dependencies=[Depends(require("inventory.withdrawal.delete"))],
)
async def api_delete_withdrawal_slip(
    slip_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.withdrawal.delete")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    await delete_withdrawal_slip(db, slip_id, org_id=org_id)
    return {"detail": "Withdrawal slip deleted"}


# ============================================================
# SUBMIT (DRAFT → PENDING)
# ============================================================

@withdrawal_router.post(
    "/{slip_id}/submit",
    response_model=WithdrawalSlipResponse,
    dependencies=[Depends(require("inventory.withdrawal.create"))],
)
async def api_submit_withdrawal_slip(
    slip_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.withdrawal.create")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    slip = await submit_withdrawal_slip(db, slip_id, org_id=org_id)
    return await _slip_to_response(db, slip)


# ============================================================
# ISSUE (PENDING → ISSUED) — creates stock movements
# ============================================================

@withdrawal_router.post(
    "/{slip_id}/issue",
    response_model=WithdrawalSlipResponse,
    dependencies=[Depends(require("inventory.withdrawal.approve"))],
)
async def api_issue_withdrawal_slip(
    slip_id: UUID,
    body: WithdrawalSlipIssueRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.withdrawal.approve")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    slip = await issue_withdrawal_slip(
        db, slip_id, issue_data=body.model_dump(),
        issued_by=user_id, org_id=org_id,
    )
    return await _slip_to_response(db, slip)


# ============================================================
# CANCEL (DRAFT/PENDING → CANCELLED)
# ============================================================

@withdrawal_router.post(
    "/{slip_id}/cancel",
    response_model=WithdrawalSlipResponse,
    dependencies=[Depends(require("inventory.withdrawal.update"))],
)
async def api_cancel_withdrawal_slip(
    slip_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.withdrawal.update")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    slip = await cancel_withdrawal_slip(db, slip_id, org_id=org_id)
    return await _slip_to_response(db, slip)
