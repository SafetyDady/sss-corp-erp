"""
SSS Corp ERP — Purchasing Schemas (Pydantic v2)
PurchaseOrder + Lines
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class POStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class POLineCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(gt=0)
    unit_cost: Decimal = Field(ge=0, decimal_places=2)


class POLineResponse(BaseModel):
    id: UUID
    po_id: UUID
    product_id: UUID
    quantity: int
    unit_cost: Decimal
    received_qty: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PurchaseOrderCreate(BaseModel):
    supplier_name: str = Field(min_length=1, max_length=255)
    order_date: date
    expected_date: Optional[date] = None
    note: Optional[str] = None
    lines: list[POLineCreate] = Field(min_length=1)


class PurchaseOrderUpdate(BaseModel):
    supplier_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    expected_date: Optional[date] = None
    note: Optional[str] = None


class PurchaseOrderResponse(BaseModel):
    id: UUID
    po_number: str
    supplier_name: str
    status: POStatus
    order_date: date
    expected_date: Optional[date] = None
    total_amount: Decimal
    note: Optional[str] = None
    created_by: UUID
    approved_by: Optional[UUID] = None
    is_active: bool
    lines: list[POLineResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PurchaseOrderListResponse(BaseModel):
    items: list[PurchaseOrderResponse]
    total: int
    limit: int
    offset: int


class GoodsReceiptLine(BaseModel):
    line_id: UUID
    received_qty: int = Field(gt=0)
