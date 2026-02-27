"""
SSS Corp ERP — Daily Work Report Schemas (Pydantic v2)
Phase 5: DailyWorkReport + DailyWorkReportLine
"""

from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================
# ENUMS
# ============================================================

class ReportStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class LineType(str, Enum):
    REGULAR = "REGULAR"
    OT = "OT"


# ============================================================
# CREATE / UPDATE
# ============================================================

class DailyReportLineCreate(BaseModel):
    line_type: LineType
    start_time: time
    end_time: time
    work_order_id: Optional[UUID] = None
    ot_type_id: Optional[UUID] = None
    note: Optional[str] = None


class DailyReportCreate(BaseModel):
    report_date: date
    lines: list[DailyReportLineCreate]
    note: Optional[str] = None

    @field_validator("lines")
    @classmethod
    def validate_lines(cls, v):
        if not v:
            raise ValueError("ต้องมีอย่างน้อย 1 บรรทัด")
        return v


class DailyReportUpdate(BaseModel):
    lines: Optional[list[DailyReportLineCreate]] = None
    note: Optional[str] = None


# ============================================================
# RESPONSE
# ============================================================

class DailyReportLineResponse(BaseModel):
    id: UUID
    line_type: LineType
    start_time: time
    end_time: time
    work_order_id: Optional[UUID] = None
    wo_number: Optional[str] = None
    ot_type_id: Optional[UUID] = None
    ot_type_name: Optional[str] = None
    hours: Decimal
    note: Optional[str] = None

    class Config:
        from_attributes = True


class DailyReportResponse(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    report_date: date
    status: ReportStatus
    total_regular_hours: Decimal
    total_ot_hours: Decimal
    note: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    lines: list[DailyReportLineResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DailyReportListResponse(BaseModel):
    items: list[DailyReportResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# APPROVE / REJECT
# ============================================================

class BatchApproveRequest(BaseModel):
    report_ids: list[UUID]

    @field_validator("report_ids")
    @classmethod
    def validate_ids(cls, v):
        if not v:
            raise ValueError("ต้องระบุอย่างน้อย 1 report")
        return v


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
