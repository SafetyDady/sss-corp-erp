"""
SSS Corp ERP — Master Data Service (Business Logic)
CostCenter, CostElement, OTType, LeaveType, ShiftType, WorkSchedule, WHTType

Business Rules enforced:
  BR#24 — Special OT Factor ≤ Maximum Ceiling
  BR#29 — Admin adjusts Factor + Max Ceiling in Master Data
  BR#30 — Overhead Rate per Cost Center (not one rate for all)
  BR#107-112 — WHT rates, PO-only, base=subtotal (ก่อน VAT)
"""

from datetime import date, time
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.master import CostCenter, CostElement, LeaveType, OTType, ShiftType, WorkSchedule, ScheduleType, Supplier, WHTType
from app.models.organization import Company


# ============================================================
# COST CENTER CRUD
# ============================================================

async def create_cost_center(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    description: Optional[str],
    overhead_rate: Decimal,
    org_id: UUID,
    company_id: Optional[UUID] = None,
) -> CostCenter:
    existing = await db.execute(
        select(CostCenter).where(
            CostCenter.org_id == org_id,
            CostCenter.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cost center with code '{code}' already exists",
        )

    cc = CostCenter(
        code=code,
        name=name,
        description=description,
        overhead_rate=overhead_rate,
        org_id=org_id,
        company_id=company_id,
    )
    db.add(cc)
    await db.commit()
    await db.refresh(cc)
    return cc


async def get_cost_center(db: AsyncSession, cc_id: UUID, *, org_id: Optional[UUID] = None) -> CostCenter:
    query = select(CostCenter).where(CostCenter.id == cc_id, CostCenter.is_active == True)
    if org_id:
        query = query.where(CostCenter.org_id == org_id)
    result = await db.execute(query)
    cc = result.scalar_one_or_none()
    if not cc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cost center not found",
        )
    return cc


async def list_cost_centers(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
    company_id: Optional[UUID] = None,
) -> tuple[list[CostCenter], int]:
    query = select(CostCenter).where(CostCenter.is_active == True)
    if org_id:
        query = query.where(CostCenter.org_id == org_id)
    if company_id:
        query = query.where(CostCenter.company_id == company_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (CostCenter.code.ilike(pattern)) | (CostCenter.name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(CostCenter.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_cost_center(
    db: AsyncSession,
    cc_id: UUID,
    *,
    update_data: dict,
    org_id: Optional[UUID] = None,
) -> CostCenter:
    cc = await get_cost_center(db, cc_id, org_id=org_id)

    for field, value in update_data.items():
        if value is not None:
            setattr(cc, field, value)

    await db.commit()
    await db.refresh(cc)
    return cc


async def delete_cost_center(db: AsyncSession, cc_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    cc = await get_cost_center(db, cc_id, org_id=org_id)
    cc.is_active = False
    await db.commit()


# ============================================================
# COST ELEMENT CRUD
# ============================================================

async def create_cost_element(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    description: Optional[str],
    org_id: UUID,
) -> CostElement:
    existing = await db.execute(
        select(CostElement).where(
            CostElement.org_id == org_id,
            CostElement.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cost element with code '{code}' already exists",
        )

    ce = CostElement(
        code=code,
        name=name,
        description=description,
        org_id=org_id,
    )
    db.add(ce)
    await db.commit()
    await db.refresh(ce)
    return ce


async def get_cost_element(db: AsyncSession, ce_id: UUID, *, org_id: Optional[UUID] = None) -> CostElement:
    query = select(CostElement).where(CostElement.id == ce_id, CostElement.is_active == True)
    if org_id:
        query = query.where(CostElement.org_id == org_id)
    result = await db.execute(query)
    ce = result.scalar_one_or_none()
    if not ce:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cost element not found",
        )
    return ce


async def list_cost_elements(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[CostElement], int]:
    query = select(CostElement).where(CostElement.is_active == True)
    if org_id:
        query = query.where(CostElement.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (CostElement.code.ilike(pattern)) | (CostElement.name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(CostElement.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_cost_element(
    db: AsyncSession,
    ce_id: UUID,
    *,
    update_data: dict,
    org_id: Optional[UUID] = None,
) -> CostElement:
    ce = await get_cost_element(db, ce_id, org_id=org_id)

    for field, value in update_data.items():
        if value is not None:
            setattr(ce, field, value)

    await db.commit()
    await db.refresh(ce)
    return ce


async def delete_cost_element(db: AsyncSession, ce_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    ce = await get_cost_element(db, ce_id, org_id=org_id)
    ce.is_active = False
    await db.commit()


# ============================================================
# OT TYPE CRUD  (BR#24, BR#29)
# ============================================================

async def create_ot_type(
    db: AsyncSession,
    *,
    name: str,
    factor: Decimal,
    max_ceiling: Decimal,
    description: Optional[str],
    org_id: UUID,
) -> OTType:
    # BR#24: factor ≤ max_ceiling
    if factor > max_ceiling:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OT factor must be ≤ max_ceiling (BR#24)",
        )

    existing = await db.execute(
        select(OTType).where(
            OTType.org_id == org_id,
            OTType.name == name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"OT type with name '{name}' already exists",
        )

    ot = OTType(
        name=name,
        factor=factor,
        max_ceiling=max_ceiling,
        description=description,
        org_id=org_id,
    )
    db.add(ot)
    await db.commit()
    await db.refresh(ot)
    return ot


async def get_ot_type(db: AsyncSession, ot_id: UUID, *, org_id: Optional[UUID] = None) -> OTType:
    query = select(OTType).where(OTType.id == ot_id, OTType.is_active == True)
    if org_id:
        query = query.where(OTType.org_id == org_id)
    result = await db.execute(query)
    ot = result.scalar_one_or_none()
    if not ot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OT type not found",
        )
    return ot


async def list_ot_types(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[OTType], int]:
    query = select(OTType).where(OTType.is_active == True)
    if org_id:
        query = query.where(OTType.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(OTType.name.ilike(pattern))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(OTType.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_ot_type(
    db: AsyncSession,
    ot_id: UUID,
    *,
    update_data: dict,
    org_id: Optional[UUID] = None,
) -> OTType:
    ot = await get_ot_type(db, ot_id, org_id=org_id)

    for field, value in update_data.items():
        if value is not None:
            setattr(ot, field, value)

    # BR#24: re-validate factor ≤ max_ceiling after update
    if ot.factor > ot.max_ceiling:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OT factor must be ≤ max_ceiling (BR#24)",
        )

    await db.commit()
    await db.refresh(ot)
    return ot


async def delete_ot_type(db: AsyncSession, ot_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    ot = await get_ot_type(db, ot_id, org_id=org_id)
    ot.is_active = False
    await db.commit()


# ============================================================
# LEAVE TYPE CRUD  (Phase 4.3)
# ============================================================

async def create_leave_type(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    is_paid: bool,
    default_quota: Optional[int],
    org_id: UUID,
) -> LeaveType:
    existing = await db.execute(
        select(LeaveType).where(
            LeaveType.org_id == org_id,
            LeaveType.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Leave type with code '{code}' already exists",
        )

    lt = LeaveType(
        code=code,
        name=name,
        is_paid=is_paid,
        default_quota=default_quota,
        org_id=org_id,
    )
    db.add(lt)
    await db.commit()
    await db.refresh(lt)
    return lt


async def get_leave_type(db: AsyncSession, lt_id: UUID, *, org_id: Optional[UUID] = None) -> LeaveType:
    query = select(LeaveType).where(LeaveType.id == lt_id, LeaveType.is_active == True)
    if org_id:
        query = query.where(LeaveType.org_id == org_id)
    result = await db.execute(query)
    lt = result.scalar_one_or_none()
    if not lt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave type not found",
        )
    return lt


async def list_leave_types(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[LeaveType], int]:
    query = select(LeaveType).where(LeaveType.is_active == True)
    if org_id:
        query = query.where(LeaveType.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (LeaveType.code.ilike(pattern)) | (LeaveType.name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(LeaveType.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_leave_type(
    db: AsyncSession,
    lt_id: UUID,
    *,
    update_data: dict,
    org_id: Optional[UUID] = None,
) -> LeaveType:
    lt = await get_leave_type(db, lt_id, org_id=org_id)

    for field, value in update_data.items():
        if value is not None:
            setattr(lt, field, value)

    await db.commit()
    await db.refresh(lt)
    return lt


async def delete_leave_type(db: AsyncSession, lt_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    lt = await get_leave_type(db, lt_id, org_id=org_id)
    lt.is_active = False
    await db.commit()


# ============================================================
# SHIFT TYPE CRUD  (Phase 4.9 — Shift Management)
# ============================================================

async def create_shift_type(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    start_time: time,
    end_time: time,
    break_minutes: int = 60,
    working_hours: Decimal = Decimal("8.00"),
    is_overnight: bool = False,
    description: Optional[str] = None,
    org_id: UUID,
) -> ShiftType:
    existing = await db.execute(
        select(ShiftType).where(
            ShiftType.org_id == org_id,
            ShiftType.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Shift type with code '{code}' already exists",
        )

    st = ShiftType(
        code=code,
        name=name,
        start_time=start_time,
        end_time=end_time,
        break_minutes=break_minutes,
        working_hours=working_hours,
        is_overnight=is_overnight,
        description=description,
        org_id=org_id,
    )
    db.add(st)
    await db.commit()
    await db.refresh(st)
    return st


async def get_shift_type(db: AsyncSession, st_id: UUID, *, org_id: Optional[UUID] = None) -> ShiftType:
    query = select(ShiftType).where(ShiftType.id == st_id)
    if org_id:
        query = query.where(ShiftType.org_id == org_id)
    result = await db.execute(query)
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift type not found",
        )
    return st


async def list_shift_types(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[ShiftType], int]:
    query = select(ShiftType).where(ShiftType.is_active == True)
    if org_id:
        query = query.where(ShiftType.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (ShiftType.code.ilike(pattern)) | (ShiftType.name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(ShiftType.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_shift_type(
    db: AsyncSession,
    st_id: UUID,
    *,
    update_data: dict,
    org_id: Optional[UUID] = None,
) -> ShiftType:
    st = await get_shift_type(db, st_id, org_id=org_id)

    for field, value in update_data.items():
        if value is not None:
            setattr(st, field, value)

    await db.commit()
    await db.refresh(st)
    return st


async def delete_shift_type(db: AsyncSession, st_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    st = await get_shift_type(db, st_id, org_id=org_id)
    st.is_active = False
    await db.commit()


# ============================================================
# WORK SCHEDULE CRUD  (Phase 4.9 — Shift Management)
# ============================================================

async def create_work_schedule(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    schedule_type: str,
    working_days: Optional[list] = None,
    default_shift_type_id: Optional[UUID] = None,
    rotation_pattern: Optional[list] = None,
    cycle_start_date: Optional[date] = None,
    description: Optional[str] = None,
    org_id: UUID,
) -> WorkSchedule:
    # Validate based on schedule type
    if schedule_type == "FIXED":
        if not working_days:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="FIXED schedule requires working_days",
            )
        if not default_shift_type_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="FIXED schedule requires default_shift_type_id",
            )
    elif schedule_type == "ROTATING":
        if not rotation_pattern or len(rotation_pattern) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ROTATING schedule requires rotation_pattern",
            )
        if not cycle_start_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ROTATING schedule requires cycle_start_date",
            )

    existing = await db.execute(
        select(WorkSchedule).where(
            WorkSchedule.org_id == org_id,
            WorkSchedule.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Work schedule with code '{code}' already exists",
        )

    ws = WorkSchedule(
        code=code,
        name=name,
        schedule_type=ScheduleType(schedule_type),
        working_days=working_days,
        default_shift_type_id=default_shift_type_id,
        rotation_pattern=rotation_pattern,
        cycle_start_date=cycle_start_date,
        description=description,
        org_id=org_id,
    )
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return ws


async def get_work_schedule(db: AsyncSession, ws_id: UUID, *, org_id: Optional[UUID] = None) -> WorkSchedule:
    query = select(WorkSchedule).where(WorkSchedule.id == ws_id)
    if org_id:
        query = query.where(WorkSchedule.org_id == org_id)
    result = await db.execute(query)
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work schedule not found",
        )
    return ws


async def list_work_schedules(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[WorkSchedule], int]:
    query = select(WorkSchedule).where(WorkSchedule.is_active == True)
    if org_id:
        query = query.where(WorkSchedule.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (WorkSchedule.code.ilike(pattern)) | (WorkSchedule.name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(WorkSchedule.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_work_schedule(
    db: AsyncSession,
    ws_id: UUID,
    *,
    update_data: dict,
    org_id: Optional[UUID] = None,
) -> WorkSchedule:
    ws = await get_work_schedule(db, ws_id, org_id=org_id)

    for field, value in update_data.items():
        if value is not None:
            if field == "schedule_type":
                setattr(ws, field, ScheduleType(value))
            else:
                setattr(ws, field, value)

    await db.commit()
    await db.refresh(ws)
    return ws


async def delete_work_schedule(db: AsyncSession, ws_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    from app.models.hr import Employee
    ws = await get_work_schedule(db, ws_id, org_id=org_id)

    # Check if any employee uses this schedule
    emp_result = await db.execute(
        select(func.count()).select_from(Employee).where(
            Employee.work_schedule_id == ws_id
        )
    )
    count = emp_result.scalar() or 0
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete: {count} employee(s) are using this work schedule",
        )

    ws.is_active = False
    await db.commit()


# ============================================================
# WHT TYPE CRUD  (Phase C5.2 — Withholding Tax)
# ============================================================

async def create_wht_type(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    section: Optional[str] = None,
    rate: Decimal = Decimal("0.00"),
    description: Optional[str] = None,
    org_id: UUID,
) -> WHTType:
    existing = await db.execute(
        select(WHTType).where(
            WHTType.org_id == org_id,
            WHTType.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"WHT type with code '{code}' already exists",
        )

    wht = WHTType(
        code=code,
        name=name,
        section=section,
        rate=rate,
        description=description,
        org_id=org_id,
    )
    db.add(wht)
    await db.commit()
    await db.refresh(wht)
    return wht


async def get_wht_type(db: AsyncSession, wht_id: UUID, *, org_id: Optional[UUID] = None) -> WHTType:
    query = select(WHTType).where(WHTType.id == wht_id, WHTType.is_active == True)
    if org_id:
        query = query.where(WHTType.org_id == org_id)
    result = await db.execute(query)
    wht = result.scalar_one_or_none()
    if not wht:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WHT type not found",
        )
    return wht


async def list_wht_types(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[WHTType], int]:
    query = select(WHTType).where(WHTType.is_active == True)
    if org_id:
        query = query.where(WHTType.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (WHTType.code.ilike(pattern)) | (WHTType.name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(WHTType.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_wht_type(
    db: AsyncSession,
    wht_id: UUID,
    *,
    update_data: dict,
    org_id: Optional[UUID] = None,
) -> WHTType:
    wht = await get_wht_type(db, wht_id, org_id=org_id)

    for field, value in update_data.items():
        if value is not None:
            setattr(wht, field, value)

    await db.commit()
    await db.refresh(wht)
    return wht


async def delete_wht_type(db: AsyncSession, wht_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    wht = await get_wht_type(db, wht_id, org_id=org_id)
    wht.is_active = False
    await db.commit()


# ============================================================
# SUPPLIER CRUD  (Phase 11 — Supplier Master Data)
# ============================================================

async def create_supplier(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    contact_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    tax_id: Optional[str] = None,
    default_wht_type_id: Optional[UUID] = None,
    org_id: UUID,
) -> Supplier:
    existing = await db.execute(
        select(Supplier).where(
            Supplier.org_id == org_id,
            Supplier.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Supplier with code '{code}' already exists",
        )

    supplier = Supplier(
        code=code,
        name=name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        address=address,
        tax_id=tax_id,
        default_wht_type_id=default_wht_type_id,
        org_id=org_id,
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


async def get_supplier(db: AsyncSession, supplier_id: UUID, *, org_id: Optional[UUID] = None) -> Supplier:
    query = select(Supplier).where(Supplier.id == supplier_id, Supplier.is_active == True)
    if org_id:
        query = query.where(Supplier.org_id == org_id)
    result = await db.execute(query)
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    return supplier


async def list_suppliers(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[Supplier], int]:
    query = select(Supplier).where(Supplier.is_active == True)
    if org_id:
        query = query.where(Supplier.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Supplier.code.ilike(pattern))
            | (Supplier.name.ilike(pattern))
            | (Supplier.contact_name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Supplier.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_supplier(
    db: AsyncSession,
    supplier_id: UUID,
    *,
    update_data: dict,
    org_id: Optional[UUID] = None,
) -> Supplier:
    supplier = await get_supplier(db, supplier_id, org_id=org_id)

    for field, value in update_data.items():
        if value is not None:
            setattr(supplier, field, value)

    await db.commit()
    await db.refresh(supplier)
    return supplier


async def delete_supplier(db: AsyncSession, supplier_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    supplier = await get_supplier(db, supplier_id, org_id=org_id)
    supplier.is_active = False
    await db.commit()


# ============================================================
# COMPANY CRUD  (C11 — Multi-Company Foundation)
# ============================================================

async def create_company(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    tax_id: Optional[str],
    address: Optional[str],
    org_id: UUID,
) -> Company:
    existing = await db.execute(
        select(Company).where(
            Company.org_id == org_id,
            Company.code == code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Company with code '{code}' already exists",
        )

    company = Company(
        code=code,
        name=name,
        tax_id=tax_id,
        address=address,
        org_id=org_id,
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


async def get_company(db: AsyncSession, company_id: UUID, *, org_id: Optional[UUID] = None) -> Company:
    query = select(Company).where(Company.id == company_id)
    if org_id:
        query = query.where(Company.org_id == org_id)
    result = await db.execute(query)
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    return company


async def list_companies(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
):
    query = select(Company).where(Company.is_active == True)
    count_query = select(func.count(Company.id)).where(Company.is_active == True)

    if org_id:
        query = query.where(Company.org_id == org_id)
        count_query = count_query.where(Company.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Company.code.ilike(pattern)) | (Company.name.ilike(pattern))
        )
        count_query = count_query.where(
            (Company.code.ilike(pattern)) | (Company.name.ilike(pattern))
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Company.code).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_company(
    db: AsyncSession,
    company_id: UUID,
    *,
    name: Optional[str] = None,
    tax_id: Optional[str] = None,
    address: Optional[str] = None,
    is_active: Optional[bool] = None,
    org_id: Optional[UUID] = None,
) -> Company:
    company = await get_company(db, company_id, org_id=org_id)

    if name is not None:
        company.name = name
    if tax_id is not None:
        company.tax_id = tax_id
    if address is not None:
        company.address = address
    if is_active is not None:
        company.is_active = is_active

    await db.commit()
    await db.refresh(company)
    return company


async def delete_company(db: AsyncSession, company_id: UUID, *, org_id: Optional[UUID] = None) -> None:
    company = await get_company(db, company_id, org_id=org_id)

    # Check references — cannot delete if CC/Dept/Employee linked
    from app.models.organization import Department

    for model, label in [
        (CostCenter, "Cost Center"),
        (Department, "Department"),
    ]:
        ref_result = await db.execute(
            select(func.count(model.id)).where(
                model.company_id == company_id,
                model.is_active == True,
            )
        )
        ref_count = ref_result.scalar() or 0
        if ref_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete company: {ref_count} active {label}(s) still linked",
            )

    from app.models.hr import Employee
    emp_result = await db.execute(
        select(func.count(Employee.id)).where(
            Employee.company_id == company_id,
            Employee.is_active == True,
        )
    )
    emp_count = emp_result.scalar() or 0
    if emp_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete company: {emp_count} active Employee(s) still linked",
        )

    company.is_active = False
    await db.commit()
