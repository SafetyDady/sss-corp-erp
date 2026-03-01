"""
SSS Corp ERP — Master Data Schemas (Pydantic v2)
CostCenter, CostElement, OTType, LeaveType, ShiftType, WorkSchedule, Supplier

Business Rules:
  BR#24 — Special OT Factor ≤ Maximum Ceiling
  BR#29 — Admin adjusts Factor + Max Ceiling in Master Data
  BR#30 — Overhead Rate per Cost Center (not one rate for all)
"""

from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
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


# ============================================================
# LEAVE TYPE SCHEMAS  (Phase 4.3)
# ============================================================

class LeaveTypeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    is_paid: bool = True
    default_quota: Optional[int] = Field(default=None, ge=0)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()


class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    is_paid: Optional[bool] = None
    default_quota: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class LeaveTypeResponse(BaseModel):
    id: UUID
    code: str
    name: str
    is_paid: bool
    default_quota: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeaveTypeListResponse(BaseModel):
    items: list[LeaveTypeResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# SCHEDULE TYPE ENUM  (Phase 4.9)
# ============================================================

class ScheduleTypeEnum(str, Enum):
    FIXED = "FIXED"
    ROTATING = "ROTATING"


# ============================================================
# SHIFT TYPE SCHEMAS  (Phase 4.9 — Shift Management)
# ============================================================

class ShiftTypeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50, description="Unique code per org")
    name: str = Field(min_length=1, max_length=255)
    start_time: time
    end_time: time
    break_minutes: int = Field(default=60, ge=0, description="Break duration in minutes")
    working_hours: Decimal = Field(
        default=Decimal("8.00"), gt=0, le=24, decimal_places=2,
        description="Net working hours per shift"
    )
    is_overnight: bool = False
    description: Optional[str] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()


class ShiftTypeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    break_minutes: Optional[int] = Field(default=None, ge=0)
    working_hours: Optional[Decimal] = Field(default=None, gt=0, le=24, decimal_places=2)
    is_overnight: Optional[bool] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ShiftTypeResponse(BaseModel):
    id: UUID
    code: str
    name: str
    start_time: time
    end_time: time
    break_minutes: int
    working_hours: Decimal
    is_overnight: bool
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShiftTypeListResponse(BaseModel):
    items: list[ShiftTypeResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# WORK SCHEDULE SCHEMAS  (Phase 4.9 — Shift Management)
# ============================================================

class WorkScheduleCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50, description="Unique code per org")
    name: str = Field(min_length=1, max_length=255)
    schedule_type: ScheduleTypeEnum = ScheduleTypeEnum.FIXED
    working_days: Optional[list[int]] = None  # FIXED: [1,2,3,4,5] = Mon-Fri
    default_shift_type_id: Optional[UUID] = None
    rotation_pattern: Optional[list[str]] = None  # ROTATING: ["MORNING","OFF",...]
    cycle_start_date: Optional[date] = None
    description: Optional[str] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()

    @field_validator("working_days")
    @classmethod
    def validate_working_days(cls, v, info):
        if v is not None:
            for day in v:
                if day < 1 or day > 7:
                    raise ValueError("working_days values must be 1-7 (Mon=1, Sun=7)")
        return v

    @field_validator("rotation_pattern")
    @classmethod
    def validate_rotation_pattern(cls, v, info):
        if v is not None and len(v) == 0:
            raise ValueError("rotation_pattern must not be empty")
        return v


class WorkScheduleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    schedule_type: Optional[ScheduleTypeEnum] = None
    working_days: Optional[list[int]] = None
    default_shift_type_id: Optional[UUID] = None
    rotation_pattern: Optional[list[str]] = None
    cycle_start_date: Optional[date] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class WorkScheduleResponse(BaseModel):
    id: UUID
    code: str
    name: str
    schedule_type: ScheduleTypeEnum
    working_days: Optional[list[int]] = None
    default_shift_type_id: Optional[UUID] = None
    rotation_pattern: Optional[list[str]] = None
    cycle_start_date: Optional[date] = None
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkScheduleListResponse(BaseModel):
    items: list[WorkScheduleResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# SUPPLIER SCHEMAS  (Phase 11 — Supplier Master Data)
# ============================================================

class SupplierCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50, description="Unique code per org")
    name: str = Field(min_length=1, max_length=255)
    contact_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = None
    tax_id: Optional[str] = Field(default=None, max_length=20)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    contact_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = None
    tax_id: Optional[str] = Field(default=None, max_length=20)
    is_active: Optional[bool] = None


class SupplierResponse(BaseModel):
    id: UUID
    code: str
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplierListResponse(BaseModel):
    items: list[SupplierResponse]
    total: int
    limit: int
    offset: int
