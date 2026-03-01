"""
SSS Corp ERP — Stock Withdrawal Slip Schemas (Pydantic v2)
Multi-line stock withdrawal document: header + lines
Types: WO_CONSUME (Work Order) | CC_ISSUE (Cost Center)
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ============================================================
# CREATE / UPDATE SCHEMAS
# ============================================================

class WithdrawalSlipLineCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(gt=0)
    location_id: Optional[UUID] = None
    note: Optional[str] = None


class WithdrawalSlipCreate(BaseModel):
    withdrawal_type: str  # WO_CONSUME or CC_ISSUE
    work_order_id: Optional[UUID] = None
    cost_center_id: Optional[UUID] = None
    cost_element_id: Optional[UUID] = None
    requested_by: Optional[UUID] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    lines: list[WithdrawalSlipLineCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_type_fields(self):
        if self.withdrawal_type == "WO_CONSUME" and not self.work_order_id:
            raise ValueError("WO_CONSUME requires work_order_id")
        if self.withdrawal_type == "CC_ISSUE" and not self.cost_center_id:
            raise ValueError("CC_ISSUE requires cost_center_id")
        if self.withdrawal_type not in ("WO_CONSUME", "CC_ISSUE"):
            raise ValueError("withdrawal_type must be WO_CONSUME or CC_ISSUE")
        return self


class WithdrawalSlipUpdate(BaseModel):
    work_order_id: Optional[UUID] = None
    cost_center_id: Optional[UUID] = None
    cost_element_id: Optional[UUID] = None
    requested_by: Optional[UUID] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    lines: Optional[list[WithdrawalSlipLineCreate]] = None


# ============================================================
# ISSUE SCHEMAS
# ============================================================

class WithdrawalSlipIssueLineInput(BaseModel):
    line_id: UUID
    issued_qty: int = Field(ge=0)
    location_id: Optional[UUID] = None  # override source location at issue time


class WithdrawalSlipIssueRequest(BaseModel):
    lines: list[WithdrawalSlipIssueLineInput] = Field(min_length=1)
    note: Optional[str] = None


# ============================================================
# RESPONSE SCHEMAS
# ============================================================

class WithdrawalSlipLineResponse(BaseModel):
    id: UUID
    slip_id: UUID
    line_number: int
    product_id: UUID
    product_sku: Optional[str] = None
    product_name: Optional[str] = None
    product_unit: Optional[str] = None
    quantity: int
    issued_qty: int
    location_id: Optional[UUID] = None
    location_name: Optional[str] = None
    warehouse_name: Optional[str] = None
    movement_id: Optional[UUID] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WithdrawalSlipResponse(BaseModel):
    id: UUID
    slip_number: str
    withdrawal_type: str
    status: str
    work_order_id: Optional[UUID] = None
    work_order_number: Optional[str] = None
    cost_center_id: Optional[UUID] = None
    cost_center_name: Optional[str] = None
    cost_element_id: Optional[UUID] = None
    cost_element_name: Optional[str] = None
    requested_by: Optional[UUID] = None
    requester_name: Optional[str] = None
    issued_by: Optional[UUID] = None
    issuer_name: Optional[str] = None
    issued_at: Optional[datetime] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    created_by: UUID
    is_active: bool
    lines: list[WithdrawalSlipLineResponse] = []
    line_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WithdrawalSlipListResponse(BaseModel):
    items: list[WithdrawalSlipResponse]
    total: int
    limit: int
    offset: int
