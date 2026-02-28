"""
SSS Corp ERP — HR Schemas (Pydantic v2)
Employee, Timesheet, Leave, PayrollRun
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================
# ENUMS
# ============================================================

class TimesheetStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    FINAL = "FINAL"
    REJECTED = "REJECTED"


class LeaveStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class PayrollStatus(str, Enum):
    DRAFT = "DRAFT"
    EXECUTED = "EXECUTED"
    EXPORTED = "EXPORTED"


class PayType(str, Enum):
    DAILY = "DAILY"
    MONTHLY = "MONTHLY"


class DayStatus(str, Enum):
    WORK = "WORK"
    LEAVE_PAID = "LEAVE_PAID"
    LEAVE_UNPAID = "LEAVE_UNPAID"
    ABSENT = "ABSENT"
    HOLIDAY = "HOLIDAY"


# ============================================================
# EMPLOYEE SCHEMAS
# ============================================================

class EmployeeCreate(BaseModel):
    employee_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=255)
    position: Optional[str] = Field(default=None, max_length=100)
    hourly_rate: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    daily_working_hours: Decimal = Field(default=Decimal("8.00"), gt=0, le=24, decimal_places=2)
    cost_center_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    supervisor_id: Optional[UUID] = None
    pay_type: PayType = PayType.DAILY
    daily_rate: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    monthly_salary: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    hire_date: Optional[date] = None  # Phase 5: nullable for migration, frontend enforces

    @field_validator("employee_code")
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    position: Optional[str] = Field(default=None, max_length=100)
    hourly_rate: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    daily_working_hours: Optional[Decimal] = Field(default=None, gt=0, le=24, decimal_places=2)
    cost_center_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    supervisor_id: Optional[UUID] = None
    pay_type: Optional[PayType] = None
    daily_rate: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    monthly_salary: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    is_active: Optional[bool] = None
    hire_date: Optional[date] = None


class EmployeeResponse(BaseModel):
    id: UUID
    employee_code: str
    full_name: str
    position: Optional[str] = None
    hourly_rate: Decimal
    daily_working_hours: Decimal
    cost_center_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    supervisor_id: Optional[UUID] = None
    pay_type: PayType
    daily_rate: Optional[Decimal] = None
    monthly_salary: Optional[Decimal] = None
    is_active: bool
    hire_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmployeeListResponse(BaseModel):
    items: list[EmployeeResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# TIMESHEET SCHEMAS
# ============================================================

class TimesheetCreate(BaseModel):
    employee_id: UUID
    work_order_id: UUID
    work_date: date
    regular_hours: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    ot_hours: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    ot_type_id: Optional[UUID] = None
    note: Optional[str] = None
    requested_approver_id: Optional[UUID] = None

    @field_validator("ot_type_id")
    @classmethod
    def ot_type_required_if_ot_hours(cls, v, info):
        ot_hours = info.data.get("ot_hours", Decimal("0"))
        if ot_hours and ot_hours > 0 and v is None:
            raise ValueError("ot_type_id is required when ot_hours > 0")
        return v


class TimesheetUpdate(BaseModel):
    regular_hours: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    ot_hours: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    ot_type_id: Optional[UUID] = None
    note: Optional[str] = None


class TimesheetResponse(BaseModel):
    id: UUID
    employee_id: UUID
    work_order_id: UUID
    work_date: date
    regular_hours: Decimal
    ot_hours: Decimal
    ot_type_id: Optional[UUID] = None
    status: TimesheetStatus
    note: Optional[str] = None
    created_by: UUID
    approved_by: Optional[UUID] = None
    final_approved_by: Optional[UUID] = None
    requested_approver_id: Optional[UUID] = None
    is_locked: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TimesheetListResponse(BaseModel):
    items: list[TimesheetResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# TIMESHEET BATCH SCHEMAS  (Phase 4.4)
# ============================================================

class TimesheetBatchEntry(BaseModel):
    work_order_id: UUID
    regular_hours: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    ot_hours: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    ot_type_id: Optional[UUID] = None
    note: Optional[str] = None


class TimesheetBatchCreate(BaseModel):
    employee_id: UUID
    work_date: date
    entries: list[TimesheetBatchEntry] = Field(min_length=1)
    requested_approver_id: Optional[UUID] = None


# ============================================================
# STANDARD TIMESHEET SCHEMAS  (Phase 4.4)
# ============================================================

class StandardTimesheetResponse(BaseModel):
    id: UUID
    employee_id: UUID
    work_date: date
    scheduled_hours: Decimal
    actual_status: DayStatus
    leave_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StandardTimesheetListResponse(BaseModel):
    items: list[StandardTimesheetResponse]
    total: int


class StandardTimesheetGenerate(BaseModel):
    employee_id: Optional[UUID] = None  # None = all active employees
    period_start: date
    period_end: date

    @field_validator("period_end")
    @classmethod
    def end_gte_start(cls, v, info):
        start = info.data.get("period_start")
        if start and v < start:
            raise ValueError("period_end must be >= period_start")
        return v


# ============================================================
# LEAVE SCHEMAS
# ============================================================

class LeaveCreate(BaseModel):
    employee_id: UUID
    leave_type: Optional[str] = None
    leave_type_id: Optional[UUID] = None
    start_date: date
    end_date: date
    reason: Optional[str] = None
    requested_approver_id: Optional[UUID] = None

    @field_validator("end_date")
    @classmethod
    def end_gte_start(cls, v, info):
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("end_date must be >= start_date")
        return v


class LeaveResponse(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None   # Phase 5: joined from Employee
    leave_type: str
    leave_type_id: Optional[UUID] = None
    leave_type_name: Optional[str] = None  # Phase 5: joined from LeaveType
    leave_type_code: Optional[str] = None  # Phase 5: for color coding
    start_date: date
    end_date: date
    days_count: int = 1
    reason: Optional[str] = None
    status: LeaveStatus
    created_by: UUID
    approved_by: Optional[UUID] = None
    requested_approver_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeaveListResponse(BaseModel):
    items: list[LeaveResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# LEAVE BALANCE SCHEMAS  (Phase 4.3)
# ============================================================

class LeaveBalanceResponse(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None    # Phase 5: joined
    leave_type_id: UUID
    leave_type_name: Optional[str] = None  # Phase 5: joined
    leave_type_code: Optional[str] = None  # Phase 5: joined
    year: int
    quota: int
    used: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeaveBalanceListResponse(BaseModel):
    items: list[LeaveBalanceResponse]
    total: int


class LeaveBalanceUpdate(BaseModel):
    quota: Optional[int] = Field(default=None, ge=0)


# ============================================================
# PAYROLL SCHEMAS
# ============================================================

class PayrollRunCreate(BaseModel):
    period_start: date
    period_end: date
    note: Optional[str] = None

    @field_validator("period_end")
    @classmethod
    def end_gte_start(cls, v, info):
        start = info.data.get("period_start")
        if start and v < start:
            raise ValueError("period_end must be >= period_start")
        return v


class PayrollRunResponse(BaseModel):
    id: UUID
    period_start: date
    period_end: date
    status: PayrollStatus
    total_amount: Decimal
    employee_count: int
    executed_by: Optional[UUID] = None
    executed_at: Optional[datetime] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PayrollRunListResponse(BaseModel):
    items: list[PayrollRunResponse]
    total: int
    limit: int
    offset: int
