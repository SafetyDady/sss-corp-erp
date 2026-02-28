# SSS Corp ERP — BUSINESS POLICY (Source of Truth)

Updated: 2026-03-01 | Based on SmartERP Master Document v2 + Phase 4-5 + PR/PO Redesign

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
| owner | ALL 123 | Full access (89 original + 16 Phase 4 + 3 Phase 5 + 10 Phase 4.9 + 5 PR/PO) |
| manager | ~73 | No admin.*, no *.delete + planning create/update |
| supervisor | ~57 | Read + approve + limited create + planning read |
| staff | ~36 | Read + own create (timesheet, leave, movement, dailyreport, PR) |
| viewer | ~23 | Read + selected export only |

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

### New Permissions (Phase 4.9 — 10 added)

| Permission Group | Count | Details |
|-----------------|:-----:|---------|
| master.shifttype.* | 4 | create / read / update / delete |
| master.schedule.* | 4 | create / read / update / delete |
| hr.roster.* | 2 | create / read |

### New Permissions (PR/PO Redesign — 5 added)

| Permission Group | Count | Details |
|-----------------|:-----:|---------|
| purchasing.pr.* | 5 | create / read / update / delete / approve |

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

Modules with approval: PR, PO, SO, WO (close), Timesheet, Leave

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

---

## PR/PO Redesign — Purchase Requisition System

### PR → PO Flow
```
Staff สร้าง PR (ใบขอซื้อ)
  ├── Header: pr_type (STANDARD/BLANKET), cost_center_id (required), required_date, priority
  ├── Header (BLANKET only): validity_start_date, validity_end_date
  ├── Lines: item_type (GOODS/SERVICE) + product_id/description + qty + estimated_cost + cost_element_id
  └── Submit → status = SUBMITTED
        ↓
Supervisor/Manager อนุมัติ PR → status = APPROVED
  └── ปุ่ม "Convert to PO" ปรากฏ
        ↓
ผู้อนุมัติกด Convert to PO
  ├── กรอก: supplier_name + actual unit_cost ต่อ line + expected_date
  ├── PO ถูกสร้าง status = APPROVED (auto-approved)
  └── PR status → PO_CREATED
        ↓
Goods Receipt (ตาม item_type):
  ├── GOODS: รับของ → RECEIVE stock movement (auto)
  └── SERVICE: ยืนยันรับงาน → no stock movement
        ↓
PO Complete: ทุก line received → status = RECEIVED
```

### PR Business Rules (BR#56-68)

| # | Rule | Enforcement |
|---|------|-------------|
| 56 | ทุก PR ต้องมี cost_center_id | Schema + DB NOT NULL |
| 57 | ทุก PR line ต้องมี cost_element_id | Schema + DB NOT NULL |
| 58 | GOODS line ต้องมี product_id | Schema validator |
| 59 | SERVICE line ต้องมี description | Schema validator |
| 60 | PR status flow: DRAFT→SUBMITTED→APPROVED→PO_CREATED (REJECTED/CANCELLED) | State machine |
| 61 | PO ต้องสร้างจาก PR เท่านั้น (บังคับ pr_id) | Service check |
| 62 | 1 PR : 1 PO (unique pr_id on PO) | DB UNIQUE |
| 63 | GOODS item → auto RECEIVE stock movement | Service logic |
| 64 | SERVICE item → manual confirm (no stock movement) | Service logic |
| 65 | SERVICE products ห้ามสร้าง stock movement | Service check |
| 66 | Data Scope: staff=ตัวเอง, supervisor=แผนก, manager/owner=ทั้ง org | API helpers |
| 67 | BLANKET PR ต้องมี validity_start_date + validity_end_date | Schema validator |
| 68 | validity_end_date >= validity_start_date | Schema validator |

### PR Types
| Type | Description |
|------|-------------|
| STANDARD | ใบขอซื้อปกติ |
| BLANKET | สัญญาซื้อระยะยาว (มี validity period) |

### PR Item Types
| Type | Behavior |
|------|----------|
| GOODS | สินค้า — รับเข้าคลัง, สร้าง stock movement อัตโนมัติ |
| SERVICE | บริการ — ยืนยันรับงาน, ไม่มี stock movement |

### Cost Allocation
- **Direct Charge**: PR.cost_center = แผนก → cost charge ตรงไปที่แผนก
- **Store Recharge**: PR.cost_center = คลัง → cost เป็นของ Store → ISSUE recharge ผ่าน WO
