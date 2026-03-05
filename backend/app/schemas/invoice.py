"""
SSS Corp ERP — Supplier Invoice Schemas
Phase C1: Accounts Payable (AP)
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# Supplier Invoice
# ============================================================

class SupplierInvoiceCreate(BaseModel):
    po_id: UUID
    invoice_number: str = Field(min_length=1, max_length=50)
    invoice_date: date
    due_date: date
    subtotal_amount: Decimal = Field(ge=0)
    vat_rate: Decimal = Field(ge=0, le=100, default=Decimal("0.00"))
    vat_amount: Decimal = Field(ge=0, default=Decimal("0.00"))
    total_amount: Decimal = Field(ge=0)
    wht_rate: Decimal = Field(ge=0, le=100, default=Decimal("0.00"))
    wht_amount: Decimal = Field(ge=0, default=Decimal("0.00"))
    net_payment: Decimal = Field(ge=0)
    cost_center_id: Optional[UUID] = None
    note: Optional[str] = None
    company_id: Optional[UUID] = None  # C11: Multi-Company


class SupplierInvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = Field(None, min_length=1, max_length=50)
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal_amount: Optional[Decimal] = Field(None, ge=0)
    vat_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    vat_amount: Optional[Decimal] = Field(None, ge=0)
    total_amount: Optional[Decimal] = Field(None, ge=0)
    wht_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    wht_amount: Optional[Decimal] = Field(None, ge=0)
    net_payment: Optional[Decimal] = Field(None, ge=0)
    note: Optional[str] = None


class InvoicePaymentResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    payment_date: date
    amount: Decimal
    wht_deducted: Decimal
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    note: Optional[str] = None
    paid_by: UUID
    paid_by_name: Optional[str] = None
    org_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class SupplierInvoiceResponse(BaseModel):
    id: UUID
    invoice_number: str
    po_id: UUID
    po_number: Optional[str] = None
    supplier_id: Optional[UUID] = None
    supplier_name: Optional[str] = None
    supplier_code: Optional[str] = None
    invoice_date: date
    due_date: date
    subtotal_amount: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    wht_rate: Decimal
    wht_amount: Decimal
    net_payment: Decimal
    paid_amount: Decimal
    remaining_amount: Optional[Decimal] = None  # computed: net_payment - paid_amount
    status: str
    is_overdue: Optional[bool] = None  # computed: APPROVED + due_date < today
    cost_center_id: Optional[UUID] = None
    cost_center_name: Optional[str] = None
    note: Optional[str] = None
    created_by: UUID
    creator_name: Optional[str] = None
    approved_by: Optional[UUID] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    is_active: bool
    org_id: UUID
    company_id: Optional[UUID] = None  # C11: Multi-Company
    company_code: Optional[str] = None  # C11: Multi-Company enrichment
    company_name: Optional[str] = None  # C11: Multi-Company enrichment
    created_at: datetime
    updated_at: datetime
    payments: Optional[list[InvoicePaymentResponse]] = None

    model_config = {"from_attributes": True}


class SupplierInvoiceListResponse(BaseModel):
    items: list[SupplierInvoiceResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# Action schemas
# ============================================================

class InvoiceApproveRequest(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")
    reason: Optional[str] = None


class InvoicePaymentCreate(BaseModel):
    payment_date: date
    amount: Decimal = Field(gt=0)
    wht_deducted: Decimal = Field(ge=0, default=Decimal("0.00"))
    payment_method: Optional[str] = Field(None, max_length=50)
    reference: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = None


# ============================================================
# AP Summary
# ============================================================

class APSummaryResponse(BaseModel):
    total_invoices: int = 0
    total_payable: Decimal = Decimal("0.00")
    total_paid: Decimal = Decimal("0.00")
    total_overdue: int = 0
    total_pending_approval: int = 0
