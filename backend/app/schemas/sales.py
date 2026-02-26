"""
SSS Corp ERP — Sales Schemas (Pydantic v2)
SalesOrder + Lines
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SOStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    INVOICED = "INVOICED"
    CANCELLED = "CANCELLED"


class SOLineCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0, decimal_places=2)


class SOLineResponse(BaseModel):
    id: UUID
    so_id: UUID
    product_id: UUID
    quantity: int
    unit_price: Decimal
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesOrderCreate(BaseModel):
    customer_id: UUID
    order_date: date
    note: Optional[str] = None
    lines: list[SOLineCreate] = Field(min_length=1)


class SalesOrderUpdate(BaseModel):
    note: Optional[str] = None


class SalesOrderResponse(BaseModel):
    id: UUID
    so_number: str
    customer_id: UUID
    status: SOStatus
    order_date: date
    total_amount: Decimal
    note: Optional[str] = None
    created_by: UUID
    approved_by: Optional[UUID] = None
    is_active: bool
    lines: list[SOLineResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesOrderListResponse(BaseModel):
    items: list[SalesOrderResponse]
    total: int
    limit: int
    offset: int
