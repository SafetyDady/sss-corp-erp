# Phase 5 — Definitive Implementation Plan

> **Author:** Manus AI | **Date:** 2026-02-27 | **Version:** 2.0 (Final)
> **Project:** SSS Corp ERP v1.0.0 → v1.1.0
> **Scope:** Daily Work Report + Staff Portal + Employee hire_date + WO ManHour UI + Fixes

---

## Table of Contents

1. [ภาพรวมและเป้าหมาย](#1-ภาพรวมและเป้าหมาย)
2. [Design Decisions (ตกลงแล้ว)](#2-design-decisions)
3. [Business Rules ใหม่ (BR#47-55)](#3-business-rules-ใหม่)
4. [ขั้นที่ 1 — Employee Model Upgrade + /me API](#4-ขั้นที่-1)
5. [ขั้นที่ 2 — Daily Work Report Backend](#5-ขั้นที่-2)
6. [ขั้นที่ 3 — Staff Portal Frontend](#6-ขั้นที่-3)
7. [ขั้นที่ 4 — Supervisor Approval Page](#7-ขั้นที่-4)
8. [ขั้นที่ 5 — WO ManHour Summary UI](#8-ขั้นที่-5)
9. [ขั้นที่ 6 — Sidebar + Routes Refactor](#9-ขั้นที่-6)
10. [ขั้นที่ 7 — แก้จุดค้าง Phase 4](#10-ขั้นที่-7)
11. [ขั้นที่ 8 — ทดสอบ End-to-End](#11-ขั้นที่-8)
12. [สรุปไฟล์ทั้งหมด](#12-สรุปไฟล์ทั้งหมด)
13. [ลำดับ Dependencies](#13-ลำดับ-dependencies)
14. [ประมาณเวลา](#14-ประมาณเวลา)

---

## 1. ภาพรวมและเป้าหมาย

Phase 5 แก้ปัญหาหลัก 4 ข้อ:

| ปัญหา | วิธีแก้ |
|---|---|
| Staff เข้าหน้า HR เห็นข้อมูลทุกคน | สร้าง **Staff Portal** — หน้าแยกเฉพาะ Staff เห็นแต่ของตัวเอง |
| ไม่มีระบบรายงานประจำวัน | สร้าง **Daily Work Report** — Staff กรอก → Supervisor อนุมัติ → บันทึก Timesheet + WO ManHour อัตโนมัติ |
| WO ไม่แสดงชั่วโมงแรงงานจริง | เพิ่ม **WO ManHour Summary** — แสดง Plan vs Actual + รายชื่อคนทำงาน |
| Employee ไม่มีวันเข้างาน | เพิ่ม **hire_date** + แสดงอายุงาน + โควต้าลา (HR กรอกเอง) |

---

## 2. Design Decisions

ตกลงแล้วทั้งหมด ไม่ต้องถามซ้ำ:

| หัวข้อ | ตัดสินใจ |
|---|---|
| Standard Timesheet | Auto-gen ทุกเดือน จ-ส 08:00-17:00 (8 ชม./วัน) ตาม `OrgWorkConfig` |
| Standard Timesheet อัปเดตจาก | ใบลา (อนุมัติแล้ว) → status=LEAVE_PAID/LEAVE_UNPAID, Daily Work Report (อนุมัติแล้ว) → เพิ่ม OT hours |
| วันไหนไม่กรอก Report | Standard Timesheet ยังเป็น 8 ชม. WORK ปกติ ไม่มี WO detail |
| Daily Work Report | กรอกทุกวัน แต่ไม่บังคับในระบบ กรอกย้อนหลังได้ หัวหน้าติดตามเอง |
| OT | ไม่ต้องขออนุมัติล่วงหน้า กรอกใน Report แล้ว Supervisor อนุมัติทีเดียว |
| Supervisor approve | หน้ารวมทุกคน กดอนุมัติรายคน หรือเลือกหลายคนอนุมัติทีเดียว |
| เสาร์ | 8 ชม. เหมือนวันปกติ (ตาม OrgWorkConfig.working_days) |
| อาทิตย์ | วันหยุด (ไม่ gen Standard Timesheet) |
| Staff เห็นหน้า HR เดิม | ไม่เห็น — ใช้ Staff Portal แทน |
| สิทธิ์ลา (Leave Balance) | HR กรอกเอง ไม่ auto-calculate จากอายุงาน |
| Payroll MONTHLY | จ่ายเต็มเดือน หักเฉพาะลาไม่รับเงิน + เพิ่ม OT |
| Payroll DAILY | จ่ายตามวันทำงานจริง (จาก Standard Timesheet) + OT |
| WO ManHour | ไม่เพิ่ม field ใน WorkOrder model คำนวณ on-the-fly จาก Timesheet |

---

## 3. Business Rules ใหม่

เพิ่มจาก BR#36-46 (Phase 4):

| # | Rule | Enforcement |
|---|---|---|
| **BR#47** | Payroll MONTHLY — จ่ายเต็มเดือน หักเฉพาะลาไม่รับเงิน + เพิ่ม OT | Payroll service calc |
| **BR#48** | Payroll DAILY — จ่ายตามวันทำงานจริง (Standard Timesheet status=WORK) × daily_rate + OT | Payroll service calc |
| **BR#49** | ถ้าไม่มี Daily Report → Standard Timesheet ยังเป็น WORK 8 ชม. → DAILY จ่ายตามนั้น | Default behavior |
| **BR#50** | Daily Work Report — 1 คน : 1 report ต่อ 1 วัน | DB UNIQUE(employee_id, report_date, org_id) |
| **BR#51** | Daily Work Report lines — เวลาห้าม overlap ในวันเดียวกัน | Service validation |
| **BR#52** | Daily Work Report approve → สร้าง/อัปเดต Timesheet (WO Time Entry) อัตโนมัติ | Service trigger |
| **BR#53** | Daily Work Report approve → อัปเดต Standard Timesheet เพิ่ม OT hours | Service trigger |
| **BR#54** | Daily Work Report — Staff แก้ไขได้เฉพาะ DRAFT หรือ REJECTED | Status check |
| **BR#55** | Employee hire_date — ต้องกรอกเมื่อสร้างพนักงาน อายุงานคำนวณจาก hire_date | Model required field |

---

## 4. ขั้นที่ 1 — Employee Model Upgrade + /me API

### 4.1 เพิ่ม hire_date ใน Employee Model

**ไฟล์:** `backend/app/models/hr.py`

```python
# เพิ่มใน class Employee หลัง is_active:
hire_date: Mapped[date | None] = mapped_column(
    Date, nullable=True  # nullable เพื่อรองรับข้อมูลเก่า, ใหม่ต้องกรอก
)
```

**เหตุผลที่ nullable=True:** พนักงานเก่าที่มีอยู่แล้วยังไม่มี hire_date ต้องให้ HR ไปกรอกทีหลัง ส่วน Frontend form ใหม่จะบังคับกรอก

### 4.2 อัปเดต Employee Schemas

**ไฟล์:** `backend/app/schemas/hr.py`

```python
# EmployeeCreate — เพิ่ม:
hire_date: Optional[date] = None  # Optional ใน API เพราะข้อมูลเก่า

# EmployeeUpdate — เพิ่ม:
hire_date: Optional[date] = None

# EmployeeResponse — เพิ่ม:
hire_date: Optional[date] = None
```

### 4.3 อัปเดต Frontend Employee Form

**ไฟล์:** `frontend/src/pages/hr/EmployeeFormModal.jsx`

เพิ่ม field:

| Field | Type | Label | Required | หมายเหตุ |
|---|---|---|---|---|
| `hire_date` | DatePicker | วันที่เข้างาน | ใช่ (สร้างใหม่) | แสดงอายุงาน auto-calc ข้างๆ |

แสดงอายุงาน (read-only):
```
วันที่เข้างาน: [2024-01-15]  อายุงาน: 2 ปี 1 เดือน 12 วัน
```

### 4.4 เพิ่ม employee_id ใน /me API

**ปัญหา:** Frontend ไม่รู้ว่า user ปัจจุบัน = employee คนไหน

**ไฟล์:** `backend/app/api/auth.py`

```python
# ใน function get_me():
# หลัง get user แล้ว query employee:
emp_result = await db.execute(
    select(Employee).where(
        Employee.user_id == current_user.id,
        Employee.is_active == True,
    )
)
employee = emp_result.scalar_one_or_none()

# return เพิ่ม:
return {
    ...existing_fields,
    "employee_id": str(employee.id) if employee else None,
    "employee_name": employee.full_name if employee else None,
    "employee_code": employee.employee_code if employee else None,
    "department_id": str(employee.department_id) if employee and employee.department_id else None,
    "hire_date": employee.hire_date.isoformat() if employee and employee.hire_date else None,
}
```

**ไฟล์:** `backend/app/schemas/auth.py`

```python
# UserMe schema เพิ่ม:
employee_id: Optional[UUID] = None
employee_name: Optional[str] = None
employee_code: Optional[str] = None
department_id: Optional[UUID] = None
hire_date: Optional[date] = None
```

### 4.5 Frontend เก็บ employee_id

**ไฟล์:** `frontend/src/stores/authStore.js`

```javascript
// ใน setUser หรือ login success:
// เก็บเพิ่ม:
employeeId: data.employee_id,
employeeName: data.employee_name,
employeeCode: data.employee_code,
departmentId: data.department_id,
hireDate: data.hire_date,
```

### 4.6 Migration

**ไฟล์ใหม่:** `backend/alembic/versions/l_employee_hire_date.py`

```sql
ALTER TABLE employees ADD COLUMN hire_date DATE;
```

---

### สรุปขั้นที่ 1

| ไฟล์ | Action | แก้อะไร |
|---|---|---|
| `backend/app/models/hr.py` | EDIT | เพิ่ม hire_date field ใน Employee |
| `backend/app/schemas/hr.py` | EDIT | เพิ่ม hire_date ใน Create/Update/Response |
| `backend/app/schemas/auth.py` | EDIT | เพิ่ม employee_id, employee_name, employee_code, department_id, hire_date ใน UserMe |
| `backend/app/api/auth.py` | EDIT | query Employee ใน get_me() แล้ว return เพิ่ม |
| `backend/alembic/versions/l_employee_hire_date.py` | NEW | Migration: ALTER TABLE employees ADD hire_date |
| `frontend/src/stores/authStore.js` | EDIT | เก็บ employeeId, employeeName, etc. |
| `frontend/src/pages/hr/EmployeeFormModal.jsx` | EDIT | เพิ่ม DatePicker วันเข้างาน + แสดงอายุงาน |

---

## 5. ขั้นที่ 2 — Daily Work Report Backend

### 5.1 Model ใหม่

**ไฟล์ใหม่:** `backend/app/models/daily_report.py`

#### DailyWorkReport

```python
class ReportStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class DailyWorkReport(Base, TimestampMixin, OrgMixin):
    """
    Daily work report: 1 report per employee per day.
    Staff กรอก → submit → Supervisor approve → auto-record Timesheet + WO ManHour.
    BR#50: UNIQUE(employee_id, report_date, org_id)
    BR#54: แก้ไขได้เฉพาะ DRAFT/REJECTED
    """
    __tablename__ = "daily_work_reports"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus, name="report_status_enum"), nullable=False, default=ReportStatus.DRAFT)
    
    # สรุปชั่วโมง (คำนวณจาก lines)
    total_regular_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    total_ot_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Submission
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Approval
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Audit
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    
    __table_args__ = (
        UniqueConstraint("employee_id", "report_date", "org_id", name="uq_daily_report_emp_date_org"),
        CheckConstraint("total_regular_hours >= 0", name="ck_daily_report_regular_positive"),
        CheckConstraint("total_ot_hours >= 0", name="ck_daily_report_ot_positive"),
        Index("ix_daily_reports_employee_date", "employee_id", "report_date"),
        Index("ix_daily_reports_status", "status"),
    )
```

#### DailyWorkReportLine

```python
class LineType(str, enum.Enum):
    REGULAR = "REGULAR"
    OT = "OT"

class DailyWorkReportLine(Base, TimestampMixin):
    """
    แต่ละบรรทัดของ Daily Work Report.
    เก็บ: ช่วงเวลา + WO + ชั่วโมง + ประเภท (ปกติ/OT)
    BR#51: เวลาห้าม overlap ในวันเดียวกัน
    """
    __tablename__ = "daily_work_report_lines"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("daily_work_reports.id", ondelete="CASCADE"), nullable=False)
    
    line_type: Mapped[LineType] = mapped_column(Enum(LineType, name="report_line_type_enum"), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)      # เช่น 08:00
    end_time: Mapped[time] = mapped_column(Time, nullable=False)        # เช่น 12:00
    
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_orders.id", ondelete="SET NULL"), nullable=True
    )  # nullable = งานทั่วไปที่ไม่ผูก WO
    
    hours: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)  # คำนวณจาก end-start
    
    ot_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ot_types.id", ondelete="SET NULL"), nullable=True
    )  # เฉพาะ OT lines
    
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    __table_args__ = (
        CheckConstraint("hours > 0", name="ck_report_line_hours_positive"),
        Index("ix_report_lines_report", "report_id"),
    )
```

### 5.2 Schemas ใหม่

**ไฟล์ใหม่:** `backend/app/schemas/daily_report.py`

```python
# --- Create ---
class DailyReportLineCreate(BaseModel):
    line_type: LineType                    # REGULAR / OT
    start_time: time                       # "08:00"
    end_time: time                         # "12:00"
    work_order_id: Optional[UUID] = None   # nullable = งานทั่วไป
    ot_type_id: Optional[UUID] = None      # เฉพาะ OT
    note: Optional[str] = None

class DailyReportCreate(BaseModel):
    report_date: date
    lines: list[DailyReportLineCreate]     # ต้องมีอย่างน้อย 1 line
    note: Optional[str] = None
    
    @field_validator("lines")
    @classmethod
    def validate_lines(cls, v):
        if not v:
            raise ValueError("ต้องมีอย่างน้อย 1 บรรทัด")
        return v

# --- Update ---
class DailyReportUpdate(BaseModel):
    lines: Optional[list[DailyReportLineCreate]] = None
    note: Optional[str] = None

# --- Response ---
class DailyReportLineResponse(BaseModel):
    id: UUID
    line_type: LineType
    start_time: time
    end_time: time
    work_order_id: Optional[UUID] = None
    wo_number: Optional[str] = None        # join แสดงเลข WO
    ot_type_id: Optional[UUID] = None
    ot_type_name: Optional[str] = None     # join แสดงชื่อ OT type
    hours: Decimal
    note: Optional[str] = None
    class Config:
        from_attributes = True

class DailyReportResponse(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: str                     # join แสดงชื่อ
    employee_code: str                     # join แสดงรหัส
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

# --- Approve/Reject ---
class BatchApproveRequest(BaseModel):
    report_ids: list[UUID]

class RejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
```

### 5.3 Service Layer

**ไฟล์ใหม่:** `backend/app/services/daily_report.py`

#### Functions:

| Function | รายละเอียด |
|---|---|
| `create_daily_report(db, employee_id, body, org_id, user_id)` | สร้าง report + lines, คำนวณ total hours, validate overlap (BR#51) |
| `update_daily_report(db, report_id, body, user_id)` | แก้ไขได้เฉพาะ DRAFT/REJECTED (BR#54), ลบ lines เก่า สร้างใหม่ |
| `submit_daily_report(db, report_id, user_id)` | DRAFT → SUBMITTED, บันทึก submitted_at |
| `approve_daily_report(db, report_id, approver_id)` | SUBMITTED → APPROVED, **trigger auto-record** |
| `batch_approve_daily_reports(db, report_ids, approver_id)` | loop approve ทีละ report |
| `reject_daily_report(db, report_id, approver_id, reason)` | SUBMITTED → REJECTED, บันทึก reject_reason |
| `list_daily_reports(db, filters, org_id)` | filter: employee_id, date_from, date_to, status |
| `get_daily_report(db, report_id)` | return report + lines + joins |

#### Validation Logic (create/update):

```python
async def validate_report_lines(lines: list, report_date: date):
    """
    BR#51: ตรวจเวลาห้าม overlap ในวันเดียวกัน
    """
    # แยก REGULAR กับ OT
    regular_lines = [l for l in lines if l.line_type == "REGULAR"]
    ot_lines = [l for l in lines if l.line_type == "OT"]
    
    # ตรวจ overlap ภายใน REGULAR
    for i, a in enumerate(regular_lines):
        for b in regular_lines[i+1:]:
            if a.start_time < b.end_time and b.start_time < a.end_time:
                raise ValueError(f"เวลาปกติ {a.start_time}-{a.end_time} ซ้อนกับ {b.start_time}-{b.end_time}")
    
    # ตรวจ overlap ภายใน OT
    for i, a in enumerate(ot_lines):
        for b in ot_lines[i+1:]:
            if a.start_time < b.end_time and b.start_time < a.end_time:
                raise ValueError(f"เวลา OT {a.start_time}-{a.end_time} ซ้อนกับ {b.start_time}-{b.end_time}")
    
    # คำนวณ hours จาก start-end
    for line in lines:
        delta = datetime.combine(report_date, line.end_time) - datetime.combine(report_date, line.start_time)
        line.hours = Decimal(str(delta.total_seconds() / 3600)).quantize(Decimal("0.01"))
        if line.hours <= 0:
            raise ValueError(f"เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม: {line.start_time}-{line.end_time}")
```

#### Auto-Record Logic (เมื่อ approve):

```python
async def auto_record_on_approve(db, report: DailyWorkReport):
    """
    BR#52: สร้าง/อัปเดต Timesheet (WO Time Entry) อัตโนมัติ
    BR#53: อัปเดต Standard Timesheet เพิ่ม OT hours
    
    เรียกเมื่อ Supervisor กดอนุมัติ
    """
    
    # ─── 1. สร้าง Timesheet records (WO Time Entry) ───
    # ลบ Timesheet เก่าที่สร้างจาก report นี้ (ถ้ามี — กรณี re-approve)
    await db.execute(
        delete(Timesheet).where(
            Timesheet.employee_id == report.employee_id,
            Timesheet.work_date == report.report_date,
            Timesheet.note.like(f"DailyReport#{report.id}%"),
        )
    )
    
    # Group lines by work_order_id
    wo_groups = {}
    for line in report.lines:
        if line.work_order_id:
            key = line.work_order_id
            if key not in wo_groups:
                wo_groups[key] = {"regular": Decimal("0"), "ot": Decimal("0"), "ot_type_id": None}
            if line.line_type == LineType.REGULAR:
                wo_groups[key]["regular"] += line.hours
            else:
                wo_groups[key]["ot"] += line.hours
                wo_groups[key]["ot_type_id"] = line.ot_type_id  # ใช้ OT type ล่าสุด
    
    # สร้าง Timesheet record ต่อ WO
    for wo_id, hours in wo_groups.items():
        ts = Timesheet(
            employee_id=report.employee_id,
            work_order_id=wo_id,
            work_date=report.report_date,
            regular_hours=hours["regular"],
            ot_hours=hours["ot"],
            ot_type_id=hours["ot_type_id"],
            status=TimesheetStatus.FINAL,  # approved แล้ว = FINAL เลย
            note=f"DailyReport#{report.id}",
            created_by=report.approved_by,
            org_id=report.org_id,
        )
        db.add(ts)
    
    # ─── 2. อัปเดต Standard Timesheet ───
    std_ts = await db.execute(
        select(StandardTimesheet).where(
            StandardTimesheet.employee_id == report.employee_id,
            StandardTimesheet.work_date == report.report_date,
        )
    )
    std_timesheet = std_ts.scalar_one_or_none()
    
    if std_timesheet:
        # อัปเดต: เพิ่ม OT hours (Standard Timesheet ปกติ = 8 ชม. WORK)
        # ไม่เปลี่ยน scheduled_hours (ยังเป็น 8)
        # ไม่เปลี่ยน actual_status (ยังเป็น WORK)
        # Note: OT hours ไม่ได้เก็บใน Standard Timesheet model ปัจจุบัน
        # → ต้องเพิ่ม field ot_hours ใน StandardTimesheet (ดูขั้นที่ 2.5)
        std_timesheet.ot_hours = report.total_ot_hours
    
    await db.flush()
```

### 5.4 เพิ่ม ot_hours ใน StandardTimesheet

**ปัญหา:** Standard Timesheet ปัจจุบันมีแค่ `scheduled_hours` (8 ชม.) กับ `actual_status` ไม่มีที่เก็บ OT

**ไฟล์:** `backend/app/models/hr.py`

```python
# เพิ่มใน class StandardTimesheet:
ot_hours: Mapped[Decimal] = mapped_column(
    Numeric(4, 2), nullable=False, default=Decimal("0.00")
)
# เพิ่มใน __table_args__:
CheckConstraint("ot_hours >= 0", name="ck_std_timesheet_ot_positive"),
```

**Migration:** รวมใน migration file เดียวกับ daily_report

### 5.5 API Endpoints

**ไฟล์ใหม่:** `backend/app/api/daily_report.py`

| # | Method | Path | Permission | ใครใช้ | ทำอะไร |
|---|---|---|---|---|---|
| 1 | `GET` | `/api/daily-report` | `hr.dailyreport.read` | Staff/Supervisor | ดูรายการ report (filter: employee_id, date_from, date_to, status) |
| 2 | `POST` | `/api/daily-report` | `hr.dailyreport.create` | Staff | สร้าง report ใหม่ (พร้อม lines) |
| 3 | `GET` | `/api/daily-report/{id}` | `hr.dailyreport.read` | Staff/Supervisor | ดูรายละเอียด report + lines |
| 4 | `PUT` | `/api/daily-report/{id}` | `hr.dailyreport.create` | Staff | แก้ไข report (เฉพาะ DRAFT/REJECTED) |
| 5 | `POST` | `/api/daily-report/{id}/submit` | `hr.dailyreport.create` | Staff | ส่งให้หัวหน้า (DRAFT → SUBMITTED) |
| 6 | `POST` | `/api/daily-report/{id}/approve` | `hr.dailyreport.approve` | Supervisor | อนุมัติ → trigger auto-record |
| 7 | `POST` | `/api/daily-report/batch-approve` | `hr.dailyreport.approve` | Supervisor | อนุมัติหลายคนทีเดียว |
| 8 | `POST` | `/api/daily-report/{id}/reject` | `hr.dailyreport.approve` | Supervisor | ปฏิเสธ + เหตุผล |

**Data Scope (สำคัญ):**

- **Staff** เรียก `GET /api/daily-report` → Backend **บังคับ filter** `employee_id = current_user.employee_id` (ดูได้เฉพาะของตัวเอง)
- **Supervisor** เรียก `GET /api/daily-report` → Backend filter `employee.department_id = current_user.department_id` (ดูได้เฉพาะลูกน้องในแผนก)
- **Manager/Owner** → ดูได้ทั้งหมด

### 5.6 Permissions ใหม่

**ไฟล์:** `backend/app/core/permissions.py`

| Permission | Owner | Manager | Supervisor | Staff | Viewer |
|---|---|---|---|---|---|
| `hr.dailyreport.create` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `hr.dailyreport.read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `hr.dailyreport.approve` | ✅ | ✅ | ✅ | ❌ | ❌ |

**Total permissions:** 105 → 108 (+3)

### 5.7 Register Router

**ไฟล์:** `backend/app/api/__init__.py`

```python
from .daily_report import daily_report_router
# เพิ่มใน all_routers:
(daily_report_router, "/api/daily-report", ["Daily Work Report"]),
```

### 5.8 Migration

**ไฟล์ใหม่:** `backend/alembic/versions/m_daily_work_report.py`

```sql
-- Table 1: daily_work_reports
CREATE TABLE daily_work_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    status report_status_enum NOT NULL DEFAULT 'DRAFT',
    total_regular_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_ot_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
    note TEXT,
    submitted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    reject_reason TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_daily_report_emp_date_org UNIQUE(employee_id, report_date, org_id)
);

-- Table 2: daily_work_report_lines
CREATE TABLE daily_work_report_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES daily_work_reports(id) ON DELETE CASCADE,
    line_type report_line_type_enum NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
    hours NUMERIC(4,2) NOT NULL,
    ot_type_id UUID REFERENCES ot_types(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_report_line_hours_positive CHECK (hours > 0)
);

-- Alter: standard_timesheets เพิ่ม ot_hours
ALTER TABLE standard_timesheets ADD COLUMN ot_hours NUMERIC(4,2) NOT NULL DEFAULT 0;
ALTER TABLE standard_timesheets ADD CONSTRAINT ck_std_timesheet_ot_positive CHECK (ot_hours >= 0);

-- Alter: employees เพิ่ม hire_date
ALTER TABLE employees ADD COLUMN hire_date DATE;

-- Indexes
CREATE INDEX ix_daily_reports_employee_date ON daily_work_reports(employee_id, report_date);
CREATE INDEX ix_daily_reports_status ON daily_work_reports(status);
CREATE INDEX ix_report_lines_report ON daily_work_report_lines(report_id);
```

---

### สรุปขั้นที่ 2

| ไฟล์ | Action | รายละเอียด |
|---|---|---|
| `backend/app/models/daily_report.py` | NEW | DailyWorkReport + DailyWorkReportLine models |
| `backend/app/schemas/daily_report.py` | NEW | Create/Update/Response/BatchApprove/Reject schemas |
| `backend/app/services/daily_report.py` | NEW | CRUD + validate + approve + auto-record logic |
| `backend/app/api/daily_report.py` | NEW | 8 API endpoints + data scope |
| `backend/app/api/__init__.py` | EDIT | Register daily_report_router |
| `backend/app/core/permissions.py` | EDIT | เพิ่ม 3 permissions (dailyreport.create/read/approve) |
| `backend/app/models/hr.py` | EDIT | เพิ่ม ot_hours ใน StandardTimesheet |
| `backend/alembic/versions/m_daily_work_report.py` | NEW | Migration: 2 tables + 2 ALTER |

---

## 6. ขั้นที่ 3 — Staff Portal Frontend

### 6.1 หน้า "รายงานประจำวัน" (`/my/daily-report`)

**ไฟล์ใหม่:** `frontend/src/pages/my/MyDailyReportPage.jsx`

**หน้าหลักที่ Staff ใช้ทุกวัน** — ฟังก์ชันครบ:

#### Layout:

```
┌──────────────────────────────────────────────────────────┐
│  📝 รายงานประจำวัน                                        │
│                                                           │
│  [◀ 26 ก.พ.] ── 27 กุมภาพันธ์ 2026 ── [28 ก.พ. ▶]       │
│  สถานะ: ⬤ ยังไม่ได้กรอก                                   │
│                                                           │
│  ── เวลาปกติ ──────────────────────────────────────────    │
│  │ #  │ เริ่ม    │ สิ้นสุด  │ Work Order       │ ชม.  │ ลบ │
│  │ 1  │ [08:00] │ [12:00] │ [WO-005 ซ่อมCNC▼] │ 4.00 │ 🗑 │
│  │ 2  │ [13:00] │ [16:00] │ [WO-008 ติดตั้ง▼]  │ 3.00 │ 🗑 │
│  │ 3  │ [16:00] │ [17:00] │ [WO-012 ตรวจสอบ▼] │ 1.00 │ 🗑 │
│  │                                    รวม: 8.00 ชม.      │
│  │ [+ เพิ่มบรรทัด]                                        │
│                                                           │
│  ── OT ────────────────────────────────────────────────    │
│  │ #  │ เริ่ม    │ สิ้นสุด  │ Work Order       │ OT Type    │ ชม.  │ ลบ │
│  │ 1  │ [17:30] │ [19:30] │ [WO-008 ติดตั้ง▼]  │ [วันธรรมดา▼]│ 2.00 │ 🗑 │
│  │                                              รวม: 2.00 ชม.     │
│  │ [+ เพิ่มบรรทัด]                                                 │
│                                                           │
│  หมายเหตุ: [____________________________________]         │
│                                                           │
│  ┌─────────────────────────────────────────────┐          │
│  │ สรุป: ปกติ 8.00 ชม. + OT 2.00 ชม. = 10.00 ชม.│         │
│  └─────────────────────────────────────────────┘          │
│                                                           │
│  [💾 บันทึกฉบับร่าง]         [📤 ส่งให้หัวหน้าอนุมัติ]     │
└──────────────────────────────────────────────────────────┘
```

#### Component Behavior:

| Element | Behavior |
|---|---|
| Date Picker | เลือกวันไหนก็ได้ (ย้อนหลังได้) ถ้าวันนั้นมี report แล้ว → โหลดมาแสดง |
| สถานะ badge | DRAFT (เทา), SUBMITTED (เหลือง), APPROVED (เขียว), REJECTED (แดง) |
| WO Dropdown | `GET /api/work-orders?status=IN_PROGRESS` — แสดงเฉพาะ WO ที่เปิดอยู่ |
| OT Type Dropdown | `GET /api/master/ot-types` — วันธรรมดา/วันหยุด/นักขัตฤกษ์ |
| ชม. (auto-calc) | คำนวณจาก end_time - start_time แสดง real-time |
| บันทึกฉบับร่าง | `POST /api/daily-report` (status=DRAFT) หรือ `PUT` ถ้ามีอยู่แล้ว |
| ส่งให้หัวหน้า | `POST /api/daily-report/{id}/submit` (DRAFT → SUBMITTED) |
| ถ้า SUBMITTED | ฟอร์ม read-only แสดงข้อความ "รอหัวหน้าอนุมัติ" |
| ถ้า APPROVED | ฟอร์ม read-only พื้นเขียว แสดงชื่อผู้อนุมัติ + วันที่ |
| ถ้า REJECTED | ฟอร์ม editable แสดงเหตุผลที่ปฏิเสธ (แดง) + ปุ่มส่งใหม่ |

#### API Calls:

```javascript
// โหลด report ของวันที่เลือก:
GET /api/daily-report?employee_id={myEmployeeId}&date_from={date}&date_to={date}

// สร้างใหม่:
POST /api/daily-report
Body: { report_date, lines: [{line_type, start_time, end_time, work_order_id, ot_type_id}], note }

// แก้ไข:
PUT /api/daily-report/{id}
Body: { lines: [...], note }

// ส่ง:
POST /api/daily-report/{id}/submit

// โหลด WO list สำหรับ dropdown:
GET /api/work-orders?status=IN_PROGRESS&limit=500

// โหลด OT types:
GET /api/master/ot-types
```

---

### 6.2 หน้า "ใบลาของฉัน" (`/my/leave`)

**ไฟล์ใหม่:** `frontend/src/pages/my/MyLeavePage.jsx`

#### Layout:

```
┌──────────────────────────────────────────────────────────┐
│  🏖️ ใบลาของฉัน                                           │
│                                                           │
│  ── โควต้าลาปี 2026 ──────────────────────────────────     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ พักร้อน   │ │ ลาป่วย   │ │ ลากิจ    │ │ ลาคลอด   │     │
│  │ 4/6 วัน  │ │ 2/30 วัน │ │ 0/3 วัน  │ │ 0/98 วัน │     │
│  │ ████░░   │ │ █░░░░░░  │ │ ░░░░░░░  │ │ ░░░░░░░  │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                           │
│  [+ ขอลาหยุด]                         ปี: [2026 ▼]       │
│                                                           │
│  ── ประวัติการลา ──────────────────────────────────────    │
│  │ วันที่         │ ประเภท   │ จำนวน │ สถานะ    │ เหตุผล  │
│  │ 15-16 ก.พ.    │ พักร้อน  │ 2 วัน │ ✅ อนุมัติ │ ท่องเที่ยว│
│  │ 10 ก.พ.       │ ลาป่วย   │ 1 วัน │ ✅ อนุมัติ │ ไม่สบาย │
│  │ 5 ม.ค.        │ พักร้อน  │ 2 วัน │ ✅ อนุมัติ │ ธุระ    │
│  │ 28 ก.พ.       │ ลากิจ    │ 1 วัน │ ⏳ รออนุมัติ│ ธุระ    │
│                                                           │
│  Filter: [ทั้งหมด ▼] [ทุกประเภท ▼]                        │
└──────────────────────────────────────────────────────────┘
```

#### Component Behavior:

| Element | Behavior |
|---|---|
| การ์ดโควต้า | `GET /api/hr/leave-balances?employee_id={myEmployeeId}&year=2026` |
| ปุ่ม "ขอลาหยุด" | เปิด LeaveFormModal แต่ **ซ่อน dropdown เลือกพนักงาน** lock เป็นตัวเอง |
| ตารางประวัติ | `GET /api/hr/leaves?employee_id={myEmployeeId}` |
| สี badge | PENDING=เหลือง, APPROVED=เขียว, REJECTED=แดง |

---

### 6.3 หน้า "Timesheet ของฉัน" (`/my/timesheet`)

**ไฟล์ใหม่:** `frontend/src/pages/my/MyTimesheetPage.jsx`

#### Layout:

```
┌──────────────────────────────────────────────────────────┐
│  ⏰ Timesheet ของฉัน                                      │
│                                                           │
│  [◀ ม.ค.] ── กุมภาพันธ์ 2026 ── [มี.ค. ▶]                │
│                                                           │
│  สรุป: ทำงาน 22 วัน | ลา 2 วัน | OT 12 ชม.               │
│                                                           │
│  │ วันที่  │ วัน │ สถานะ     │ ปกติ   │ OT    │ WO Detail          │
│  │ 01/02  │ จ  │ ✅ ทำงาน   │ 8 ชม.  │ 0     │ WO-005(4) WO-008(4)│
│  │ 02/02  │ อ  │ ✅ ทำงาน   │ 8 ชม.  │ 2 ชม. │ WO-008(8+2OT)      │
│  │ 03/02  │ พ  │ 🏥 ลาป่วย  │ 0      │ 0     │ —                   │
│  │ 04/02  │ พฤ │ ✅ ทำงาน   │ 8 ชม.  │ 0     │ WO-012(8)           │
│  │ ...    │    │           │        │       │                     │
│  │ 08/02  │ ส  │ ✅ ทำงาน   │ 8 ชม.  │ 0     │ WO-005(8)           │
│  │ 09/02  │ อา │ 🔴 หยุด    │ —      │ —     │ —                   │
│  │ ...    │    │           │        │       │                     │
│                                                           │
│  ── สรุปท้ายเดือน ──                                       │
│  ชั่วโมงปกติ: 176 ชม. | OT: 12 ชม. | ลา: 2 วัน            │
└──────────────────────────────────────────────────────────┘
```

#### Data Source:

```
Standard Timesheet: GET /api/hr/standard-timesheet?employee_id={myEmployeeId}&period_start=2026-02-01&period_end=2026-02-28
  → แสดง scheduled_hours, actual_status, ot_hours

WO Detail: GET /api/hr/timesheet?employee_id={myEmployeeId}&date_from=2026-02-01&date_to=2026-02-28
  → แสดง work_order_id + hours ต่อวัน (join WO number)
```

**Read-only** — ไม่มีปุ่มแก้ไข ข้อมูลมาจาก Daily Report + ใบลา

---

### 6.4 หน้า "งานของฉันวันนี้" (`/my/tasks`)

**ไฟล์ใหม่:** `frontend/src/pages/my/MyTasksPage.jsx`

#### Layout:

```
┌──────────────────────────────────────────────────────────┐
│  📌 งานของฉันวันนี้                                       │
│                                                           │
│  [◀ 26 ก.พ.] ── 27 กุมภาพันธ์ 2026 ── [28 ก.พ. ▶]       │
│                                                           │
│  ┌─────────────────────────────────────────┐              │
│  │ 🔧 WO-005 ซ่อมเครื่อง CNC               │              │
│  │ แผนก: ซ่อมบำรุง | สถานะ: IN_PROGRESS    │              │
│  │ วางแผน: 8 ชม.                           │              │
│  │ เครื่องมือ: ประแจ, สว่าน                  │              │
│  │ วัสดุ: สลักเกลียว x10, น้ำมัน x2         │              │
│  └─────────────────────────────────────────┘              │
│                                                           │
│  ┌─────────────────────────────────────────┐              │
│  │ 🔧 WO-008 ติดตั้งท่อ                     │              │
│  │ แผนก: ก่อสร้าง | สถานะ: IN_PROGRESS      │              │
│  │ วางแผน: 4 ชม.                           │              │
│  │ เครื่องมือ: เครื่องเชื่อม                  │              │
│  │ วัสดุ: ท่อ PVC x20                       │              │
│  └─────────────────────────────────────────┘              │
│                                                           │
│  ไม่มีงานวางแผนเพิ่มเติม                                   │
└──────────────────────────────────────────────────────────┘
```

#### Data Source:

```
GET /api/planning/daily-plans?date={today}&employee_id={myEmployeeId}
  → DailyPlan + DailyPlanWorker + DailyPlanTool + DailyPlanMaterial
  → join WorkOrder (wo_number, description, status)
```

---

### 6.5 Dashboard เวอร์ชัน Staff

**ไฟล์แก้:** `frontend/src/pages/DashboardPage.jsx`

เพิ่ม conditional rendering: ถ้า role=staff → แสดง Staff Dashboard

```
┌──────────────────────────────────────────────────────────┐
│  สวัสดี น้องมิ้นท์! (รหัส: EMP-001)                       │
│  แผนก: ซ่อมบำรุง | อายุงาน: 2 ปี 1 เดือน                  │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Report    │ │ วันลาเหลือ│ │ งานวันนี้ │ │ คำขอรอ   │     │
│  │ วันนี้    │ │          │ │          │ │ อนุมัติ   │     │
│  │ ❌ ยังไม่  │ │ 4 วัน    │ │ 2 WO    │ │ 1 ใบลา   │     │
│  │ กรอก     │ │ พักร้อน   │ │          │ │          │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                           │
│  ── ปุ่มลัด ──                                             │
│  [📝 กรอก Report วันนี้]  [🏖️ ขอลา]  [📌 ดูงานวันนี้]     │
│                                                           │
│  ── Report ล่าสุด ──                                       │
│  │ 26 ก.พ. │ 8+2 OT ชม. │ 3 WO │ ✅ APPROVED │           │
│  │ 25 ก.พ. │ 8+0 OT ชม. │ 2 WO │ ✅ APPROVED │           │
│  │ 24 ก.พ. │ 8+3 OT ชม. │ 1 WO │ ⏳ SUBMITTED│           │
└──────────────────────────────────────────────────────────┘
```

#### API Calls:

```javascript
// ข้อมูลพนักงาน: จาก authStore (employee_name, hire_date, department_id)
// Report วันนี้: GET /api/daily-report?employee_id={me}&date_from={today}&date_to={today}
// วันลาเหลือ: GET /api/hr/leave-balances?employee_id={me}&year=2026
// งานวันนี้: GET /api/planning/daily-plans?date={today}&employee_id={me}
// คำขอรออนุมัติ: GET /api/hr/leaves?employee_id={me}&status=PENDING
// Report ล่าสุด: GET /api/daily-report?employee_id={me}&limit=5
```

---

### สรุปขั้นที่ 3

| ไฟล์ | Action | รายละเอียด |
|---|---|---|
| `frontend/src/pages/my/MyDailyReportPage.jsx` | NEW | Staff กรอก Daily Work Report |
| `frontend/src/pages/my/MyLeavePage.jsx` | NEW | ใบลาของฉัน + โควต้า |
| `frontend/src/pages/my/MyTimesheetPage.jsx` | NEW | Timesheet ของฉัน (read-only) |
| `frontend/src/pages/my/MyTasksPage.jsx` | NEW | งานวันนี้จาก Daily Plan |
| `frontend/src/pages/DashboardPage.jsx` | EDIT | เพิ่ม Staff Dashboard version |

---

## 7. ขั้นที่ 4 — Supervisor Approval Page

**ไฟล์ใหม่:** `frontend/src/pages/hr/DailyReportApprovalTab.jsx`

#### Layout:

```
┌──────────────────────────────────────────────────────────┐
│  ✅ อนุมัติรายงานประจำวัน                                   │
│                                                           │
│  วันที่: [◀ 26 ก.พ.] ── 27 ก.พ. 2026 ── [28 ก.พ. ▶]     │
│  Filter: [ทุกสถานะ ▼]                                     │
│                                                           │
│  ☐ เลือกทั้งหมด (เฉพาะ SUBMITTED)                          │
│                                                           │
│  ┌─ ☐ น้องมิ้นท์ (EMP-001) ──────────── SUBMITTED ──┐     │
│  │  ปกติ 8.00 ชม. | OT 2.00 ชม. | 3 WO              │     │
│  │  ▼ รายละเอียด                                      │     │
│  │  │ 08:00-12:00 │ WO-005 ซ่อม CNC    │ ปกติ │ 4 ชม.│     │
│  │  │ 13:00-16:00 │ WO-008 ติดตั้งท่อ   │ ปกติ │ 3 ชม.│     │
│  │  │ 16:00-17:00 │ WO-012 ตรวจสอบ     │ ปกติ │ 1 ชม.│     │
│  │  │ 17:30-19:30 │ WO-008 ติดตั้งท่อ   │ OT   │ 2 ชม.│     │
│  └───────────────────────────────────────────────────┘     │
│                                                           │
│  ┌─ ☐ พี่สมชาย (EMP-002) ──────────── SUBMITTED ──┐      │
│  │  ปกติ 8.00 ชม. | OT 0 ชม. | 2 WO                │      │
│  │  ▶ รายละเอียด (collapsed)                         │      │
│  └───────────────────────────────────────────────────┘     │
│                                                           │
│  ┌─ ✅ น้องเจน (EMP-003) ──────────── APPROVED ────┐      │
│  │  ปกติ 8.00 ชม. | OT 3.00 ชม. | 1 WO             │      │
│  │  อนุมัติโดย: หัวหน้าวิชัย | 27 ก.พ. 10:30         │      │
│  └───────────────────────────────────────────────────┘     │
│                                                           │
│  [✅ อนุมัติที่เลือก (2)]    [❌ ปฏิเสธที่เลือก]            │
└──────────────────────────────────────────────────────────┘
```

#### Component Behavior:

| Element | Behavior |
|---|---|
| Date picker | เลือกวันที่ดู default=วันนี้ |
| Checkbox "เลือกทั้งหมด" | เลือกเฉพาะ SUBMITTED (ไม่เลือก APPROVED/REJECTED) |
| Expand/Collapse | กดดูรายละเอียด lines ของแต่ละคน |
| อนุมัติที่เลือก | `POST /api/daily-report/batch-approve` body: {report_ids: [...]} |
| ปฏิเสธที่เลือก | เปิด modal ใส่เหตุผล → `POST /api/daily-report/{id}/reject` ทีละ report |
| APPROVED row | แสดงสีเขียวอ่อน + ชื่อผู้อนุมัติ + เวลา |
| REJECTED row | แสดงสีแดงอ่อน + เหตุผล |

#### API Calls:

```javascript
// โหลด reports ของลูกน้อง:
GET /api/daily-report?date_from={date}&date_to={date}
// (Backend auto-filter ตาม department ของ Supervisor)

// อนุมัติ batch:
POST /api/daily-report/batch-approve
Body: { report_ids: ["uuid1", "uuid2"] }

// ปฏิเสธ:
POST /api/daily-report/{id}/reject
Body: { reason: "ชั่วโมง OT ไม่ตรงกับที่ตกลง" }
```

**ไฟล์แก้:** `frontend/src/pages/hr/HRPage.jsx`

เพิ่ม tab "อนุมัติรายงาน" (แสดงเฉพาะ Supervisor/Manager/Owner):

```javascript
// เพิ่มใน tabs array:
{ key: 'daily-report-approval', label: 'อนุมัติรายงาน', permission: 'hr.dailyreport.approve', component: DailyReportApprovalTab }
```

---

### สรุปขั้นที่ 4

| ไฟล์ | Action | รายละเอียด |
|---|---|---|
| `frontend/src/pages/hr/DailyReportApprovalTab.jsx` | NEW | Supervisor อนุมัติ/ปฏิเสธ + batch approve |
| `frontend/src/pages/hr/HRPage.jsx` | EDIT | เพิ่ม tab "อนุมัติรายงาน" |

---

## 8. ขั้นที่ 5 — WO ManHour Summary UI

### 5.1 Backend API ใหม่

**ไฟล์แก้:** `backend/app/api/workorder.py`

เพิ่ม endpoint:

```python
@wo_router.get("/{wo_id}/manhour-summary")
async def api_manhour_summary(wo_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Return:
    - planned_manhours: จาก WOMasterPlan.total_manhours
    - actual_manhours: Σ(regular_hours + ot_hours) จาก Timesheet ที่ work_order_id = wo_id
    - remaining: planned - actual
    - progress_pct: actual / planned * 100
    - workers: [{employee_name, employee_code, work_date, regular_hours, ot_hours, total}]
    """
```

**ไฟล์แก้:** `backend/app/services/workorder.py`

เพิ่ม function:

```python
async def get_manhour_summary(db: AsyncSession, wo_id: UUID) -> dict:
    # 1. Get planned manhours from WOMasterPlan
    plan_result = await db.execute(
        select(WOMasterPlan).where(WOMasterPlan.work_order_id == wo_id)
    )
    plan = plan_result.scalar_one_or_none()
    planned = plan.total_manhours if plan else Decimal("0")
    
    # 2. Get actual from Timesheet (FINAL status)
    ts_result = await db.execute(
        select(
            Timesheet.employee_id,
            Employee.full_name,
            Employee.employee_code,
            Timesheet.work_date,
            Timesheet.regular_hours,
            Timesheet.ot_hours,
        ).join(Employee, Timesheet.employee_id == Employee.id)
        .where(
            Timesheet.work_order_id == wo_id,
            Timesheet.status == TimesheetStatus.FINAL,
        )
        .order_by(Timesheet.work_date.desc())
    )
    rows = ts_result.all()
    
    actual = sum(r.regular_hours + r.ot_hours for r in rows)
    remaining = planned - actual
    progress_pct = (actual / planned * 100) if planned > 0 else 0
    
    workers = [
        {
            "employee_name": r.full_name,
            "employee_code": r.employee_code,
            "work_date": r.work_date.isoformat(),
            "regular_hours": float(r.regular_hours),
            "ot_hours": float(r.ot_hours),
            "total_hours": float(r.regular_hours + r.ot_hours),
        }
        for r in rows
    ]
    
    return {
        "planned_manhours": float(planned),
        "actual_manhours": float(actual),
        "remaining_manhours": float(remaining),
        "progress_pct": round(float(progress_pct), 1),
        "workers": workers,
    }
```

### 5.2 Frontend WO Detail — เพิ่ม ManHour Section

**ไฟล์แก้:** `frontend/src/pages/workorder/WorkOrderDetailPage.jsx`

เพิ่ม section ใต้ Cost Summary:

```
┌──────────────────────────────────────────────────────────┐
│  👷 ManHour Summary                                       │
│                                                           │
│  แผน (Plan):      120.00 ชม.                              │
│  ใช้จริง (Actual): 87.50 ชม.                               │
│  คงเหลือ:          32.50 ชม.                               │
│  [████████████████████░░░░░░] 72.9%                       │
│                                                           │
│  ── รายละเอียดแรงงาน ──                                    │
│  │ พนักงาน      │ วันที่     │ ปกติ   │ OT    │ รวม    │   │
│  │ มิ้นท์ EMP-001│ 27/02/26  │ 4.00  │ 2.00  │ 6.00  │   │
│  │ มิ้นท์ EMP-001│ 26/02/26  │ 8.00  │ 0.00  │ 8.00  │   │
│  │ สมชาย EMP-002│ 27/02/26  │ 8.00  │ 0.00  │ 8.00  │   │
│  │ สมชาย EMP-002│ 26/02/26  │ 8.00  │ 0.00  │ 8.00  │   │
│  │ ...          │           │       │       │       │   │
│  │                                    รวม: 87.50 ชม. │   │
└──────────────────────────────────────────────────────────┘
```

#### API Call:

```javascript
GET /api/work-orders/{woId}/manhour-summary
```

---

### สรุปขั้นที่ 5

| ไฟล์ | Action | รายละเอียด |
|---|---|---|
| `backend/app/services/workorder.py` | EDIT | เพิ่ม get_manhour_summary() |
| `backend/app/api/workorder.py` | EDIT | เพิ่ม GET /{wo_id}/manhour-summary |
| `frontend/src/pages/workorder/WorkOrderDetailPage.jsx` | EDIT | เพิ่ม ManHour Summary section + workers table |

---

## 9. ขั้นที่ 6 — Sidebar + Routes Refactor

**ไฟล์แก้:** `frontend/src/App.jsx`

### 6.1 Sidebar แยกตาม Role

```javascript
// Staff เห็น:
const staffMenuItems = [
  // ── ของฉัน ──
  { key: '/my/daily-report', icon: <ClipboardEdit />, label: 'รายงานประจำวัน' },
  { key: '/my/leave',        icon: <CalendarOff />,   label: 'ใบลาของฉัน' },
  { key: '/my/timesheet',    icon: <Clock />,         label: 'Timesheet ของฉัน' },
  { key: '/my/tasks',        icon: <ListTodo />,      label: 'งานของฉันวันนี้' },
  // ── ระบบงาน (ตาม permission เดิม) ──
  ...existingMenuItems.filter(item => hasPermission(item.permission)),
];

// Supervisor/Manager/Owner เห็น:
// เมนูเดิมทั้งหมด (ไม่เปลี่ยน)
// + HR เพิ่ม tab "อนุมัติรายงาน"
```

### 6.2 Routes ใหม่

```javascript
// เพิ่มใน Routes:
<Route path="/my/daily-report" component={MyDailyReportPage} />
<Route path="/my/leave" component={MyLeavePage} />
<Route path="/my/timesheet" component={MyTimesheetPage} />
<Route path="/my/tasks" component={MyTasksPage} />
```

### 6.3 Sidebar Section Header

เพิ่ม section divider ใน sidebar:

```
── ของฉัน ──
  📝 รายงานประจำวัน
  🏖️ ใบลาของฉัน
  ⏰ Timesheet ของฉัน
  📌 งานของฉันวันนี้

── ระบบงาน ──
  📊 Dashboard
  📦 Inventory
  ...
```

**หมายเหตุ:** Supervisor/Manager/Owner ก็เห็นเมนู "ของฉัน" ด้วย (ทุกคนกรอก Daily Report ได้) แต่จะเห็นเมนู HR + Admin เพิ่มด้วย

---

### สรุปขั้นที่ 6

| ไฟล์ | Action | รายละเอียด |
|---|---|---|
| `frontend/src/App.jsx` | EDIT | เพิ่ม routes /my/* + sidebar section "ของฉัน" + แสดงตาม role |

---

## 10. ขั้นที่ 7 — แก้จุดค้าง Phase 4

| # | งาน | ไฟล์ | รายละเอียด |
|---|---|---|---|
| 7.1 | LeaveTab แสดงชื่อแทน UUID | `frontend/src/pages/hr/LeaveTab.jsx` | join employee_name, leave_type_name ใน response |
| 7.2 | LeaveTab สี dynamic | `frontend/src/pages/hr/LeaveTab.jsx` | สี badge ตาม leave_type.code (ANNUAL=ฟ้า, SICK=แดง, PERSONAL=ส้ม, MATERNITY=ชมพู, UNPAID=เทา) |
| 7.3 | Leave Balance Tab (HR) | `frontend/src/pages/hr/HRPage.jsx` + `LeaveBalanceTab.jsx` (NEW) | Tab ให้ HR ดู/แก้ไขโควต้าลาทุกคน ทุกประเภท ทุกปี |
| 7.4 | WO Master Plan UI | `frontend/src/pages/workorder/WorkOrderDetailPage.jsx` + `MasterPlanSection.jsx` (NEW) | Section แสดง/แก้ไข Master Plan (planned_start, planned_end, total_manhours, lines) |
| 7.5 | Standard Timesheet generate ปุ่ม | `frontend/src/pages/hr/StandardTimesheetView.jsx` | เพิ่มปุ่ม "Generate" เรียก `POST /api/hr/standard-timesheet/generate` |
| 7.6 | Setup Wizard guard | `backend/app/api/setup.py` | ตรวจว่ามี org แล้ว → redirect ไม่ให้สร้างซ้ำ |

---

### สรุปขั้นที่ 7

| ไฟล์ | Action | รายละเอียด |
|---|---|---|
| `frontend/src/pages/hr/LeaveTab.jsx` | EDIT | ชื่อแทน UUID + สี dynamic |
| `frontend/src/pages/hr/LeaveBalanceTab.jsx` | NEW | HR ดู/แก้ไขโควต้าลา |
| `frontend/src/pages/hr/HRPage.jsx` | EDIT | เพิ่ม tab Leave Balance |
| `frontend/src/pages/workorder/MasterPlanSection.jsx` | NEW | WO Master Plan UI |
| `frontend/src/pages/workorder/WorkOrderDetailPage.jsx` | EDIT | เพิ่ม MasterPlanSection |
| `frontend/src/pages/hr/StandardTimesheetView.jsx` | EDIT | เพิ่มปุ่ม Generate |
| `backend/app/api/setup.py` | EDIT | Guard ป้องกันสร้าง org ซ้ำ |

---

## 11. ขั้นที่ 8 — ทดสอบ End-to-End

### Test Scenarios:

| # | Scenario | Steps | Expected Result |
|---|---|---|---|
| T1 | Staff กรอก Daily Report | Login Staff → /my/daily-report → กรอก 3 บรรทัดปกติ + 1 OT → บันทึก → ส่ง | Report status = SUBMITTED |
| T2 | Supervisor อนุมัติ | Login Supervisor → HR → อนุมัติรายงาน → เลือก 2 คน → อนุมัติ | Reports status = APPROVED |
| T3 | ตรวจ Timesheet auto-record | ดู Timesheet (WO Time Entry) ของ Staff | มี records ใหม่ตาม WO ที่กรอก, status=FINAL |
| T4 | ตรวจ Standard Timesheet | ดู Standard Timesheet ของ Staff | ot_hours อัปเดตตาม Report |
| T5 | ตรวจ WO ManHour | ดู WO Detail → ManHour Summary | actual_manhours เพิ่มตาม Report |
| T6 | Staff ขอลา | Login Staff → /my/leave → ขอลา → ดูโควต้า | ใบลาสร้างสำเร็จ, โควต้าแสดงถูก |
| T7 | ลาอนุมัติ → Timesheet | Supervisor อนุมัติใบลา → ดู Standard Timesheet | วันลา = LEAVE_PAID/LEAVE_UNPAID |
| T8 | Staff Dashboard | Login Staff → Dashboard | แสดง: Report วันนี้, วันลาเหลือ, งานวันนี้ |
| T9 | Supervisor ปฏิเสธ | Supervisor ปฏิเสธ Report + เหตุผล | Staff เห็น REJECTED + เหตุผล + แก้ไขได้ |
| T10 | Staff แก้ไข + ส่งใหม่ | Staff แก้ Report ที่ถูกปฏิเสธ → ส่งใหม่ | Report status = SUBMITTED อีกครั้ง |
| T11 | Batch approve | Supervisor เลือก 3 คน → อนุมัติทีเดียว | ทั้ง 3 reports = APPROVED |
| T12 | Overlap validation | Staff กรอก 08:00-12:00 + 11:00-15:00 | Error: เวลาซ้อนกัน |
| T13 | Manager ไม่กระทบ | Login Manager → ทุกหน้าเดิมทำงานปกติ | ไม่มี regression |
| T14 | Employee hire_date | HR สร้างพนักงานใหม่ → กรอก hire_date | แสดงอายุงาน ถูกต้อง |
| T15 | WO ManHour Progress | ดู WO ที่มี Master Plan + Timesheet | Progress bar แสดง % ถูกต้อง |

---

## 12. สรุปไฟล์ทั้งหมด

### ไฟล์ใหม่ (13 ไฟล์)

| # | ไฟล์ | ขั้นที่ | หน้าที่ |
|---|---|---|---|
| 1 | `backend/app/models/daily_report.py` | 2 | DailyWorkReport + Lines models |
| 2 | `backend/app/schemas/daily_report.py` | 2 | Pydantic schemas |
| 3 | `backend/app/services/daily_report.py` | 2 | CRUD + validate + approve + auto-record |
| 4 | `backend/app/api/daily_report.py` | 2 | 8 API endpoints |
| 5 | `backend/alembic/versions/m_daily_work_report.py` | 2 | Migration (2 tables + 2 ALTER) |
| 6 | `frontend/src/pages/my/MyDailyReportPage.jsx` | 3 | Staff กรอก Daily Report |
| 7 | `frontend/src/pages/my/MyLeavePage.jsx` | 3 | ใบลาของฉัน + โควต้า |
| 8 | `frontend/src/pages/my/MyTimesheetPage.jsx` | 3 | Timesheet ของฉัน (read-only) |
| 9 | `frontend/src/pages/my/MyTasksPage.jsx` | 3 | งานวันนี้จาก Daily Plan |
| 10 | `frontend/src/pages/hr/DailyReportApprovalTab.jsx` | 4 | Supervisor อนุมัติ/ปฏิเสธ |
| 11 | `frontend/src/pages/hr/LeaveBalanceTab.jsx` | 7 | HR ดู/แก้ไขโควต้าลา |
| 12 | `frontend/src/pages/workorder/MasterPlanSection.jsx` | 7 | WO Master Plan UI |
| 13 | `frontend/src/pages/my/MyDailyReportPage.jsx` | 3 | (listed above) |

### ไฟล์แก้ไข (13 ไฟล์)

| # | ไฟล์ | ขั้นที่ | แก้อะไร |
|---|---|---|---|
| 1 | `backend/app/models/hr.py` | 1,2 | Employee +hire_date, StandardTimesheet +ot_hours |
| 2 | `backend/app/schemas/hr.py` | 1 | Employee schemas +hire_date |
| 3 | `backend/app/schemas/auth.py` | 1 | UserMe +employee_id, employee_name, etc. |
| 4 | `backend/app/api/auth.py` | 1 | /me query Employee |
| 5 | `backend/app/api/__init__.py` | 2 | Register daily_report router |
| 6 | `backend/app/core/permissions.py` | 2 | +3 permissions (dailyreport.*) |
| 7 | `backend/app/services/workorder.py` | 5 | +get_manhour_summary() |
| 8 | `backend/app/api/workorder.py` | 5 | +GET manhour-summary endpoint |
| 9 | `backend/app/api/setup.py` | 7 | Guard ป้องกันสร้าง org ซ้ำ |
| 10 | `frontend/src/stores/authStore.js` | 1 | เก็บ employeeId, etc. |
| 11 | `frontend/src/pages/hr/EmployeeFormModal.jsx` | 1 | +DatePicker hire_date |
| 12 | `frontend/src/App.jsx` | 6 | Sidebar + routes /my/* |
| 13 | `frontend/src/pages/DashboardPage.jsx` | 3 | Staff Dashboard version |
| 14 | `frontend/src/pages/hr/HRPage.jsx` | 4,7 | +tab อนุมัติรายงาน + Leave Balance |
| 15 | `frontend/src/pages/hr/LeaveTab.jsx` | 7 | ชื่อแทน UUID + สี dynamic |
| 16 | `frontend/src/pages/workorder/WorkOrderDetailPage.jsx` | 5,7 | +ManHour Summary + MasterPlan |
| 17 | `frontend/src/pages/hr/StandardTimesheetView.jsx` | 7 | +ปุ่ม Generate |

**รวม: ~13 ไฟล์ใหม่ + ~17 ไฟล์แก้ไข = ~30 ไฟล์**

---

## 13. ลำดับ Dependencies

```
ขั้น 1: Employee hire_date + /me API (MUST FIRST)
  │  ทุกอย่างต้องรู้ว่า "ฉัน = employee คนไหน"
  │
  ├──→ ขั้น 2: Daily Report Backend (Model + API + Auto-record)
  │      │  ต้องมี API พร้อมก่อน Frontend
  │      │
  │      ├──→ ขั้น 3: Staff Portal Frontend (4 หน้า + Dashboard)
  │      │      ต้องมี API daily-report + leave-balance + standard-timesheet
  │      │
  │      └──→ ขั้น 4: Supervisor Approval Page
  │             ต้องมี API daily-report approve/reject
  │
  ├──→ ขั้น 5: WO ManHour Summary (Backend + Frontend)
  │      ต้องมี Timesheet records จาก auto-record (ขั้น 2)
  │
  └──→ ขั้น 6: Sidebar + Routes (ทำพร้อมขั้น 3 ได้)
         ต้องมี pages ใหม่พร้อม

ขั้น 7: แก้จุดค้าง (ไม่ depend ใคร — ทำเมื่อไหร่ก็ได้)

ขั้น 8: ทดสอบ (ทำหลังสุด)
```

### แนะนำลำดับทำงาน:

```
วันที่ 1: ขั้น 1 (1 ชม.) → ขั้น 2 (6-8 ชม.)
วันที่ 2: ขั้น 3 (6-8 ชม.)
วันที่ 3: ขั้น 4 (2-3 ชม.) → ขั้น 5 (2-3 ชม.) → ขั้น 6 (1-2 ชม.)
วันที่ 4: ขั้น 7 (3-4 ชม.) → ขั้น 8 (2-3 ชม.)
```

---

## 14. ประมาณเวลา

| ขั้นที่ | งาน | ฝั่ง | เวลา |
|---|---|---|---|
| 1 | Employee hire_date + /me API | Backend + Frontend | 1-2 ชม. |
| 2 | Daily Report Backend (Model + API + Logic) | Backend | 6-8 ชม. |
| 3 | Staff Portal (4 หน้า + Dashboard) | Frontend | 6-8 ชม. |
| 4 | Supervisor Approval Page | Frontend | 2-3 ชม. |
| 5 | WO ManHour Summary (API + UI) | Backend + Frontend | 2-3 ชม. |
| 6 | Sidebar + Routes | Frontend | 1-2 ชม. |
| 7 | แก้จุดค้าง Phase 4 (6 items) | ทั้งคู่ | 3-4 ชม. |
| 8 | ทดสอบ E2E (15 scenarios) | ทั้งคู่ | 2-3 ชม. |
| **รวม** | | | **~23-33 ชม.** |

---

*Phase 5 Definitive Implementation Plan v2.0 — 2026-02-27*
*SSS Corp ERP — SSS Intelligence & Solutions Co., Ltd.*
