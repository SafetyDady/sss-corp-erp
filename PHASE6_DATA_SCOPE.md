# Phase 6 — Data Scope: Role-Based Data Visibility ✅ COMPLETED

> **สำหรับ Opus 4.6 Co-pilot** — ✅ IMPLEMENTED 2026-02-28
> ต้องอ่าน CLAUDE.md ก่อนเริ่มทำทุกครั้ง

---

## สรุปปัญหา

ปัจจุบันระบบมี **Permission** (เข้า endpoint ได้ไหม) แต่ขาด **Data Scope** (เห็นข้อมูลอะไรบ้าง)

ปัญหา 2 ประเภท:
1. **Critical Security** — บาง endpoint ไม่มี org_id filter → ข้อมูลข้ามองค์กรได้
2. **Role-Based Scope** — HR endpoints ไม่ filter ตาม role → staff เห็นข้อมูล HR ทุกคน

---

## หลักการ 3-Tier Data Scope

| ข้อมูล | staff | supervisor | manager/owner |
|--------|-------|------------|---------------|
| HR: Timesheet, Leave, Daily Report | ของตัวเองเท่านั้น | แผนกตัวเองเท่านั้น | ทั้ง org |
| HR: Payroll | ❌ (permission กันไว้แล้ว) | ❌ (permission กันไว้แล้ว) | ทั้ง org |
| HR: Employee | ❌ (permission กันไว้แล้ว) | แผนกตัวเอง | ทั้ง org |
| HR: Leave Balance | ของตัวเอง | แผนกตัวเอง | ทั้ง org |
| HR: Standard Timesheet | ของตัวเอง | แผนกตัวเอง | ทั้ง org |
| Operations (WO, Inventory, Tools, etc.) | ทั้ง org | ทั้ง org | ทั้ง org |
| Finance Reports | ❌ (permission กันไว้แล้ว) | ❌ (permission กันไว้แล้ว) | ทั้ง org |
| Admin | ❌ | ❌ | owner เท่านั้น |

---

## ไฟล์ที่ต้องสร้าง/แก้ไข (9 ไฟล์)

| # | ไฟล์ | Action | Step |
|---|------|--------|------|
| 1 | `backend/app/api/_helpers.py` | **สร้างใหม่** | Step 1 |
| 2 | `backend/app/api/finance.py` | แก้ไข | Step 2 |
| 3 | `backend/app/api/planning.py` | แก้ไข | Step 2 |
| 4 | `backend/app/api/admin.py` | แก้ไข | Step 2 |
| 5 | `backend/app/api/hr.py` | แก้ไข | Step 2-5 |
| 6 | `backend/app/services/hr.py` | แก้ไข | Step 3-5 |
| 7 | `backend/app/services/planning.py` | แก้ไข | Step 2 |
| 8 | `backend/app/api/daily_report.py` | แก้ไข (refactor) | Step 6 |
| 9 | `CLAUDE.md` | อัปเดต | Step 6 |

---

## Step 1: สร้าง Shared Helper Functions

### สร้างไฟล์ใหม่: `backend/app/api/_helpers.py`

```python
"""
SSS Corp ERP — Shared API Helpers
Data scope helpers for role-based data visibility (Phase 6)

Usage:
    from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hr import Employee


async def resolve_employee_id(
    db: AsyncSession, user_id: UUID
) -> Optional[UUID]:
    """Get employee_id linked to a user_id. Returns None if no employee linked."""
    result = await db.execute(
        select(Employee.id).where(
            Employee.user_id == user_id,
            Employee.is_active == True,
        )
    )
    row = result.one_or_none()
    return row[0] if row else None


async def resolve_employee(
    db: AsyncSession, user_id: UUID
) -> Optional[Employee]:
    """Get full Employee object linked to a user_id."""
    result = await db.execute(
        select(Employee).where(
            Employee.user_id == user_id,
            Employee.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def get_department_employee_ids(
    db: AsyncSession, department_id: UUID, org_id: UUID
) -> list[UUID]:
    """Get list of employee IDs in a department."""
    result = await db.execute(
        select(Employee.id).where(
            Employee.department_id == department_id,
            Employee.org_id == org_id,
            Employee.is_active == True,
        )
    )
    return [row[0] for row in result.all()]
```

---

## Step 2: แก้ Critical Security — Missing org_id Filter

### 2A. แก้ `backend/app/api/finance.py`

**ปัญหา**: ทั้ง 2 endpoints ไม่มี `token` dependency → ไม่รู้ org_id → query ข้ามองค์กร

**แก้ endpoint `api_finance_reports` (line 38-104)**:
- เพิ่ม `token: dict = Depends(get_token_payload)` ใน function params
- เพิ่ม `org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID`
- เพิ่ม import: `from app.core.security import get_token_payload` และ `from app.core.config import DEFAULT_ORG_ID`
- เพิ่ม `.where(WorkOrder.org_id == org_id)` ใน wo_query (line 46-50)
- เพิ่ม `.where(PurchaseOrder.org_id == org_id)` ใน po_query (line 55-58)
- เพิ่ม `.where(SalesOrder.org_id == org_id)` ใน so_query (line 67-70)
- เพิ่ม `.where(StockMovement.org_id == org_id)` ใน movement_query (line 79-81)

**แก้ endpoint `api_finance_export` (line 111-139)**:
- เพิ่ม `token: dict = Depends(get_token_payload)` ใน function params
- แก้ call: `report = await api_finance_reports(period_start=period_start, period_end=period_end, db=db, token=token)`
- (**สำคัญ**: เนื่องจาก `api_finance_export` เรียก `api_finance_reports` ภายใน ต้องส่ง token ไปด้วย)

**ตัวอย่างโค้ดที่แก้แล้ว (finance.py)**:
```python
# เพิ่ม imports ที่ต้นไฟล์
from app.core.security import get_token_payload
from app.core.config import DEFAULT_ORG_ID

@finance_router.get(
    "/reports",
    dependencies=[Depends(require("finance.report.read"))],
)
async def api_finance_reports(
    period_start: Optional[date] = Query(default=None),
    period_end: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),  # ← เพิ่ม
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID  # ← เพิ่ม

    # Work Orders summary — เพิ่ม org_id filter
    wo_query = select(
        func.count().label("total"),
        func.count().filter(WorkOrder.status == WOStatus.OPEN).label("open"),
        func.count().filter(WorkOrder.status == WOStatus.CLOSED).label("closed"),
    ).where(WorkOrder.is_active == True, WorkOrder.org_id == org_id)  # ← เพิ่ม org_id

    # Purchase Orders summary — เพิ่ม org_id filter
    po_query = select(
        func.count().label("total"),
        func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("total_amount"),
    ).where(PurchaseOrder.is_active == True, PurchaseOrder.org_id == org_id)  # ← เพิ่ม

    # Sales Orders summary — เพิ่ม org_id filter
    so_query = select(
        func.count().label("total"),
        func.coalesce(func.sum(SalesOrder.total_amount), 0).label("total_amount"),
    ).where(SalesOrder.is_active == True, SalesOrder.org_id == org_id)  # ← เพิ่ม

    # Stock movements — เพิ่ม org_id filter
    movement_query = select(
        func.coalesce(func.sum(StockMovement.quantity * StockMovement.unit_cost), 0),
    ).where(StockMovement.is_reversed == False, StockMovement.org_id == org_id)  # ← เพิ่ม

    # ... (ส่วนที่เหลือเหมือนเดิม)


@finance_router.get(
    "/reports/export",
    dependencies=[Depends(require("finance.report.export"))],
)
async def api_finance_export(
    period_start: Optional[date] = Query(default=None),
    period_end: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),  # ← เพิ่ม
):
    report = await api_finance_reports(
        period_start=period_start, period_end=period_end, db=db, token=token  # ← ส่ง token
    )
    # ... (ส่วนที่เหลือเหมือนเดิม)
```

---

### 2B. แก้ `backend/app/api/planning.py`

**ปัญหา**: หลาย endpoints ไม่มี token → ไม่รู้ org_id

**Endpoints ที่ต้องแก้** (เพิ่ม token + org_id):

1. **`api_get_master_plan`** (line 95-100) — เพิ่ม token, ส่ง org_id ไป service
2. **`api_update_master_plan`** (line 136-152) — เพิ่ม token, ส่ง org_id ไป service
3. **`api_list_daily_plans`** (line 164-181) — เพิ่ม token, ส่ง org_id ไป service
4. **`api_update_daily_plan`** (line 221-246) — เพิ่ม token, ส่ง org_id ไป service
5. **`api_delete_daily_plan`** (line 254-259) — เพิ่ม token, ส่ง org_id ไป service
6. **`api_check_conflicts`** (line 270-282) — เพิ่ม token, ส่ง org_id ไป service
7. **`api_list_material_reservations`** (line 294-304) — เพิ่ม token, ส่ง org_id ไป service
8. **`api_cancel_material_reservation`** (line 338-343) — เพิ่ม token, ส่ง org_id ไป service
9. **`api_list_tool_reservations`** (line 355-365) — เพิ่ม token, ส่ง org_id ไป service

**Pattern สำหรับทุก endpoint**:
```python
async def api_xxx(
    ...,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),  # ← เพิ่ม
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID  # ← เพิ่ม
    return await xxx_service(db, ..., org_id=org_id)  # ← ส่ง org_id
```

**ต้องแก้ service functions ใน `backend/app/services/planning.py` ด้วย**:

1. **`get_master_plan`** (line 103-125) — เพิ่ม `org_id: Optional[UUID] = None` param → filter `.where(WOMasterPlan.org_id == org_id)`
2. **`update_master_plan`** (line 128-186) — เพิ่ม `org_id` param → filter
3. **`list_daily_plans`** (line 432-473) — เพิ่ม `org_id: Optional[UUID] = None` param → filter `.where(DailyPlan.org_id == org_id)`
4. **`get_daily_plan`** (line 476-491) — เพิ่ม `org_id` param → filter
5. **`update_daily_plan`** (line 494-588) — เพิ่ม `org_id` param → filter
6. **`delete_daily_plan`** (line 591-622) — เพิ่ม `org_id` param → filter
7. **`check_conflicts`** (line 629-693) — เพิ่ม `org_id` param → filter join with DailyPlan.org_id
8. **`list_material_reservations`** (line 763-784) — เพิ่ม `org_id: Optional[UUID] = None` → filter `.where(MaterialReservation.org_id == org_id)`
9. **`cancel_material_reservation`** (line 787-813) — เพิ่ม `org_id` → filter
10. **`list_tool_reservations`** (line 883-904) — เพิ่ม `org_id: Optional[UUID] = None` → filter `.where(ToolReservation.org_id == org_id)`
11. **`cancel_tool_reservation`** (line 907-933) — เพิ่ม `org_id` → filter

**ตัวอย่าง service แก้ (list_daily_plans)**:
```python
async def list_daily_plans(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    plan_date: Optional[date] = None,
    date_end: Optional[date] = None,
    work_order_id: Optional[UUID] = None,
    org_id: Optional[UUID] = None,  # ← เพิ่ม
) -> tuple[list, int]:
    from app.models.planning import DailyPlan

    query = select(DailyPlan)

    if org_id:  # ← เพิ่ม
        query = query.where(DailyPlan.org_id == org_id)

    # ... (ส่วนที่เหลือเหมือนเดิม)
```

---

### 2C. แก้ `backend/app/api/admin.py`

**ปัญหา**: `api_audit_log` (line 220-245) ไม่มี token → query ข้ามองค์กร

**แก้ไข**:
```python
@admin_router.get(
    "/audit-log",
    dependencies=[Depends(require("admin.role.read"))],
)
async def api_audit_log(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),  # ← เพิ่ม
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID  # ← เพิ่ม

    result = await db.execute(
        select(User)
        .where(User.org_id == org_id)  # ← เพิ่ม org_id filter
        .order_by(User.updated_at.desc())
        .limit(limit)
    )
    # ... (ส่วนที่เหลือเหมือนเดิม)
```

---

### 2D. แก้ `backend/app/api/hr.py` — Missing token endpoints

**Endpoints ที่ไม่มี token ที่ต้องเพิ่ม**:

1. **`api_update_employee`** (line 164-170) — เพิ่ม `token`, ส่ง `org_id` ไป service
2. **`api_delete_employee`** (line 178-182) — เพิ่ม `token`, ส่ง `org_id` ไป service
3. **`api_update_timesheet`** (line 252-258) — เพิ่ม `token`, ส่ง `org_id`
4. **`api_unlock_timesheet`** (line 296-301) — เพิ่ม `token`, ส่ง `org_id`
5. **`api_list_standard_timesheets`** (line 347-359) — เพิ่ม `token`, ส่ง `org_id`
6. **`api_list_leave_balances`** (line 458-464) — เพิ่ม `token`, ส่ง `org_id`
7. **`api_update_leave_balance`** (line 472-478) — เพิ่ม `token`, ส่ง `org_id`
8. **`api_export_payroll`** (line 541-573) — เพิ่ม `token`, ส่ง `org_id` **(CRITICAL)**

**ตัวอย่าง payroll export (CRITICAL)**:
```python
@hr_router.get(
    "/payroll/export",
    dependencies=[Depends(require("hr.payroll.export"))],
)
async def api_export_payroll(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    token: dict = Depends(get_token_payload),  # ← เพิ่ม
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID  # ← เพิ่ม
    items, total = await list_payroll_runs(db, limit=limit, offset=offset, org_id=org_id)  # ← ส่ง org_id
    # ... (ส่วนที่เหลือเหมือนเดิม)
```

**ต้องแก้ service functions ใน `backend/app/services/hr.py` ด้วย**:

1. **`update_employee`** (line 138-150) — เพิ่ม `org_id` param → ส่งต่อไป `get_employee`
2. **`delete_employee`** (line 153-156) — เพิ่ม `org_id` param → ส่งต่อไป `get_employee`
3. **`update_timesheet`** (line 300-329) — เพิ่ม `org_id` param → ส่งต่อไป `get_timesheet`
4. **`unlock_timesheet`** (line 377-396) — เพิ่ม `org_id` param → ส่งต่อไป `get_timesheet`
5. **`list_standard_timesheets`** (line 594-617) — เพิ่ม `org_id: Optional[UUID] = None` → filter `.where(StandardTimesheet.org_id == org_id)`
6. **`list_leave_balances`** (line 871-915) — เพิ่ม `org_id: Optional[UUID] = None` → filter LeaveBalance by org_id (ต้อง join หรือ filter ผ่าน Employee.org_id)
7. **`update_leave_balance`** (line 918-938) — เพิ่ม `org_id` → validate ว่า balance belongs to org

---

## Step 3: Role-Based Filter — HR Timesheet

### 3A. แก้ `backend/app/services/hr.py` — `list_timesheets`

**ปัจจุบัน (line 269-297)**: รับ `employee_id` เดียว, ไม่มี `employee_ids`

**เพิ่ม parameter `employee_ids`** เพื่อรองรับ supervisor filter:

```python
async def list_timesheets(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    employee_id: Optional[UUID] = None,
    employee_ids: Optional[list[UUID]] = None,  # ← เพิ่มสำหรับ supervisor
    work_order_id: Optional[UUID] = None,
    status_filter: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[Timesheet], int]:
    query = select(Timesheet)
    if org_id:
        query = query.where(Timesheet.org_id == org_id)

    if employee_id:
        query = query.where(Timesheet.employee_id == employee_id)
    elif employee_ids is not None:  # ← เพิ่ม
        if employee_ids:
            query = query.where(Timesheet.employee_id.in_(employee_ids))
        else:
            # supervisor ไม่มีคนในแผนก → return empty
            return [], 0

    if work_order_id:
        query = query.where(Timesheet.work_order_id == work_order_id)
    if status_filter:
        query = query.where(Timesheet.status == status_filter)

    # ... (ส่วนที่เหลือเหมือนเดิม)
```

### 3B. แก้ `backend/app/api/hr.py` — `api_list_timesheets`

**ปัจจุบัน (line 194-212)**: ไม่มี role-based filter

**แก้ไข**:
```python
@hr_router.get(
    "/timesheet",
    response_model=TimesheetListResponse,
    dependencies=[Depends(require("hr.timesheet.read"))],
)
async def api_list_timesheets(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    employee_id: Optional[UUID] = Query(default=None),
    work_order_id: Optional[UUID] = Query(default=None),
    status: Optional[str] = Query(
        default=None,
        pattern=r"^(DRAFT|SUBMITTED|APPROVED|FINAL|REJECTED)$",
    ),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])  # ← เพิ่ม
    role = token.get("role", "")  # ← เพิ่ม

    # ---- Data scope enforcement ----
    from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids

    filter_employee_id = employee_id
    filter_employee_ids = None

    if role == "staff":
        emp_id = await resolve_employee_id(db, user_id)
        if not emp_id:
            return TimesheetListResponse(items=[], total=0, limit=limit, offset=offset)
        filter_employee_id = emp_id  # force own data only

    elif role == "supervisor":
        if not employee_id:  # ไม่ได้ระบุ employee_id → filter ทั้งแผนก
            emp = await resolve_employee(db, user_id)
            if emp and emp.department_id:
                filter_employee_ids = await get_department_employee_ids(db, emp.department_id, org_id)
            else:
                return TimesheetListResponse(items=[], total=0, limit=limit, offset=offset)
    # manager/owner → ไม่ filter เพิ่ม (เห็นทั้ง org)

    items, total = await list_timesheets(
        db, limit=limit, offset=offset,
        employee_id=filter_employee_id,
        employee_ids=filter_employee_ids,  # ← เพิ่ม
        work_order_id=work_order_id,
        status_filter=status, org_id=org_id,
    )
    return TimesheetListResponse(items=items, total=total, limit=limit, offset=offset)
```

### 3C. แก้ `api_list_standard_timesheets` — เหมือน timesheet

**ปัจจุบัน (line 347-359)**: ไม่มี token, ไม่มี role filter

**แก้ไข**: เพิ่ม token + role-based filter (pattern เดียวกับ 3B)

- เพิ่ม `token: dict = Depends(get_token_payload)` ใน params
- เพิ่ม role-based filter logic เหมือน 3B
- อัปเดต service `list_standard_timesheets` ให้รับ `employee_ids` param (เหมือน pattern 3A)

### 3D. Timesheet Create — Validate ownership (staff สร้างเฉพาะของตัวเอง)

**`api_create_timesheet`** (line 221-244) — เพิ่ม validation:
```python
# หลัง org_id extraction
role = token.get("role", "")
if role == "staff":
    from app.api._helpers import resolve_employee_id
    own_emp_id = await resolve_employee_id(db, user_id)
    if not own_emp_id or body.employee_id != own_emp_id:
        raise HTTPException(status_code=403, detail="Staff can only create timesheet for themselves")

elif role == "supervisor":
    # BR#21: supervisor สร้างแทนคนในแผนกได้
    from app.api._helpers import resolve_employee, get_department_employee_ids
    emp = await resolve_employee(db, user_id)
    if emp and emp.department_id:
        dept_ids = await get_department_employee_ids(db, emp.department_id, org_id)
        if body.employee_id not in dept_ids:
            raise HTTPException(status_code=403, detail="Supervisor can only create timesheet for own department")
```

**`api_create_timesheet_batch`** (line 310-335) — เพิ่ม validation เดียวกัน (staff=ตัวเอง, supervisor=แผนก)

---

## Step 4: Role-Based Filter — HR Leave + Leave Balance

### 4A. แก้ `backend/app/services/hr.py` — `list_leaves`

**ปัจจุบัน (line 497-560)**: รับ `employee_id` เดียว

**เพิ่ม parameter `employee_ids`** (เหมือน pattern list_timesheets):
```python
async def list_leaves(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    employee_id: Optional[UUID] = None,
    employee_ids: Optional[list[UUID]] = None,  # ← เพิ่ม
    org_id: Optional[UUID] = None,
) -> tuple[list[dict], int]:
    # ... query setup ...

    if employee_id:
        query = query.where(Leave.employee_id == employee_id)
    elif employee_ids is not None:  # ← เพิ่ม
        if employee_ids:
            query = query.where(Leave.employee_id.in_(employee_ids))
        else:
            return [], 0

    # ... count query ต้องเพิ่ม employee_ids filter ด้วย ...
```

**สำคัญ**: count query (line 524-528) ต้องแก้ให้รองรับ employee_ids ด้วย

### 4B. แก้ `backend/app/api/hr.py` — `api_list_leaves`

**ปัจจุบัน (line 392-401)**: ไม่มี role filter

**แก้ไข**: เพิ่ม role-based filter pattern เดียวกับ Step 3B

```python
async def api_list_leaves(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    employee_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    user_id = UUID(token["sub"])
    role = token.get("role", "")

    from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids

    filter_employee_id = employee_id
    filter_employee_ids = None

    if role == "staff":
        emp_id = await resolve_employee_id(db, user_id)
        if not emp_id:
            return LeaveListResponse(items=[], total=0, limit=limit, offset=offset)
        filter_employee_id = emp_id
    elif role == "supervisor":
        if not employee_id:
            emp = await resolve_employee(db, user_id)
            if emp and emp.department_id:
                filter_employee_ids = await get_department_employee_ids(db, emp.department_id, org_id)
            else:
                return LeaveListResponse(items=[], total=0, limit=limit, offset=offset)

    items, total = await list_leaves(
        db, limit=limit, offset=offset,
        employee_id=filter_employee_id,
        employee_ids=filter_employee_ids,
        org_id=org_id,
    )
    return LeaveListResponse(items=items, total=total, limit=limit, offset=offset)
```

### 4C. Leave Create — Validate ownership

**`api_create_leave`** (line 410-432):
```python
# เพิ่มหลัง org_id extraction
role = token.get("role", "")
if role == "staff":
    from app.api._helpers import resolve_employee_id
    own_emp_id = await resolve_employee_id(db, user_id)
    if not own_emp_id or body.employee_id != own_emp_id:
        raise HTTPException(status_code=403, detail="Staff can only create leave for themselves")
```

### 4D. Leave Balance — เพิ่ม org_id + role filter

**`api_list_leave_balances`** (line 458-464):
- เพิ่ม `token: dict = Depends(get_token_payload)`
- เพิ่ม role-based filter (staff=ตัวเอง, supervisor=แผนก)
- ส่ง `org_id` ไป service

**Service `list_leave_balances`** (line 871-915):
- เพิ่ม `org_id: Optional[UUID] = None` param
- เพิ่ม `employee_ids: Optional[list[UUID]] = None` param
- Filter: ถ้ามี org_id → join Employee table → `.where(Employee.org_id == org_id)`
- Filter: ถ้ามี employee_ids → `.where(LeaveBalance.employee_id.in_(employee_ids))`

---

## Step 5: Role-Based Filter — HR Employee

### 5A. แก้ `backend/app/services/hr.py` — `list_employees`

**ปัจจุบัน (line 110-135)**: ไม่มี `department_id` filter

**เพิ่ม parameter `department_id`**:
```python
async def list_employees(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
    department_id: Optional[UUID] = None,  # ← เพิ่มสำหรับ supervisor
) -> tuple[list[Employee], int]:
    query = select(Employee).where(Employee.is_active == True)
    if org_id:
        query = query.where(Employee.org_id == org_id)
    if department_id:  # ← เพิ่ม
        query = query.where(Employee.department_id == department_id)
    # ... (ส่วนที่เหลือเหมือนเดิม)
```

### 5B. แก้ `backend/app/api/hr.py` — `api_list_employees`

**ปัจจุบัน (line 102-111)**: ไม่มี role filter

**แก้ไข**:
```python
async def api_list_employees(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    role = token.get("role", "")
    user_id = UUID(token["sub"])

    department_id = None
    if role == "supervisor":
        from app.api._helpers import resolve_employee
        emp = await resolve_employee(db, user_id)
        if emp and emp.department_id:
            department_id = emp.department_id
        else:
            return EmployeeListResponse(items=[], total=0, limit=limit, offset=offset)
    # manager/owner → ไม่ filter

    items, total = await list_employees(
        db, limit=limit, offset=offset, search=search,
        org_id=org_id, department_id=department_id,
    )
    return EmployeeListResponse(items=items, total=total, limit=limit, offset=offset)
```

**Note**: Staff ไม่มี `hr.employee.read` permission → ไม่เข้า endpoint นี้อยู่แล้ว
**Note**: Payroll — staff/supervisor ไม่มี `hr.payroll.read` permission → ไม่ต้องเพิ่ม role filter แค่ต้องแก้ org_id ที่ขาด (Step 2D)

---

## Step 6: Refactor + Cleanup

### 6A. Refactor `backend/app/api/daily_report.py`

แทนที่ local helpers ด้วย shared helpers:

**ลบ** functions `_resolve_employee_id` และ `_resolve_employee` (line 59-83)

**เปลี่ยน** import:
```python
# ลบ: from sqlalchemy import select (ถ้าไม่ได้ใช้ที่อื่นในไฟล์)
# เพิ่ม:
from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids
```

**แก้** `api_list_daily_reports` (line 112-131):
```python
    if role == "staff":
        emp_id = await resolve_employee_id(db, user_id)  # ← ใช้ shared helper
        ...
    elif role == "supervisor":
        if not employee_id:
            emp = await resolve_employee(db, user_id)  # ← ใช้ shared helper
            if emp and emp.department_id:
                dept_emp_ids = await get_department_employee_ids(db, emp.department_id, org_id)  # ← ใช้ shared helper
```

**แก้** `api_create_daily_report` (line 166-167):
```python
    emp_id = await resolve_employee_id(db, user_id)  # ← ใช้ shared helper
```

**ลบ** `from sqlalchemy import select` ถ้าไม่ได้ใช้ที่อื่นในไฟล์
**ลบ** `from app.models.hr import Employee` ถ้าไม่ได้ใช้ที่อื่นในไฟล์ (ย้ายไป _helpers.py แล้ว)

---

### 6B. อัปเดต `CLAUDE.md`

เพิ่ม section ใหม่หลัง "Business Rules" section:

```markdown
## Data Scope Rules (Phase 6)

| ข้อมูล | staff | supervisor | manager/owner |
|--------|-------|------------|---------------|
| HR: Timesheet | ของตัวเอง | แผนกตัวเอง | ทั้ง org |
| HR: Leave | ของตัวเอง | แผนกตัวเอง | ทั้ง org |
| HR: Daily Report | ของตัวเอง | แผนกตัวเอง | ทั้ง org |
| HR: Leave Balance | ของตัวเอง | แผนกตัวเอง | ทั้ง org |
| HR: Standard Timesheet | ของตัวเอง | แผนกตัวเอง | ทั้ง org |
| HR: Employee | ❌ (no perm) | แผนกตัวเอง | ทั้ง org |
| HR: Payroll | ❌ (no perm) | ❌ (no perm) | ทั้ง org |
| Operations (WO, Inventory, etc.) | ทั้ง org | ทั้ง org | ทั้ง org |
| Finance Reports | ❌ (no perm) | ❌ (no perm) | ทั้ง org |

### Implementation Pattern
ทุก HR endpoint ที่มี data scope ต้องใช้ pattern:
- Import: `from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids`
- Staff → `resolve_employee_id(db, user_id)` → force own data
- Supervisor → `resolve_employee(db, user_id)` → `get_department_employee_ids(db, emp.department_id, org_id)`
- Manager/Owner → no filter
```

เพิ่มใน HARD CONSTRAINTS:
```markdown
### 10. Data Scope
- HR endpoints ต้อง filter ตาม role: staff=ของตัวเอง, supervisor=แผนก, manager/owner=ทั้ง org
- ทุก endpoint ต้องมี org_id filter (multi-tenant) — ห้ามมี endpoint ที่ไม่ filter org_id
- ใช้ shared helpers จาก `app.api._helpers` — ห้าม duplicate logic
```

เพิ่มใน "Common Pitfalls":
```markdown
18. ❌ อย่าลืม data scope — HR endpoints ต้อง filter ตาม role ไม่ใช่แค่ permission
19. ❌ อย่าสร้าง endpoint ใหม่โดยไม่มี org_id filter
```

เพิ่มใน "Reference Files":
```markdown
| `backend/app/api/_helpers.py` | Shared data scope helpers (Phase 6) |
```

---

## Verification Checklist

ทดสอบผ่าน Swagger UI (`http://localhost:8000/docs`):

### ทดสอบ org_id filter (Step 2)
- [ ] Login org A → `GET /api/finance/reports` → ต้องไม่เห็นข้อมูล org B
- [ ] Login org A → `GET /api/planning/daily` → ต้องไม่เห็นข้อมูล org B
- [ ] Login org A → `GET /api/admin/audit-log` → ต้องเห็นเฉพาะ users ใน org A
- [ ] Login org A → `GET /api/hr/payroll/export` → ต้องไม่เห็นข้อมูล org B
- [ ] Login org A → `GET /api/hr/leave-balance` → ต้องไม่เห็นข้อมูล org B

### ทดสอบ role-based filter (Step 3-5)
- [ ] Login staff → `GET /api/hr/timesheet` → เห็นเฉพาะของตัวเอง
- [ ] Login staff → `GET /api/hr/leave` → เห็นเฉพาะของตัวเอง
- [ ] Login staff → `GET /api/hr/leave-balance` → เห็นเฉพาะของตัวเอง
- [ ] Login staff → `POST /api/hr/timesheet` ด้วย employee_id ของคนอื่น → 403
- [ ] Login staff → `POST /api/hr/leave` ด้วย employee_id ของคนอื่น → 403
- [ ] Login supervisor → `GET /api/hr/timesheet` → เห็นเฉพาะคนในแผนก
- [ ] Login supervisor → `GET /api/hr/employees` → เห็นเฉพาะคนในแผนก
- [ ] Login supervisor → `GET /api/hr/leave` → เห็นเฉพาะคนในแผนก
- [ ] Login manager → `GET /api/hr/timesheet` → เห็นทั้งหมดใน org
- [ ] Login owner → `GET /api/hr/timesheet` → เห็นทั้งหมดใน org

### ทดสอบ Edge Cases
- [ ] Employee ไม่มี department_id → supervisor เห็น empty list (ไม่ error)
- [ ] User ไม่มี Employee linked → staff เห็น empty list (ไม่ error)
- [ ] Permission ยังทำงานถูก: viewer ไม่มี hr.employee.read → ต้อง 403

---

## สรุปลำดับการทำ

```
Step 1: สร้าง _helpers.py (ไฟล์ใหม่)
   ↓
Step 2: แก้ org_id filter (finance → planning → admin → hr)
   ↓      ↑ แก้ service functions ควบคู่กัน
Step 3: Role filter — Timesheet (api + service)
   ↓
Step 4: Role filter — Leave + Balance (api + service)
   ↓
Step 5: Role filter — Employee (api + service)
   ↓
Step 6: Refactor daily_report.py + อัปเดต CLAUDE.md
```

**ข้อควรระวัง**:
- ทุก endpoint ต้อง `from app.core.config import DEFAULT_ORG_ID` เป็น fallback
- ห้ามลบ import ที่ยังใช้อยู่
- ห้ามเปลี่ยน API path/method — แก้แค่ภายใน function
- Test credentials: owner@sss-corp.com / owner123 (ดู CLAUDE.md)
- Dev server: `docker compose -f docker-compose.dev.yml up`

---

*End of Phase 6 Scope — Data Scope: Role-Based Data Visibility*
