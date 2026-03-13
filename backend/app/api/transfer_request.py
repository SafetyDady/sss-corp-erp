"""
SSS Corp ERP — Transfer Request API Routes
Multi-line transfer document: DRAFT → PENDING → TRANSFERRED

Endpoints:
  GET    /api/inventory/transfer-requests              inventory.movement.read
  POST   /api/inventory/transfer-requests              inventory.movement.create
  GET    /api/inventory/transfer-requests/{id}         inventory.movement.read
  PUT    /api/inventory/transfer-requests/{id}         inventory.movement.create   (DRAFT)
  DELETE /api/inventory/transfer-requests/{id}         inventory.movement.delete   (DRAFT)
  POST   /api/inventory/transfer-requests/{id}/submit  inventory.movement.create   (DRAFT→PENDING)
  POST   /api/inventory/transfer-requests/{id}/execute inventory.withdrawal.approve (PENDING→TRANSFERRED)
  POST   /api/inventory/transfer-requests/{id}/cancel  inventory.movement.create   (→CANCELLED)
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.transfer_request import (
    TransferRequestCreate,
    TransferRequestExecuteRequest,
    TransferRequestListResponse,
    TransferRequestResponse,
    TransferRequestUpdate,
)
from app.services.transfer_request import (
    cancel_transfer_request,
    create_transfer_request,
    delete_transfer_request,
    execute_transfer_request,
    get_tf_enrichment_info,
    get_tf_line_enrichment_info,
    get_transfer_request,
    list_transfer_requests,
    submit_transfer_request,
    update_transfer_request,
)

transfer_request_router = APIRouter(
    prefix="/api/inventory/transfer-requests", tags=["transfer-request"]
)


# ============================================================
# HELPERS
# ============================================================

async def _tf_to_response(db, tf) -> dict:
    """Convert a transfer request ORM object to response dict with enrichment."""
    enrichment = await get_tf_enrichment_info(db, [tf])
    line_enrichment = await get_tf_line_enrichment_info(db, list(tf.lines))
    tf_info = enrichment.get(tf.id, {})

    lines = []
    for line in sorted(tf.lines, key=lambda x: x.line_number):
        le = line_enrichment.get(line.id, {})
        lines.append({
            "id": line.id,
            "transfer_request_id": line.transfer_request_id,
            "line_number": line.line_number,
            "product_id": line.product_id,
            "product_sku": le.get("product_sku"),
            "product_name": le.get("product_name"),
            "product_unit": le.get("product_unit"),
            "quantity": line.quantity,
            "transferred_qty": line.transferred_qty,
            "movement_id": line.movement_id,
            "note": line.note,
            "created_at": line.created_at,
            "updated_at": line.updated_at,
        })

    return {
        "id": tf.id,
        "transfer_number": tf.transfer_number,
        "status": tf.status.value if hasattr(tf.status, "value") else tf.status,
        "source_warehouse_id": tf.source_warehouse_id,
        "source_warehouse_name": tf_info.get("source_warehouse_name"),
        "source_location_id": tf.source_location_id,
        "source_location_name": tf_info.get("source_location_name"),
        "dest_warehouse_id": tf.dest_warehouse_id,
        "dest_warehouse_name": tf_info.get("dest_warehouse_name"),
        "dest_location_id": tf.dest_location_id,
        "dest_location_name": tf_info.get("dest_location_name"),
        "requested_by": tf.requested_by,
        "requester_name": tf_info.get("requester_name"),
        "transferred_by": tf.transferred_by,
        "transferrer_name": tf_info.get("transferrer_name"),
        "transferred_at": tf.transferred_at,
        "note": tf.note,
        "reference": tf.reference,
        "created_by": tf.created_by,
        "is_active": tf.is_active,
        "lines": lines,
        "line_count": len(lines),
        "created_at": tf.created_at,
        "updated_at": tf.updated_at,
    }


# ============================================================
# LIST
# ============================================================

@transfer_request_router.get(
    "",
    response_model=TransferRequestListResponse,
    dependencies=[Depends(require("inventory.movement.read"))],
)
async def api_list_transfer_requests(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.movement.read")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    items, total = await list_transfer_requests(
        db, limit=limit, offset=offset, search=search,
        tf_status=status, org_id=org_id,
    )

    enrichment = await get_tf_enrichment_info(db, items)
    all_lines = []
    for tf in items:
        all_lines.extend(tf.lines)
    line_enrichment = await get_tf_line_enrichment_info(db, all_lines)

    result_items = []
    for tf in items:
        tf_info = enrichment.get(tf.id, {})
        lines = []
        for line in sorted(tf.lines, key=lambda x: x.line_number):
            le = line_enrichment.get(line.id, {})
            lines.append({
                "id": line.id,
                "transfer_request_id": line.transfer_request_id,
                "line_number": line.line_number,
                "product_id": line.product_id,
                "product_sku": le.get("product_sku"),
                "product_name": le.get("product_name"),
                "product_unit": le.get("product_unit"),
                "quantity": line.quantity,
                "transferred_qty": line.transferred_qty,
                "movement_id": line.movement_id,
                "note": line.note,
                "created_at": line.created_at,
                "updated_at": line.updated_at,
            })
        result_items.append({
            "id": tf.id,
            "transfer_number": tf.transfer_number,
            "status": tf.status.value if hasattr(tf.status, "value") else tf.status,
            "source_warehouse_id": tf.source_warehouse_id,
            "source_warehouse_name": tf_info.get("source_warehouse_name"),
            "source_location_id": tf.source_location_id,
            "source_location_name": tf_info.get("source_location_name"),
            "dest_warehouse_id": tf.dest_warehouse_id,
            "dest_warehouse_name": tf_info.get("dest_warehouse_name"),
            "dest_location_id": tf.dest_location_id,
            "dest_location_name": tf_info.get("dest_location_name"),
            "requested_by": tf.requested_by,
            "requester_name": tf_info.get("requester_name"),
            "transferred_by": tf.transferred_by,
            "transferrer_name": tf_info.get("transferrer_name"),
            "transferred_at": tf.transferred_at,
            "note": tf.note,
            "reference": tf.reference,
            "created_by": tf.created_by,
            "is_active": tf.is_active,
            "lines": lines,
            "line_count": len(lines),
            "created_at": tf.created_at,
            "updated_at": tf.updated_at,
        })

    return {"items": result_items, "total": total, "limit": limit, "offset": offset}


# ============================================================
# CREATE
# ============================================================

@transfer_request_router.post(
    "",
    response_model=TransferRequestResponse,
    dependencies=[Depends(require("inventory.movement.create"))],
)
async def api_create_transfer_request(
    body: TransferRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.movement.create")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    tf = await create_transfer_request(
        db, body=body.model_dump(), created_by=user_id, org_id=org_id,
    )
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id,
        org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="CREATE", resource_type="transfer_request",
        resource_id=str(tf.id),
        description=f"สร้างใบขอโอนย้าย {tf.transfer_number}",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return await _tf_to_response(db, tf)


# ============================================================
# GET DETAIL
# ============================================================

@transfer_request_router.get(
    "/{tf_id}",
    response_model=TransferRequestResponse,
    dependencies=[Depends(require("inventory.movement.read"))],
)
async def api_get_transfer_request(
    tf_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.movement.read")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    tf = await get_transfer_request(db, tf_id, org_id=org_id)
    return await _tf_to_response(db, tf)


# ============================================================
# UPDATE (DRAFT only)
# ============================================================

@transfer_request_router.put(
    "/{tf_id}",
    response_model=TransferRequestResponse,
    dependencies=[Depends(require("inventory.movement.create"))],
)
async def api_update_transfer_request(
    tf_id: UUID,
    body: TransferRequestUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.movement.create")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    update_data = body.model_dump(exclude_unset=True)
    tf = await update_transfer_request(
        db, tf_id, body=update_data, org_id=org_id,
    )
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id,
        org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="UPDATE", resource_type="transfer_request",
        resource_id=str(tf_id),
        description=f"แก้ไขใบขอโอนย้าย {tf_id}",
        changes=update_data,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return await _tf_to_response(db, tf)


# ============================================================
# DELETE (DRAFT only)
# ============================================================

@transfer_request_router.delete(
    "/{tf_id}",
    dependencies=[Depends(require("inventory.movement.delete"))],
)
async def api_delete_transfer_request(
    tf_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.movement.delete")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    await delete_transfer_request(db, tf_id, org_id=org_id)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id,
        org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="DELETE", resource_type="transfer_request",
        resource_id=str(tf_id),
        description=f"ลบใบขอโอนย้าย {tf_id}",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return {"detail": "Transfer request deleted"}


# ============================================================
# SUBMIT (DRAFT → PENDING)
# ============================================================

@transfer_request_router.post(
    "/{tf_id}/submit",
    response_model=TransferRequestResponse,
    dependencies=[Depends(require("inventory.movement.create"))],
)
async def api_submit_transfer_request(
    tf_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.movement.create")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    tf = await submit_transfer_request(db, tf_id, org_id=org_id)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id,
        org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="STATUS_CHANGE", resource_type="transfer_request",
        resource_id=str(tf_id),
        description=f"ส่งใบขอโอนย้าย {tf.transfer_number}",
        changes={"status": {"old": "DRAFT", "new": "PENDING"}},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return await _tf_to_response(db, tf)


# ============================================================
# EXECUTE (PENDING → TRANSFERRED) — creates TRANSFER movements
# ============================================================

@transfer_request_router.post(
    "/{tf_id}/execute",
    response_model=TransferRequestResponse,
    dependencies=[Depends(require("inventory.withdrawal.approve"))],
)
async def api_execute_transfer_request(
    tf_id: UUID,
    body: TransferRequestExecuteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.withdrawal.approve")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    tf = await execute_transfer_request(
        db, tf_id, execute_data=body.model_dump(),
        transferred_by=user_id, org_id=org_id,
    )
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id,
        org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="approve", resource_type="transfer_request",
        resource_id=str(tf_id),
        description=f"ดำเนินการโอนย้ายสินค้า {tf.transfer_number}",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return await _tf_to_response(db, tf)


# ============================================================
# CANCEL (DRAFT/PENDING → CANCELLED)
# ============================================================

@transfer_request_router.post(
    "/{tf_id}/cancel",
    response_model=TransferRequestResponse,
    dependencies=[Depends(require("inventory.movement.create"))],
)
async def api_cancel_transfer_request(
    tf_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require("inventory.movement.create")),
):
    org_id = token.get("org_id", DEFAULT_ORG_ID)
    user_id = UUID(token["sub"])
    tf = await cancel_transfer_request(db, tf_id, org_id=org_id)
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    await create_audit_log(
        db, user_id=user_id,
        org_id=UUID(org_id) if isinstance(org_id, str) else org_id,
        action="STATUS_CHANGE", resource_type="transfer_request",
        resource_id=str(tf_id),
        description=f"ยกเลิกใบขอโอนย้าย {tf_id}",
        changes={"status": {"new": "CANCELLED"}},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return await _tf_to_response(db, tf)
