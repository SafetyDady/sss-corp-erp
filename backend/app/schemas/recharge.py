"""
SSS Corp ERP — Internal Recharge Schemas (Pydantic v2)
Phase C9: Fixed Recharge — Budget + Generate + Report
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# BUDGET — Create / Update / Response
# ============================================================

class FixedRechargeBudgetCreate(BaseModel):
    fiscal_year: int = Field(ge=2020, le=2100)
    source_cost_center_id: UUID
    annual_budget: Decimal = Field(ge=0)
    description: Optional[str] = None


class FixedRechargeBudgetUpdate(BaseModel):
    annual_budget: Optional[Decimal] = Field(default=None, ge=0)
    description: Optional[str] = None


class FixedRechargeBudgetResponse(BaseModel):
    id: UUID
    fiscal_year: int
    source_cost_center_id: UUID
    source_cost_center_name: Optional[str] = None
    source_cost_center_code: Optional[str] = None
    annual_budget: Decimal
    monthly_budget: Optional[Decimal] = None
    description: Optional[str] = None
    status: str
    created_by: UUID
    creator_name: Optional[str] = None
    is_active: bool
    org_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FixedRechargeBudgetListResponse(BaseModel):
    items: list[FixedRechargeBudgetResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# GENERATE REQUEST
# ============================================================

class RechargeGenerateRequest(BaseModel):
    budget_id: UUID
    year: int = Field(ge=2020, le=2100)
    month: int = Field(ge=1, le=12)


# ============================================================
# ENTRY RESPONSE
# ============================================================

class FixedRechargeEntryResponse(BaseModel):
    id: UUID
    budget_id: UUID
    period_year: int
    period_month: int
    source_cost_center_id: UUID
    source_cost_center_name: Optional[str] = None
    target_department_id: UUID
    target_department_name: Optional[str] = None
    target_cost_center_id: UUID
    target_cost_center_name: Optional[str] = None
    target_cost_center_code: Optional[str] = None
    headcount: int
    total_headcount: int
    allocation_pct: Decimal
    amount: Decimal
    note: Optional[str] = None
    generated_by: UUID
    org_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class FixedRechargeEntryListResponse(BaseModel):
    items: list[FixedRechargeEntryResponse]
    total: int
    limit: int
    offset: int
    monthly_budget: Optional[Decimal] = None


# ============================================================
# COST CENTER SUMMARY (Actual + Fixed)
# ============================================================

class CostCenterSummaryRow(BaseModel):
    cost_center_id: UUID
    cost_center_code: str
    cost_center_name: str
    actual_labor: Decimal = Decimal("0.00")
    actual_material: Decimal = Decimal("0.00")
    actual_tool: Decimal = Decimal("0.00")
    actual_overhead: Decimal = Decimal("0.00")
    actual_total: Decimal = Decimal("0.00")
    fixed_recharge: Decimal = Decimal("0.00")
    grand_total: Decimal = Decimal("0.00")


class CostCenterSummaryResponse(BaseModel):
    items: list[CostCenterSummaryRow]
    period_year: Optional[int] = None
    period_month: Optional[int] = None
