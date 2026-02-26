"""
SSS Corp ERP — Warehouse Schemas (Pydantic v2)
Warehouse + Location CRUD
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================
# WAREHOUSE SCHEMAS
# ============================================================

class WarehouseCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50, description="Unique warehouse code")
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()


class WarehouseUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str | None) -> str | None:
        if v is not None:
            return v.strip().upper()
        return v


class WarehouseResponse(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    address: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WarehouseListResponse(BaseModel):
    items: list[WarehouseResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# LOCATION SCHEMAS
# ============================================================

class LocationCreate(BaseModel):
    warehouse_id: UUID
    code: str = Field(min_length=1, max_length=50, description="Unique location code per warehouse")
    name: str = Field(min_length=1, max_length=255)
    zone_type: str = Field(default="GENERAL", max_length=50)
    description: Optional[str] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("zone_type")
    @classmethod
    def normalize_zone_type(cls, v: str) -> str:
        return v.strip().upper()


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    zone_type: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("zone_type")
    @classmethod
    def normalize_zone_type(cls, v: str | None) -> str | None:
        if v is not None:
            return v.strip().upper()
        return v


class LocationResponse(BaseModel):
    id: UUID
    warehouse_id: UUID
    code: str
    name: str
    zone_type: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LocationListResponse(BaseModel):
    items: list[LocationResponse]
    total: int
    limit: int
    offset: int
