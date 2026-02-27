"""
SSS Corp ERP — Work Order Schemas (Pydantic v2)
CRUD + status transitions + cost summary
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# WORK ORDER — CREATE / UPDATE
# ============================================================

class WorkOrderCreate(BaseModel):
    customer_name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    cost_center_code: Optional[str] = Field(default=None, max_length=50)
    requested_approver_id: Optional[UUID] = None


class WorkOrderUpdate(BaseModel):
    """Only allowed when status != CLOSED."""
    customer_name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    cost_center_code: Optional[str] = Field(default=None, max_length=50)


# ============================================================
# WORK ORDER — RESPONSE
# ============================================================

class WorkOrderResponse(BaseModel):
    id: UUID
    wo_number: str
    status: str
    customer_name: Optional[str] = None
    description: Optional[str] = None
    cost_center_code: Optional[str] = None
    opened_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_by: UUID
    requested_approver_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkOrderListResponse(BaseModel):
    items: list[WorkOrderResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# COST SUMMARY (read-only, calculated)
# ============================================================

class CostSummaryResponse(BaseModel):
    """WO Total Cost = Material + ManHour + Tools + Overhead."""
    wo_id: UUID
    wo_number: str
    material_cost: float = 0.0
    manhour_cost: float = 0.0
    tools_recharge: float = 0.0
    admin_overhead: float = 0.0
    total_cost: float = 0.0
