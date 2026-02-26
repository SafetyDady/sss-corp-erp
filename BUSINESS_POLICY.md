# SSS Corp ERP — BUSINESS POLICY (Source of Truth)

Updated: 2026-02-26 | Based on SmartERP Master Document v2

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
| owner | ALL 89 | Full access |
| manager | ~52 | No admin.user.delete, no hr.payroll.execute |
| supervisor | ~38 | Read/approve + limited create |
| staff | ~22 | Read + own create (timesheet, leave, movement) |
| viewer | ~9 | Read only, limited modules |
