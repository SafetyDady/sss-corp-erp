"""
SSS Corp ERP — Organization Schemas (Pydantic v2)
Phase 4.1: Organization, Department, OrgWorkConfig, OrgApprovalConfig
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================
# ORGANIZATION SCHEMAS
# ============================================================

class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    tax_id: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: UUID
    code: str
    name: str
    tax_id: Optional[str] = None
    address: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# DEPARTMENT SCHEMAS
# ============================================================

class DepartmentCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50, description="Unique code per org")
    name: str = Field(min_length=1, max_length=255)
    cost_center_id: UUID
    head_id: Optional[UUID] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    cost_center_id: Optional[UUID] = None
    head_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: UUID
    code: str
    name: str
    cost_center_id: UUID
    head_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DepartmentListResponse(BaseModel):
    items: list[DepartmentResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# ORG WORK CONFIG SCHEMAS
# ============================================================

class OrgWorkConfigUpdate(BaseModel):
    working_days: Optional[list[int]] = Field(
        default=None,
        description="ISO weekday numbers [1=Mon..7=Sun]"
    )
    hours_per_day: Optional[Decimal] = Field(
        default=None, gt=0, le=24, decimal_places=2
    )

    @field_validator("working_days")
    @classmethod
    def validate_working_days(cls, v):
        if v is not None:
            if not v:
                raise ValueError("working_days must not be empty")
            for day in v:
                if day < 1 or day > 7:
                    raise ValueError("working_days values must be 1-7 (Mon-Sun)")
            if len(set(v)) != len(v):
                raise ValueError("working_days must not contain duplicates")
        return v


class OrgWorkConfigResponse(BaseModel):
    id: UUID
    org_id: UUID
    working_days: list[int]
    hours_per_day: Decimal
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# ORG APPROVAL CONFIG SCHEMAS
# ============================================================

VALID_APPROVAL_MODULES = [
    "purchasing.po",
    "sales.order",
    "hr.timesheet",
    "hr.leave",
    "workorder.order",
]


class OrgApprovalConfigItem(BaseModel):
    module_key: str
    require_approval: bool = True

    @field_validator("module_key")
    @classmethod
    def validate_module_key(cls, v):
        if v not in VALID_APPROVAL_MODULES:
            raise ValueError(f"module_key must be one of: {VALID_APPROVAL_MODULES}")
        return v


class OrgApprovalConfigUpdate(BaseModel):
    configs: list[OrgApprovalConfigItem]


class OrgApprovalConfigResponse(BaseModel):
    id: UUID
    org_id: UUID
    module_key: str
    require_approval: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrgApprovalConfigListResponse(BaseModel):
    items: list[OrgApprovalConfigResponse]


# ============================================================
# DEPT MENU CONFIG SCHEMAS  (Go-Live G6)
# ============================================================

VALID_MENU_KEYS = [
    "dashboard", "supply-chain", "work-orders", "purchasing",
    "sales", "hr", "customers", "planning", "master", "finance", "admin",
]


class DeptMenuConfigItem(BaseModel):
    menu_key: str
    is_visible: bool = True

    @field_validator("menu_key")
    @classmethod
    def validate_menu_key(cls, v):
        if v not in VALID_MENU_KEYS:
            raise ValueError(f"menu_key must be one of: {VALID_MENU_KEYS}")
        return v


class DeptMenuConfigUpdate(BaseModel):
    department_id: Optional[UUID] = None  # None = org-wide default
    items: list[DeptMenuConfigItem]


class DeptMenuConfigResponse(BaseModel):
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    items: list[DeptMenuConfigItem]


# ============================================================
# ORG TAX CONFIG SCHEMAS  (C5 Tax Calculation)
# ============================================================

class OrgTaxConfigUpdate(BaseModel):
    vat_enabled: Optional[bool] = None
    default_vat_rate: Optional[Decimal] = Field(
        default=None, ge=0, le=100, decimal_places=2,
        description="Default VAT rate % for new PO/SO (e.g. 7.00)"
    )
    wht_enabled: Optional[bool] = None


class OrgTaxConfigResponse(BaseModel):
    id: UUID
    org_id: UUID
    vat_enabled: bool
    default_vat_rate: Decimal
    wht_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
