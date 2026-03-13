from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# --- Auth ---

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# --- User ---

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: str = Field(default="staff", pattern=r"^(owner|manager|supervisor|staff|viewer)$")


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserMe(UserResponse):
    permissions: list[str]
    employee_id: Optional[UUID] = None
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    hire_date: Optional[date] = None
    work_schedule_id: Optional[UUID] = None  # Phase 4.9: employee's assigned schedule
    working_days: Optional[list[int]] = None  # OrgWorkConfig: ISO weekdays [1-7]
    hours_per_day: Optional[float] = None  # OrgWorkConfig: hours per day
    dept_menu: Optional[dict[str, bool]] = None  # Go-Live G6: menu visibility per dept
    # Phase 10: Organization info for print headers
    org_name: Optional[str] = None
    org_address: Optional[str] = None
    org_tax_id: Optional[str] = None
    # Phase 13: 2FA status
    is_2fa_enabled: bool = False
    # LINE Login
    line_linked: bool = False
    login_method: Optional[str] = None  # "line" | "email" | None
