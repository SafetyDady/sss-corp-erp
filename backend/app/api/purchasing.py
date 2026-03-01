"""
SSS Corp ERP — Purchasing API Routes
PR/PO Redesign: PR CRUD + approve + convert + PO endpoints

PR Endpoints:
  GET    /api/purchasing/pr                    purchasing.pr.read
  POST   /api/purchasing/pr                    purchasing.pr.create
  GET    /api/purchasing/pr/{id}               purchasing.pr.read
  PUT    /api/purchasing/pr/{id}               purchasing.pr.update
  DELETE /api/purchasing/pr/{id}               purchasing.pr.delete
  POST   /api/purchasing/pr/{id}/submit        purchasing.pr.create
  POST   /api/purchasing/pr/{id}/approve       purchasing.pr.approve
  POST   /api/purchasing/pr/{id}/cancel        purchasing.pr.update
  POST   /api/purchasing/pr/{id}/convert-to-po purchasing.pr.approve

PO Endpoints (existing):
  GET    /api/purchasing/po                   purchasing.po.read
  POST   /api/purchasing/po                   purchasing.po.create
  GET    /api/purchasing/po/{id}              purchasing.po.read
  PUT    /api/purchasing/po/{id}              purchasing.po.update
  DELETE /api/purchasing/po/{id}              purchasing.po.delete
  POST   /api/purchasing/po/{id}/approve      purchasing.po.approve
  POST   /api/purchasing/po/{id}/receive      purchasing.po.update
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.api._helpers import resolve_employee, resolve_employee_id
from app.schemas.purchasing import (
    ConvertToPORequest,
    GoodsReceiptRequest,
    PRApproveRequest,
    PRCreate,
    PRListResponse,
    PRResponse,
    PRUpdate,
    PurchaseOrderCreate,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
    PurchaseOrderUpdate,
)
from app.services.organization import check_approval_bypass
from app.services.purchasing import (
    approve_purchase_order,
    approve_purchase_requisition,
    cancel_purchase_requisition,
    convert_pr_to_po,
    create_purchase_order,
    create_purchase_requisition,
    delete_purchase_order,
    delete_purchase_requisition,
    get_purchase_order,
    get_purchase_requisition,
    list_purchase_orders,
    list_purchase_requisitions,
    receive_goods,
    submit_purchase_requisition,
    update_purchase_order,
    update_purchase_requisition,
)

purchasing_router = APIRouter(prefix="/api/purchasing", tags=["purchasing"])


# ============================================================
# PR ENDPOINTS
# ============================================================

@purchasing_router.get(
    "/pr",
    response_model=PRListResponse,
    dependencies=[Depends(require("purchasing.pr.read"))],
)
async def api_list_prs(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    status: Optional[str] = Query(
        default=None,
        pattern=r"^(DRAFT|SUBMITTED|APPROVED|PO_CREATED|REJECTED|CANCELLED)$",
    ),
    pr_type: Optional[str] = Query(default=None, pattern=r"^(STANDARD|BLANKET)$"),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])
    role = token.get("role", "staff")

    # Data Scope
    created_by_filter = None
    department_filter = None

    if role == "staff":
        # Staff sees only own PRs
        created_by_filter = user_id
    elif role == "supervisor":
        # Supervisor sees own department's PRs
        emp = await resolve_employee(db, user_id)
        if emp and emp.department_id:
            department_filter = [emp.department_id]
        else:
            created_by_filter = user_id
    # manager/owner see all

    items, total = await list_purchase_requisitions(
        db,
        limit=limit,
        offset=offset,
        search=search,
        pr_status=status,
        pr_type=pr_type,
        org_id=org_id,
        created_by_filter=created_by_filter,
        department_filter=department_filter,
    )

    # Compute total_estimated for response
    response_items = []
    for pr in items:
        pr_dict = _pr_to_response(pr)
        response_items.append(pr_dict)

    return PRListResponse(items=response_items, total=total, limit=limit, offset=offset)


@purchasing_router.post(
    "/pr",
    response_model=PRResponse,
    status_code=201,
    dependencies=[Depends(require("purchasing.pr.create"))],
)
async def api_create_pr(
    body: PRCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    # Resolve requester employee
    requester_id = await resolve_employee_id(db, user_id)

    body_dict = body.model_dump()
    # Convert lines from Pydantic to dicts
    body_dict["lines"] = [l.model_dump() for l in body.lines]
    # Convert enums to strings
    if body.pr_type:
        body_dict["pr_type"] = body.pr_type.value
    if body.priority:
        body_dict["priority"] = body.priority.value
    for line in body_dict["lines"]:
        line["item_type"] = line["item_type"].value if hasattr(line["item_type"], "value") else line["item_type"]

    pr = await create_purchase_requisition(
        db,
        body=body_dict,
        created_by=user_id,
        org_id=org_id,
        requester_id=requester_id,
    )
    return _pr_to_response(pr)


@purchasing_router.get(
    "/pr/{pr_id}",
    response_model=PRResponse,
    dependencies=[Depends(require("purchasing.pr.read"))],
)
async def api_get_pr(
    pr_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    pr = await get_purchase_requisition(db, pr_id, org_id=org_id)
    return _pr_to_response(pr)


@purchasing_router.put(
    "/pr/{pr_id}",
    response_model=PRResponse,
    dependencies=[Depends(require("purchasing.pr.update"))],
)
async def api_update_pr(
    pr_id: UUID,
    body: PRUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)

    # Convert lines if present
    if "lines" in update_data and update_data["lines"] is not None:
        update_data["lines"] = [
            {**l, "item_type": l["item_type"].value if hasattr(l["item_type"], "value") else l["item_type"]}
            for l in update_data["lines"]
        ]

    # Convert enums
    if "pr_type" in update_data and update_data["pr_type"] is not None:
        update_data["pr_type"] = update_data["pr_type"].value if hasattr(update_data["pr_type"], "value") else update_data["pr_type"]
    if "priority" in update_data and update_data["priority"] is not None:
        update_data["priority"] = update_data["priority"].value if hasattr(update_data["priority"], "value") else update_data["priority"]

    pr = await update_purchase_requisition(db, pr_id, update_data=update_data, org_id=org_id)
    return _pr_to_response(pr)


@purchasing_router.delete(
    "/pr/{pr_id}",
    status_code=204,
    dependencies=[Depends(require("purchasing.pr.delete"))],
)
async def api_delete_pr(
    pr_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_purchase_requisition(db, pr_id, org_id=org_id)


@purchasing_router.post(
    "/pr/{pr_id}/submit",
    response_model=PRResponse,
    dependencies=[Depends(require("purchasing.pr.create"))],
)
async def api_submit_pr(
    pr_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    pr = await submit_purchase_requisition(db, pr_id, org_id=org_id)

    # Check if auto-approve bypass is on
    if await check_approval_bypass(db, org_id, "purchasing.pr"):
        user_id = UUID(token["sub"])
        pr = await approve_purchase_requisition(
            db, pr_id, action="approve", approved_by=user_id, org_id=org_id
        )

    return _pr_to_response(pr)


@purchasing_router.post(
    "/pr/{pr_id}/approve",
    response_model=PRResponse,
    dependencies=[Depends(require("purchasing.pr.approve"))],
)
async def api_approve_pr(
    pr_id: UUID,
    body: PRApproveRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    pr = await approve_purchase_requisition(
        db, pr_id, action=body.action, reason=body.reason, approved_by=user_id, org_id=org_id
    )
    return _pr_to_response(pr)


@purchasing_router.post(
    "/pr/{pr_id}/cancel",
    response_model=PRResponse,
    dependencies=[Depends(require("purchasing.pr.update"))],
)
async def api_cancel_pr(
    pr_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    pr = await cancel_purchase_requisition(db, pr_id, org_id=org_id)
    return _pr_to_response(pr)


@purchasing_router.post(
    "/pr/{pr_id}/convert-to-po",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require("purchasing.pr.approve"))],
)
async def api_convert_pr_to_po(
    pr_id: UUID,
    body: ConvertToPORequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    body_dict = body.model_dump()
    body_dict["lines"] = [l.model_dump() for l in body.lines]

    po = await convert_pr_to_po(db, pr_id, body=body_dict, created_by=user_id, org_id=org_id)
    return _po_to_response(po)


# ============================================================
# PO ENDPOINTS (existing, modified)
# ============================================================

@purchasing_router.get(
    "/po",
    response_model=PurchaseOrderListResponse,
    dependencies=[Depends(require("purchasing.po.read"))],
)
async def api_list_pos(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    status: Optional[str] = Query(
        default=None,
        pattern=r"^(DRAFT|SUBMITTED|APPROVED|RECEIVED|CANCELLED)$",
    ),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])
    role = token.get("role", "staff")

    # Data Scope — consistent with PR list (Phase 6 compliance)
    created_by_filter = None
    department_filter = None

    if role == "staff":
        created_by_filter = user_id
    elif role == "supervisor":
        emp = await resolve_employee(db, user_id)
        if emp and emp.department_id:
            department_filter = [emp.department_id]
        else:
            created_by_filter = user_id
    # manager/owner see all

    items, total = await list_purchase_orders(
        db, limit=limit, offset=offset, search=search, po_status=status, org_id=org_id,
        created_by_filter=created_by_filter, department_filter=department_filter,
    )
    response_items = [_po_to_response(po) for po in items]
    return PurchaseOrderListResponse(items=response_items, total=total, limit=limit, offset=offset)


@purchasing_router.post(
    "/po",
    response_model=PurchaseOrderResponse,
    status_code=201,
    dependencies=[Depends(require("purchasing.po.create"))],
)
async def api_create_po(
    body: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    # BR#61: PO must be created via PR convert only
    from fastapi import HTTPException
    raise HTTPException(
        status_code=422,
        detail="PO must be created via PR conversion. Use POST /api/purchasing/pr/{id}/convert-to-po",
    )


@purchasing_router.get(
    "/po/{po_id}",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require("purchasing.po.read"))],
)
async def api_get_po(
    po_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    po = await get_purchase_order(db, po_id, org_id=org_id)
    return _po_to_response(po)


@purchasing_router.put(
    "/po/{po_id}",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require("purchasing.po.update"))],
)
async def api_update_po(
    po_id: UUID,
    body: PurchaseOrderUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    update_data = body.model_dump(exclude_unset=True)
    po = await update_purchase_order(db, po_id, update_data=update_data, org_id=org_id)
    return _po_to_response(po)


@purchasing_router.delete(
    "/po/{po_id}",
    status_code=204,
    dependencies=[Depends(require("purchasing.po.delete"))],
)
async def api_delete_po(
    po_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    await delete_purchase_order(db, po_id, org_id=org_id)


@purchasing_router.post(
    "/po/{po_id}/approve",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require("purchasing.po.approve"))],
)
async def api_approve_po(
    po_id: UUID,
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    po = await approve_purchase_order(db, po_id, approved_by=user_id, org_id=org_id)
    return _po_to_response(po)


@purchasing_router.post(
    "/po/{po_id}/receive",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require("purchasing.po.update"))],
)
async def api_receive_goods(
    po_id: UUID,
    body: GoodsReceiptRequest,
    token: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    receipt_lines = [l.model_dump() for l in body.lines]
    po = await receive_goods(
        db,
        po_id,
        receipt_lines=receipt_lines,
        received_by=user_id,
        org_id=org_id,
        delivery_note_number=body.delivery_note_number,
    )
    return _po_to_response(po)


# ============================================================
# RESPONSE HELPERS
# ============================================================

def _pr_to_response(pr) -> dict:
    """Convert PR model to response dict with computed total_estimated."""
    from decimal import Decimal
    total = sum(
        Decimal(str(line.quantity)) * Decimal(str(line.estimated_unit_cost))
        for line in pr.lines
    )
    return {
        "id": pr.id,
        "pr_number": pr.pr_number,
        "pr_type": pr.pr_type.value if hasattr(pr.pr_type, "value") else pr.pr_type,
        "cost_center_id": pr.cost_center_id,
        "department_id": pr.department_id,
        "requester_id": pr.requester_id,
        "status": pr.status.value if hasattr(pr.status, "value") else pr.status,
        "priority": pr.priority.value if hasattr(pr.priority, "value") else pr.priority,
        "required_date": pr.required_date,
        "delivery_date": pr.delivery_date,
        "validity_start_date": pr.validity_start_date,
        "validity_end_date": pr.validity_end_date,
        "total_estimated": total,
        "note": pr.note,
        "requested_approver_id": pr.requested_approver_id,
        "approved_by": pr.approved_by,
        "approved_at": pr.approved_at,
        "rejected_reason": pr.rejected_reason,
        "created_by": pr.created_by,
        "is_active": pr.is_active,
        "lines": [
            {
                "id": line.id,
                "pr_id": line.pr_id,
                "line_number": line.line_number,
                "item_type": line.item_type.value if hasattr(line.item_type, "value") else line.item_type,
                "product_id": line.product_id,
                "description": line.description,
                "quantity": line.quantity,
                "unit": line.unit,
                "estimated_unit_cost": line.estimated_unit_cost,
                "cost_element_id": line.cost_element_id,
                "note": line.note,
                "created_at": line.created_at,
                "updated_at": line.updated_at,
            }
            for line in sorted(pr.lines, key=lambda l: l.line_number)
        ],
        "created_at": pr.created_at,
        "updated_at": pr.updated_at,
    }


def _po_to_response(po) -> dict:
    """Convert PO model to response dict with PR + Supplier reference."""
    pr_number = None
    if po.purchase_requisition:
        pr_number = po.purchase_requisition.pr_number

    # Supplier enrichment
    supplier_id = getattr(po, "supplier_id", None)
    supplier_code = None
    supplier_contact = None
    supplier_phone = None
    supplier = getattr(po, "supplier", None)
    if supplier:
        supplier_code = supplier.code
        supplier_contact = supplier.contact_name
        supplier_phone = supplier.phone

    return {
        "id": po.id,
        "po_number": po.po_number,
        "pr_id": po.pr_id,
        "pr_number": pr_number,
        "supplier_name": po.supplier_name,
        "supplier_id": supplier_id,
        "supplier_code": supplier_code,
        "supplier_contact": supplier_contact,
        "supplier_phone": supplier_phone,
        "status": po.status.value if hasattr(po.status, "value") else po.status,
        "order_date": po.order_date,
        "expected_date": po.expected_date,
        "total_amount": po.total_amount,
        "cost_center_id": po.cost_center_id,
        "note": po.note,
        "delivery_note_number": getattr(po, "delivery_note_number", None),
        "created_by": po.created_by,
        "approved_by": po.approved_by,
        "requested_approver_id": po.requested_approver_id,
        "is_active": po.is_active,
        "lines": [
            {
                "id": line.id,
                "po_id": line.po_id,
                "pr_line_id": getattr(line, "pr_line_id", None),
                "product_id": line.product_id,
                "item_type": (line.item_type.value if hasattr(line.item_type, "value") else line.item_type)
                    if hasattr(line, "item_type") else "GOODS",
                "description": getattr(line, "description", None),
                "quantity": line.quantity,
                "unit": getattr(line, "unit", "PCS"),
                "unit_cost": line.unit_cost,
                "cost_element_id": getattr(line, "cost_element_id", None),
                "received_qty": line.received_qty,
                "received_by": getattr(line, "received_by", None),
                "received_at": getattr(line, "received_at", None),
                "created_at": line.created_at,
                "updated_at": line.updated_at,
            }
            for line in po.lines
        ],
        "created_at": po.created_at,
        "updated_at": po.updated_at,
    }
