"""
SSS Corp ERP — Sales Schemas (Pydantic v2)
SalesOrder + Lines + Submit/Approve/Reject/Cancel
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


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
    requested_approver_id: Optional[UUID] = None
    vat_rate: Optional[Decimal] = Field(default=None, ge=0, le=100, decimal_places=2,
                                         description="VAT rate %. None = use org default")
    lines: list[SOLineCreate] = Field(min_length=1)


class SalesOrderUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    order_date: Optional[date] = None
    note: Optional[str] = None
    requested_approver_id: Optional[UUID] = None
    vat_rate: Optional[Decimal] = Field(default=None, ge=0, le=100, decimal_places=2)
    lines: Optional[list[SOLineCreate]] = None


class SOApproveRequest(BaseModel):
    action: str = Field(pattern=r"^(approve|reject)$")
    reason: Optional[str] = None


class SalesOrderResponse(BaseModel):
    id: UUID
    so_number: str
    customer_id: UUID
    customer_name: Optional[str] = None
    customer_code: Optional[str] = None
    status: SOStatus
    order_date: date
    subtotal_amount: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    note: Optional[str] = None
    created_by: UUID
    creator_name: Optional[str] = None
    approved_by: Optional[UUID] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None
    requested_approver_id: Optional[UUID] = None
    is_active: bool
    lines: list[SOLineResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def extract_customer(cls, data):
        """Extract customer_name/code from customer relationship."""
        if hasattr(data, "customer") and data.customer is not None:
            # SQLAlchemy ORM object — copy to a mutable dict
            obj = {}
            for col in data.__table__.columns:
                obj[col.key] = getattr(data, col.key, None)
            # Add relationship fields
            obj["customer_name"] = data.customer.name
            obj["customer_code"] = data.customer.code
            # Add lines relationship
            obj["lines"] = data.lines if hasattr(data, "lines") else []
            return obj
        return data


class SalesOrderListResponse(BaseModel):
    items: list[SalesOrderResponse]
    total: int
    limit: int
    offset: int
