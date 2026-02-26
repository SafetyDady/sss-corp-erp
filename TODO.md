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

## Phase 1 — Core Modules ✅

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

### 1.2 Master Data ✅

- [x] Model: `CostCenter` (code unique per org, name, overhead_rate Numeric(5,2), is_active)
- [x] Model: `CostElement` (code unique per org, name, is_active)
- [x] Model: `OTType` (name unique per org, factor Numeric(4,2), max_ceiling Numeric(4,2), is_active)
- [x] Schema: CostCenter CRUD schemas
- [x] Schema: CostElement CRUD schemas
- [x] Schema: OTType CRUD schemas (BR#24 validation: factor ≤ max_ceiling)
- [x] Service: CostCenter CRUD + overhead rate per CC (BR#30)
- [x] Service: CostElement CRUD
- [x] Service: OTType CRUD + factor ≤ max_ceiling validation (BR#24)
- [x] API: `GET/POST/PUT/DELETE /api/master/cost-centers` — master.costcenter.*
- [x] API: `GET/POST/PUT/DELETE /api/master/cost-elements` — master.costelement.*
- [x] API: `GET/POST/PUT/DELETE /api/master/ot-types` — master.ottype.*
- [x] Migration: `a1b2c3d4e5f6_add_master_data_tables.py`
- [x] Permissions: `master.costcenter.*` (4) + `master.costelement.*` (4) + `master.ottype.*` (4) = 12 total
- [x] BR#24: factor ≤ max_ceiling — service + schema validation ✅
- [x] BR#29: Admin adjusts Factor + Max Ceiling in Master Data ✅
- [x] BR#30: Overhead Rate per Cost Center ✅

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
- [x] Service: Cost summary — now calculates all 4 components (BR#14-17)
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
- [x] BR#14: Cost summary (Material + ManHour + Tools + Overhead) — fully implemented ✅
- [x] RBAC: Viewer can read, cannot create; Staff cannot close (approve) — tested ✅

### 1.5 Pagination + Search + Filter

- [x] Inventory: `?limit=20&offset=0&search=&product_type=` — done
- [x] Stock Movements: `?limit=20&offset=0&product_id=&movement_type=` — done
- [x] Warehouse: `?limit=20&offset=0&search=` — done
- [x] Locations: `?limit=20&offset=0&warehouse_id=&search=` — done
- [x] Work Orders: `?limit=20&offset=0&search=&status=` — done
- [x] Master Data: all 3 entities support `?limit&offset&search` — done

---

## Phase 2 — HR + Job Costing ✅

### 2.1 Employee ✅

- [x] Model: `Employee` (employee_code, full_name, position, hourly_rate Numeric(12,2), daily_working_hours, cost_center_id FK, user_id FK)
- [x] Schema: EmployeeCreate/Update/Response/ListResponse
- [x] Service: Employee CRUD (code unique per org)
- [x] API: `GET/POST /api/hr/employees` — hr.employee.read/create
- [x] API: `GET/PUT/DELETE /api/hr/employees/{id}` — read/update/delete
- [x] Migration: `b2c3d4e5f6a7_add_hr_and_tools_tables.py`

### 2.2 Timesheet ✅

- [x] Model: `Timesheet` (employee_id, work_order_id, work_date, regular_hours, ot_hours, ot_type_id, status DRAFT/SUBMITTED/APPROVED/FINAL/REJECTED)
- [x] Schema: TimesheetCreate/Update/Response/ListResponse
- [x] Service: Create with overlap check (BR#18), lock period 7 days (BR#19), daily hours limit (BR#20)
- [x] Service: Approve flow — Supervisor approve (BR#23) → HR final (BR#26)
- [x] Service: Unlock (BR#22 — hr.timesheet.execute)
- [x] API: `GET/POST /api/hr/timesheet` — hr.timesheet.read/create
- [x] API: `PUT /api/hr/timesheet/{id}` — hr.timesheet.update
- [x] API: `POST /api/hr/timesheet/{id}/approve` — hr.timesheet.approve
- [x] API: `POST /api/hr/timesheet/{id}/final` — hr.timesheet.execute
- [x] API: `POST /api/hr/timesheet/{id}/unlock` — hr.timesheet.execute
- [x] BR#18: 1 employee/WO/date = unique (no overlap) ✅
- [x] BR#19: Lock period 7 days ✅
- [x] BR#20: Daily hours limit ✅
- [x] BR#22: HR unlock ✅
- [x] BR#23: 3-tier approval flow ✅
- [x] BR#26: HR final authority ✅

### 2.3 OT System ✅

- [x] Model: `OTType` — in Master Data (Phase 1.2)
- [x] Schema: OTType CRUD — in Master Data schemas
- [x] Service: CRUD + factor ≤ max_ceiling validation (BR#24)
- [x] API: `/api/master/ot-types` — master.ottype.*
- [x] BR#24: Special OT Factor ≤ Maximum Ceiling ✅
- [x] BR#25: Default OT types (weekday 1.5×, weekend 2.0×, holiday 3.0×) — configurable via API ✅
- [x] BR#29: Admin adjusts Factor + Max Ceiling in Master Data ✅

### 2.4 Tools Module ✅

- [x] Model: `Tool` (code, name, rate_per_hour Numeric(12,2), status AVAILABLE/CHECKED_OUT/MAINTENANCE/RETIRED)
- [x] Model: `ToolCheckout` (tool_id, employee_id, work_order_id, checkout_at, checkin_at, charge_amount)
- [x] Schema: ToolCreate/Update/Response/ListResponse + ToolCheckoutRequest/Response
- [x] Service: Tool CRUD + checkout/checkin + auto recharge on check-in (BR#28)
- [x] API: `GET/POST /api/tools` — tools.tool.read/create
- [x] API: `PUT/DELETE /api/tools/{id}` — tools.tool.update/delete
- [x] API: `POST /api/tools/{id}/checkout` — tools.tool.execute
- [x] API: `POST /api/tools/{id}/checkin` — tools.tool.execute
- [x] API: `GET /api/tools/{id}/history` — tools.tool.read
- [x] BR#27: Tool checked out to 1 person at a time ✅
- [x] BR#28: Auto charge on check-in (hours × rate) ✅

### 2.5 WO Cost Summary ✅

- [x] Service: Calculate 4 components (Material + ManHour + Tools + Overhead — BR#14)
- [x] BR#14: WO Total = Material + ManHour + Tools + Overhead ✅
- [x] BR#15: ManHour = Σ((Regular + OT × Factor) × Rate) ✅
- [x] BR#16: Tools Recharge = Σ(charge_amount from check-ins) ✅
- [x] BR#17: Admin Overhead = ManHour × overhead_rate% (per Cost Center) ✅

### 2.6 Payroll ✅

- [x] Model: `PayrollRun` (period_start, period_end, status DRAFT/EXECUTED/EXPORTED, total_amount, employee_count)
- [x] Schema: PayrollRunCreate/Response/ListResponse
- [x] Service: Create + Execute payroll (aggregates FINAL timesheets)
- [x] API: `GET /api/hr/payroll` — hr.payroll.read
- [x] API: `POST /api/hr/payroll` — hr.payroll.create
- [x] API: `POST /api/hr/payroll/run` — hr.payroll.execute

### 2.7 Leave ✅

- [x] Model: `Leave` (employee_id, leave_type, start_date, end_date, status PENDING/APPROVED/REJECTED)
- [x] Schema: LeaveCreate/Response/ListResponse
- [x] Service: Create + Approve/Reject
- [x] API: `GET /api/hr/leave` — hr.leave.read
- [x] API: `POST /api/hr/leave` — hr.leave.create
- [x] API: `POST /api/hr/leave/{id}/approve` — hr.leave.approve

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
