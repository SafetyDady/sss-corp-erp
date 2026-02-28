"""
SSS Corp ERP — Setup Wizard API (v2)
Phase 4.7 → v2: Initial system setup + department/OT/Leave/Employee auto-creation

Endpoint:
  POST /api/setup    (no auth required — only works once)

This endpoint is used for initial system setup. It:
1. Checks if any organization already exists (if yes, returns 400)
2. Creates a new Organization
3. Creates the first User with role='owner' and org_id=new_org.id
4. (v2) Creates departments + matching cost centers (optional)
5. (v2) Seeds default OT Types + Leave Types
6. (v2) Creates Employee record for owner user
7. (v2) Creates Leave Balances for owner employee
8. Returns login tokens (access + refresh) so the user can proceed
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
)
from app.models.organization import Organization, Department
from app.models.user import RefreshToken, User
from app.models.master import CostCenter, OTType, LeaveType
from app.models.hr import Employee, LeaveBalance, PayType


router = APIRouter(prefix="/api/setup", tags=["setup"])
settings = get_settings()


# ============================================================
# SCHEMAS
# ============================================================

class SetupDepartment(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    overhead_rate: float = Field(ge=0, le=100, default=15.0)


class SetupRequest(BaseModel):
    org_name: str = Field(min_length=1, max_length=255)
    org_code: str = Field(min_length=1, max_length=50)
    admin_email: EmailStr
    admin_password: str = Field(min_length=6, max_length=128)
    admin_full_name: str = Field(min_length=1, max_length=255)
    departments: list[SetupDepartment] = Field(default_factory=list, max_length=20)


class SetupResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    org_id: str
    org_name: str
    user_id: str
    message: str


# ============================================================
# DEFAULT DATA
# ============================================================

DEFAULT_OT_TYPES = [
    {"name": "ล่วงเวลาวันธรรมดา", "factor": Decimal("1.50"), "max_ceiling": Decimal("3.00")},
    {"name": "ล่วงเวลาวันหยุด", "factor": Decimal("2.00"), "max_ceiling": Decimal("3.00")},
    {"name": "ล่วงเวลาวันนักขัตฤกษ์", "factor": Decimal("3.00"), "max_ceiling": Decimal("3.00")},
]

DEFAULT_LEAVE_TYPES = [
    {"code": "ANNUAL", "name": "ลาพักร้อน", "is_paid": True, "default_quota": 6},
    {"code": "SICK", "name": "ลาป่วย", "is_paid": True, "default_quota": 30},
    {"code": "PERSONAL", "name": "ลากิจ", "is_paid": True, "default_quota": 3},
    {"code": "MATERNITY", "name": "ลาคลอด", "is_paid": True, "default_quota": 98},
    {"code": "UNPAID", "name": "ลาไม่รับเงิน", "is_paid": False, "default_quota": None},
]


# ============================================================
# SETUP ENDPOINT
# ============================================================

@router.post("", response_model=SetupResponse, status_code=201)
async def api_setup(
    body: SetupRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Initial system setup — create first organization and owner user.
    This endpoint only works ONCE. If any organization exists, it returns 400.
    """
    # 1. Check if any organization already exists
    org_count_result = await db.execute(
        select(func.count()).select_from(Organization)
    )
    org_count = org_count_result.scalar() or 0
    if org_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup already completed — an organization already exists",
        )

    # 2. Check if org_code is unique (redundant since no orgs exist, but safe)
    existing_org = await db.execute(
        select(Organization).where(Organization.code == body.org_code)
    )
    if existing_org.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Organization with code '{body.org_code}' already exists",
        )

    # 3. Check if email is unique
    existing_user = await db.execute(
        select(User).where(User.email == body.admin_email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{body.admin_email}' already exists",
        )

    # 4. Create Organization
    org = Organization(
        code=body.org_code,
        name=body.org_name,
    )
    db.add(org)
    await db.flush()  # Get org.id

    # 5. Create Owner User
    user = User(
        email=body.admin_email,
        hashed_password=hash_password(body.admin_password),
        full_name=body.admin_full_name,
        role="owner",
        org_id=org.id,
    )
    db.add(user)
    await db.flush()  # Get user.id

    # 6. Create Departments + Cost Centers (optional)
    first_dept_id = None
    first_cc_id = None
    for dept_data in body.departments:
        # Auto-create matching CostCenter
        cc = CostCenter(
            code=f"CC-{dept_data.code.upper()}",
            name=dept_data.name,
            overhead_rate=Decimal(str(dept_data.overhead_rate)),
            org_id=org.id,
        )
        db.add(cc)
        await db.flush()  # Get cc.id

        if first_cc_id is None:
            first_cc_id = cc.id

        # Create Department
        dept = Department(
            code=dept_data.code.upper(),
            name=dept_data.name,
            cost_center_id=cc.id,
            org_id=org.id,
        )
        db.add(dept)
        await db.flush()  # Get dept.id

        if first_dept_id is None:
            first_dept_id = dept.id

    # 7. Seed default OT Types
    for ot_data in DEFAULT_OT_TYPES:
        ot = OTType(
            name=ot_data["name"],
            factor=ot_data["factor"],
            max_ceiling=ot_data["max_ceiling"],
            org_id=org.id,
        )
        db.add(ot)

    # 8. Seed default Leave Types
    leave_type_ids_with_quota = []
    for lt_data in DEFAULT_LEAVE_TYPES:
        lt = LeaveType(
            code=lt_data["code"],
            name=lt_data["name"],
            is_paid=lt_data["is_paid"],
            default_quota=lt_data["default_quota"],
            org_id=org.id,
        )
        db.add(lt)
        await db.flush()  # Get lt.id
        if lt_data["default_quota"] is not None:
            leave_type_ids_with_quota.append((lt.id, lt_data["default_quota"]))

    # 9. Create Employee for Owner
    employee = Employee(
        employee_code="EMP-001",
        full_name=body.admin_full_name,
        position="เจ้าของกิจการ",
        pay_type=PayType.MONTHLY,
        monthly_salary=Decimal("0.00"),
        hourly_rate=Decimal("0.00"),
        daily_working_hours=Decimal("8.00"),
        department_id=first_dept_id,
        cost_center_id=first_cc_id,
        user_id=user.id,
        hire_date=date.today(),
        org_id=org.id,
    )
    db.add(employee)
    await db.flush()  # Get employee.id

    # Set owner as head of first department
    if first_dept_id:
        dept_result = await db.execute(
            select(Department).where(Department.id == first_dept_id)
        )
        first_dept = dept_result.scalar_one_or_none()
        if first_dept:
            first_dept.head_id = employee.id

    # 10. Create Leave Balances for Owner
    current_year = date.today().year
    for lt_id, quota in leave_type_ids_with_quota:
        lb = LeaveBalance(
            employee_id=employee.id,
            leave_type_id=lt_id,
            year=current_year,
            quota=quota,
            used=0,
            org_id=org.id,
        )
        db.add(lb)

    # 11. Create tokens
    token_data = {
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "org_id": str(org.id),
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # 12. Store refresh token in DB
    db_refresh = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(db_refresh)

    await db.commit()

    return SetupResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        org_id=str(org.id),
        org_name=org.name,
        user_id=str(user.id),
        message="Setup completed successfully — organization and owner user created",
    )
