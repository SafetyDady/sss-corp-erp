"""
SSS Corp ERP — Master Data Schemas (Pydantic v2)
CostCenter, CostElement, OTType

Business Rules:
  BR#24 — Special OT Factor ≤ Maximum Ceiling
  BR#29 — Admin adjusts Factor + Max Ceiling in Master Data
  BR#30 — Overhead Rate per Cost Center (not one rate for all)
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================
# COST CENTER SCHEMAS
# ============================================================

class CostCenterCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50, description="Unique code per org")
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    overhead_rate: Decimal = Field(
        default=Decimal("0.00"), ge=0, le=100, decimal_places=2,
        description="Overhead rate % (BR#30)"
    )

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()


class CostCenterUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    overhead_rate: Optional[Decimal] = Field(
        default=None, ge=0, le=100, decimal_places=2
    )
    is_active: Optional[bool] = None


class CostCenterResponse(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    overhead_rate: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CostCenterListResponse(BaseModel):
    items: list[CostCenterResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# COST ELEMENT SCHEMAS
# ============================================================

class CostElementCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50, description="Unique code per org")
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()


class CostElementUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CostElementResponse(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CostElementListResponse(BaseModel):
    items: list[CostElementResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# OT TYPE SCHEMAS  (BR#24, BR#25, BR#29)
# ============================================================

class OTTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    factor: Decimal = Field(
        default=Decimal("1.50"), gt=0, decimal_places=2,
        description="OT multiplier factor"
    )
    max_ceiling: Decimal = Field(
        default=Decimal("3.00"), gt=0, decimal_places=2,
        description="Maximum ceiling for factor (BR#24)"
    )
    description: Optional[str] = None

    @field_validator("max_ceiling")
    @classmethod
    def ceiling_gte_factor(cls, v, info):
        """BR#24: max_ceiling >= factor"""
        factor = info.data.get("factor")
        if factor is not None and v < factor:
            raise ValueError("max_ceiling must be >= factor (BR#24)")
        return v


class OTTypeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    factor: Optional[Decimal] = Field(default=None, gt=0, decimal_places=2)
    max_ceiling: Optional[Decimal] = Field(default=None, gt=0, decimal_places=2)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class OTTypeResponse(BaseModel):
    id: UUID
    name: str
    factor: Decimal
    max_ceiling: Decimal
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OTTypeListResponse(BaseModel):
    items: list[OTTypeResponse]
    total: int
    limit: int
    offset: int
