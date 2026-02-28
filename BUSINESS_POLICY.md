# SSS Corp ERP — BUSINESS POLICY (Source of Truth)

Updated: 2026-02-28 | Based on SmartERP Master Document v2 + Phase 4-5 additions

---

## Hard Constraints (ห้ามฝ่าฝืนเด็ดขาด)

1. **Permission format:** `module.resource.action` (3-part เสมอ)
2. **Action set — 7 ตัว:** `create / read / update / delete / approve / export / execute`
3. **Module set — 11 ตัว:** `inventory / warehouse / workorder / purchasing / sales / finance / master / admin / customer / tools / hr`
4. **Explicit allow only** — ไม่มี implicit, wildcard, inheritance
5. **Stock movements เป็น immutable** — REVERSAL เท่านั้น
6. **Job Costing 4 components:** Material + ManHour + Tools Recharge + Admin Overhead
7. **Timesheet:** ชั่วโมงเดียวกัน = 1 WO เท่านั้น (ห้าม overlap)
8. **Timesheet Lock Period:** กรอกย้อนหลัง ≤ 7 วัน; HR unlock ก่อนแก้
9. **Special OT Factor ≤ Maximum Ceiling** ที่ Admin กำหนดใน Master Data
10. **Financial fields ใช้ Numeric(12,2)** — ห้ามใช้ Float

---

## Job Costing Formula

```
WO Total Cost
├── Material Cost    = CONSUME qty × unit_cost
├── ManHour Cost     = (Regular hrs + OT hrs × OT Factor) × Employee Rate
├── Tools Recharge   = Check-out Hours × Tool Rate (บาท/ชม.)
└── Admin Overhead   = ManHour Cost × Overhead Rate %
```

## Timesheet Flow

```
พนักงานกรอก (hr.timesheet.create)
  → Supervisor approve (hr.timesheet.approve)
  → HR final (hr.timesheet.execute)
  → Auto charge เข้า WO
```

## OT Types

| Type | Default Factor | Editable |
|------|---------------|----------|
| วันธรรมดา | 1.5x | Admin ปรับได้ |
| วันหยุด | 2.0x | Admin ปรับได้ |
| นักขัตฤกษ์ | 3.0x | Admin ปรับได้ |
| Special | กรอกเอง | ≤ Max Ceiling |

## Stock Movement Types

| Type | Effect | Immutable |
|------|--------|-----------|
| RECEIVE | +stock | ✅ |
| ISSUE | -stock | ✅ |
| TRANSFER | move between locations | ✅ |
| ADJUST | correction (+ or -) | ✅ |
| REVERSAL | undo previous movement | ✅ |

---

## Roles (5 roles)

| Role | Permissions | Notes |
|------|------------|-------|
| owner | ALL 108 | Full access (89 original + 16 Phase 4 + 3 Phase 5) |
| manager | ~60 | No admin.*, no *.delete + planning create/update |
| supervisor | ~44 | Read + approve + limited create + planning read |
| staff | ~31 | Read + own create (timesheet, leave, movement, dailyreport) |
| viewer | ~18 | Read + selected export only |

### New Permissions (Phase 4 — 16 added)

| Permission Group | Count | Details |
|-----------------|:-----:|---------|
| master.department.* | 4 | create / read / update / delete |
| master.leavetype.* | 4 | create / read / update / delete |
| admin.config.* | 2 | read / update (Org + Work + Approval config) |
| workorder.plan.* | 4 | create / read / update / delete (Master + Daily Plan) |
| workorder.reservation.* | 2 | create / read (Material + Tool reservation) |

### New Permissions (Phase 5 — 3 added)

| Permission Group | Count | Details |
|-----------------|:-----:|---------|
| hr.dailyreport.* | 3 | create / read / approve |

---

## Business Rules — Phase 4 Additions (BR#36-46)

### Leave Rules

| # | Rule | Enforcement |
|---|------|-------------|
| 36 | ลาเกินโควต้าไม่ได้ (used + days_count <= quota) | Service check |
| 37 | ลาได้เงิน → Timesheet วันนั้น = 8 ชม. ปกติ (payroll เต็ม) | Auto calc |
| 38 | ลาไม่ได้เงิน → Timesheet วันนั้น = 0 ชม. (หัก payroll) | Auto calc |
| 39 | วันลา → ห้ามกรอก WO Time Entry | Service check |

### Planning Rules

| # | Rule | Enforcement |
|---|------|-------------|
| 40 | Daily Plan — 1 คน : 1 WO ต่อวัน (conflict check) | DB UNIQUE + Service |
| 41 | Daily Plan — 1 เครื่องมือ : 1 WO ต่อวัน (conflict check) | DB UNIQUE + Service |
| 42 | Daily Plan — พนักงานลาวันนั้น จัดลงงานไม่ได้ | Service check |
| 43 | Daily Plan — วางแผนล่วงหน้าได้ 14 วัน, แก้ไขได้ | Service check |
| 44 | MaterialReservation — available = on_hand - SUM(reserved qty) | Service check |
| 45 | ToolReservation — ห้ามจองซ้อนช่วงเดียวกัน | Service check |
| 46 | WO Master Plan — 1 plan per WO | DB UNIQUE |

---

## Leave Types (Default)

| Code | Name | Paid | Default Quota/year |
|------|------|:----:|:------------------:|
| ANNUAL | ลาพักร้อน | Yes | 6 |
| SICK | ลาป่วย | Yes | 30 |
| PERSONAL | ลากิจ | Yes | 3 |
| MATERNITY | ลาคลอด | Yes | 98 |
| UNPAID | ลาไม่ได้เงิน | No | unlimited |

---

## Approval Flow (Phase 4.2)

```
ทุก document ที่ต้อง approve:
→ ผู้สร้างเลือก "ผู้อนุมัติ" (requested_approver_id) จาก dropdown
→ Dropdown แสดงเฉพาะ user ที่มี permission *.approve ของ module นั้น
→ Submit → status = SUBMITTED
→ ผู้อนุมัติ approve / reject

ถ้า OrgApprovalConfig.require_approval == false:
→ auto set status = APPROVED (skip SUBMITTED)
→ ซ่อน approver dropdown + approve button
```

Modules with approval: PO, SO, WO (close), Timesheet, Leave

---

## Planning Flow (Phase 4.5)

```
1. WO Master Plan — กำหนดแผนรวม (manpower, material, tool)
   → 1 plan per WO, สร้างได้ตอน DRAFT
2. Daily Plan — จัดคน/เครื่องมือ/วัสดุ ลง WO รายวัน
   → Conflict check: 1 คน = 1 WO/วัน, 1 tool = 1 WO/วัน
   → ถ้าพนักงานลาวันนั้น → จัดลงงานไม่ได้
3. Reservation — จองวัสดุ/เครื่องมือล่วงหน้า
   → Material: available = on_hand - SUM(reserved)
   → Tool: ห้ามจองซ้อนช่วงเดียวกัน
```

---

## Multi-tenant (Phase 4.7)

```
- org_id ใน JWT token payload
- ทุก query ต้องมี .where(Model.org_id == org_id)
- Setup Wizard: POST /api/setup (no auth, once-only)
  → สร้าง Organization + Admin User (role=owner)
  → Returns login tokens
```

---

## Daily Work Report (Phase 5)

```
Business Rules:
  BR#47 — Employee hire_date required for new employees (optional for existing)
  BR#48 — Staff Portal: "ของฉัน" menu group — own data scope only
  BR#49 — Daily Work Report per employee per day (line items: REGULAR/OT)
  BR#50 — 1 report per employee per day (same org) — duplicate check
  BR#51 — Time overlap validation (within REGULAR lines, within OT lines)
  BR#52 — Auto-create Timesheet WO Time Entry on report approve
  BR#53 — Auto-update StandardTimesheet OT hours on report approve
  BR#54 — Edit only DRAFT/REJECTED status (state machine: DRAFT→SUBMITTED→APPROVED/REJECTED)
  BR#55 — Supervisor sees only own department reports

Flow:
  Staff กรอก Daily Work Report → บันทึก DRAFT
  → Staff กด Submit → SUBMITTED
  → Supervisor/Manager Approve → APPROVED (auto Timesheet)
  → หรือ Reject → REJECTED (กลับไปแก้ไข re-submit ได้)

Permissions: hr.dailyreport.create / hr.dailyreport.read / hr.dailyreport.approve
```
