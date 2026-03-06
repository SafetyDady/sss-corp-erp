"""
SSS Corp ERP — Tool Checkout Slip Schemas (Pydantic v2)
Multi-line tool checkout document: header + lines
Flow: DRAFT → PENDING → CHECKED_OUT → PARTIAL_RETURN/RETURNED (+CANCELLED)
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ============================================================
# CREATE / UPDATE SCHEMAS
# ============================================================

class ToolCheckoutSlipLineCreate(BaseModel):
    tool_id: UUID
    employee_id: UUID
    note: Optional[str] = None


class ToolCheckoutSlipCreate(BaseModel):
    work_order_id: UUID
    requested_by: Optional[UUID] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    lines: list[ToolCheckoutSlipLineCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_no_duplicate_tools(self):
        tool_ids = [line.tool_id for line in self.lines]
        if len(tool_ids) != len(set(tool_ids)):
            raise ValueError("Duplicate tool_id found in lines — each tool can only appear once per slip")
        return self


class ToolCheckoutSlipUpdate(BaseModel):
    work_order_id: Optional[UUID] = None
    requested_by: Optional[UUID] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    lines: Optional[list[ToolCheckoutSlipLineCreate]] = None

    @model_validator(mode="after")
    def validate_no_duplicate_tools(self):
        if self.lines:
            tool_ids = [line.tool_id for line in self.lines]
            if len(tool_ids) != len(set(tool_ids)):
                raise ValueError("Duplicate tool_id found in lines — each tool can only appear once per slip")
        return self


# ============================================================
# ISSUE / RETURN SCHEMAS
# ============================================================

class ToolCheckoutSlipIssueLineInput(BaseModel):
    line_id: UUID


class ToolCheckoutSlipIssueRequest(BaseModel):
    lines: list[ToolCheckoutSlipIssueLineInput] = Field(min_length=1)
    note: Optional[str] = None


class ToolCheckoutSlipReturnLineInput(BaseModel):
    line_id: UUID


class ToolCheckoutSlipReturnRequest(BaseModel):
    lines: list[ToolCheckoutSlipReturnLineInput] = Field(min_length=1)
    note: Optional[str] = None


# ============================================================
# RESPONSE SCHEMAS
# ============================================================

class ToolCheckoutSlipLineResponse(BaseModel):
    id: UUID
    slip_id: UUID
    line_number: int
    tool_id: UUID
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
    rate_per_hour: Optional[Decimal] = None
    employee_id: UUID
    employee_name: Optional[str] = None
    checkout_id: Optional[UUID] = None
    is_returned: bool
    returned_at: Optional[datetime] = None
    returned_by: Optional[UUID] = None
    returned_by_name: Optional[str] = None
    charge_amount: Decimal
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ToolCheckoutSlipResponse(BaseModel):
    id: UUID
    slip_number: str
    status: str
    work_order_id: UUID
    work_order_number: Optional[str] = None
    requested_by: Optional[UUID] = None
    requester_name: Optional[str] = None
    issued_by: Optional[UUID] = None
    issuer_name: Optional[str] = None
    issued_at: Optional[datetime] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    created_by: UUID
    is_active: bool
    lines: list[ToolCheckoutSlipLineResponse] = []
    line_count: int = 0
    returned_count: int = 0
    total_charge: Decimal = Decimal("0.00")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ToolCheckoutSlipListResponse(BaseModel):
    items: list[ToolCheckoutSlipResponse]
    total: int
    limit: int
    offset: int
