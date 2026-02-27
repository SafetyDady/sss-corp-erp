"""
SSS Corp ERP — Planning Schemas (Pydantic v2)
Phase 4.5: WO Master Plan, Daily Plan, Material & Tool Reservation

Models covered:
  WOMasterPlan, WOMasterPlanLine, DailyPlan, DailyPlanWorker,
  DailyPlanTool, DailyPlanMaterial, MaterialReservation, ToolReservation
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================
# ENUMS (mirrors models/planning.py)
# ============================================================

class PlanLineType(str, Enum):
    MANPOWER = "MANPOWER"
    MATERIAL = "MATERIAL"
    TOOL = "TOOL"


class ReservationStatus(str, Enum):
    RESERVED = "RESERVED"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"


class ToolReservationStatus(str, Enum):
    RESERVED = "RESERVED"
    CHECKED_OUT = "CHECKED_OUT"
    RETURNED = "RETURNED"
    CANCELLED = "CANCELLED"


# ============================================================
# MASTER PLAN LINE
# ============================================================

class MasterPlanLineCreate(BaseModel):
    line_type: PlanLineType
    # MANPOWER fields
    employee_count: Optional[int] = None
    skill_description: Optional[str] = Field(default=None, max_length=255)
    estimated_hours: Optional[Decimal] = Field(default=None, ge=0)
    # MATERIAL fields
    product_id: Optional[UUID] = None
    quantity: Optional[int] = Field(default=None, ge=1)
    # TOOL fields
    tool_id: Optional[UUID] = None
    estimated_days: Optional[int] = Field(default=None, ge=1)


class MasterPlanLineResponse(BaseModel):
    id: UUID
    plan_id: UUID
    line_type: PlanLineType
    employee_count: Optional[int] = None
    skill_description: Optional[str] = None
    estimated_hours: Optional[Decimal] = None
    product_id: Optional[UUID] = None
    quantity: Optional[int] = None
    tool_id: Optional[UUID] = None
    estimated_days: Optional[int] = None

    class Config:
        from_attributes = True


# ============================================================
# MASTER PLAN
# ============================================================

class MasterPlanCreate(BaseModel):
    planned_start: date
    planned_end: date
    total_manhours: Decimal = Field(default=Decimal("0.00"), ge=0)
    note: Optional[str] = None
    lines: list[MasterPlanLineCreate] = []

    @field_validator("planned_end")
    @classmethod
    def end_gte_start(cls, v, info):
        start = info.data.get("planned_start")
        if start and v < start:
            raise ValueError("planned_end must be >= planned_start")
        return v


class MasterPlanUpdate(BaseModel):
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None
    total_manhours: Optional[Decimal] = Field(default=None, ge=0)
    note: Optional[str] = None
    lines: Optional[list[MasterPlanLineCreate]] = None


class MasterPlanResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    planned_start: date
    planned_end: date
    total_manhours: Decimal
    note: Optional[str] = None
    lines: list[MasterPlanLineResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# DAILY PLAN — WORKERS / TOOLS / MATERIALS
# ============================================================

class DailyPlanWorkerCreate(BaseModel):
    employee_id: UUID
    planned_hours: Decimal = Field(default=Decimal("8.00"), gt=0)


class DailyPlanToolCreate(BaseModel):
    tool_id: UUID


class DailyPlanMaterialCreate(BaseModel):
    product_id: UUID
    planned_qty: int = Field(ge=1)


# ============================================================
# DAILY PLAN
# ============================================================

class DailyPlanCreate(BaseModel):
    plan_date: date
    work_order_id: UUID
    note: Optional[str] = None
    workers: list[DailyPlanWorkerCreate] = []
    tools: list[DailyPlanToolCreate] = []
    materials: list[DailyPlanMaterialCreate] = []


class DailyPlanUpdate(BaseModel):
    note: Optional[str] = None
    workers: Optional[list[DailyPlanWorkerCreate]] = None
    tools: Optional[list[DailyPlanToolCreate]] = None
    materials: Optional[list[DailyPlanMaterialCreate]] = None


class DailyPlanWorkerResponse(BaseModel):
    id: UUID
    employee_id: UUID
    planned_hours: Decimal

    class Config:
        from_attributes = True


class DailyPlanToolResponse(BaseModel):
    id: UUID
    tool_id: UUID

    class Config:
        from_attributes = True


class DailyPlanMaterialResponse(BaseModel):
    id: UUID
    product_id: UUID
    planned_qty: int

    class Config:
        from_attributes = True


class DailyPlanResponse(BaseModel):
    id: UUID
    plan_date: date
    work_order_id: UUID
    created_by: UUID
    note: Optional[str] = None
    workers: list[DailyPlanWorkerResponse] = []
    tools: list[DailyPlanToolResponse] = []
    materials: list[DailyPlanMaterialResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DailyPlanListResponse(BaseModel):
    items: list[DailyPlanResponse]
    total: int


# ============================================================
# MATERIAL RESERVATION
# ============================================================

class MaterialReservationCreate(BaseModel):
    work_order_id: UUID
    product_id: UUID
    quantity: int = Field(ge=1)
    reserved_date: date


class MaterialReservationResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    product_id: UUID
    quantity: int
    reserved_date: date
    reserved_by: UUID
    status: ReservationStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MaterialReservationListResponse(BaseModel):
    items: list[MaterialReservationResponse]
    total: int


# ============================================================
# TOOL RESERVATION
# ============================================================

class ToolReservationCreate(BaseModel):
    work_order_id: UUID
    tool_id: UUID
    start_date: date
    end_date: date

    @field_validator("end_date")
    @classmethod
    def end_gte_start(cls, v, info):
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("end_date must be >= start_date")
        return v


class ToolReservationResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    tool_id: UUID
    start_date: date
    end_date: date
    reserved_by: UUID
    status: ToolReservationStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ToolReservationListResponse(BaseModel):
    items: list[ToolReservationResponse]
    total: int
