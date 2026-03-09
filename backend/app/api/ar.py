"""
SSS Corp ERP — Customer Invoice API
Phase C2: Accounts Receivable (AR) — 10 endpoints

Permissions: finance.ar.{create,read,update,delete,approve,export}
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.ar import (
    ARApproveRequest,
    ARSummaryResponse,
    CustomerInvoiceCreate,
    CustomerInvoiceListResponse,
    CustomerInvoiceResponse,
    CustomerInvoiceUpdate,
    CustomerPaymentCreate,
)
from app.services.ar import (
    approve_ar_invoice,
    cancel_ar_invoice,
    create_ar_invoice,
    delete_ar_invoice,
    enrich_ar_invoice_detail,
    enrich_ar_invoices,
    get_ar_invoice,
    get_ar_summary,
    list_ar_invoices,
    receive_payment,
    submit_ar_invoice,
    update_ar_invoice,
)

ar_router = APIRouter(prefix="/api/finance/ar", tags=["finance-ar"])


# ── List customer invoices ──
@ar_router.get(
    "",
    response_model=CustomerInvoiceListResponse,
    dependencies=[Depends(require("finance.ar.read"))],
)
async def api_list_ar_invoices(
    status: Optional[str] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    overdue: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    items, total = await list_ar_invoices(
        db, org_id, status=status, customer_id=customer_id,
        search=search, overdue=overdue, limit=limit, offset=offset,
    )
    enriched = await enrich_ar_invoices(db, items)
    return {"items": enriched, "total": total, "limit": limit, "offset": offset}


# ── Create customer invoice ──
@ar_router.post(
    "",
    response_model=CustomerInvoiceResponse,
    status_code=201,
    dependencies=[Depends(require("finance.ar.create"))],
)
async def api_create_ar_invoice(
    body: CustomerInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    user_id = UUID(token["sub"])
    inv = await create_ar_invoice(db, org_id, user_id, body.model_dump())
    enriched = await enrich_ar_invoice_detail(db, inv)
    return enriched


# ── AR Summary ──
@ar_router.get(
    "/summary",
    response_model=ARSummaryResponse,
    dependencies=[Depends(require("finance.ar.read"))],
)
async def api_ar_summary(
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    return await get_ar_summary(db, org_id)


# ── Get single customer invoice ──
@ar_router.get(
    "/{invoice_id}",
    response_model=CustomerInvoiceResponse,
    dependencies=[Depends(require("finance.ar.read"))],
)
async def api_get_ar_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    inv = await get_ar_invoice(db, invoice_id, org_id)
    return await enrich_ar_invoice_detail(db, inv)


# ── Update customer invoice ──
@ar_router.put(
    "/{invoice_id}",
    response_model=CustomerInvoiceResponse,
    dependencies=[Depends(require("finance.ar.update"))],
)
async def api_update_ar_invoice(
    invoice_id: UUID,
    body: CustomerInvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    inv = await update_ar_invoice(
        db, invoice_id, org_id,
        body.model_dump(exclude_unset=True),
    )
    return await enrich_ar_invoice_detail(db, inv)


# ── Delete customer invoice ──
@ar_router.delete(
    "/{invoice_id}",
    status_code=204,
    dependencies=[Depends(require("finance.ar.delete"))],
)
async def api_delete_ar_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    await delete_ar_invoice(db, invoice_id, org_id)


# ── Submit (DRAFT → PENDING) ──
@ar_router.post(
    "/{invoice_id}/submit",
    response_model=CustomerInvoiceResponse,
    dependencies=[Depends(require("finance.ar.create"))],
)
async def api_submit_ar_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    inv = await submit_ar_invoice(db, invoice_id, org_id)
    return await enrich_ar_invoice_detail(db, inv)


# ── Approve/Reject (PENDING → APPROVED/DRAFT) ──
@ar_router.post(
    "/{invoice_id}/approve",
    response_model=CustomerInvoiceResponse,
    dependencies=[Depends(require("finance.ar.approve"))],
)
async def api_approve_ar_invoice(
    invoice_id: UUID,
    body: ARApproveRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    user_id = UUID(token["sub"])
    inv = await approve_ar_invoice(
        db, invoice_id, org_id, user_id,
        action=body.action, reason=body.reason,
    )

    # Audit log
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    new_status = inv.status.value if hasattr(inv.status, "value") else str(inv.status)
    await create_audit_log(
        db, user_id=user_id, org_id=org_id,
        action="STATUS_CHANGE", resource_type="customer_invoice",
        resource_id=str(inv.id),
        description=f"{body.action} ใบแจ้งหนี้ลูกค้า {inv.invoice_number}",
        changes={"status": {"old": "PENDING", "new": new_status}, "action": body.action},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()  # Persist audit log (service already committed business data)

    return await enrich_ar_invoice_detail(db, inv)


# ── Receive Payment (APPROVED → PAID when fully received) ──
@ar_router.post(
    "/{invoice_id}/receive",
    response_model=CustomerInvoiceResponse,
    dependencies=[Depends(require("finance.ar.approve"))],
)
async def api_receive_payment(
    invoice_id: UUID,
    body: CustomerPaymentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    user_id = UUID(token["sub"])
    inv = await receive_payment(db, invoice_id, org_id, user_id, body.model_dump())

    # Audit log
    from app.services.security import create_audit_log
    from app.api._helpers import get_client_ip
    new_status = inv.status.value if hasattr(inv.status, "value") else str(inv.status)
    await create_audit_log(
        db, user_id=user_id, org_id=org_id,
        action="STATUS_CHANGE", resource_type="customer_invoice",
        resource_id=str(inv.id),
        description=f"รับชำระเงิน ใบแจ้งหนี้ลูกค้า {inv.invoice_number} (สถานะ: {new_status})",
        changes={"status": {"new": new_status}, "payment_amount": float(body.amount)},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()  # Persist audit log (service already committed business data)

    return await enrich_ar_invoice_detail(db, inv)


# ── Cancel (DRAFT/PENDING → CANCELLED) ──
@ar_router.post(
    "/{invoice_id}/cancel",
    response_model=CustomerInvoiceResponse,
    dependencies=[Depends(require("finance.ar.update"))],
)
async def api_cancel_ar_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    inv = await cancel_ar_invoice(db, invoice_id, org_id)
    return await enrich_ar_invoice_detail(db, inv)
