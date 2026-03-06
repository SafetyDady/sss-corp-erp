"""
SSS Corp ERP — Fixed Asset Schemas
Phase C13: Asset Register + Depreciation
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# ASSET CATEGORY
# ============================================================

class AssetCategoryCreate(BaseModel):
    code: str = Field(max_length=20)
    name: str = Field(max_length=100)
    useful_life_years: int = Field(gt=0)
    depreciation_rate: Decimal = Field(gt=0, le=100)


class AssetCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    useful_life_years: Optional[int] = Field(None, gt=0)
    depreciation_rate: Optional[Decimal] = Field(None, gt=0, le=100)


class AssetCategoryResponse(BaseModel):
    id: UUID
    code: str
    name: str
    useful_life_years: int
    depreciation_rate: Decimal
    depreciation_method: str
    is_active: bool

    model_config = {"from_attributes": True}


# ============================================================
# FIXED ASSET
# ============================================================

class AssetCreate(BaseModel):
    asset_code: Optional[str] = Field(None, max_length=50)  # auto-generate if blank
    asset_name: str = Field(max_length=255)
    description: Optional[str] = None
    category_id: UUID
    acquisition_date: date
    acquisition_cost: Decimal = Field(gt=0)
    salvage_value: Decimal = Field(ge=0, default=Decimal("0"))
    useful_life_years: Optional[int] = Field(None, gt=0)  # inherit from category if None
    cost_center_id: UUID
    location: Optional[str] = Field(None, max_length=255)
    responsible_employee_id: Optional[UUID] = None
    tool_id: Optional[UUID] = None
    po_id: Optional[UUID] = None


class AssetUpdate(BaseModel):
    asset_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    responsible_employee_id: Optional[UUID] = None
    cost_center_id: Optional[UUID] = None
    salvage_value: Optional[Decimal] = Field(None, ge=0)
    tool_id: Optional[UUID] = None


class AssetResponse(BaseModel):
    id: UUID
    asset_code: str
    asset_name: str
    description: Optional[str] = None
    category_id: UUID
    category_name: Optional[str] = None

    # Financial
    acquisition_date: date
    acquisition_cost: Decimal
    salvage_value: Decimal
    useful_life_years: int
    depreciation_method: str

    # Computed
    accumulated_depreciation: Decimal
    net_book_value: Decimal
    monthly_depreciation: Optional[Decimal] = None
    remaining_life_months: Optional[int] = None

    # Status
    status: str
    disposed_date: Optional[date] = None
    disposal_amount: Optional[Decimal] = None
    disposal_gain_loss: Optional[Decimal] = None

    # Location & Ownership
    cost_center_id: UUID
    cost_center_name: Optional[str] = None
    location: Optional[str] = None
    responsible_employee_id: Optional[UUID] = None
    responsible_employee_name: Optional[str] = None

    # Links
    tool_id: Optional[UUID] = None
    tool_code: Optional[str] = None
    po_id: Optional[UUID] = None
    po_number: Optional[str] = None

    # Audit
    created_by: UUID
    created_by_name: Optional[str] = None
    created_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}


class AssetDisposeRequest(BaseModel):
    disposed_date: date
    disposal_amount: Decimal = Field(ge=0)


# ============================================================
# DEPRECIATION
# ============================================================

class DepreciationGenerateRequest(BaseModel):
    year: int = Field(ge=2020, le=2100)
    month: int = Field(ge=1, le=12)


class DepreciationEntryResponse(BaseModel):
    id: UUID
    asset_id: UUID
    asset_code: Optional[str] = None
    asset_name: Optional[str] = None
    category_name: Optional[str] = None
    period_year: int
    period_month: int
    depreciation_amount: Decimal
    accumulated_depreciation: Decimal
    net_book_value: Decimal
    generated_by: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# SUMMARY
# ============================================================

class AssetSummaryResponse(BaseModel):
    total_assets: int
    total_active: int
    total_fully_depreciated: int
    total_disposed: int
    total_retired: int
    total_acquisition_cost: Decimal
    total_accumulated_depreciation: Decimal
    total_net_book_value: Decimal


class DepreciationSummaryResponse(BaseModel):
    period_year: int
    period_month: int
    total_assets_depreciated: int
    total_depreciation_amount: Decimal
    total_accumulated: Decimal
