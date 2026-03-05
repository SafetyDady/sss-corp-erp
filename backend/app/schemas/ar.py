"""
SSS Corp ERP — Customer Invoice Schemas
Phase C2: Accounts Receivable (AR)
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# Customer Invoice
# ============================================================

class CustomerInvoiceCreate(BaseModel):
    so_id: UUID
    invoice_number: Optional[str] = Field(None, min_length=1, max_length=50)
    invoice_date: date
    due_date: date
    subtotal_amount: Decimal = Field(ge=0)
    vat_rate: Decimal = Field(ge=0, le=100, default=Decimal("0.00"))
    vat_amount: Decimal = Field(ge=0, default=Decimal("0.00"))
    total_amount: Decimal = Field(ge=0)
    note: Optional[str] = None


class CustomerInvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = Field(None, min_length=1, max_length=50)
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal_amount: Optional[Decimal] = Field(None, ge=0)
    vat_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    vat_amount: Optional[Decimal] = Field(None, ge=0)
    total_amount: Optional[Decimal] = Field(None, ge=0)
    note: Optional[str] = None


class CustomerPaymentResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    payment_date: date
    amount: Decimal
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    note: Optional[str] = None
    received_by: UUID
    received_by_name: Optional[str] = None
    org_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerInvoiceResponse(BaseModel):
    id: UUID
    invoice_number: str
    so_id: UUID
    so_number: Optional[str] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_code: Optional[str] = None
    invoice_date: date
    due_date: date
    subtotal_amount: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    received_amount: Decimal
    remaining_amount: Optional[Decimal] = None  # computed: total_amount - received_amount
    status: str
    is_overdue: Optional[bool] = None  # computed: APPROVED + due_date < today
    note: Optional[str] = None
    created_by: UUID
    creator_name: Optional[str] = None
    approved_by: Optional[UUID] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    is_active: bool
    org_id: UUID
    created_at: datetime
    updated_at: datetime
    payments: Optional[list[CustomerPaymentResponse]] = None

    model_config = {"from_attributes": True}


class CustomerInvoiceListResponse(BaseModel):
    items: list[CustomerInvoiceResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# Action schemas
# ============================================================

class ARApproveRequest(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")
    reason: Optional[str] = None


class CustomerPaymentCreate(BaseModel):
    payment_date: date
    amount: Decimal = Field(gt=0)
    payment_method: Optional[str] = Field(None, max_length=50)
    reference: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = None


# ============================================================
# AR Summary
# ============================================================

class ARSummaryResponse(BaseModel):
    total_invoices: int = 0
    total_receivable: Decimal = Decimal("0.00")
    total_received: Decimal = Decimal("0.00")
    total_overdue: int = 0
    total_pending_approval: int = 0
