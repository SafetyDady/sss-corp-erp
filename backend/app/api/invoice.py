"""
SSS Corp ERP — Supplier Invoice API
Phase C1: Accounts Payable (AP) — 10 endpoints

Permissions: finance.invoice.{create,read,update,delete,approve,export}
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.invoice import (
    APSummaryResponse,
    InvoiceApproveRequest,
    InvoicePaymentCreate,
    SupplierInvoiceCreate,
    SupplierInvoiceListResponse,
    SupplierInvoiceResponse,
    SupplierInvoiceUpdate,
)
from app.services.invoice import (
    approve_invoice,
    cancel_invoice,
    create_invoice,
    delete_invoice,
    enrich_invoice_detail,
    enrich_invoices,
    get_ap_summary,
    get_invoice,
    list_invoices,
    record_payment,
    submit_invoice,
    update_invoice,
)

invoice_router = APIRouter(prefix="/api/finance", tags=["finance-ap"])


# ── List invoices ──
@invoice_router.get(
    "/invoices",
    response_model=SupplierInvoiceListResponse,
    dependencies=[Depends(require("finance.invoice.read"))],
)
async def api_list_invoices(
    status: Optional[str] = Query(None),
    supplier_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    overdue: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    items, total = await list_invoices(
        db, org_id, status=status, supplier_id=supplier_id,
        search=search, overdue=overdue, limit=limit, offset=offset,
    )
    enriched = await enrich_invoices(db, items)
    return {"items": enriched, "total": total, "limit": limit, "offset": offset}


# ── Create invoice ──
@invoice_router.post(
    "/invoices",
    response_model=SupplierInvoiceResponse,
    status_code=201,
    dependencies=[Depends(require("finance.invoice.create"))],
)
async def api_create_invoice(
    body: SupplierInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    user_id = UUID(token["sub"])
    inv = await create_invoice(db, org_id, user_id, body.model_dump())
    enriched = await enrich_invoice_detail(db, inv)
    return enriched


# ── AP Summary ──
@invoice_router.get(
    "/invoices/summary",
    response_model=APSummaryResponse,
    dependencies=[Depends(require("finance.invoice.read"))],
)
async def api_ap_summary(
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    return await get_ap_summary(db, org_id)


# ── Get single invoice ──
@invoice_router.get(
    "/invoices/{invoice_id}",
    response_model=SupplierInvoiceResponse,
    dependencies=[Depends(require("finance.invoice.read"))],
)
async def api_get_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    inv = await get_invoice(db, invoice_id, org_id)
    return await enrich_invoice_detail(db, inv)


# ── Update invoice ──
@invoice_router.put(
    "/invoices/{invoice_id}",
    response_model=SupplierInvoiceResponse,
    dependencies=[Depends(require("finance.invoice.update"))],
)
async def api_update_invoice(
    invoice_id: UUID,
    body: SupplierInvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    inv = await update_invoice(
        db, invoice_id, org_id,
        body.model_dump(exclude_unset=True),
    )
    return await enrich_invoice_detail(db, inv)


# ── Delete invoice ──
@invoice_router.delete(
    "/invoices/{invoice_id}",
    status_code=204,
    dependencies=[Depends(require("finance.invoice.delete"))],
)
async def api_delete_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    await delete_invoice(db, invoice_id, org_id)


# ── Submit (DRAFT → PENDING) ──
@invoice_router.post(
    "/invoices/{invoice_id}/submit",
    response_model=SupplierInvoiceResponse,
    dependencies=[Depends(require("finance.invoice.create"))],
)
async def api_submit_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    inv = await submit_invoice(db, invoice_id, org_id)
    return await enrich_invoice_detail(db, inv)


# ── Approve/Reject (PENDING → APPROVED/DRAFT) ──
@invoice_router.post(
    "/invoices/{invoice_id}/approve",
    response_model=SupplierInvoiceResponse,
    dependencies=[Depends(require("finance.invoice.approve"))],
)
async def api_approve_invoice(
    invoice_id: UUID,
    body: InvoiceApproveRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    user_id = UUID(token["sub"])
    inv = await approve_invoice(
        db, invoice_id, org_id, user_id,
        action=body.action, reason=body.reason,
    )
    return await enrich_invoice_detail(db, inv)


# ── Record Payment (APPROVED → PAID when fully settled) ──
@invoice_router.post(
    "/invoices/{invoice_id}/pay",
    response_model=SupplierInvoiceResponse,
    dependencies=[Depends(require("finance.invoice.approve"))],
)
async def api_record_payment(
    invoice_id: UUID,
    body: InvoicePaymentCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    user_id = UUID(token["sub"])
    inv = await record_payment(db, invoice_id, org_id, user_id, body.model_dump())
    return await enrich_invoice_detail(db, inv)


# ── Cancel (DRAFT/PENDING → CANCELLED) ──
@invoice_router.post(
    "/invoices/{invoice_id}/cancel",
    response_model=SupplierInvoiceResponse,
    dependencies=[Depends(require("finance.invoice.update"))],
)
async def api_cancel_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"])
    inv = await cancel_invoice(db, invoice_id, org_id)
    return await enrich_invoice_detail(db, inv)
