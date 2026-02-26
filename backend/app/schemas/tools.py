"""
SSS Corp ERP — Tools Schemas (Pydantic v2)
Tool CRUD + ToolCheckout
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================
# ENUMS
# ============================================================

class ToolStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    CHECKED_OUT = "CHECKED_OUT"
    MAINTENANCE = "MAINTENANCE"
    RETIRED = "RETIRED"


# ============================================================
# TOOL SCHEMAS
# ============================================================

class ToolCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    rate_per_hour: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()


class ToolUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    rate_per_hour: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    is_active: Optional[bool] = None


class ToolResponse(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    rate_per_hour: Decimal
    status: ToolStatus
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ToolListResponse(BaseModel):
    items: list[ToolResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# TOOL CHECKOUT SCHEMAS
# ============================================================

class ToolCheckoutRequest(BaseModel):
    employee_id: UUID
    work_order_id: UUID


class ToolCheckinRequest(BaseModel):
    pass  # No extra fields needed — tool_id from URL


class ToolCheckoutResponse(BaseModel):
    id: UUID
    tool_id: UUID
    employee_id: UUID
    work_order_id: UUID
    checkout_at: datetime
    checkin_at: Optional[datetime] = None
    charge_amount: Decimal
    checked_out_by: UUID
    checked_in_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ToolCheckoutListResponse(BaseModel):
    items: list[ToolCheckoutResponse]
    total: int
    limit: int
    offset: int
