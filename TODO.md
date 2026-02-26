# TODO.md — SSS Corp ERP Implementation Tracker

> อ้างอิง: `CLAUDE.md` → Implementation Phases + Business Rules
> อัปเดตล่าสุด: 2026-02-26

---

## Phase 0 — Foundation ✅

- [x] Monorepo structure (frontend/ + backend/)
- [x] Docker Compose (dev) — PostgreSQL 16, Redis 7, Backend, Frontend
- [x] Dockerfile (production/Railway)
- [x] FastAPI + CORS + Rate Limiting (slowapi)
- [x] Auth — JWT Bearer Token + Refresh rotation
- [x] RBAC core — 89 permissions, 5 roles (owner/manager/supervisor/staff/viewer) — synced to CLAUDE.md v2
- [x] Alembic setup + migrations
- [x] React 18 + Vite + Ant Design + Zustand
- [x] Login page + Dashboard + Sidebar (permission-filtered)
- [x] API client with auto refresh interceptor

---

## Phase 1 — Core Modules 🟡

### 1.1 Inventory ✅

- [x] Model: `Product` (sku unique, type MATERIAL/CONSUMABLE, cost Numeric(12,2), on_hand, CHECK constraints)
- [x] Model: `StockMovement` (immutable, RECEIVE/ISSUE/TRANSFER/ADJUST/CONSUME/REVERSAL)
- [x] Schema: `ProductCreate`, `ProductUpdate`, `ProductResponse`, `ProductListResponse`
- [x] Schema: `StockMovementCreate`, `StockMovementResponse`, `StockMovementListResponse`
- [x] Service: Product CRUD with business rules
- [x] Service: Stock movement creation + reversal + on_hand tracking
- [x] API: `GET/POST /api/inventory/products` — list + create
- [x] API: `GET/PUT/DELETE /api/inventory/products/{id}` — read + update + soft-delete
- [x] API: `GET/POST /api/stock/movements` — list + create
- [x] API: `POST /api/stock/movements/{id}/reverse` — reversal
- [x] Migration: `8e4d5f2d2bad_add_inventory_products_and_stock_.py`
- [x] Permissions: `inventory.product.*` (5) + `inventory.movement.*` (4) = 9 total
- [x] BR#1: MATERIAL cost >= 1.00 THB — tested ✅
- [x] BR#2: SKU unique — tested ✅
- [x] BR#3: SKU immutable with movements — tested ✅
- [x] BR#4: No delete with movements/balance > 0 — tested ✅
- [x] BR#5: on_hand >= 0 — tested ✅
- [x] BR#6: ISSUE balance >= qty — tested ✅
- [x] BR#7: ADJUST owner only — tested ✅
- [x] BR#8: Movements immutable, REVERSAL only — tested ✅

### 1.2 Master Data

- [ ] Model: `CostCenter` (name, overhead_rate Numeric(5,2), org_id)
- [ ] Model: `CostElement` (name, type)
- [ ] Model: `Unit` (name, abbreviation)
- [ ] Schema: CostCenter CRUD schemas
- [ ] Schema: CostElement read schema
- [ ] Schema: Unit CRUD schemas
- [ ] Service: CostCenter CRUD + overhead rate per CC (BR#30)
- [ ] Service: CostElement read
- [ ] Service: Unit CRUD
- [ ] API: `GET/POST /api/master/cost-centers` — master.costcenter.read/create
- [ ] API: `GET /api/master/cost-elements` — master.costelement.read
- [ ] API: `GET/POST/PUT/DELETE` Unit endpoints — master.unit.*
- [ ] Migration
- [ ] Test: CRUD + permission checks

### 1.3 Warehouse ✅

- [x] Model: `Warehouse` (code unique per org, name, description, address, is_active, org_id)
- [x] Model: `Location` (warehouse_id FK, code unique per warehouse, zone_type, BR#34 — 1 zone type per warehouse)
- [x] Schema: `WarehouseCreate/Update/Response/ListResponse`
- [x] Schema: `LocationCreate/Update/Response/ListResponse`
- [x] Service: Warehouse CRUD (code unique per org, no delete with active locations)
- [x] Service: Location CRUD + zone type unique per warehouse (BR#34)
- [x] API: `GET/POST /api/warehouse/warehouses` — warehouse.warehouse.read/create
- [x] API: `GET/PUT/DELETE /api/warehouse/warehouses/{id}` — read/update/delete
- [x] API: `GET/POST /api/warehouse/locations` — warehouse.location.read/create
- [x] API: `GET/PUT/DELETE /api/warehouse/locations/{id}` — read/update/delete
- [x] Permissions: `warehouse.warehouse.*` (4) + `warehouse.zone.*` (4) + `warehouse.location.*` (4) = 12 total
- [x] Migration: `9601f4969f76_add_warehouse_and_location_tables.py`
- [x] BR#34: 1 zone type per warehouse — tested ✅
- [x] Warehouse code unique per org — tested ✅
- [x] Location code unique per warehouse — tested ✅
- [x] No delete warehouse with active locations — tested ✅
- [x] RBAC: Viewer can read, cannot create — tested ✅
- [x] Fix: `DEFAULT_ORG_ID` constant (replaced random uuid4() fallback across all modules)

### 1.4 Work Orders ✅

- [x] Model: `WorkOrder` (wo_number auto "WO-{YYYY}-{NNNN}", status DRAFT/OPEN/CLOSED, customer_name, description, cost_center_code, created_by FK)
- [x] Model: Added `work_order_id` FK to `StockMovement` (nullable, for CONSUME linkage)
- [x] Schema: `WorkOrderCreate/Update/Response/ListResponse`, `CostSummaryResponse`
- [x] Service: WorkOrder CRUD + state machine (DRAFT→OPEN→CLOSED, no reverse)
- [x] Service: Delete only DRAFT + no movements + creator/owner only
- [x] Service: Cost summary (material_cost from CONSUME movements; manhour/tools/overhead ready for Phase 2)
- [x] API: `GET/POST /api/work-orders` — workorder.order.read/create
- [x] API: `GET/PUT/DELETE /api/work-orders/{id}` — read/update/delete
- [x] API: `POST /api/work-orders/{id}/open` — workorder.order.update
- [x] API: `POST /api/work-orders/{id}/close` — workorder.order.approve
- [x] API: `GET /api/work-orders/{id}/cost-summary` — workorder.order.read
- [x] Permissions: `workorder.order.*` (create/read/update/delete/approve/export) = 6 total
- [x] Migration: `725e6c865a71_add_work_orders_and_stock_movement_wo_fk.py`
- [x] BR#10: Status flow DRAFT→OPEN→CLOSED, no reverse — tested ✅
- [x] CLOSED WO cannot be edited — tested ✅
- [x] Delete only DRAFT + no movements — tested ✅
- [x] wo_number auto-generated unique per org — tested ✅
- [x] BR#14: Cost summary (Material + ManHour + Tools + Overhead) — API ready, Phase 2 populates latter 3 ✅
- [x] RBAC: Viewer can read, cannot create; Staff cannot close (approve) — tested ✅

### 1.5 Pagination + Search + Filter

- [x] Inventory: `?limit=20&offset=0&search=&product_type=` — done
- [x] Stock Movements: `?limit=20&offset=0&product_id=&movement_type=` — done
- [x] Warehouse: `?limit=20&offset=0&search=` — done
- [x] Locations: `?limit=20&offset=0&warehouse_id=&search=` — done
- [x] Work Orders: `?limit=20&offset=0&search=&status=` — done

---

## Phase 2 — HR + Job Costing 🔲

### 2.1 Employee

- [ ] Model: `Employee` (name, rate Numeric(12,2), cost_center_id, user_id)
- [ ] Schema: Employee CRUD schemas
- [ ] Service: Employee CRUD
- [ ] API: `GET/POST/PUT /api/hr/employees` — hr.employee.*
- [ ] Migration
- [ ] Test

### 2.2 Timesheet

- [ ] Model: `Timesheet` (employee_id, work_order_id, date, hours, status)
- [ ] Schema: Timesheet CRUD + approve/final schemas
- [ ] Service: Create with overlap check (BR#18), lock period 7 days (BR#19)
- [ ] Service: Approve flow → Supervisor approve → HR final
- [ ] Service: Unlock (hr.timesheet.execute)
- [ ] API: `GET/POST/PUT /api/hr/timesheet` + approve/final/unlock
- [ ] Migration
- [ ] Test: BR#18 (no overlap) + BR#19 (lock period) + approve flow

### 2.3 OT System

- [ ] Model: `OTType` (name, factor, max_ceiling)
- [ ] Schema: OTType CRUD schemas
- [ ] Service: CRUD + validate factor ≤ max ceiling (BR#24)
- [ ] API: `GET/POST/PUT /api/master/ot-types` — master.ottype.*
- [ ] Migration
- [ ] Test: BR#24 (Special OT ≤ Max Ceiling)

### 2.4 Tools Module

- [ ] Model: `Tool` (name, rate_per_hour Numeric(12,2), status)
- [ ] Model: `ToolCheckout` (tool_id, employee_id, checkout_at, checkin_at)
- [ ] Schema: Tool CRUD + checkout/checkin schemas
- [ ] Service: CRUD + checkout/checkin + auto recharge on check-in (BR#27, BR#28)
- [ ] API: `GET/POST/PUT /api/tools` + checkout/checkin/history
- [ ] Migration
- [ ] Test: BR#27 (1 person checkout) + BR#28 (auto charge on check-in)

### 2.5 WO Cost Summary

- [ ] Service: Calculate 4 components (Material + ManHour + Tools + Overhead — BR#14)
- [ ] API: `GET /api/work-orders/{id}/cost-summary`
- [ ] Test: Cost calculation accuracy

### 2.6 Payroll

- [ ] Model: `PayrollRun` (period, status, total)
- [ ] Schema: Payroll run + export schemas
- [ ] Service: Execute payroll (hr.payroll.execute)
- [ ] Service: Export payroll (hr.payroll.export)
- [ ] API: `GET /api/hr/payroll` + `POST /api/hr/payroll/run` + `GET /api/hr/payroll/export`
- [ ] Migration
- [ ] Test

---

## Phase 3 — Business Flow + Frontend 🔲

### 3.1 Purchasing

- [ ] Model: `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`
- [ ] Schema: PO CRUD + approve schemas
- [ ] Service: PO → GR → RECEIVE flow
- [ ] API: purchasing.po.* endpoints
- [ ] Migration
- [ ] Test

### 3.2 Sales

- [ ] Model: `SalesOrder`, `SalesOrderLine`, `Invoice`
- [ ] Schema: SO CRUD + approve schemas
- [ ] Service: Sales order + invoicing
- [ ] API: sales.order.* endpoints
- [ ] Migration
- [ ] Test

### 3.3 Finance Reports

- [ ] Service: Report generation (finance.report.read/export)
- [ ] API: Finance report endpoints
- [ ] Test

### 3.4 React Frontend — All Modules

- [ ] Inventory page: Product list + CRUD modal + stock movement log
- [ ] Warehouse page: Warehouse + location management
- [ ] Work Order page: WO list + status flow + cost summary
- [ ] HR pages: Employee, Timesheet, Leave, Payroll
- [ ] Tools page: Tool list + checkout/checkin
- [ ] Master Data page: Cost Centers, Units, OT Types
- [ ] Purchasing page: PO list + approve flow
- [ ] Sales page: SO list + invoicing
- [ ] Finance page: Reports + export
- [ ] Admin page: User management + role/permission editor

### 3.5 Admin Panel

- [ ] API: `GET /api/admin/roles` + `PUT /api/admin/roles/{role}/permissions`
- [ ] API: `GET /api/admin/users` + `PATCH /api/admin/users/{id}/role`
- [ ] API: `GET /api/admin/audit-log`
- [ ] Frontend: Admin settings UI

---

## Phase 4 — Multi-tenant + Production 🔲

- [ ] Multi-tenant: org_id filtering on all queries + Setup Wizard
- [ ] Deploy: Vercel (frontend) + Railway (backend)
- [ ] Backup strategy + automated backups
- [ ] Monitoring: Sentry error tracking
- [ ] Security audit: OWASP checks, rate limiting review
- [ ] Load test: k6 or locust
- [ ] Documentation: API docs + user guide

---

*Last updated: 2026-02-26*
