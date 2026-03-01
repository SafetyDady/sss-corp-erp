# CLAUDE.md — SSS Corp ERP

> **ไฟล์นี้คือ "สมอง" ของโปรเจกต์ — AI ต้องอ่านก่อนทำงานทุกครั้ง**
> Source of truth: SmartERP_Master_Document_v2.xlsx
> อัปเดตล่าสุด: 2026-03-02 v15 (Stock Withdrawal Slip — ใบเบิกของ multi-line document)

---

## Project Overview

**SSS Corp ERP** — ระบบ ERP สำหรับธุรกิจ Manufacturing/Trading ขนาดเล็ก-กลาง
- Multi-tenant (Shared DB + org_id)
- **11 Modules, 133 Permissions, 5 Roles**
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
| Monitoring | **Sentry** (optional) | Backend + Frontend error tracking |
| Deploy | **Vercel** (frontend) + **Railway** (backend) | git push = deploy |

---

## Project Structure

```
sss-corp-erp/
├── frontend/                     ← Vercel deploys this (Root Dir = frontend/)
│   ├── src/
│   │   ├── components/           # Shared UI (StatusBadge, ScopeBadge, EmployeeContextSelector, etc.)
│   │   ├── pages/                # Route pages (~95 files, 29+ routes)
│   │   │   ├── setup/            # SetupWizardPage (Phase 4.7)
│   │   │   ├── planning/         # PlanningPage, DailyPlan, Reservation (Phase 4.5)
│   │   │   ├── approval/         # ApprovalPage + 6 approval tabs (Phase 7+)
│   │   │   ├── purchasing/       # PurchasingPage (PR+PO tabs), PRDetail, PODetail, ConvertToPO
│   │   │   ├── supply-chain/    # SupplyChainPage, WithdrawalSlip (Tab, Form, Detail, Issue, Print)
│   │   │   └── ...               # inventory, warehouse, workorder, hr, etc.
│   │   ├── hooks/                # usePermission, useAuth, etc.
│   │   ├── stores/               # Zustand stores
│   │   ├── services/             # API client (axios + interceptor)
│   │   └── utils/                # Helpers, formatters
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── vercel.json               # SPA rewrites + security headers + caching
├── backend/                      ← Railway deploys this (Dockerfile)
│   ├── app/
│   │   ├── api/                  # Route handlers (17 files, 18 routers)
│   │   │   ├── _helpers.py       # Shared data scope helpers (Phase 6)
│   │   │   ├── planning.py       # Daily plans, reservations (Phase 4.5)
│   │   │   ├── setup.py          # One-time org setup (Phase 4.7)
│   │   │   └── ...               # auth, inventory, warehouse, etc.
│   │   ├── core/                 # config, database, security, permissions
│   │   ├── models/               # SQLAlchemy models (12 files)
│   │   │   ├── organization.py   # Org, Department, OrgConfig (Phase 4.1)
│   │   │   ├── planning.py       # WOMasterPlan, DailyPlan, Reservations (Phase 4.5)
│   │   │   └── ...               # user, inventory, warehouse, etc.
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── services/             # Business logic (1 file per module)
│   │   │   ├── email.py          # SMTP notification service (Phase 4.6)
│   │   │   ├── organization.py   # Org + Department service (Phase 4.1)
│   │   │   ├── planning.py       # Planning + Reservation service (Phase 4.5)
│   │   │   └── ...
│   │   └── main.py               # FastAPI app + Sentry init
│   ├── alembic/                  # DB migrations (14 revisions)
│   ├── tests/                    # pytest
│   ├── Dockerfile                # Production (Railway, non-root user)
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

### 8. Leave Rules (Phase 4)
- ลาเกินโควต้าไม่ได้ (BR#36)
- ลาได้เงิน → Timesheet = 8 ชม. ปกติ (BR#37)
- ลาไม่ได้เงิน → Timesheet = 0 ชม. (BR#38)
- วันลา → ห้ามกรอก WO Time Entry (BR#39)

### 9. Planning Rules (Phase 4)
- Daily Plan — **1 คน : 1 WO ต่อวัน** (BR#40)
- Daily Plan — **1 เครื่องมือ : 1 WO ต่อวัน** (BR#41)
- Daily Plan — พนักงานลาวันนั้น จัดลงงานไม่ได้ (BR#42)
- MaterialReservation — available = on_hand - SUM(reserved) (BR#44)
- ToolReservation — ห้ามจองซ้อนช่วงเดียวกัน (BR#45)

### 10. Data Scope (Phase 6)
- HR endpoints ต้อง filter ตาม role: staff=ของตัวเอง, supervisor=แผนก, manager/owner=ทั้ง org
- ทุก endpoint ต้องมี org_id filter (multi-tenant) — ห้ามมี endpoint ที่ไม่ filter org_id
- ใช้ shared helpers จาก `app.api._helpers` — ห้าม duplicate logic

### 11. Stock-Location Rules (Phase 11)
- **location_id optional** บน StockMovement — backward compatible กับ movements เก่า (BR#72)
- **stock_by_location.on_hand >= 0** ต่อ location (BR#69)
- **ISSUE/CONSUME** จาก location → ต้องมี stock เพียงพอที่ location นั้น (BR#70)
- **Product.on_hand** = denormalized aggregate — อัปเดต atomic ทั้ง product + stock_by_location (BR#71)
- **Low stock** = on_hand ≤ min_stock AND min_stock > 0 — highlight ใน Product List + stat card (BR#73)

---

## RBAC — 5 Roles x 133 Permissions (Full Matrix)

### Inventory (15 permissions)

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
| inventory.withdrawal.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| inventory.withdrawal.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| inventory.withdrawal.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| inventory.withdrawal.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| inventory.withdrawal.approve | ✅ | ✅ | ✅ | ❌ | ❌ |
| inventory.withdrawal.export | ✅ | ✅ | ✅ | ❌ | ✅ |

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

### Work Order (12 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| workorder.order.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| workorder.order.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| workorder.order.update | ✅ | ✅ | ✅ | ✅ | ❌ |
| workorder.order.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| workorder.order.approve | ✅ | ✅ | ✅ | ❌ | ❌ |
| workorder.order.export | ✅ | ✅ | ✅ | ✅ | ❌ |
| workorder.plan.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| workorder.plan.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| workorder.plan.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| workorder.plan.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| workorder.reservation.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| workorder.reservation.read | ✅ | ✅ | ✅ | ✅ | ✅ |

### Purchasing (11 permissions)

| Permission | owner | manager | supervisor | staff | viewer |
|-----------|:-----:|:-------:|:----------:|:-----:|:------:|
| purchasing.pr.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| purchasing.pr.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| purchasing.pr.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| purchasing.pr.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| purchasing.pr.approve | ✅ | ✅ | ✅ | ❌ | ❌ |
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

### Master Data (32 permissions)

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
| master.department.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| master.department.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| master.department.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| master.department.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| master.leavetype.create | ✅ | ✅ | ❌ | ❌ | ❌ |
| master.leavetype.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| master.leavetype.update | ✅ | ✅ | ❌ | ❌ | ❌ |
| master.leavetype.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| master.shifttype.create | ✅ | ✅ | ❌ | ❌ | ❌ |
| master.shifttype.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| master.shifttype.update | ✅ | ✅ | ❌ | ❌ | ❌ |
| master.shifttype.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| master.schedule.create | ✅ | ✅ | ❌ | ❌ | ❌ |
| master.schedule.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| master.schedule.update | ✅ | ✅ | ❌ | ❌ | ❌ |
| master.schedule.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| master.supplier.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| master.supplier.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| master.supplier.update | ✅ | ✅ | ✅ | ❌ | ❌ |
| master.supplier.delete | ✅ | ❌ | ❌ | ❌ | ❌ |

### Admin (10 permissions)

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
| admin.config.read | ✅ | ❌ | ❌ | ❌ | ❌ |
| admin.config.update | ✅ | ❌ | ❌ | ❌ | ❌ |

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

### HR (22 permissions)

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
| hr.dailyreport.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| hr.dailyreport.read | ✅ | ✅ | ✅ | ✅ | ❌ |
| hr.dailyreport.approve | ✅ | ✅ | ✅ | ❌ | ❌ |
| hr.roster.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| hr.roster.read | ✅ | ✅ | ✅ | ✅ | ❌ |

### Permission Count Summary

| Role | Count | Description |
|------|-------|-------------|
| owner | 133 | ALL permissions |
| manager | ~81 | ไม่มี admin.*, ไม่มี *.delete + planning create/update |
| supervisor | ~65 | read + approve + limited create + planning read |
| staff | ~39 | read + own create (timesheet, leave, movement, dailyreport, roster, PR, withdrawal) |
| viewer | ~26 | read + selected export only |

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

### Flow 8: Purchasing PR → PO Workflow (Redesigned)
```
Staff สร้าง PR (ใบขอซื้อ) + กำหนด Cost Center + เพิ่ม Line Items (purchasing.pr.create)
→ Submit ขออนุมัติ → status = SUBMITTED
→ Supervisor/Manager Approve PR (purchasing.pr.approve) → status = APPROVED
→ ผู้อนุมัติกด "Convert to PO" → กรอก supplier + actual unit_cost
→ PO ถูกสร้าง (auto-approved, status=APPROVED), PR → PO_CREATED
→ Goods Receipt:
  → GOODS items → InputNumber qty → RECEIVE stock movement (auto)
  → SERVICE items → ยืนยันรับงาน → no stock movement
→ ทุก line received → PO status = RECEIVED
Permissions: purchasing.pr.create → pr.approve → po (auto) → po.update (GR)
```

### Flow 9: Admin — Manage Roles & Policy
```
Owner เข้า Admin Panel (admin.role.read)
→ ปรับ Permission ต่อ role (admin.role.update)
→ ตั้ง OT Types + Factor + Max Ceiling (master.ottype.*)
→ ตั้ง Overhead Rate % ต่อ Cost Center (master.costcenter.update)
```

### Flow 10: Setup Wizard v2 (Phase 4.7)
```
First-time access → /setup page
→ Step 1: กรอกชื่อองค์กร + รหัส
→ Step 2: กำหนดแผนก (optional, max 20) — auto-create CostCenter per dept
→ Step 3: กรอกชื่อ/อีเมล/รหัสผ่าน Admin
→ POST /api/setup → สร้าง Organization + Departments + CostCenters + OT Types + Leave Types + User(role=owner) + Employee(EMP-001)
→ Auto login → redirect to Dashboard
Permission: none (once-only, disabled after first org created)
```

### Flow 11: WO Planning (Phase 4.5)
```
Manager สร้าง WO Master Plan (workorder.plan.create)
→ กำหนด planned_start, planned_end, manpower/material/tool needs
→ Supervisor สร้าง Daily Plan (workorder.plan.create)
→ จัด Workers + Tools + Materials ลง WO ต่อวัน
→ ระบบเช็ค conflict: 1 คน = 1 WO/วัน, ลา = ห้ามจัด (BR#40-42)
→ Staff เห็นงานที่ได้รับมอบหมาย → กรอก WO Time Entry
```

### Flow 12: Material/Tool Reservation (Phase 4.5)
```
Manager จองวัสดุ → POST /api/planning/reservations/material
→ ระบบเช็ค available = on_hand - SUM(reserved) (BR#44)
Manager จองเครื่องมือ → POST /api/planning/reservations/tool
→ ระบบเช็ค overlap ช่วงวันที่ (BR#45)
→ Status: RESERVED → FULFILLED / CANCELLED
```

---

## Business Rules (Complete — 77 Rules)

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
| 36 | hr | Leave | ลาเกินโควต้าไม่ได้ (used + days <= quota) | Service check |
| 37 | hr | Leave | ลาได้เงิน → Timesheet = 8 ชม. ปกติ (payroll เต็ม) | Auto calc |
| 38 | hr | Leave | ลาไม่ได้เงิน → Timesheet = 0 ชม. (หัก payroll) | Auto calc |
| 39 | hr | Leave | วันลา → ห้ามกรอก WO Time Entry | Service check |
| 40 | planning | Daily Plan | 1 คน : 1 WO ต่อวัน (conflict check) | DB UNIQUE + Service |
| 41 | planning | Daily Plan | 1 เครื่องมือ : 1 WO ต่อวัน (conflict check) | DB UNIQUE + Service |
| 42 | planning | Daily Plan | พนักงานลาวันนั้น จัดลงงานไม่ได้ | Service check |
| 43 | planning | Daily Plan | วางแผนล่วงหน้าได้ 14 วัน, แก้ไขได้ | Service check |
| 44 | planning | Reservation | MaterialReservation: available = on_hand - SUM(reserved) | Service check |
| 45 | planning | Reservation | ToolReservation: ห้ามจองซ้อนช่วงเดียวกัน | Service check |
| 46 | planning | Master Plan | WO Master Plan — 1 plan per WO | DB UNIQUE |
| 47 | hr | Employee | hire_date required for new employees (optional for existing) | Frontend + Schema |
| 48 | hr | Staff Portal | Staff sees only own data (ของฉัน menu group) | Data scope |
| 49 | hr | Daily Report | Daily Work Report per employee per day (REGULAR/OT lines) | Service |
| 50 | hr | Daily Report | 1 report per employee per day per org | DB UNIQUE + Service |
| 51 | hr | Daily Report | Time overlap validation within same line type | Service check |
| 52 | hr | Daily Report | Auto-create Timesheet WO Time Entry on approve | Auto calc |
| 53 | hr | Daily Report | Auto-update StandardTimesheet OT hours on approve | Auto calc |
| 54 | hr | Daily Report | Edit only DRAFT/REJECTED status | State machine |
| 55 | hr | Daily Report | Supervisor sees only own department reports | Data scope |
| 56 | purchasing | PR | ทุก PR ต้องมี cost_center_id | Schema + DB NOT NULL |
| 57 | purchasing | PR | ทุก PR line ต้องมี cost_element_id | Schema + DB NOT NULL |
| 58 | purchasing | PR | GOODS line ต้องมี product_id | Schema validator |
| 59 | purchasing | PR | SERVICE line ต้องมี description | Schema validator |
| 60 | purchasing | PR | PR status flow: DRAFT→SUBMITTED→APPROVED→PO_CREATED (REJECTED/CANCELLED) | State machine |
| 61 | purchasing | PO | PO ต้องสร้างจาก PR เท่านั้น (บังคับ pr_id สำหรับ new PO) | Service check |
| 62 | purchasing | PO | 1 PR : 1 PO (unique pr_id on PO) | DB UNIQUE |
| 63 | purchasing | GR | GOODS item → auto RECEIVE stock movement | Service logic |
| 64 | purchasing | GR | SERVICE item → manual confirm (no stock movement) | Service logic |
| 65 | inventory | Product | SERVICE products ห้ามสร้าง stock movement | Service check |
| 66 | purchasing | PR | Data Scope: staff=ตัวเอง, supervisor=แผนก, manager/owner=ทั้ง org | API helpers |
| 67 | purchasing | PR | BLANKET PR ต้องมี validity_start_date + validity_end_date | Schema validator |
| 68 | purchasing | PR | validity_end_date >= validity_start_date | Schema validator |
| 69 | inventory | Stock | stock_by_location.on_hand >= 0 ต่อ location | DB CHECK + Service |
| 70 | inventory | Stock | ISSUE/CONSUME จาก location ต้องมี stock เพียงพอที่ location นั้น | Service check |
| 71 | inventory | Stock | Product.on_hand = SUM(stock_by_location.on_hand) + unlocated stock (denormalized) | Atomic update |
| 72 | inventory | Stock | location_id optional บน StockMovement (backward compatible กับ movements เก่า) | Nullable FK |
| 73 | inventory | Stock | Low stock = on_hand ≤ min_stock AND min_stock > 0 | Computed |
| 74 | inventory | CONSUME | CONSUME ต้องมี work_order_id + WO.status=OPEN + product ∈ {MATERIAL, CONSUMABLE} | Service check |
| 75 | inventory | RETURN | RETURN ต้องมี work_order_id + WO.status=OPEN + product ∈ {MATERIAL, CONSUMABLE} | Service check |
| 76 | inventory | ISSUE | ISSUE ต้องมี cost_center_id (active + org match) | Service check |
| 77 | inventory | TRANSFER | TRANSFER ต้องมี location_id (source) + to_location_id (dest), ต่างกัน, atomic 2 ฝั่ง | Service check |
| 78 | inventory | ADJUST | ADJUST ต้องมี adjust_type (INCREASE/DECREASE), owner only | Service check |
| 79 | inventory | RETURN | Material Cost = Σ(CONSUME) − Σ(RETURN), capped at 0 | Service calc |
| 80 | inventory | Withdrawal | WO_CONSUME → work_order_id required, WO must be OPEN | Schema + Service |
| 81 | inventory | Withdrawal | CC_ISSUE → cost_center_id required, active + org match | Schema + Service |
| 82 | inventory | Withdrawal | ทุก product ต้องเป็น MATERIAL/CONSUMABLE (ห้าม SERVICE) | Service check |
| 83 | inventory | Withdrawal | Status flow: DRAFT → PENDING → ISSUED (+ CANCELLED) | State machine |
| 84 | inventory | Withdrawal | Delete DRAFT only | Permission + Service |
| 85 | inventory | Withdrawal | Issue สร้าง StockMovement ต่อ line (issued_qty > 0) | Service logic |
| 86 | inventory | Withdrawal | Lines with issued_qty = 0 → skip (ไม่สร้าง movement) | Service logic |
| 87 | inventory | Withdrawal | Stock validation ผ่าน create_movement() ที่มีอยู่ (BR#5,6,69-70) | Reuse existing |
| 88 | inventory | Withdrawal | ISSUED แล้วแก้ไม่ได้ — corrections ผ่าน movement REVERSAL | State machine |

---

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
| Purchasing: PR | ของตัวเอง | แผนกตัวเอง | ทั้ง org |
| Operations (WO, Inventory, etc.) | ทั้ง org | ทั้ง org | ทั้ง org |
| Finance Reports | ❌ (no perm) | ❌ (no perm) | ทั้ง org |

### Implementation Pattern
ทุก HR endpoint ที่มี data scope ต้องใช้ pattern:
- Import: `from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids`
- Staff → `resolve_employee_id(db, user_id)` → force own data
- Supervisor → `resolve_employee(db, user_id)` → `get_department_employee_ids(db, emp.department_id, org_id)`
- Manager/Owner → no filter

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
GET    /api/stock/movements                 inventory.movement.read      (?location_id=&work_order_id=&movement_type=)
POST   /api/stock/movements                 inventory.movement.create    (body: +location_id, work_order_id, cost_center_id, cost_element_id, to_location_id, adjust_type)
POST   /api/stock/movements/{id}/reverse    inventory.movement.delete
```

### Stock by Location
```
GET    /api/inventory/stock-by-location     inventory.product.read       (?product_id=&location_id=&warehouse_id=)
GET    /api/inventory/low-stock-count       inventory.product.read       → {count: int}
```

### Stock Withdrawal Slips (ใบเบิกของ)
```
GET    /api/inventory/withdrawal-slips              inventory.withdrawal.read     (?search, status, withdrawal_type, limit, offset)
POST   /api/inventory/withdrawal-slips              inventory.withdrawal.create
GET    /api/inventory/withdrawal-slips/{id}         inventory.withdrawal.read
PUT    /api/inventory/withdrawal-slips/{id}         inventory.withdrawal.update   (DRAFT only)
DELETE /api/inventory/withdrawal-slips/{id}         inventory.withdrawal.delete   (DRAFT only)
POST   /api/inventory/withdrawal-slips/{id}/submit  inventory.withdrawal.create   (DRAFT→PENDING)
POST   /api/inventory/withdrawal-slips/{id}/issue   inventory.withdrawal.approve  (PENDING→ISSUED, creates movements)
POST   /api/inventory/withdrawal-slips/{id}/cancel  inventory.withdrawal.update   (→CANCELLED)
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
GET    /api/work-orders/{id}/materials      workorder.order.read         (CONSUME + RETURN movements)
```

### Purchasing — PR (Purchase Requisition)
```
GET    /api/purchasing/pr                    purchasing.pr.read      (?search, status, pr_type, limit, offset)
POST   /api/purchasing/pr                    purchasing.pr.create
GET    /api/purchasing/pr/{id}               purchasing.pr.read
PUT    /api/purchasing/pr/{id}               purchasing.pr.update    (DRAFT/SUBMITTED only)
DELETE /api/purchasing/pr/{id}               purchasing.pr.delete    (DRAFT only, owner only)
POST   /api/purchasing/pr/{id}/submit        purchasing.pr.create    (DRAFT → SUBMITTED)
POST   /api/purchasing/pr/{id}/approve       purchasing.pr.approve   (body: {action, reason})
POST   /api/purchasing/pr/{id}/convert-to-po purchasing.pr.approve   (body: ConvertToPORequest)
```

### Purchasing — PO (Purchase Order)
```
GET    /api/purchasing/po                   purchasing.po.read
POST   /api/purchasing/po                   purchasing.po.create    (blocked — PO created via convert only)
GET    /api/purchasing/po/{id}             purchasing.po.read
PUT    /api/purchasing/po/{id}             purchasing.po.update
DELETE /api/purchasing/po/{id}             purchasing.po.delete
POST   /api/purchasing/po/{id}/approve      purchasing.po.approve
POST   /api/purchasing/po/{id}/receive      purchasing.po.update    (GOODS→stock movement, SERVICE→confirm only, +delivery_note_number)
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
GET    /api/master/suppliers                master.supplier.read
POST   /api/master/suppliers                master.supplier.create
GET    /api/master/suppliers/{id}           master.supplier.read
PUT    /api/master/suppliers/{id}           master.supplier.update
DELETE /api/master/suppliers/{id}           master.supplier.delete
```

### Shift Types (Phase 4.9)
```
GET    /api/master/shift-types              master.shifttype.read
POST   /api/master/shift-types              master.shifttype.create
GET    /api/master/shift-types/{id}         master.shifttype.read
PUT    /api/master/shift-types/{id}         master.shifttype.update
DELETE /api/master/shift-types/{id}         master.shifttype.delete
```

### Work Schedules (Phase 4.9)
```
GET    /api/master/work-schedules           master.schedule.read
POST   /api/master/work-schedules           master.schedule.create
GET    /api/master/work-schedules/{id}      master.schedule.read
PUT    /api/master/work-schedules/{id}      master.schedule.update
DELETE /api/master/work-schedules/{id}      master.schedule.delete
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
GET    /api/hr/leave                        hr.leave.read        (?status=PENDING|APPROVED|REJECTED)
POST   /api/hr/leave                        hr.leave.create
POST   /api/hr/leave/{id}/approve           hr.leave.approve     (body: {action: "approve"|"reject"})
```

### HR — Shift Roster (Phase 4.9)
```
GET    /api/hr/roster                       hr.roster.read       (?employee_id=&start_date=&end_date=)
POST   /api/hr/roster/generate              hr.roster.create     (body: RosterGenerateRequest + pattern_offset for ROTATING)
PUT    /api/hr/roster/{id}                  hr.roster.create     (manual override)
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

### Setup (Phase 4.7)
```
POST   /api/setup                           — (no auth, once-only)
```

### Organization & Config (Phase 4.1)
```
GET    /api/admin/organization              admin.config.read
PUT    /api/admin/organization              admin.config.update
GET    /api/admin/config/work               admin.config.read
PUT    /api/admin/config/work               admin.config.update
GET    /api/admin/config/approval           admin.config.read
PUT    /api/admin/config/approval           admin.config.update
```

### Department (Phase 4.1)
```
GET    /api/master/departments              master.department.read
POST   /api/master/departments              master.department.create
PUT    /api/master/departments/{id}         master.department.update
DELETE /api/master/departments/{id}         master.department.delete
```

### Leave Type (Phase 4.3)
```
GET    /api/master/leave-types              master.leavetype.read
POST   /api/master/leave-types              master.leavetype.create
PUT    /api/master/leave-types/{id}         master.leavetype.update
DELETE /api/master/leave-types/{id}         master.leavetype.delete
```

### Leave Balance (Phase 4.3)
```
GET    /api/hr/leave-balance                hr.leave.read
PUT    /api/hr/leave-balance/{id}           hr.employee.update
```

### Batch Timesheet (Phase 4.4)
```
POST   /api/hr/timesheet/batch              hr.timesheet.create
GET    /api/hr/standard-timesheet           hr.timesheet.read
POST   /api/hr/standard-timesheet/generate  hr.timesheet.execute
```

### Approvers (Phase 4.2)
```
GET    /api/approvers?module=               — (JWT, any authenticated user)
```

### WO Master Plan (Phase 4.5)
```
GET    /api/work-orders/{id}/plan           workorder.plan.read
POST   /api/work-orders/{id}/plan           workorder.plan.create
PUT    /api/work-orders/{id}/plan           workorder.plan.update
```

### Daily Plan & Reservation (Phase 4.5)
```
GET    /api/planning/daily                  workorder.plan.read
POST   /api/planning/daily                  workorder.plan.create
PUT    /api/planning/daily/{id}             workorder.plan.update
DELETE /api/planning/daily/{id}             workorder.plan.delete
GET    /api/planning/conflicts              workorder.plan.read
GET    /api/planning/reservations/material  workorder.reservation.read
POST   /api/planning/reservations/material  workorder.reservation.create
GET    /api/planning/reservations/tool      workorder.reservation.read
POST   /api/planning/reservations/tool      workorder.reservation.create
PUT    /api/planning/reservations/{id}/cancel  workorder.reservation.create
```

### Daily Work Report (Phase 5)
```
GET    /api/daily-report                    hr.dailyreport.read
POST   /api/daily-report                    hr.dailyreport.create
GET    /api/daily-report/{id}               hr.dailyreport.read
PUT    /api/daily-report/{id}               hr.dailyreport.create
POST   /api/daily-report/{id}/submit        hr.dailyreport.create
POST   /api/daily-report/{id}/approve       hr.dailyreport.approve
POST   /api/daily-report/batch-approve      hr.dailyreport.approve
POST   /api/daily-report/{id}/reject        hr.dailyreport.approve
```

### Performance Monitoring (Phase 14)
```
GET    /api/admin/performance/summary       admin.config.read    (?period=24h|7d|30d)
GET    /api/admin/performance/endpoints     admin.config.read    (per-endpoint breakdown)
GET    /api/admin/performance/slow-requests admin.config.read    (?limit=50)
POST   /api/admin/performance/vitals        — (JWT, frontend beacon)
POST   /api/admin/performance/analyze       admin.config.read    (body: {period, focus})
GET    /api/admin/performance/analysis/latest  admin.config.read
POST   /api/admin/performance/analyze/endpoint admin.config.read (body: {path, period})
POST   /api/admin/performance/ask           admin.config.read    (body: {question})
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
python -m app.seed                                     # Create full org: 3 depts, 5 users, 5 employees, OT/Leave types

# --- Frontend ---
cd frontend
npm install                                            # Install deps
npm run dev                                            # Dev server
npm run build                                          # Production build
```

### Test Credentials (Dev)

| Email | Password | Role |
|-------|----------|------|
| owner@sss-corp.com | owner123 | owner (all 133 perms) |
| manager@sss-corp.com | manager123 | manager (~73 perms) |
| supervisor@sss-corp.com | supervisor123 | supervisor (~57 perms) |
| staff@sss-corp.com | staff123 | staff (~36 perms) |
| viewer@sss-corp.com | viewer123 | viewer (~23 perms) |

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

### Phase 3 — Business Flow + Frontend ✅
- [x] Customer: CRUD (5 endpoints)
- [x] Purchasing: PO → approve → GR → RECEIVE movements (7 endpoints)
- [x] Sales Orders: CRUD + approve (6 endpoints)
- [x] Finance Reports: summary + CSV export (2 endpoints)
- [x] Admin Panel: roles/permissions/users/audit-log (6 endpoints, BR#31-33)
- [x] Full React Frontend for all modules (54 files, Batch 1-7 complete)
- [x] Backend: `GET /api/hr/payroll/export` endpoint implemented (CSV StreamingResponse)
- [x] UI_GUIDELINES.md v4 synced with all frontend files
- [x] Route wiring verified + API path fixes applied

### Phase 4 — Organization, Planning & Production ✅
- [x] **4.1** Organization & Department — Org model, Department CRUD, OrgWorkConfig, OrgApprovalConfig
- [x] **4.2** Approval Flow Overhaul — requested_approver_id on all documents, bypass config
- [x] **4.3** Leave System Upgrade — LeaveType master, LeaveBalance, quota enforcement (BR#36-39)
- [x] **4.4** Timesheet Redesign — StandardTimesheet (auto), WO Time Entry batch form
- [x] **4.5** WO Planning & Reservation — Master Plan, Daily Plan, Material/Tool Reservation (BR#40-46)
- [x] **4.6** Email Notification — SMTP service, approval request emails (disabled by default)
- [x] **4.7** Multi-tenant Enforcement — org_id in JWT, all queries filtered, Setup Wizard v2 (4-step with departments)
- [x] **4.8** Deploy & Production — Vercel (SPA + headers), Railway (Docker), Sentry, security hardening
- [x] **4.9** Shift Management — ShiftType (master), WorkSchedule (FIXED/ROTATING), ShiftRoster (daily per-employee), Employee.work_schedule_id, Staff Schedule Selector (MyTimesheetPage), OrgWorkConfig-based weekend detection, pattern_offset for ROTATING roster start position

### Phase 5 — Staff Portal & Daily Report ✅
- [x] **5.1** Employee hire_date + /me API employee fields (BR#47)
- [x] **5.2** Daily Work Report backend: model, schema, service, API, migration (BR#49-54)
- [x] **5.3** Staff Portal: 4 pages (MyDailyReport, MyLeave, MyTimesheet, MyTasks) (BR#48)
- [x] **5.4** DailyReportApprovalTab with batch approve/reject (BR#55)
- [x] **5.5** WO ManHour Summary: backend + frontend
- [x] **5.6** Sidebar refactor: grouped menu ("ของฉัน" / "ระบบงาน")
- [x] **5.7** Phase 4 leftovers: Leave names+colors, LeaveBalanceTab, MasterPlanSection
- [x] **5.8** E2E testing — 15 scenarios PASSED

### Phase 6 — Data Scope: Role-Based Data Visibility ✅
**Backend (6.1-6.7):**
- [x] **6.1** Shared helpers (`_helpers.py`) — resolve_employee_id, resolve_employee, get_department_employee_ids
- [x] **6.2** Critical Security — Missing org_id filter fixed (finance, planning, admin, hr)
- [x] **6.3** Role-Based Filter — Timesheet (staff=own, supervisor=dept, manager/owner=all)
- [x] **6.4** Role-Based Filter — Leave + Leave Balance (same pattern)
- [x] **6.5** Role-Based Filter — Employee (supervisor=dept)
- [x] **6.6** Refactor daily_report.py — shared helpers, removed duplicates
- [x] **6.7** Data scope ownership validation on create (staff=self only)

**Frontend (6.8-6.14):**
- [x] **6.8** Backend: department_name in `/api/auth/me` + authStore
- [x] **6.9** Fix MePage bug — employee_id guard on 3 API calls
- [x] **6.10** ScopeBadge component — role-aware scope indicator (cyan/purple/green)
- [x] **6.11** SupervisorDashboard — 3-way dashboard routing (staff/supervisor/admin)
- [x] **6.12** EmployeeContextSelector — role-scoped employee dropdown
- [x] **6.13** HR Page scope UI — EmployeeContextSelector on 5 tabs + ScopeBadge
- [x] **6.14** MePage viewer fix — permission-filtered tabs, ME menu visibility

**Enhanced Seed & Scalability (6.15-6.18):**
- [x] **6.15** Enhanced Seed Data — seed.py rewrite: full org structure (3 CostCenters, 3 Departments, 5 Employees, OT/Leave types, LeaveBalances)
- [x] **6.16** Setup Wizard v2 — 4-step wizard (org → departments → admin → done), auto-create CostCenter/OT/Leave/Employee
- [x] **6.17** EmployeeContextSelector scalability — department grouping for manager/owner + server-side search with 300ms debounce
- [x] **6.18** DailyReportApprovalTab + MePage — employee filter on approval tab + department name display on MePage

### Phase 7 — My Approval: Centralized Approval Center ✅
**Backend (7.1-7.2):**
- [x] **7.1** BUG-1 Fix: Leave approve API now accepts `{action: "approve"|"reject"}` body — reject was broken before
- [x] **7.2** Leave list API: added `status` query param for server-side filtering (PENDING/APPROVED/REJECTED)

**Frontend (7.3-7.8):**
- [x] **7.3** ApprovalPage.jsx — Main tab container with 5 tabs + badge counts (Promise.all limit=1)
- [x] **7.4** TimesheetApprovalTab.jsx — Approve (SUBMITTED) + Final (APPROVED) with EmployeeContextSelector
- [x] **7.5** LeaveApprovalTab.jsx — Approve/Reject with Popconfirm, PENDING filter
- [x] **7.6** POApprovalTab.jsx — Approve + View detail for SUBMITTED POs
- [x] **7.7** SOApprovalTab.jsx — Approve + View detail for SUBMITTED SOs
- [x] **7.8** App.jsx — Sidebar 3-group (ME/อนุมัติ/ระบบงาน) + `/approval` route + ClipboardCheck icon

### Phase 7.9 — PR/PO Redesign: Purchase Requisition System ✅
**Backend (7.9.1-7.9.5):**
- [x] **7.9.1** Models: PR enums (PRStatus, PRPriority, PRItemType, PRType) + PurchaseRequisition + PurchaseRequisitionLine + SERVICE ProductType + PO model extensions (pr_id, cost_center_id, item_type, cost_element_id, received_by/at)
- [x] **7.9.2** Migration: 2 new tables + 8 new columns on PO/PO lines + SERVICE enum value
- [x] **7.9.3** Permissions: +5 purchasing.pr.* (create/read/update/delete/approve) → 118→123
- [x] **7.9.4** Schemas: PRCreate/Update/Response + ConvertToPORequest + enhanced PO/GR schemas
- [x] **7.9.5** Services + API: PR CRUD + submit + approve/reject + convert_pr_to_po + data scope + block SERVICE stock movements + enhanced GR (GOODS→movement, SERVICE→confirm)

**Frontend (7.9.6-7.9.9):**
- [x] **7.9.6** PurchasingPage (tabbed container PR+PO) + PRTab + POTab + PRFormModal (dynamic lines, BLANKET fields)
- [x] **7.9.7** PRDetailPage (approve/reject/convert/cancel) + ConvertToPOModal (price comparison) + GoodsReceiptModal (GOODS+SERVICE sections)
- [x] **7.9.8** PODetailPage (PR ref, item_type, GR modal) + PRApprovalTab + ApprovalPage PR tab
- [x] **7.9.9** App.jsx (routes, sidebar, _purchasing_check) + permissionMeta + StatusBadge (PO_CREATED, SERVICE)

### Phase 8 — Dashboard & Analytics 📊 (Planned)
- [ ] **8.1** KPI Dashboard — real-time stat cards (ยอดขาย, ต้นทุน WO, สถานะ stock, pending approvals)
- [ ] **8.2** Charts — Recharts/Ant Charts (WO Cost Trend, Inventory Turnover, Revenue)
- [ ] **8.3** Manager Dashboard v2 — department comparison, cost center breakdown, employee productivity
- [ ] **8.4** Staff Dashboard v2 — personal KPIs (WO assigned, hours logged, leave balance)
- [ ] **8.5** Finance Dashboard — P&L summary, cost analysis, budget vs actual
- [ ] **8.6** Backend: aggregation APIs for dashboard data (materialized views / on-the-fly)

### Phase 9 — Notification Center 🔔 (Planned)
- [ ] **9.1** Model: `Notification` (user_id, type, title, message, is_read, link, created_at)
- [ ] **9.2** Backend: Notification service — create on events (approval request, status change, stock alert)
- [ ] **9.3** API: `GET /api/notifications` + `PATCH /api/notifications/{id}/read` + `POST /api/notifications/read-all`
- [ ] **9.4** Frontend: Bell icon in header — dropdown with notification list + unread badge count
- [ ] **9.5** Real-time: WebSocket or SSE for instant push (optional, can start with polling)
- [ ] **9.6** Integration: connect with existing email service (Phase 4.6) — dual channel (in-app + email)
- [ ] **9.7** Notification preferences: user can toggle per-event-type (in-app / email / both / none)

### Phase 10 — Export & Print 🖨️ (Planned)
- [ ] **10.1** PDF generation — backend (WeasyPrint or ReportLab) or frontend (jsPDF + html2canvas)
- [ ] **10.2** WO Report PDF — cost summary, material list, manhour breakdown, tools recharge
- [ ] **10.3** PO / SO PDF — document header, line items, totals, approval signatures
- [ ] **10.4** Payroll PDF — employee payslip, period summary
- [ ] **10.5** Excel export (xlsx) — all list pages via backend (openpyxl) or frontend (SheetJS)
- [ ] **10.6** Print-friendly CSS — `@media print` styles for key pages
- [ ] **10.7** Report templates — admin-configurable headers (company logo, address)

### Phase 11 — Inventory Enhancement 📦 (Partial ✅)
- [x] **11.1** Stock-Location Integration — StockMovement.location_id FK + stock_by_location table (per-product per-location on_hand) + location-aware RECEIVE/ISSUE/CONSUME + reverse (BR#69-72)
- [x] **11.2** Low Stock Alert — min_stock field + is_low_stock computed + stat card on Supply Chain page + Product List row highlight (BR#73)
- [x] **11.3** GR Location Picker — GoodsReceiptModal Warehouse/Location cascade picker for GOODS lines
- [x] **11.4** Manual Movement Location — MovementCreateModal Warehouse/Location cascade picker
- [x] **11.5** Movement Location Display — MovementListPage Location column + location filter
- [x] **11.6** Seed Data — 1 Warehouse, 3 Locations (RECEIVING/STORAGE/SHIPPING), 5 Products (3 MATERIAL + 1 CONSUMABLE + 1 SERVICE), 3 Tools
- [x] **11.7** PO QR Code — QR Code on PO document (antd `<QRCode>`), scan → auto-open GR, print label (`@media print`)
- [x] **11.8** Delivery Note Number — เลขใบวางของ field in GR Modal → stored on PO → displayed in PO Detail + PO List
- [x] **11.9** Supplier Master Data — Supplier CRUD (code, name, contact, email, phone, address, tax_id) + PO.supplier_id FK + ConvertToPO dropdown + 4 permissions (127 total)
- [x] **11.10** Stock Withdrawal Scenarios — 5 movement types fixed: CONSUME→WO (work_order_id), ISSUE→CostCenter, TRANSFER 2-way atomic, ADJUST INCREASE/DECREASE, RETURN new type + WO Material Cost = CONSUME−RETURN (BR#74-79)
- [x] **11.10B** Stock Withdrawal Slip (ใบเบิกของ) — Multi-line withdrawal document (Header+Lines), DRAFT→PENDING→ISSUED workflow, WO_CONSUME/CC_ISSUE types, print, issue creates movements per line, 6 new permissions (127→133), 8 API endpoints (BR#80-88)
- [ ] **11.11** Stock Aging Report — inventory value by age bracket (0-30, 31-60, 61-90, 90+ days)
- [ ] **11.12** Batch/Lot Tracking — batch_number on StockMovement, FIFO/LIFO costing option
- [ ] **11.13** Barcode/QR — generate barcode for SKU (frontend display + print label)
- [ ] **11.14** Stock Take — cycle count workflow (count → variance → adjust)
- [ ] **11.15** Multi-warehouse Transfer — TRANSFER movement between warehouses with approval

### Phase 12 — Mobile Responsive 📱 (Planned)
- [ ] **12.1** Responsive layout — Ant Design Grid breakpoints, collapsible sidebar mobile-first
- [ ] **12.2** Mobile Staff Portal — Daily Report create/edit from phone
- [ ] **12.3** Mobile Tool check-in/out — simplified form for field workers
- [ ] **12.4** Mobile Approval — swipe approve/reject on approval list
- [ ] **12.5** PWA — manifest.json, service worker, offline-first for read operations
- [ ] **12.6** Touch-optimized UI — larger tap targets, bottom navigation bar (mobile only)

### Phase 13 — Audit & Security Enhancement 🔐 (Planned)
- [ ] **13.1** Enhanced Audit Trail — model-level event logging (who, what, when, before/after values)
- [ ] **13.2** Login History — device, IP, location, timestamp per user
- [ ] **13.3** Session Management — active sessions list, remote logout
- [ ] **13.4** Password Policy — min length, complexity, expiry, history (no reuse)
- [ ] **13.5** Two-Factor Auth (2FA) — TOTP (Google Authenticator) or email OTP
- [ ] **13.6** API Rate Limiting per user — prevent abuse (beyond current global rate limit)
- [ ] **13.7** Data Export Audit — log all export/download actions for compliance

### Phase 14 — AI-Powered Performance Monitoring ⚡🤖 (Planned)
- [ ] **14.1** Backend Middleware — `PerformanceMiddleware` (response time, `X-Response-Time` header, slow request flagging)
- [ ] **14.2** DB Query Profiler — SQLAlchemy event listeners, slow query logging (>100ms), N+1 detection
- [ ] **14.3** Performance Data Storage — `PerformanceLog` model + Redis real-time buffer + 30-day retention
- [ ] **14.4** Frontend Performance Collection — Web Vitals (LCP/FID/CLS), API call timing, beacon upload
- [ ] **14.5** Aggregation API — `GET /api/admin/performance/summary` (avg/p95/p99, slowest endpoints, error rate)
- [ ] **14.6** AI Analysis Engine — Claude API (`anthropic` SDK), aggregation→prompt→analysis, Thai language output
- [ ] **14.7** AI Analysis API — `POST /api/admin/performance/analyze`, cached results, severity rating
- [ ] **14.8** Natural Language Query — `POST /api/admin/performance/ask` (ถามเป็นภาษาคน → AI ตอบ)
- [ ] **14.9** Performance Dashboard UI — `PerformancePage.jsx` (stat cards + AI card + charts + detail tables)
- [ ] **14.10** AI Chat Panel — `PerformanceAIChat.jsx` (drawer, chat bubbles, quick questions, markdown rendering)
- [ ] **14.11** Sentry Integration Enhancement — transaction tracing, browser tracing, AI supplement
- [ ] **14.12** Scheduled AI Report — daily 06:00 background job, email digest, critical severity notification
- [ ] **14.13** Optimization Suggestions — Index Advisor, Cache Advisor, N+1 Resolver, Bundle Advisor

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
14. ❌ อย่าลืม org_id filter บนทุก query — multi-tenant enforcement (Phase 4.7)
15. ❌ อย่าให้ Daily Plan จัดคนซ้ำ WO เดียวกัน (1 คน : 1 WO/วัน) (BR#40)
16. ❌ อย่าให้ลาเกินโควต้า — ต้องเช็ค LeaveBalance ก่อน (BR#36)
17. ❌ อย่าใช้ JWT_SECRET_KEY default ใน production — ระบบจะ RuntimeError (Phase 4.8)
18. ❌ อย่าลืม data scope — HR endpoints ต้อง filter ตาม role ไม่ใช่แค่ permission
19. ❌ อย่าสร้าง endpoint ใหม่โดยไม่มี org_id filter
20. ❌ อย่าสร้าง PO ตรงโดยไม่ผ่าน PR — PO ต้องมี pr_id เสมอ (ยกเว้นข้อมูลเก่า) (BR#61)
21. ❌ อย่าสร้าง stock movement สำหรับ SERVICE products (BR#65)
22. ❌ อย่าลืม cost_center_id บน PR + cost_element_id บนทุก PR line (BR#56-57)
23. ❌ อย่าลืมอัปเดต stock_by_location เมื่อสร้าง movement ที่มี location_id — ต้อง atomic กับ Product.on_hand (BR#71)
24. ❌ อย่า ISSUE/CONSUME จาก location ที่มี stock ไม่พอ — ต้องเช็ค stock_by_location.on_hand ก่อน (BR#70)
25. ❌ อย่าสร้าง CONSUME/RETURN movement โดยไม่มี work_order_id — ต้อง validate WO exists + OPEN (BR#74-75)
26. ❌ อย่าสร้าง ISSUE movement โดยไม่มี cost_center_id — ต้อง validate CostCenter exists + active (BR#76)
27. ❌ อย่าลืม TRANSFER ต้อง atomic 2 ฝั่ง — source ลด + dest เพิ่ม, product.on_hand ไม่เปลี่ยน (BR#77)
28. ❌ อย่าลืม RETURN หักจาก Material Cost ใน WO Cost Summary — Material = CONSUME − RETURN, cap 0 (BR#79)
29. ❌ อย่าแก้ไข Withdrawal Slip ที่ ISSUED แล้ว — corrections ผ่าน movement REVERSAL เท่านั้น (BR#88)
30. ❌ อย่าสร้าง Withdrawal Slip ที่มี SERVICE products — ต้องเป็น MATERIAL/CONSUMABLE เท่านั้น (BR#82)
31. ❌ อย่าลืม Issue ต้อง reuse `create_movement()` — ไม่ duplicate stock logic (BR#85,87)

---

## Reference Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | ← ไฟล์นี้ — อ่านก่อนทำงานทุกครั้ง |
| `UI_GUIDELINES.md` | Theme (Full Dark + Cyan), icons (Lucide), layout, language rules |
| `BUSINESS_POLICY.md` | Business rules (source of truth) |
| `TODO.md` | Implementation tracker + checklist |
| `SmartERP_Master_Document_v2.xlsx` | Original design spec |
| `backend/app/core/permissions.py` | RBAC permissions + role mapping + PERMISSION_DESCRIPTIONS (133 Thai descriptions) |
| `backend/app/core/security.py` | JWT token creation/validation |
| `backend/app/core/config.py` | Environment settings + DEFAULT_ORG_ID |
| `frontend/src/stores/authStore.js` | Auth state + token management |
| `frontend/src/hooks/usePermission.js` | RBAC hook for components |
| `frontend/src/components/StatusBadge.jsx` | Reusable status badge (33+ statuses) |
| `backend/app/models/organization.py` | Org, Department, OrgConfig models |
| `backend/app/models/planning.py` | WOMasterPlan, DailyPlan, Reservations |
| `backend/app/models/daily_report.py` | DailyWorkReport model (Phase 5) |
| `backend/app/services/email.py` | SMTP email notification service |
| `backend/app/api/setup.py` | One-time setup wizard API |
| `backend/app/api/planning.py` | Daily plans + reservations API |
| `backend/app/api/daily_report.py` | Daily Work Report API (Phase 5) |
| `frontend/src/pages/setup/SetupWizardPage.jsx` | First-time org setup wizard v2 (4-step with departments) |
| `frontend/src/pages/my/MyDailyReportPage.jsx` | Staff — Daily Work Report (Phase 5) |
| `frontend/src/pages/my/MyLeavePage.jsx` | Staff — My Leave (Phase 5) |
| `frontend/src/pages/my/MyTimesheetPage.jsx` | Staff — My Timesheet + Schedule Selector + Roster (Phase 5 + 4.9 UX) |
| `frontend/src/pages/my/MyTasksPage.jsx` | Staff — My Tasks (Phase 5) |
| `frontend/src/pages/hr/DailyReportApprovalTab.jsx` | Supervisor — Batch approve (Phase 5) |
| `backend/app/api/_helpers.py` | Shared data scope helpers (Phase 6) |
| `frontend/src/components/ScopeBadge.jsx` | Role-aware scope indicator badge (Phase 6) |
| `frontend/src/components/EmployeeContextSelector.jsx` | Role-scoped employee dropdown + dept grouping + server-side search (Phase 6) |
| `backend/app/seed.py` | Enhanced dev seed: 3 depts, 5 users, 5 employees, OT/Leave types, LeaveBalances, 1 warehouse, 3 locations, 5 products, 3 tools, 5 suppliers |
| `frontend/src/pages/approval/ApprovalPage.jsx` | Centralized Approval Center — 6 tabs + badge counts (Phase 7+) |
| `frontend/src/pages/approval/TimesheetApprovalTab.jsx` | Timesheet approve/final (Phase 7) |
| `frontend/src/pages/approval/LeaveApprovalTab.jsx` | Leave approve/reject (Phase 7) |
| `frontend/src/pages/approval/POApprovalTab.jsx` | PO approve (Phase 7) |
| `frontend/src/pages/approval/SOApprovalTab.jsx` | SO approve (Phase 7) |
| `frontend/src/utils/permissionMeta.js` | Permission UI metadata: MODULE_META, RESOURCE_META, ACTION_META, buildPermissionTree() |
| `frontend/src/pages/master/ShiftTypeTab.jsx` | ShiftType master data CRUD (Phase 4.9) |
| `frontend/src/pages/master/WorkScheduleTab.jsx` | WorkSchedule master data CRUD — FIXED/ROTATING (Phase 4.9) |
| `frontend/src/pages/hr/RosterTab.jsx` | Shift Roster viewer + generate + manual override (Phase 4.9) |
| `frontend/src/pages/purchasing/PurchasingPage.jsx` | Tabbed container (PR+PO tabs) + stat cards (Phase 7.9) |
| `frontend/src/pages/purchasing/PRTab.jsx` | PR list + search/filter/CRUD (Phase 7.9) |
| `frontend/src/pages/purchasing/PRFormModal.jsx` | Create/edit PR with dynamic lines, BLANKET fields (Phase 7.9) |
| `frontend/src/pages/purchasing/PRDetailPage.jsx` | PR detail + approve/reject/convert/cancel (Phase 7.9) |
| `frontend/src/pages/purchasing/ConvertToPOModal.jsx` | Convert approved PR to PO — price comparison + supplier dropdown (Phase 7.9 + 11) |
| `frontend/src/pages/purchasing/POTab.jsx` | PO list embedded tab — no create button (Phase 7.9) |
| `frontend/src/pages/purchasing/GoodsReceiptModal.jsx` | Line-by-line GR — GOODS + SERVICE sections + Warehouse/Location picker + Delivery Note Number (Phase 7.9 + 11) |
| `frontend/src/pages/purchasing/POQRCodeModal.jsx` | QR Code display + print for PO (Phase 11.7) |
| `frontend/src/pages/approval/PRApprovalTab.jsx` | PR approval tab for Approval Center (Phase 7.9) |
| `frontend/src/pages/master/SupplierTab.jsx` | Supplier master data list tab (Phase 11.9) |
| `frontend/src/pages/master/SupplierFormModal.jsx` | Supplier create/edit modal (Phase 11.9) |
| `frontend/src/pages/workorder/WOConsumeModal.jsx` | CONSUME material from WO Detail — pre-filled WO (Phase 11.10) |
| `frontend/src/pages/workorder/WOReturnModal.jsx` | RETURN material to stock from WO Detail (Phase 11.10) |
| `backend/app/schemas/withdrawal.py` | Withdrawal Slip Pydantic schemas (Phase 11.10B) |
| `backend/app/services/withdrawal.py` | Withdrawal Slip business logic: CRUD + submit + issue + cancel (Phase 11.10B) |
| `backend/app/api/withdrawal.py` | Withdrawal Slip 8 API endpoints (Phase 11.10B) |
| `frontend/src/pages/supply-chain/WithdrawalSlipTab.jsx` | Withdrawal list tab in SupplyChainPage (Phase 11.10B) |
| `frontend/src/pages/supply-chain/WithdrawalSlipFormModal.jsx` | Create/edit multi-line withdrawal slip (Phase 11.10B) |
| `frontend/src/pages/supply-chain/WithdrawalSlipDetailPage.jsx` | Withdrawal detail + status actions (Phase 11.10B) |
| `frontend/src/pages/supply-chain/WithdrawalSlipIssueModal.jsx` | Issue confirmation — per-line issued_qty (Phase 11.10B) |
| `frontend/src/pages/supply-chain/WithdrawalSlipPrintView.jsx` | Print layout with signature fields (Phase 11.10B) |
| `backend/app/middleware/performance.py` | Request timing middleware (Phase 14) |
| `backend/app/services/ai_performance.py` | AI performance analysis engine — Claude API (Phase 14) |
| `frontend/src/pages/admin/PerformancePage.jsx` | AI Performance Dashboard (Phase 14) |
| `frontend/src/components/PerformanceAIChat.jsx` | AI Chat panel for performance Q&A (Phase 14) |
| `frontend/src/utils/performance.js` | Web Vitals + API timing collection (Phase 14) |

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

*End of CLAUDE.md — SSS Corp ERP v15 (Phase 0-7.9 complete + Phase 11 partial: Stock-Location + Low Stock + QR Code + Delivery Note + Supplier + Stock Withdrawal + Withdrawal Slip, Phase 8-14 planned)*
