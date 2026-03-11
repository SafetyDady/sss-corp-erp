"""
SSS Corp ERP — Stock Take Pydantic Schemas
Phase 11.14
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# --- CREATE / UPDATE ---

class StockTakeCreate(BaseModel):
    warehouse_id: UUID
    location_id: Optional[UUID] = None
    counted_by: Optional[UUID] = None
    note: Optional[str] = None
    reference: Optional[str] = None


class StockTakeLineUpdate(BaseModel):
    line_id: UUID
    counted_qty: int = Field(ge=0)
    note: Optional[str] = None


class StockTakeUpdate(BaseModel):
    counted_by: Optional[UUID] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    lines: Optional[list[StockTakeLineUpdate]] = None


class StockTakeApproveRequest(BaseModel):
    action: str
    reason: Optional[str] = None

    @model_validator(mode="after")
    def validate_action(self):
        if self.action not in ("approve", "reject"):
            raise ValueError("action must be 'approve' or 'reject'")
        return self


# --- RESPONSE ---

class StockTakeLineResponse(BaseModel):
    id: UUID
    stocktake_id: UUID
    line_number: int
    product_id: UUID
    product_sku: Optional[str] = None
    product_name: Optional[str] = None
    product_unit: Optional[str] = None
    location_id: Optional[UUID] = None
    location_name: Optional[str] = None
    warehouse_name: Optional[str] = None
    system_qty: int
    counted_qty: Optional[int] = None
    variance: Optional[int] = None
    unit_cost: Decimal
    variance_value: Optional[Decimal] = None
    movement_id: Optional[UUID] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StockTakeResponse(BaseModel):
    id: UUID
    stocktake_number: str
    status: str
    warehouse_id: UUID
    warehouse_name: Optional[str] = None
    location_id: Optional[UUID] = None
    location_name: Optional[str] = None
    counted_by: Optional[UUID] = None
    counter_name: Optional[str] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    approved_by: Optional[UUID] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_reason: Optional[str] = None
    posted_at: Optional[datetime] = None
    created_by: UUID
    is_active: bool
    lines: list[StockTakeLineResponse] = []
    line_count: int = 0
    total_variance_value: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StockTakeListResponse(BaseModel):
    items: list[StockTakeResponse]
    total: int
    limit: int
    offset: int


class StockTakeProductResponse(BaseModel):
    product_id: UUID
    sku: str
    name: str
    unit: str
    product_type: str
    on_hand: int
    cost: Decimal
    location_id: Optional[UUID] = None
    location_name: Optional[str] = None
    location_on_hand: Optional[int] = None
