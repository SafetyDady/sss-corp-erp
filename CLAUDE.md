# CLAUDE.md — SSS Corp ERP

> **ไฟล์นี้คือ "สมอง" ของโปรเจกต์ — AI ต้องอ่านก่อนทำงานทุกครั้ง**
> Source of truth: SmartERP_Master_Document_v2.xlsx
> อัปเดตล่าสุด: 2026-02-26 v2

---

## Project Overview

**SSS Corp ERP** — ระบบ ERP สำหรับธุรกิจ Manufacturing/Trading ขนาดเล็ก-กลาง
- Multi-tenant (Shared DB + org_id)
- **11 Modules, 89 Permissions, 5 Roles**
- Job Costing: Material + ManHour + Tools Recharge + Admin Overhead
- อ้างอิงเพิ่มเติม: `UI_GUIDELINES.md` (theme/icons), `BUSINESS_POLICY.md` (business rules)

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | **FastAPI** (Python 3.12) | Async, auto docs |
| Frontend | **React 18** + Vite + Ant Design | SPA, Zustand state |
| Database | **PostgreSQL 16** | Alembic migrations |
| Cache | **Redis** | Rate limiting + session cache |
| ORM | **SQLAlchemy 2.0** (async) | Numeric(12,2) for money |
| Auth | **JWT Bearer Token** | Access 15min + Refresh 7d + rotation |
| Icons | **Lucide React** | ห้ามใช้ emoji / Ant Design Icons |
| Deploy | **Vercel** (frontend) + **Railway** (backend) | git push = deploy |

---

## Project Structure

```
sss-corp-erp/
├── frontend/                     ← Vercel deploys this (Root Dir = frontend/)
│   ├── src/
│   │   ├── components/           # Shared UI (StatusBadge, EmptyState, etc.)
│   │   ├── pages/                # Route pages (1 file per page)
│   │   ├── hooks/                # usePermission, useAuth, etc.
│   │   ├── stores/               # Zustand stores
│   │   ├── services/             # API client (axios + interceptor)
│   │   └── utils/                # Helpers, formatters
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── vercel.json
├── backend/                      ← Railway deploys this (Dockerfile)
│   ├── app/
│   │   ├── api/                  # Route handlers (1 file per module)
│   │   ├── core/                 # config, database, security, permissions
│   │   ├── models/               # SQLAlchemy models (1 file per domain)
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── services/             # Business logic (1 file per module)
│   │   └── main.py               # FastAPI app entry point
│   ├── alembic/                  # DB migrations
│   ├── tests/                    # pytest
│   ├── Dockerfile                # Production (Railway)
│   ├── Dockerfile.dev            # Dev (hot-reload)
│   ├── railway.toml
│   └── requirements.txt
├── docker-compose.dev.yml        # Local dev: all services
├── CLAUDE.md                     # ← ไฟล์นี้
├── UI_GUIDELINES.md              # Theme, colors, icons, layout
├── BUSINESS_POLICY.md            # Business rules (source of truth)
├── TODO.md                       # Implementation tracker
└── README.md
```

---

## HARD CONSTRAINTS (ห้ามฝ่าฝืนเด็ดขาด)

### 1. Permission System
- Format: `module.resource.action` **(3-part เสมอ)**
- 7 Actions: `create / read / update / delete / approve / export / execute`
- 11 Modules: `inventory / warehouse / workorder / purchasing / sales / finance / master / admin / customer / tools / hr`
- **Explicit allow only** — ไม่มี implicit, wildcard, inheritance
- ทุก endpoint ต้องมี `dependencies=[Depends(require("module.resource.action"))]`

### 2. Data Integrity
- **Stock movements เป็น immutable** — แก้ผ่าน REVERSAL เท่านั้น
- **Financial fields ใช้ `Numeric(12,2)`** — ห้ามใช้ Float (BR#35)
- **on_hand >= 0** ตลอดเวลา (DB CHECK + Service validation)
- **SKU unique** ทั่วระบบ, เปลี่ยนไม่ได้ถ้ามี movements
- **cost_center_id ต้องเป็น integer/UUID** ไม่ใช่ string (BR#9)

### 3. Timesheet Rules
- ชั่วโมงเดียวกัน = **1 WO เท่านั้น** (ห้าม overlap) (BR#18)
- **Lock Period 7 วัน** — กรอกย้อนหลังได้ไม่เกิน 7 วัน (BR#19)
- **ชั่วโมงรวมต่อวัน ≤ Working Hours วันนั้น** (BR#20)
- **Supervisor กรอกแทนได้** ถ้าพนักงานไม่กรอก (BR#21, hr.timesheet.update)
- **HR unlock** ก่อนแก้หลัง 7 วัน (BR#22, hr.timesheet.execute)
- **HR เป็น final authority** ก่อนเข้า Payroll (BR#26)

### 4. OT Rules
- OT Flow: **พนักงานกรอก → Supervisor approve → HR final** (BR#23)
- Special OT Factor **≤ Maximum Ceiling** ที่ Admin กำหนดใน Master Data (BR#24)
- Default: วันธรรมดา 1.5x, วันหยุด 2.0x, นักขัตฤกษ์ 3.0x (BR#25)
- Admin ปรับ Factor + Maximum Ceiling ได้ใน Master Data (BR#29)

### 5. Work Order
- Status flow: **DRAFT → OPEN → CLOSED** (ห้ามย้อน) (BR#10)
- Close WO ต้องมี **workorder.order.approve** (BR#11)
- ลบได้เฉพาะ **DRAFT + ไม่มี movements + Owner** only (BR#12)
- CONSUME ต้อง **WO.status=OPEN** และ **product.type=CONSUMABLE** (BR#13)

### 6. Admin
- Owner ลด role ตัวเองไม่ได้ (BR#31)
- Permission ต้องอยู่ใน master list เท่านั้น — fail-fast validation (BR#32)
- Action ต้องเป็น 1 ใน 7: create/read/update/delete/approve/export/execute (BR#33)

### 7. Tools
- Tool checkout 1 คน ณ เวลาเดียว (BR#27)
- Auto charge เมื่อ **Check-in** เท่านั้น (ไม่ใช่ Check-out) (BR#28)

---

## RBAC — 5 Roles x 89 Permissions (Full Matrix)

### Inventory (9 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| inventory.product.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| inventory.product.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| inventory.product.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| inventory.product.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| inventory.product.export | ✅ | ✅ | ✅ | ❌ | ✅ |
| inventory.movement.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| inventory.movement.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| inventory.movement.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| inventory.movement.export | ✅ | ✅ | ✅ | ✅ | ❌ |

### Warehouse (12 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| warehouse.warehouse.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| warehouse.warehouse.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| warehouse.warehouse.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| warehouse.warehouse.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| warehouse.zone.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| warehouse.zone.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| warehouse.zone.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| warehouse.zone.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| warehouse.location.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| warehouse.location.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| warehouse.location.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| warehouse.location.delete | ✅ | ❌ | ❌ | ❌ | ❌ |

### Work Order (6 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| workorder.order.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| workorder.order.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| workorder.order.update | ✅ | ✅ | ✅ | ✅ | ❌ |
| workorder.order.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| workorder.order.approve | ✅ | ✅ | ✅ | ❌ | ❌ |
| workorder.order.export | ✅ | ✅ | ✅ | ✅ | ❌ |

### Purchasing (6 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| purchasing.po.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| purchasing.po.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| purchasing.po.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| purchasing.po.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| purchasing.po.approve | ✅ | ✅ | ✅ | ❌ | ❌ |
| purchasing.po.export | ✅ | ✅ | ✅ | ❌ | ✅ |

### Sales (6 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| sales.order.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| sales.order.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| sales.order.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| sales.order.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| sales.order.approve | ✅ | ✅ | ✅ | ❌ | ❌ |
| sales.order.export | ✅ | ✅ | ✅ | ❌ | ✅ |

### Finance (2 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| finance.report.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| finance.report.export | ✅ | ❌ | ❌ | ❌ | ❌ |

### Master Data (12 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| master.costcenter.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| master.costcenter.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| master.costcenter.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| master.costcenter.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| master.costelement.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| master.costelement.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| master.costelement.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| master.costelement.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| master.ottype.create | ✅ | ✅ | ❌ | ❌ | ❌ |
| master.ottype.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| master.ottype.update | ✅ | ✅ | ❌ | ❌ | ❌ |
| master.ottype.delete | ✅ | ❌ | ❌ | ❌ | ❌ |

### Admin (8 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| admin.role.create | ✅ | ❌ | ❌ | ❌ | ❌ |
| admin.role.read | ✅ | ❌ | ❌ | ❌ | ❌ |
| admin.role.update | ✅ | ❌ | ❌ | ❌ | ❌ |
| admin.role.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| admin.user.create | ✅ | ❌ | ❌ | ❌ | ❌ |
| admin.user.read | ✅ | ❌ | ❌ | ❌ | ❌ |
| admin.user.update | ✅ | ❌ | ❌ | ❌ | ❌ |
| admin.user.delete | ✅ | ❌ | ❌ | ❌ | ❌ |

### Customer (5 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| customer.customer.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| customer.customer.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| customer.customer.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| customer.customer.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| customer.customer.export | ✅ | ✅ | ✅ | ❌ | ✅ |

### Tools (6 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| tools.tool.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| tools.tool.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| tools.tool.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| tools.tool.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| tools.tool.execute | ✅ | ✅ | ✅ | ✅ | ❌ |
| tools.tool.export | ✅ | ✅ | ✅ | ❌ | ✅ |

### HR (17 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| hr.employee.create | ✅ | ✅ | ❌ | ❌ | ❌ |
| hr.employee.read | ✅ | ✅ | ✅ | ❌ | ❌ |
| hr.employee.update | ✅ | ✅ | ❌ | ❌ | ❌ |
| hr.employee.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| hr.employee.export | ✅ | ✅ | ❌ | ❌ | ❌ |
| hr.timesheet.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| hr.timesheet.read | ✅ | ✅ | ✅ | ✅ | ❌ |
| hr.timesheet.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| hr.timesheet.approve | ✅ | ✅ | ✅ | ❌ | ❌ |
| hr.timesheet.execute | ✅ | ✅ | ❌ | ❌ | ❌ |
| hr.payroll.create | ✅ | ✅ | ❌ | ❌ | ❌ |
| hr.payroll.read | ✅ | ✅ | ❌ | ❌ | ❌ |
| hr.payroll.execute | ✅ | ✅ | ❌ | ❌ | ❌ |
| hr.payroll.export | ✅ | ✅ | ❌ | ❌ | ❌ |
| hr.leave.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| hr.leave.read | ✅ | ✅ | ✅ | ✅ | ❌ |
| hr.leave.approve | ✅ | ✅ | ✅ | ❌ | ❌ |

### Permission Count Summary

| Role | Count | Description |
|------|-------|-------------|
| owner | 89 | ALL permissions |
| manager | ~52 | ไม่มี admin.*, ไม่มี *.delete (ยกเว้นบางตัว) |
| supervisor | ~38 | read + approve + limited create |
| staff | ~22 | read + own create (timesheet, leave, movement) |
| viewer | ~15 | read + selected export only |

### Permission Usage Pattern
```python
# Backend — ทุก endpoint ต้องมี
@router.get("/products", dependencies=[Depends(require("inventory.product.read"))])
async def list_products(db: AsyncSession = Depends(get_db)):
    ...

# Frontend — ซ่อน UI ตาม permission
const { can } = usePermission();
if (can('inventory.product.create')) { /* show create button */ }
```

---

## Job Costing Formula

```
WO Total Cost (BR#14)
├── Material Cost    = Σ(CONSUME qty x unit_cost)                              (BR#14)
├── ManHour Cost     = Σ((Regular hrs + OT hrs x OT Factor) x Employee Rate)   (BR#15)
├── Tools Recharge   = Σ(Check-out Hours x Tool Rate baht/hr)                  (BR#16)
└── Admin Overhead   = ManHour Cost x Overhead Rate % (per Cost Center)         (BR#17)
```

**Flow:**
1. Material — เมื่อ CONSUME movement เข้า WO (auto calc)
2. ManHour — เมื่อ Timesheet ถูก HR final approve → charge เข้า WO (auto calc)
3. Tools Recharge — เมื่อ Tool check-in → คำนวณชั่วโมง x rate (auto calc)
4. Admin Overhead — เมื่อ ManHour อัปเดต → recalc Overhead (auto calc)

---

## Business Flow Diagrams

### Flow 1: RECEIVE Stock Movement
```
Manager+ กด New Movement → RECEIVE
→ เลือก Product + qty + unit_cost
→ เลือก Zone ปลายทาง (RECEIVING/STORAGE)
→ Submit → on_hand เพิ่ม
Permission: inventory.movement.create
```

### Flow 2: ISSUE Stock Movement
```
Manager+ กด New Movement → ISSUE
→ เลือก Product + qty
→ เลือก cost_center_id + cost_element_id
→ Submit → on_hand ลด (BR#6: balance >= qty)
Permission: inventory.movement.create
```

### Flow 3: Work Order Lifecycle
```
Manager+ สร้าง WO → status=DRAFT
→ Manager+ กด Open → status=OPEN (sets opened_at)
→ [ระหว่าง OPEN: CONSUME materials, กรอก Timesheet, Check-out Tools]
→ Manager+ กด Close → status=CLOSED (sets closed_at)
Permissions: workorder.order.create → update → approve
```

### Flow 4: Timesheet → ManHour (Job Costing)
```
Staff กรอก Timesheet (WO + Regular hrs + OT hrs + OT Type)
→ ระบบดึง OT Factor อัตโนมัติจาก Master Data
→ Supervisor Review + Approve (hr.timesheet.approve)
→ HR Final Approve (hr.timesheet.execute)
→ ระบบ auto charge ManHour Cost เข้า WO
```

### Flow 5: Tools Recharge (Job Costing)
```
Staff Check-out Tool → ระบุ Tool + WO (tools.tool.execute)
→ ใช้งาน Tool ใน WO
→ Staff Check-in Tool (tools.tool.execute)
→ ระบบ auto charge: (check-in time - check-out time) x Tool Rate baht/hr
```

### Flow 6: Admin Overhead (Job Costing)
```
ทุกครั้งที่ ManHour อัปเดต:
→ ระบบ auto คำนวณ Overhead = ManHour Cost x Overhead Rate % (per Cost Center)
→ อัปเดต WO Total Cost
Manager+ ดู WO Detail → เห็น 4 components (workorder.order.read)
```

### Flow 7: OT Request
```
Staff กรอก OT Hours + เลือก OT Type (hr.timesheet.create)
→ ถ้า Special → กรอก Factor (ต้อง ≤ Max Ceiling — BR#24)
→ Supervisor Approve (hr.timesheet.approve)
→ HR Final (hr.timesheet.execute) → เข้า Payroll
```

### Flow 8: Purchasing PO Workflow
```
Staff+ สร้าง PO + เพิ่ม Line Items (purchasing.po.create)
→ Submit ขออนุมัติ (purchasing.po.update)
→ Manager+ Approve (purchasing.po.approve)
→ Goods Receipt → RECEIVE movement (purchasing.po.update)
```

### Flow 9: Admin — Manage Roles & Policy
```
Owner เข้า Admin Panel (admin.role.read)
→ ปรับ Permission ต่อ role (admin.role.update)
→ ตั้ง OT Types + Factor + Max Ceiling (master.ottype.*)
→ ตั้ง Overhead Rate % ต่อ Cost Center (master.costcenter.update)
```

---

## Business Rules (Complete — 35 Rules)

| # | Module | Feature | Rule | Enforcement |
|---|--------|---------|------|-------------|
| 1 | inventory | Product | MATERIAL cost >= 1.00 THB | DB CHECK + Service |
| 2 | inventory | Product | SKU unique ทั่วระบบ | DB UNIQUE |
| 3 | inventory | Product | SKU เปลี่ยนไม่ได้ถ้ามี movements | Service check |
| 4 | inventory | Product | ลบไม่ได้ถ้ามี movements หรือ balance>0 | Service check |
| 5 | inventory | Balance | on_hand >= 0 ตลอดเวลา | DB CHECK + Service |
| 6 | inventory | ISSUE/CONSUME | balance >= qty ก่อน movement | Service check |
| 7 | inventory | ADJUST | Owner only (inventory.movement.delete) | Permission |
| 8 | inventory | REVERSAL | Immutable — แก้ผ่าน REVERSAL เท่านั้น | ADR-005 |
| 9 | inventory | Cost | cost_center_id ต้องเป็น integer/UUID ไม่ใช่ string | ADR-006 |
| 10 | workorder | Status | DRAFT→OPEN→CLOSED เท่านั้น ห้ามย้อน | State machine |
| 11 | workorder | Close | ต้องมี workorder.order.approve | Permission |
| 12 | workorder | Delete | DRAFT only + ไม่มี movements + Owner | Permission + Service |
| 13 | workorder | CONSUME | WO.status=OPEN และ product.type=CONSUMABLE | Service check |
| 14 | workorder | Job Cost | WO Total = Material + ManHour + Tools + Overhead | Formula Auto |
| 15 | workorder | ManHour | ManHour Cost = Σ((Regular + OT x Factor) x Rate) | Formula Auto |
| 16 | workorder | Tools Recharge | Tools Recharge = Σ(Hours x Tool Rate) | Formula Auto |
| 17 | workorder | Admin Overhead | Overhead = ManHour Cost x Overhead Rate % | Formula Auto |
| 18 | hr | Timesheet | ชั่วโมงเดียวกัน = 1 WO เท่านั้น (ห้าม overlap) | Service check |
| 19 | hr | Timesheet | กรอกย้อนหลังได้ไม่เกิน 7 วัน | Lock Period |
| 20 | hr | Timesheet | ชั่วโมงรวมต่อวัน ≤ Working Hours วันนั้น | Validation |
| 21 | hr | Timesheet | Supervisor กรอกแทนได้ถ้าพนักงานไม่กรอก | hr.timesheet.update |
| 22 | hr | Timesheet | HR unlock ก่อนแก้หลัง 7 วัน | hr.timesheet.execute |
| 23 | hr | OT | OT Flow: กรอก → Supervisor approve → HR final | 3-tier approval |
| 24 | hr | OT | Special OT Factor ≤ Maximum Ceiling ที่ Admin กำหนด | Master Data validation |
| 25 | hr | OT | OT Types: วันธรรมดา 1.5x, วันหยุด 2x, นักขัตฤกษ์ 3x | Master Data |
| 26 | hr | OT | HR เป็น final authority ก่อนเข้า Payroll | hr.timesheet.execute |
| 27 | tools | Check-out | Tool ถูก checkout ได้ 1 คน ณ เวลาเดียว | Service check |
| 28 | tools | Recharge | Auto charge เมื่อ Check-in เท่านั้น (ไม่ใช่ Check-out) | Auto calc |
| 29 | master | OT Types | Admin ปรับ Factor + Maximum Ceiling ได้ใน Master Data | master.ottype.update |
| 30 | master | Overhead Rate | Rate ต่อ Cost Center ไม่ใช่ Rate เดียวทั้งองค์กร | master.costcenter.update |
| 31 | admin | Role | Owner ลด role ตัวเองไม่ได้ | Service check |
| 32 | admin | Permission | Permission ต้องอยู่ใน master list เท่านั้น | Fail-fast validation |
| 33 | admin | Action | Action ต้องเป็น 1 ใน 7: create/read/update/delete/approve/export/execute | VALID_ACTIONS |
| 34 | warehouse | Zone | 1 zone type ต่อ warehouse (UNIQUE constraint) | DB UNIQUE |
| 35 | finance | Float | ห้ามใช้ Float สำหรับ accounting — ต้อง Numeric(12,2) | Tech constraint |

---

## API Endpoints (Complete)

### Auth
```
POST   /api/auth/login                     — (no auth)
POST   /api/auth/refresh                   — (refresh token)
GET    /api/auth/me                         — (JWT)
POST   /api/auth/register                  admin.user.create
POST   /api/auth/logout                    — (JWT)
```

### Inventory
```
GET    /api/inventory/products              inventory.product.read
POST   /api/inventory/products              inventory.product.create
GET    /api/inventory/products/{id}         inventory.product.read
PUT    /api/inventory/products/{id}         inventory.product.update
DELETE /api/inventory/products/{id}         inventory.product.delete
```

### Stock Movements
```
GET    /api/stock/movements                 inventory.movement.read
POST   /api/stock/movements                 inventory.movement.create
POST   /api/stock/movements/{id}/reverse    inventory.movement.delete
```

### Warehouse
```
GET    /api/warehouse/warehouses            warehouse.warehouse.read
POST   /api/warehouse/warehouses            warehouse.warehouse.create
GET    /api/warehouse/warehouses/{id}       warehouse.warehouse.read
PUT    /api/warehouse/warehouses/{id}       warehouse.warehouse.update
DELETE /api/warehouse/warehouses/{id}       warehouse.warehouse.delete
GET    /api/warehouse/locations             warehouse.location.read
POST   /api/warehouse/locations             warehouse.location.create
GET    /api/warehouse/locations/{id}        warehouse.location.read
PUT    /api/warehouse/locations/{id}        warehouse.location.update
DELETE /api/warehouse/locations/{id}        warehouse.location.delete
```

### Work Orders
```
GET    /api/work-orders                     workorder.order.read
POST   /api/work-orders                     workorder.order.create
GET    /api/work-orders/{id}               workorder.order.read
PUT    /api/work-orders/{id}               workorder.order.update
DELETE /api/work-orders/{id}               workorder.order.delete
POST   /api/work-orders/{id}/open           workorder.order.update
POST   /api/work-orders/{id}/close          workorder.order.approve
GET    /api/work-orders/{id}/cost-summary   workorder.order.read
```

### Purchasing
```
GET    /api/purchasing/po                   purchasing.po.read
POST   /api/purchasing/po                   purchasing.po.create
GET    /api/purchasing/po/{id}             purchasing.po.read
PUT    /api/purchasing/po/{id}             purchasing.po.update
DELETE /api/purchasing/po/{id}             purchasing.po.delete
POST   /api/purchasing/po/{id}/approve      purchasing.po.approve
POST   /api/purchasing/po/{id}/receive      purchasing.po.update
```

### Sales
```
GET    /api/sales/orders                    sales.order.read
POST   /api/sales/orders                    sales.order.create
GET    /api/sales/orders/{id}              sales.order.read
PUT    /api/sales/orders/{id}              sales.order.update
DELETE /api/sales/orders/{id}              sales.order.delete
POST   /api/sales/orders/{id}/approve       sales.order.approve
```

### Finance
```
GET    /api/finance/reports                 finance.report.read
GET    /api/finance/reports/export          finance.report.export
```

### Master Data
```
GET    /api/master/cost-centers             master.costcenter.read
POST   /api/master/cost-centers             master.costcenter.create
PUT    /api/master/cost-centers/{id}       master.costcenter.update
DELETE /api/master/cost-centers/{id}       master.costcenter.delete
GET    /api/master/cost-elements            master.costelement.read
POST   /api/master/cost-elements            master.costelement.create
PUT    /api/master/cost-elements/{id}      master.costelement.update
DELETE /api/master/cost-elements/{id}      master.costelement.delete
GET    /api/master/ot-types                 master.ottype.read
POST   /api/master/ot-types                 master.ottype.create
PUT    /api/master/ot-types/{id}           master.ottype.update
DELETE /api/master/ot-types/{id}           master.ottype.delete
```

### HR — Timesheet
```
GET    /api/hr/timesheet                    hr.timesheet.read
POST   /api/hr/timesheet                    hr.timesheet.create
PUT    /api/hr/timesheet/{id}              hr.timesheet.update
POST   /api/hr/timesheet/{id}/approve       hr.timesheet.approve
POST   /api/hr/timesheet/{id}/final         hr.timesheet.execute
POST   /api/hr/timesheet/{id}/unlock        hr.timesheet.execute
```

### HR — Employee / Payroll / Leave
```
GET    /api/hr/employees                    hr.employee.read
POST   /api/hr/employees                    hr.employee.create
PUT    /api/hr/employees/{id}              hr.employee.update
DELETE /api/hr/employees/{id}              hr.employee.delete
GET    /api/hr/payroll                      hr.payroll.read
POST   /api/hr/payroll/run                  hr.payroll.execute
GET    /api/hr/payroll/export               hr.payroll.export
GET    /api/hr/leave                        hr.leave.read
POST   /api/hr/leave                        hr.leave.create
POST   /api/hr/leave/{id}/approve           hr.leave.approve
```

### Tools
```
GET    /api/tools                           tools.tool.read
POST   /api/tools                           tools.tool.create
PUT    /api/tools/{id}                     tools.tool.update
DELETE /api/tools/{id}                     tools.tool.delete
POST   /api/tools/{id}/checkout             tools.tool.execute
POST   /api/tools/{id}/checkin              tools.tool.execute
GET    /api/tools/{id}/history              tools.tool.read
```

### Customer
```
GET    /api/customers                       customer.customer.read
POST   /api/customers                       customer.customer.create
PUT    /api/customers/{id}                 customer.customer.update
DELETE /api/customers/{id}                 customer.customer.delete
```

### Admin
```
GET    /api/admin/roles                     admin.role.read
PUT    /api/admin/roles/{role}/permissions   admin.role.update
GET    /api/admin/users                     admin.user.read
PATCH  /api/admin/users/{id}/role           admin.user.update
GET    /api/admin/audit-log                 admin.role.read
POST   /api/admin/seed-permissions          admin.role.update
```

### System
```
GET    /api/health                          — (no auth)
```

---

## Development Commands

```bash
# --- Local Dev ---
docker compose -f docker-compose.dev.yml up          # Start all services
docker compose -f docker-compose.dev.yml down         # Stop all

# Frontend: http://localhost:5173 (Vite hot-reload)
# Backend:  http://localhost:8000 (FastAPI auto-reload)
# API Docs: http://localhost:8000/docs (Swagger UI)
# DB:       localhost:5433 (postgres/postgres) ← port 5433 เลี่ยง local PG conflict

# --- Database ---
cd backend
alembic revision --autogenerate -m "description"      # Create migration
alembic upgrade head                                   # Apply migrations
alembic downgrade -1                                   # Rollback 1

# --- Seed Data ---
cd backend
python -m app.seed                                     # Create test users

# --- Frontend ---
cd frontend
npm install                                            # Install deps
npm run dev                                            # Dev server
npm run build                                          # Production build
```

### Test Credentials (Dev)

| Email | Password | Role |
|-------|----------|------|
| owner@sss-corp.com | owner123 | owner (all 89 perms) |
| manager@sss-corp.com | manager123 | manager (~52 perms) |
| supervisor@sss-corp.com | supervisor123 | supervisor (~38 perms) |
| staff@sss-corp.com | staff123 | staff (~22 perms) |
| viewer@sss-corp.com | viewer123 | viewer (~15 perms) |

### Important Constants
```python
# backend/app/core/config.py
DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")  # ใช้แทน random uuid4()
```

---

## Coding Conventions

### Backend (Python)
- **Async everywhere** — use `async def`, `await`, `AsyncSession`
- **1 file per module** in `api/`, `models/`, `schemas/`, `services/`
- **Pydantic v2** for all request/response schemas
- **Service layer** for business logic — keep route handlers thin
- **Permission on every endpoint**: `dependencies=[Depends(require("x.y.z"))]`
- **Money = `Numeric(12,2)`** — never Float
- **UUID primary keys** — `UUID(as_uuid=True), default=uuid.uuid4`
- **TimestampMixin** on all models: `created_at`, `updated_at`
- **Pagination**: `?limit=20&offset=0` on all list endpoints
- **Error format**: `raise HTTPException(status_code=4xx, detail="message")`

### Frontend (React)
- **Functional components** only — no class components
- **Ant Design** for all UI — Table, Form, Modal, Button, Card, etc.
- **Lucide React** for all icons — ห้ามใช้ emoji / Ant Design Icons
- **Full Dark theme** — ดู UI_GUIDELINES.md
- **StatusBadge component** — ห้ามใช้ inline style สำหรับ badges
- **Zustand** for global state — 1 store per domain
- **usePermission hook** for RBAC: `const { can } = usePermission()`
- **API calls via `services/api.js`** — auto adds Bearer token, auto refresh
- **Pages in `pages/`** — 1 file per page, named `XxxPage.jsx`
- **Thai labels + English data/menu** — ดู UI_GUIDELINES.md Language Rules
- **No console.log** in committed code

### Naming
- Backend: snake_case (Python standard)
- Frontend: camelCase (JS standard)
- DB tables: snake_case, plural (e.g., `users`, `work_orders`)
- API routes: kebab-case (e.g., `/api/work-orders`)
- Permissions: dot-separated (e.g., `workorder.order.create`)

---

## Implementation Phases

### Phase 0 — Foundation ✅ (Done)
- [x] Monorepo structure
- [x] Docker Compose (dev) — port 5433 for PG
- [x] Dockerfile (production/Railway)
- [x] FastAPI + CORS + Rate Limiting
- [x] Auth (JWT Bearer Token + refresh rotation)
- [x] RBAC core (permissions.py)
- [x] Alembic setup
- [x] React + Vite + Ant Design + Zustand
- [x] Login page + Dashboard + Sidebar
- [x] API client with auto refresh interceptor

### Phase 1 — Core Modules ✅
- [x] **Inventory** ✅ — 15 tests passed, all 8 BRs verified
- [x] **Warehouse** ✅ — 15 tests passed, BR#34 verified
- [x] **Work Orders** ✅ — 18 tests passed, status machine + cost summary ready
- [x] **Master Data** ✅ — CostCenter, CostElement, OTType (12 endpoints, BR#24/29/30)

### Phase 2 — HR + Job Costing ✅
- [x] Employee CRUD (hourly_rate, cost_center_id, daily_working_hours)
- [x] Timesheet: create → approve → final → lock 7 days (BR#18-22, 26)
- [x] OT System: types/factor/ceiling in Master Data (BR#23-25, 29)
- [x] Tools Module: CRUD + check-in/out + auto recharge (BR#27-28)
- [x] WO Cost Summary API — all 4 components live (BR#14-17)
- [x] Payroll create + execute (aggregates FINAL timesheets)
- [x] Leave: create + approve/reject

### Phase 3 — Business Flow + Frontend 🟡
- [x] Customer: CRUD (5 endpoints)
- [x] Purchasing: PO → approve → GR → RECEIVE movements (7 endpoints)
- [x] Sales Orders: CRUD + approve (6 endpoints)
- [x] Finance Reports: summary + CSV export (2 endpoints)
- [x] Admin Panel: roles/permissions/users/audit-log (6 endpoints, BR#31-33)
- [ ] Full React Frontend for all modules

### Phase 4 — Multi-tenant + Production 🔲
- [ ] Multi-tenant: org_id filtering + Setup Wizard
- [ ] Deploy: Vercel + Railway
- [ ] Backup + Monitoring (Sentry)
- [ ] Security audit + load test

---

## Common Pitfalls (อย่าทำ!)

1. ❌ อย่าใช้ `Float` สำหรับ money — ใช้ `Numeric(12,2)` เท่านั้น (BR#35)
2. ❌ อย่าลืม `dependencies=[Depends(require(...))]` บนทุก endpoint (BR#32)
3. ❌ อย่าสร้าง endpoint โดยไม่มี permission ใน `ALL_PERMISSIONS` list
4. ❌ อย่าให้ stock movement ถูก update/delete — ใช้ REVERSAL เท่านั้น (BR#8)
5. ❌ อย่าให้ WO status ย้อนกลับ (CLOSED → OPEN ❌) (BR#10)
6. ❌ อย่าลืม pagination (`?limit&offset`) บนทุก list endpoint
7. ❌ อย่าใช้ `localStorage` เก็บ token — เก็บใน Zustand (memory) เท่านั้น
8. ❌ อย่า commit `console.log` / `.env` / `node_modules`
9. ❌ อย่า hard-code OT factors — ดึงจาก Master Data เสมอ (BR#29)
10. ❌ อย่าให้ Timesheet overlap (1 ชั่วโมง = 1 WO เท่านั้น) (BR#18)
11. ❌ อย่าใช้ `uuid4()` เป็น fallback สำหรับ org_id — ใช้ `DEFAULT_ORG_ID` จาก config
12. ❌ อย่าใช้ emoji ใน UI — ใช้ Lucide icons เท่านั้น
13. ❌ อย่าใช้ Ant Design Icons — ใช้ Lucide icons เท่านั้น

---

## Reference Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | ← ไฟล์นี้ — อ่านก่อนทำงานทุกครั้ง |
| `UI_GUIDELINES.md` | Theme (Full Dark + Cyan), icons (Lucide), layout, language rules |
| `BUSINESS_POLICY.md` | Business rules (source of truth) |
| `TODO.md` | Implementation tracker + checklist |
| `SmartERP_Master_Document_v2.xlsx` | Original design spec |
| `backend/app/core/permissions.py` | RBAC permissions + role mapping |
| `backend/app/core/security.py` | JWT token creation/validation |
| `backend/app/core/config.py` | Environment settings + DEFAULT_ORG_ID |
| `frontend/src/stores/authStore.js` | Auth state + token management |
| `frontend/src/hooks/usePermission.js` | RBAC hook for components |
| `frontend/src/components/StatusBadge.jsx` | Reusable status badge |

---

## How to Give Instructions

เมื่อสั่งงาน ให้ระบุ:
1. **Module** ที่จะทำ (เช่น inventory, hr, tools)
2. **ต้องการอะไร** (เช่น สร้าง model, สร้าง API, สร้างหน้า frontend)
3. **อ้างอิง CLAUDE.md** สำหรับ permission, business rules, API spec

ตัวอย่าง:
```
ทำ Phase 2 — HR Timesheet module ตาม CLAUDE.md
- Model: Timesheet ตาม section "HR — Timesheet"
- API: ตาม API Endpoints section
- Permissions: ตาม HR permission matrix (17 ตัว)
- Business Rules: BR#18-22, 26
- Flow: ตาม Flow 4 (Timesheet → ManHour)
```

---

*End of CLAUDE.md — SSS Corp ERP v3 (v2 — complete)*
