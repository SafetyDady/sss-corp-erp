# TODO.md — SSS Corp ERP Implementation Tracker

> อ้างอิง: `CLAUDE.md` → Implementation Phases + Business Rules
> อัปเดตล่าสุด: 2026-03-01 (Phase 7.9 — PR/PO Redesign: Purchase Requisition System)

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
- [x] API: `GET /api/hr/payroll/export` — hr.payroll.export (CSV StreamingResponse) ← เพิ่มใหม่

### 2.7 Leave ✅

- [x] Model: `Leave` (employee_id, leave_type, start_date, end_date, status PENDING/APPROVED/REJECTED)
- [x] Schema: LeaveCreate/Response/ListResponse
- [x] Service: Create + Approve/Reject
- [x] API: `GET /api/hr/leave` — hr.leave.read
- [x] API: `POST /api/hr/leave` — hr.leave.create
- [x] API: `POST /api/hr/leave/{id}/approve` — hr.leave.approve

---

## Phase 3 — Business Flow + Frontend ✅

### 3.0 Customer ✅

- [x] Model: `Customer` (code, name, contact_name, email, phone, address, tax_id)
- [x] Schema: CustomerCreate/Update/Response/ListResponse
- [x] Service: Customer CRUD (code unique per org)
- [x] API: `GET/POST /api/customers` + `GET/PUT/DELETE /api/customers/{id}`
- [x] Permissions: `customer.customer.*` (5)

### 3.1 Purchasing ✅

- [x] Model: `PurchaseOrder` (po_number auto, status DRAFT/SUBMITTED/APPROVED/RECEIVED/CANCELLED)
- [x] Model: `PurchaseOrderLine` (po_id, product_id, quantity, unit_cost, received_qty)
- [x] Schema: PO CRUD + approve + GoodsReceiptLine schemas
- [x] Service: PO CRUD + approve + goods receipt → creates RECEIVE movements
- [x] API: `GET/POST /api/purchasing/po` + `GET/PUT/DELETE /api/purchasing/po/{id}`
- [x] API: `POST /api/purchasing/po/{id}/approve` + `POST /api/purchasing/po/{id}/receive`
- [x] Permissions: `purchasing.po.*` (6)

### 3.2 Sales ✅

- [x] Model: `SalesOrder` (so_number auto, customer_id FK, status DRAFT/SUBMITTED/APPROVED/INVOICED/CANCELLED)
- [x] Model: `SalesOrderLine` (so_id, product_id, quantity, unit_price)
- [x] Schema: SO CRUD + approve schemas
- [x] Service: SO CRUD + approve
- [x] API: `GET/POST /api/sales/orders` + `GET/PUT/DELETE /api/sales/orders/{id}`
- [x] API: `POST /api/sales/orders/{id}/approve`
- [x] Permissions: `sales.order.*` (6)

### 3.3 Finance Reports ✅

- [x] API: `GET /api/finance/reports` — finance.report.read (aggregated summary)
- [x] API: `GET /api/finance/reports/export` — finance.report.export (CSV download)
- [x] Period filtering: `?period_start=&period_end=`

### 3.4 React Frontend — All Modules ✅ (100% complete — 54 files)

**Batch 1 — Foundation ✅ (11 files)**
- [x] Install `lucide-react`, remove `@ant-design/icons` usage
- [x] `src/utils/constants.js` — COLORS + ANT_THEME_TOKEN (dark Cyan theme)
- [x] `src/utils/formatters.js` — formatCurrency/Date/DateTime/Number
- [x] `src/components/StatusBadge.jsx` — 28 statuses
- [x] `src/components/EmptyState.jsx` — Lucide Inbox icon
- [x] `src/components/PageHeader.jsx` — title + subtitle + actions
- [x] `src/components/SearchInput.jsx` — debounced 300ms
- [x] `src/App.css` — dark scrollbar, table, modal CSS overrides
- [x] `src/App.jsx` — rewritten: darkAlgorithm, Lucide icons, 17 routes, collapsible sidebar 210/56px
- [x] `src/pages/LoginPage.jsx` — fixed: Lucide icons, dark card colors
- [x] `src/pages/DashboardPage.jsx` — fixed: no emoji, real API stat cards

**Batch 2 — Inventory + Warehouse + Customers ✅ (10 files)**
- [x] `pages/inventory/ProductListPage.jsx` — table + search + CRUD modal
- [x] `pages/inventory/ProductFormModal.jsx` — create/edit product
- [x] `pages/inventory/MovementListPage.jsx` — movements table + reverse + type filter
- [x] `pages/inventory/MovementCreateModal.jsx` — create movement
- [x] `pages/warehouse/WarehouseListPage.jsx` — table + CRUD modal
- [x] `pages/warehouse/WarehouseFormModal.jsx` — create/edit warehouse
- [x] `pages/warehouse/LocationListPage.jsx` — table + warehouse lookup
- [x] `pages/warehouse/LocationFormModal.jsx` — create/edit location
- [x] `pages/customer/CustomerListPage.jsx` — table + CRUD modal
- [x] `pages/customer/CustomerFormModal.jsx` — create/edit customer

**Batch 3 — Work Orders + Purchasing + Sales ✅ (9 files)**
- [x] `pages/workorder/WorkOrderListPage.jsx` — table + Open/Close actions + status filter
- [x] `pages/workorder/WorkOrderFormModal.jsx` — create/edit WO
- [x] `pages/workorder/WorkOrderDetailPage.jsx` — detail + Job Costing 4 cards + total
- [x] `pages/purchasing/POListPage.jsx` — table + approve action
- [x] `pages/purchasing/POFormModal.jsx` — create PO with dynamic line items
- [x] `pages/purchasing/PODetailPage.jsx` — detail + lines + Goods Receipt
- [x] `pages/sales/SOListPage.jsx` — table + approve action
- [x] `pages/sales/SOFormModal.jsx` — create SO with dynamic line items + customer select
- [x] `pages/sales/SODetailPage.jsx` — detail + lines

**Batch 4 — HR Module ✅ (9 files)**
- [x] `pages/hr/HRPage.jsx` — tab container (พนักงาน/Timesheet/ลาหยุด/Payroll) — RBAC-aware
- [x] `pages/hr/EmployeeTab.jsx` — Employee list CRUD, monospace codes, Tag positions
- [x] `pages/hr/EmployeeFormModal.jsx` — create/edit form, cost center select, currency formatter
- [x] `pages/hr/TimesheetTab.jsx` — approval workflow (DRAFT→SUBMITTED→APPROVED→FINAL)
- [x] `pages/hr/TimesheetFormModal.jsx` — conditional OT type, overlap/lock error handling
- [x] `pages/hr/LeaveTab.jsx` — approve/reject, color-coded leave types
- [x] `pages/hr/LeaveFormModal.jsx` — date validation, sick leave hint
- [x] `pages/hr/PayrollTab.jsx` — summary stat cards, execute, server-side CSV export
- [x] `pages/hr/PayrollFormModal.jsx` — period date validation

**Batch 5 — Admin + Master Data ✅ (11 files)**
- [x] `pages/admin/AdminPage.jsx` — 3 tabs (Users/Roles/Audit Log) — RBAC-aware
- [x] `pages/admin/UserTab.jsx` — inline role change Select, BR#31 protection
- [x] `pages/admin/RoleTab.jsx` — 5 roles, grouped permission checkboxes, owner locked
- [x] `pages/admin/AuditLogTab.jsx` — audit log with refresh
- [x] `pages/master/MasterDataPage.jsx` — 3 tabs (Cost Centers/Cost Elements/OT Types)
- [x] `pages/master/CostCenterTab.jsx` + `CostCenterFormModal.jsx` — overhead rate (BR#30)
- [x] `pages/master/CostElementTab.jsx` + `CostElementFormModal.jsx` — CRUD
- [x] `pages/master/OTTypeTab.jsx` + `OTTypeFormModal.jsx` — BR#24 validation (ceiling >= factor)

**Batch 6 — Tools Module ✅ (3 files)**
- [x] `pages/tools/ToolListPage.jsx` — table + checkout/checkin + history timeline modal
- [x] `pages/tools/ToolFormModal.jsx` — create/edit tool, rate_per_hour (BR#28)
- [x] `pages/tools/ToolCheckoutModal.jsx` — employee + WO select, cost hint

**Batch 7 — Finance ✅ (1 file)**
- [x] `pages/finance/FinancePage.jsx` — summary cards + cost breakdown + date filter + CSV export

### 3.6 Route Wiring + API Path Verification ✅
- [x] App.jsx — all 17 routes wired to actual page components
- [x] FinancePage import path fixed (`./pages/finance/FinancePage`)
- [x] Finance API paths fixed (`/api/finance/reports`, `/api/finance/reports/export`)
- [x] PayrollTab — server-side export via `GET /api/hr/payroll/export`
- [x] PayrollTab — execute path fixed to `POST /api/hr/payroll/run`

### 3.5 Admin Panel ✅ (Backend + Frontend)

- [x] API: `GET /api/admin/roles` — admin.role.read (list roles + permissions)
- [x] API: `PUT /api/admin/roles/{role}/permissions` — admin.role.update (BR#32/BR#33 validation)
- [x] API: `GET /api/admin/users` — admin.user.read
- [x] API: `PATCH /api/admin/users/{id}/role` — admin.user.update (BR#31: owner can't demote self)
- [x] API: `GET /api/admin/audit-log` — admin.role.read
- [x] API: `POST /api/admin/seed-permissions` — admin.role.update
- [x] Frontend: Admin settings UI (AdminPage + UserTab + RoleTab + AuditLogTab) ✅

---

## Phase 4 — Organization, Planning & Production ✅

### 4.1 Organization & Department ✅

- [x] Model: `Organization` (code unique, name, tax_id, address)
- [x] Model: `Department` (org_id, code unique per org, name, cost_center_id FK, head_id FK)
- [x] Model: `OrgWorkConfig` (working_days JSON, hours_per_day Numeric)
- [x] Model: `OrgApprovalConfig` (module_key, require_approval toggle)
- [x] Schema: Organization, Department, OrgConfig CRUD schemas
- [x] Service: Organization + Department CRUD
- [x] API: `GET/POST/PUT/DELETE /api/master/departments` — master.department.*
- [x] API: `GET/PUT /api/admin/organization` — admin.config.*
- [x] API: `GET/PUT /api/admin/config/work` + `/api/admin/config/approval` — admin.config.*
- [x] Employee model: + department_id, supervisor_id, pay_type, daily_rate, monthly_salary
- [x] Frontend: DepartmentTab.jsx + DepartmentFormModal.jsx (Master Data tabs)
- [x] Frontend: OrgSettingsTab.jsx (Admin page — work config + approval toggles)
- [x] Permissions: `master.department.*` (4) + `admin.config.*` (2) = 6 new
- [x] Migration: `d_phase4_1_org_department.py`

### 4.2 Approval Flow Overhaul ✅

- [x] Model: + `requested_approver_id` on PO, SO, WO, Timesheet, Leave
- [x] API: `GET /api/approvers?module=` — returns eligible approvers
- [x] Approval bypass logic: auto-approve when `OrgApprovalConfig.require_approval == false`
- [x] Frontend: Approver Select dropdown on POFormModal, SOFormModal, WorkOrderFormModal, TimesheetFormModal, LeaveFormModal
- [x] Migration: `e_phase4_2_approval_overhaul.py`

### 4.3 Leave System Upgrade ✅

- [x] Model: `LeaveType` (code unique per org, name, is_paid, default_quota)
- [x] Model: `LeaveBalance` (employee_id, leave_type_id, year, quota, used)
- [x] Leave model: leave_type → leave_type_id FK, + days_count
- [x] Default seed: ANNUAL(6d), SICK(30d), PERSONAL(3d), MATERNITY(98d), UNPAID(unlimited)
- [x] API: `GET/POST/PUT/DELETE /api/master/leave-types` — master.leavetype.*
- [x] API: `GET /api/hr/leave-balance` + `PUT /api/hr/leave-balance/{id}`
- [x] BR#36: Leave quota enforcement (used + days <= quota) ✅
- [x] BR#37-38: Paid/unpaid leave timesheet integration ✅
- [x] BR#39: Block WO time entry on leave days ✅
- [x] Frontend: LeaveTypeTab.jsx + LeaveTypeFormModal.jsx (Master Data)
- [x] Frontend: LeaveFormModal.jsx — LeaveType dropdown + quota display
- [x] Permissions: `master.leavetype.*` (4) = 4 new
- [x] Migration: `f_phase4_3_leave_upgrade.py`

### 4.4 Timesheet Redesign ✅

- [x] Model: `StandardTimesheet` (auto-generated daily attendance: WORK/LEAVE_PAID/LEAVE_UNPAID/ABSENT/HOLIDAY)
- [x] WO Time Entry: batch submit multiple WOs per date via `POST /api/hr/timesheet/batch`
- [x] API: `GET /api/hr/standard-timesheet` — hr.timesheet.read
- [x] API: `POST /api/hr/standard-timesheet/generate` — hr.timesheet.execute
- [x] API: `POST /api/hr/timesheet/batch` — hr.timesheet.create (batch WO entries for 1 date)
- [x] Supervisor routing: filter timesheets by supervisor_id or dept.head_id
- [x] Frontend: WOTimeEntryForm.jsx — daily WO entry form
- [x] Frontend: StandardTimesheetView.jsx — read-only auto-generated timesheet view
- [x] Migration: `g_phase4_4_timesheet_redesign.py`

### 4.5 WO Planning & Reservation ✅

- [x] Model: `WOMasterPlan` + `WOMasterPlanLine` (MANPOWER/MATERIAL/TOOL)
- [x] Model: `DailyPlan` + `DailyPlanWorker` + `DailyPlanTool` + `DailyPlanMaterial`
- [x] Model: `MaterialReservation` (RESERVED/FULFILLED/CANCELLED)
- [x] Model: `ToolReservation` (RESERVED/CHECKED_OUT/RETURNED/CANCELLED)
- [x] API: `GET/POST/PUT /api/work-orders/{id}/plan` — workorder.plan.*
- [x] API: `GET/POST/PUT/DELETE /api/planning/daily` — workorder.plan.*
- [x] API: `GET /api/planning/conflicts` — conflict check (employee/tool per date)
- [x] API: `GET/POST /api/planning/reservations/material` + `/tool` — workorder.reservation.*
- [x] API: `PUT /api/planning/reservations/{id}/cancel` — cancel reservation
- [x] BR#40: 1 person : 1 WO per day (conflict check) ✅
- [x] BR#41: 1 tool : 1 WO per day (conflict check) ✅
- [x] BR#42: Employee on leave → cannot assign to daily plan ✅
- [x] BR#44: Material reservation checks available stock ✅
- [x] BR#45: Tool reservation no-overlap validation ✅
- [x] BR#46: 1 master plan per WO ✅
- [x] Frontend: PlanningPage.jsx — tab container (Daily Plan + Reservations)
- [x] Frontend: DailyPlanTab.jsx + DailyPlanFormModal.jsx
- [x] Frontend: ReservationTab.jsx + ReservationFormModal.jsx
- [x] Route: `/planning` in App.jsx + sidebar menu item
- [x] Permissions: `workorder.plan.*` (4) + `workorder.reservation.*` (2) = 6 new
- [x] Migration: `h_phase4_5_planning_reservation.py`

### 4.6 Email Notification ✅

- [x] Service: `backend/app/services/email.py` — SMTP email service
- [x] Templates: Approval request email (Thai + document link)
- [x] Integration: PO, SO, Timesheet, Leave, WO close → email to requested_approver
- [x] Config: `EMAIL_ENABLED=false` by default, env vars for SMTP settings
- [x] No migration needed (config only)

### 4.7 Multi-tenant Enforcement ✅

- [x] JWT Token: org_id added to payload
- [x] All 17+ service `list_*()` functions: `.where(Model.org_id == org_id)` filter
- [x] All `get_*()` functions: verify org_id matches
- [x] User.org_id: NOT NULL enforcement
- [x] Setup Wizard v2: `POST /api/setup` (no auth, creates first org + depts + OT/Leave + admin + employee, returns tokens)
- [x] Frontend: SetupWizardPage.jsx — 4-step form (org → departments → admin → done)
- [x] Route: `/setup` — public, shown only when no org exists
- [x] Migration: `i_phase4_7_multitenant_enforce.py`

### 4.8 Deploy & Production ✅

- [x] Vercel: `vercel.json` with SPA rewrites, security headers, asset caching
- [x] Railway: `Dockerfile` with non-root user, multi-worker uvicorn
- [x] Sentry: Backend `sentry-sdk[fastapi]` + Frontend `@sentry/react` (optional via env)
- [x] Health check: `GET /api/health` — DB + Redis connectivity check + version info
- [x] Security: JWT_SECRET_KEY validation (RuntimeError on default in production)
- [x] Security: CORS_ORIGINS, rate limiting, X-Frame-Options, X-Content-Type-Options
- [x] Env files: `.env.example` for backend + frontend
- [x] Package version: 1.0.0

### 4.9 Shift Management ✅

- [x] Model: `ShiftType` (code, name, start_time, end_time, break_minutes, working_hours, is_overnight)
- [x] Model: `WorkSchedule` (code, name, schedule_type FIXED/ROTATING, working_days, rotation_pattern, cycle_start_date)
- [x] Model: `ShiftRoster` (employee_id, roster_date, shift_type_id, is_working_day, is_manual_override, note)
- [x] Model: Employee + `work_schedule_id` FK (nullable — backward compatible)
- [x] Schema: ShiftType/WorkSchedule Create/Update/Response/ListResponse
- [x] Schema: ShiftRoster Response/Update + RosterGenerateRequest/Response
- [x] Service: ShiftType CRUD (5 functions) + WorkSchedule CRUD (5 functions)
- [x] Service: generate_shift_roster (FIXED/ROTATING auto-gen) + list_shift_rosters + update_shift_roster
- [x] Service: StandardTimesheet integration — roster fallback chain (ShiftRoster → OrgWorkConfig)
- [x] API: `GET/POST/GET/{id}/PUT/{id}/DELETE/{id} /api/master/shift-types` — master.shifttype.*
- [x] API: `GET/POST/GET/{id}/PUT/{id}/DELETE/{id} /api/master/work-schedules` — master.schedule.*
- [x] API: `GET /api/hr/roster` + `POST /api/hr/roster/generate` + `PUT /api/hr/roster/{id}` — hr.roster.*
- [x] Seed: 4 ShiftTypes (REGULAR/MORNING/AFTERNOON/NIGHT) + 2 WorkSchedules (REGULAR-MF/ROTATING-3SHIFT)
- [x] Permissions: `master.shifttype.*` (4) + `master.schedule.*` (4) + `hr.roster.*` (2) = 10 new (108→118)
- [x] Frontend: ShiftTypeTab.jsx + ShiftTypeFormModal.jsx (Master Data tabs)
- [x] Frontend: WorkScheduleTab.jsx + WorkScheduleFormModal.jsx (Master Data tabs)
- [x] Frontend: RosterTab.jsx + RosterGenerateModal.jsx (HR tab)
- [x] Frontend: EmployeeFormModal.jsx — work_schedule_id dropdown
- [x] Frontend: MasterDataPage.jsx + HRPage.jsx — new tabs added
- [x] Frontend: permissionMeta.js — 3 new resources (shifttype, schedule, roster)
- [x] Migration: `e1f2a3b4c5d6_phase4_9_shift_management.py`
- [x] Build: `npm run build` — 0 errors ✅

### 4.9 UX: Staff Schedule Selector + OrgWorkConfig Weekend Fix ✅

- [x] **Backend: `schemas/hr.py`** — Added `work_schedule_id: Optional[UUID]` to `RosterGenerateRequest` (override schedule)
- [x] **Backend: `schemas/hr.py`** — Added `start_time`, `end_time`, `working_hours` to `ShiftRosterResponse`
- [x] **Backend: `services/hr.py`** — `generate_shift_roster()` accepts `work_schedule_id` override (employees don't need assigned schedule)
- [x] **Backend: `services/hr.py`** — `list_shift_rosters()` returns shift time fields (start_time, end_time, working_hours)
- [x] **Backend: `api/hr.py`** — Roster generate: staff data scope enforcement (force own employee_id)
- [x] **Backend: `schemas/auth.py`** — Added `working_days`, `hours_per_day` to `UserMe`
- [x] **Backend: `api/auth.py`** — `/me` endpoint returns OrgWorkConfig `working_days` + `hours_per_day`
- [x] **Frontend: `authStore.js`** — Added `workScheduleId`, `workingDays`, `hoursPerDay` (state/fetchMe/logout/partialize)
- [x] **Frontend: `MyTimesheetPage.jsx`** — Complete rewrite:
  - WorkSchedule selector (Select dropdown from `/api/master/work-schedules`)
  - "สร้างตารางกะ" button with Popconfirm → `POST /api/hr/roster/generate` with `work_schedule_id`
  - Roster data loading + "กะ" column with color-coded Tags (REGULAR=blue, MORNING=green, AFTERNOON=orange, NIGHT=purple)
  - OrgWorkConfig-based weekend detection: `!(orgWorkingDays || [1,2,3,4,5]).includes(isoDay)` instead of hardcoded Sat/Sun
- [x] Build: `npm run build` — 0 errors ✅

---

## Phase 5 — Staff Portal & Daily Report ✅

### 5.1 Employee hire_date + /me API ✅

- [x] Model: Employee + `hire_date` (nullable for existing, required for new)
- [x] Schema: EmployeeCreate/Update — hire_date field
- [x] API: `GET /api/auth/me` — returns employee fields (hire_date, department, etc.)
- [x] Frontend: EmployeeFormModal — hire_date DatePicker (required for new)
- [x] Migration: `c9d0e1f2a3b4_phase5_1_employee_hire_date.py`
- [x] BR#47: hire_date required for new employees ✅

### 5.2 Daily Work Report Backend ✅

- [x] Model: `DailyWorkReport` + `DailyWorkReportLine` (REGULAR/OT line items)
- [x] Schema: DailyWorkReport CRUD + line items + status transitions
- [x] Service: Create, update, submit, approve, reject, batch-approve
- [x] Service: Auto-create Timesheet WO Time Entry on approve (BR#52)
- [x] Service: Auto-update StandardTimesheet OT hours on approve (BR#53)
- [x] API: `GET/POST /api/daily-report` — hr.dailyreport.create/read
- [x] API: `GET/PUT /api/daily-report/{id}` — read/update
- [x] API: `POST /api/daily-report/{id}/submit` — submit for approval
- [x] API: `POST /api/daily-report/{id}/approve` — hr.dailyreport.approve
- [x] API: `POST /api/daily-report/batch-approve` — hr.dailyreport.approve
- [x] API: `POST /api/daily-report/{id}/reject` — hr.dailyreport.approve
- [x] Migration: `d0e1f2a3b4c5_phase5_2_daily_work_report.py`
- [x] Permissions: `hr.dailyreport.*` (create/read/approve) = 3 new
- [x] BR#49-50: 1 report per employee per day ✅
- [x] BR#51: Time overlap validation within same line type ✅
- [x] BR#52: Auto-create Timesheet WO Time Entry on approve ✅
- [x] BR#53: Auto-update StandardTimesheet OT hours on approve ✅
- [x] BR#54: Edit only DRAFT/REJECTED status ✅

### 5.3 Staff Portal Frontend ✅

- [x] `pages/my/MePage.jsx` — Staff Portal container/router
- [x] `pages/my/MyDailyReportPage.jsx` — Daily Work Report (create/edit/submit)
- [x] `pages/my/MyLeavePage.jsx` — My Leave requests (own data only)
- [x] `pages/my/MyTimesheetPage.jsx` — My Timesheet + Schedule Selector + Roster view
- [x] `pages/my/MyTasksPage.jsx` — My Tasks (assigned daily plans)
- [x] Routes: `/my/daily-report`, `/my/leave`, `/my/timesheet`, `/my/tasks`
- [x] BR#48: Staff sees only own data ("ของฉัน" menu group) ✅

### 5.4 Daily Report Approval Tab ✅

- [x] `pages/hr/DailyReportApprovalTab.jsx` — Supervisor batch approve/reject
- [x] Added to HRPage.jsx as new tab
- [x] BR#55: Supervisor sees only own department reports ✅

### 5.5 WO ManHour Summary ✅

- [x] Backend: ManHour summary calculated on-the-fly from Timesheet
- [x] Frontend: `pages/workorder/MasterPlanSection.jsx` — Plan vs Actual display
- [x] WorkOrderDetailPage — ManHour summary cards

### 5.6 Sidebar Refactor ✅

- [x] Grouped menu: "ของฉัน" (My Daily Report, My Leave, My Timesheet, My Tasks)
- [x] Grouped menu: "ระบบงาน" (existing modules)
- [x] RBAC-filtered: Staff sees "ของฉัน" group, Manager+ sees both

### 5.7 Phase 4 Leftovers ✅

- [x] Leave names + colors in StatusBadge
- [x] `pages/hr/LeaveBalanceTab.jsx` — HR manage leave quotas
- [x] `pages/workorder/MasterPlanSection.jsx` — WO detail plan section

### 5.8 E2E Testing ✅

- [x] 15 end-to-end test scenarios PASSED
- [x] Staff Portal flow: create report → submit → supervisor approve → auto timesheet
- [x] All business rules BR#47-55 verified

---

## Phase 6 — Data Scope: Role-Based Data Visibility ✅

### 6.1-6.7 Backend Data Scope ✅

- [x] Shared helpers (`backend/app/api/_helpers.py`) — resolve_employee_id, resolve_employee, get_department_employee_ids
- [x] Critical Security: Missing org_id filter fixed (finance, planning, admin, hr)
- [x] Role-Based Filter: Timesheet (staff=own, supervisor=dept, manager/owner=all)
- [x] Role-Based Filter: Leave + Leave Balance (same pattern)
- [x] Role-Based Filter: Employee (supervisor=dept)
- [x] Refactor daily_report.py — shared helpers, removed duplicates
- [x] Data scope ownership validation on create (staff=self only)

### 6.8-6.14 Frontend Data Scope ✅

- [x] Backend: `department_name` in `/api/auth/me` (auth.py schema + API + authStore)
- [x] Fix MePage bug: 3 API calls missing `employee_id` — guard + dependency added
- [x] `ScopeBadge.jsx` — NEW: role-aware scope indicator (cyan=personal, purple=dept, green=org)
- [x] `SupervisorDashboard` — NEW: 3-way dashboard routing (staff/supervisor/admin)
- [x] `EmployeeContextSelector.jsx` — NEW: role-scoped employee dropdown with auto scope
- [x] HR Page: ScopeBadge in subtitle + EmployeeContextSelector on 5 tabs (Timesheet, Leave, StandardTimesheet, LeaveBalance, WOTimeEntry)
- [x] MePage: Viewer fix — permission-filtered tabs + ME menu visibility
- [x] App.jsx: ME menu shown only if user has at least 1 my-page permission
- [x] Bug fixes: COLORS.info → '#3b82f6', unused imports removed, stale closure fixed

### 6.15-6.18 Enhanced Seed + Setup v2 + Scalability ✅

- [x] **seed.py** — Complete rewrite: full org structure (3 CostCenters, 3 Departments, 5 Employees linked to Users+Depts, 3 OT Types, 5 Leave Types, 20 LeaveBalances)
  - Fixed UUIDs for deterministic/idempotent seeding
  - Employee mapping: owner→EMP-001(ADMIN dept), manager→EMP-002(ADMIN), supervisor→EMP-003(PROD head), staff→EMP-004(PROD), viewer→EMP-005(ADMIN)
  - Dept heads: owner=ฝ่ายบริหาร head, supervisor=ฝ่ายผลิต head
- [x] **setup.py (backend)** — Enhanced: `SetupDepartment` schema, auto-create CostCenter per dept, seed OT/Leave defaults, create Employee(EMP-001) for owner, set department head
- [x] **SetupWizardPage.jsx** — 4-step wizard (org → departments → admin → done), dynamic dept rows with code/name/OH%, validation
- [x] **EmployeeContextSelector.jsx** — Department grouping for manager/owner (Antd grouped options), server-side search with 300ms debounce, `filterOption={false}`
- [x] **DailyReportApprovalTab.jsx** — Added EmployeeContextSelector filter, `employee_id` param to API call
- [x] **MePage.jsx** — Added department name display (`Building2` icon + `departmentName` from authStore)
- [x] Frontend build: 0 errors

---

## Phase 7 — My Approval: Centralized Approval Center ✅

### 7.1 BUG-1 Fix: Leave Approve API ✅

- [x] `backend/app/api/hr.py` — `LeaveApproveRequest` schema with `action: approve|reject`
- [x] `api_approve_leave()` now accepts body and passes `approve=(body.action == "approve")` to service
- [x] Service layer (`approve_leave()`) already had `approve: bool = True` param — no change needed
- [x] **Fixed bug**: Reject always became Approve because API never sent `approve=False`

### 7.2 Leave List API — status filter ✅

- [x] `backend/app/api/hr.py` — Added `status: Optional[str]` query param to `api_list_leaves()`
- [x] `backend/app/services/hr.py` — Added `status` param to `list_leaves()` with `.where(Leave.status == status)` filter
- [x] Regex validation: `^(PENDING|APPROVED|REJECTED)$`

### 7.3 ApprovalPage.jsx — Main Tab Container ✅

- [x] `frontend/src/pages/approval/ApprovalPage.jsx` — Created
- [x] 5 permission-gated tabs: Daily Report, Timesheet, Leave, PO, SO
- [x] Badge count via `Promise.all` (5 APIs, `limit=1` for total count)
- [x] `onAction={fetchCounts}` callback — re-fetches counts after child approve/reject
- [x] Reuses `DailyReportApprovalTab` from `pages/hr/`
- [x] PageHeader with `ScopeBadge`

### 7.4 TimesheetApprovalTab.jsx ✅

- [x] `frontend/src/pages/approval/TimesheetApprovalTab.jsx` — Created
- [x] Status filter: SUBMITTED (Supervisor approve) / APPROVED (HR Final)
- [x] `EmployeeContextSelector` for employee filtering
- [x] Approve (Check icon, green) + Final (ShieldCheck icon, purple) buttons
- [x] Calls `onAction?.()` after each action to update parent badge count

### 7.5 LeaveApprovalTab.jsx ✅

- [x] `frontend/src/pages/approval/LeaveApprovalTab.jsx` — Created
- [x] Fixed `status: 'PENDING'` server-side filter (uses backend 7.2)
- [x] Approve (Check, green) + Reject (XCircle, red with Popconfirm)
- [x] Sends `{ action: "approve" | "reject" }` body (uses backend 7.1 fix)
- [x] Leave type color-coded Tags

### 7.6 POApprovalTab.jsx ✅

- [x] `frontend/src/pages/approval/POApprovalTab.jsx` — Created
- [x] Fixed `status: 'SUBMITTED'` filter
- [x] Approve button + View detail button (navigate to `/purchasing/${id}`)
- [x] Columns: po_number, supplier_name, order_date, total_amount, status

### 7.7 SOApprovalTab.jsx ✅

- [x] `frontend/src/pages/approval/SOApprovalTab.jsx` — Created
- [x] Same pattern as PO but uses `/api/sales/orders`
- [x] Columns: so_number, customer_id, order_date, total_amount, status
- [x] View navigates to `/sales/${id}`

### 7.8 App.jsx — Sidebar + Route ✅

- [x] Added `ClipboardCheck` to lucide-react import
- [x] Added lazy import: `ApprovalPage`
- [x] Added `APPROVAL_MENU_ITEMS` with `_approval_check` pseudo-permission
- [x] Added `approvalItems` filter (OR of 5 approve permissions)
- [x] Sidebar: 3-group layout (ME / อนุมัติ / ระบบงาน)
- [x] `selectedKey`: added `/approval` path matching
- [x] Route: `<Route path="/approval" element={<ApprovalPage />} />`
- [x] Frontend build: `npm run build` → 0 errors

---

## Phase 7.9 — PR/PO Redesign: Purchase Requisition System ✅

### 7.9.1 Backend — Models + Migration ✅

- [x] `backend/app/models/inventory.py` — Added `SERVICE` to ProductType enum
- [x] `backend/app/models/purchasing.py` — 4 new enums: PRStatus, PRPriority, PRItemType, PRType
- [x] `backend/app/models/purchasing.py` — PurchaseRequisition model (pr_number, pr_type, cost_center_id, required_date, delivery_date, validity dates, etc.)
- [x] `backend/app/models/purchasing.py` — PurchaseRequisitionLine model (item_type, product_id, description, cost_element_id, estimated_unit_cost, etc.)
- [x] `backend/app/models/purchasing.py` — PurchaseOrder extensions: pr_id (FK unique), cost_center_id
- [x] `backend/app/models/purchasing.py` — PurchaseOrderLine extensions: pr_line_id, item_type, description, cost_element_id, unit, received_by, received_at
- [x] `backend/app/models/__init__.py` — Added PR model imports
- [x] `backend/alembic/versions/f2a3b4c5d6e7_pr_po_redesign.py` — Migration: 2 tables + 8 columns + SERVICE enum

### 7.9.2 Backend — Permissions ✅

- [x] `backend/app/core/permissions.py` — +5 permissions: purchasing.pr.create/read/update/delete/approve (118→123)
- [x] Role mapping: owner/manager/supervisor get all 5, staff gets create+read, viewer gets read
- [x] PERMISSION_DESCRIPTIONS updated with Thai descriptions

### 7.9.3 Backend — Schemas ✅

- [x] `backend/app/schemas/purchasing.py` — PRLineCreate, PRCreate, PRUpdate, PRApproveRequest
- [x] ConvertToPOLine, ConvertToPORequest schemas
- [x] PRLineResponse, PRResponse, PRListResponse
- [x] Enhanced PurchaseOrderResponse (pr_id, pr_number, cost_center_id)
- [x] Enhanced POLineResponse (item_type, description, cost_element_id, received_by/at)
- [x] Validators: GOODS→product_id required, SERVICE→description required, BLANKET→validity dates required

### 7.9.4 Backend — Services ✅

- [x] `backend/app/services/purchasing.py` — PR CRUD: create, get, list, update, delete, submit, approve/reject
- [x] `convert_pr_to_po()` — Creates PO from approved PR (auto-approved, cost propagation)
- [x] Enhanced `receive_goods()` — GOODS→stock movement, SERVICE→confirm only
- [x] `backend/app/services/inventory.py` — Block stock movements for SERVICE products (BR#65)
- [x] PR number auto-gen: PR-YYYY-XXXX format

### 7.9.5 Backend — API Endpoints ✅

- [x] `backend/app/api/purchasing.py` — 8 new PR endpoints:
  - GET /api/purchasing/pr (list with search, status, pr_type filters + data scope)
  - POST /api/purchasing/pr (create)
  - GET /api/purchasing/pr/{id} (get)
  - PUT /api/purchasing/pr/{id} (update, DRAFT/SUBMITTED only)
  - DELETE /api/purchasing/pr/{id} (delete, DRAFT only)
  - POST /api/purchasing/pr/{id}/submit (DRAFT→SUBMITTED)
  - POST /api/purchasing/pr/{id}/approve (approve/reject)
  - POST /api/purchasing/pr/{id}/convert-to-po (create PO from approved PR)
- [x] Data scope: staff=own PRs, supervisor=department, manager/owner=all org

### 7.9.6 Frontend — New Pages ✅

- [x] `frontend/src/pages/purchasing/PurchasingPage.jsx` — Tabbed container (PR+PO) + stat cards
- [x] `frontend/src/pages/purchasing/PRTab.jsx` — PR list with search/filter (status, type, priority)
- [x] `frontend/src/pages/purchasing/POTab.jsx` — PO list embedded tab (no create button)
- [x] `frontend/src/pages/purchasing/PRFormModal.jsx` — Create/edit PR with dynamic lines, BLANKET conditional fields
- [x] `frontend/src/pages/purchasing/PRDetailPage.jsx` — PR detail + Submit/Approve/Reject/Convert/Cancel actions
- [x] `frontend/src/pages/purchasing/ConvertToPOModal.jsx` — Convert PR to PO with price comparison (estimated vs actual)
- [x] `frontend/src/pages/purchasing/GoodsReceiptModal.jsx` — Line-by-line GR (GOODS + SERVICE sections)

### 7.9.7 Frontend — Modified Pages ✅

- [x] `frontend/src/pages/purchasing/PODetailPage.jsx` — Added PR reference, item_type column, GoodsReceiptModal
- [x] `frontend/src/pages/approval/PRApprovalTab.jsx` — NEW: PR approval tab for Approval Center
- [x] `frontend/src/pages/approval/ApprovalPage.jsx` — Added PR tab + badge count (6 tabs now)
- [x] `frontend/src/pages/approval/POApprovalTab.jsx` — Updated navigate path to /purchasing/po/{id}

### 7.9.8 Frontend — Integration ✅

- [x] `frontend/src/App.jsx` — PurchasingPage + PRDetailPage imports, routes, _purchasing_check pseudo-perm
- [x] `frontend/src/utils/permissionMeta.js` — Added pr: 'ใบขอซื้อ (PR)' to RESOURCE_META
- [x] `frontend/src/components/StatusBadge.jsx` — Added PO_CREATED + SERVICE statuses
- [x] `npm run build` → 0 errors (3511 modules transformed)

---

## UX Improvement — Admin RoleTab Redesign ✅

### Backend Changes ✅

- [x] `backend/app/core/permissions.py` — Added `PERMISSION_DESCRIPTIONS: dict[str, str]` (108 Thai descriptions)
  - คำอธิบายภาษาไทยสำหรับทุก permission เช่น "สร้างสินค้า/วัตถุดิบใหม่ในระบบ"
  - `assert set(PERMISSION_DESCRIPTIONS.keys()) == set(ALL_PERMISSIONS)` — ป้องกัน mismatch
- [x] `backend/app/api/admin.py` — Added `descriptions` key to `api_seed_permissions()` response
  - Import `PERMISSION_DESCRIPTIONS` + return ใน seed-permissions API
  - Backward-compatible — key เดิมยังอยู่ครบ

### Frontend Changes ✅

- [x] `frontend/src/utils/permissionMeta.js` — **NEW FILE**: Permission UI metadata
  - `MODULE_META` — 11 modules: Thai label + Lucide icon name
  - `MODULE_ORDER` — display order matching sidebar
  - `RESOURCE_META` — 25 resources: Thai labels
  - `ACTION_META` — 7 actions: Thai label + Lucide icon + color
  - `ACTION_ORDER` — display order: create → read → update → delete → approve → export → execute
  - `buildPermissionTree()` — flat permission list → module → resource → action hierarchy
- [x] `frontend/src/pages/admin/RoleTab.jsx` — **FULL REWRITE**: Permission management UI
  - MODULE → RESOURCE → ACTION hierarchical layout (was flat checkbox grid)
  - Switch toggle (with icon + color) instead of monospace Checkbox
  - Per-module Collapse panels with Thai name + Lucide icon + granted/total count
  - Resource rows with action toggles (green=create, cyan=read, yellow=edit, red=delete, purple=approve)
  - Tooltip on each action showing Thai description from backend
  - Search bar — filter by module/resource/action name, description (Thai+English)
  - "เปิดทั้งหมด" / "ปิดทั้งหมด" buttons per module (Grant All / Revoke All)
  - Owner card locked — all switches disabled, no save button
  - Change indicator badge + Save button
  - `npm run build` → 0 errors

## UX Improvement — Cost Center / Cost Element: Thai → English ✅

- **Problem**: "ศูนย์ต้นทุน" (Cost Center) และ "องค์ประกอบต้นทุน" (Cost Element) เป็นภาษาไทยที่สับสน ผู้ใช้งานแนะนำให้ใช้ภาษาอังกฤษแทน
- **Solution**: เปลี่ยนทุกจุดที่แสดงผลจากภาษาไทยเป็นภาษาอังกฤษ "Cost Center" / "Cost Element"
- **Files updated (11 total)**:
  - [x] `frontend/src/utils/permissionMeta.js` — RESOURCE_META labels
  - [x] `frontend/src/pages/master/MasterDataPage.jsx` — tab labels + subtitle
  - [x] `frontend/src/pages/master/CostCenterFormModal.jsx` — modal titles, messages
  - [x] `frontend/src/pages/master/CostCenterTab.jsx` — tooltips, popconfirm, button, empty state
  - [x] `frontend/src/pages/master/CostElementFormModal.jsx` — modal title, messages
  - [x] `frontend/src/pages/master/CostElementTab.jsx` — tooltips, popconfirm, button, empty state
  - [x] `frontend/src/pages/master/DepartmentFormModal.jsx` — form label, placeholder, validation
  - [x] `frontend/src/pages/master/DepartmentTab.jsx` — column header
  - [x] `frontend/src/pages/hr/EmployeeFormModal.jsx` — form label, placeholder
  - [x] `frontend/src/pages/finance/FinancePage.jsx` — column title, divider text
  - [x] `backend/app/core/permissions.py` — 8 permission descriptions
- [x] Final grep confirmed 0 remaining Thai occurrences
- [x] `npm run build` → 0 errors

---

## Phase 8 — Dashboard & Analytics 📊 (Planned)

### 8.1 KPI Dashboard
- [ ] Backend: `GET /api/dashboard/kpi` — aggregated stats (sales total, WO count by status, stock value, pending approvals)
- [ ] Backend: `GET /api/dashboard/trends` — time-series data (daily/weekly/monthly)
- [ ] Frontend: KPI stat cards — total revenue, active WOs, low stock items, pending approvals count
- [ ] Frontend: Real-time refresh (polling every 30s or manual refresh button)

### 8.2 Charts & Visualizations
- [ ] Install: `recharts` or `@ant-design/charts`
- [ ] WO Cost Trend — line chart: material vs manhour vs tools vs overhead over time
- [ ] Inventory Turnover — bar chart: top 10 fast/slow-moving products
- [ ] Revenue Chart — area chart: monthly sales revenue
- [ ] Department Cost — pie chart: cost distribution by department/cost center
- [ ] Employee Productivity — bar chart: hours logged per employee per period

### 8.3 Manager Dashboard v2
- [ ] Department comparison cards — cost center breakdown
- [ ] WO pipeline — Gantt-style timeline (OPEN WOs with planned dates)
- [ ] Approval queue summary — pending items across all modules
- [ ] Budget vs Actual — cost center budget utilization

### 8.4 Staff Dashboard v2
- [ ] Personal KPIs — hours logged this week/month, WO assignments, leave balance
- [ ] My WO list — active work orders assigned to me
- [ ] Upcoming schedule — daily plan assignments for next 7 days

### 8.5 Finance Dashboard
- [ ] P&L summary — revenue vs costs by period
- [ ] Cost analysis — breakdown by cost center, cost element
- [ ] Budget tracking — planned vs actual spending

### 8.6 Backend Aggregation APIs
- [ ] Materialized views or on-the-fly aggregation (choose based on data volume)
- [ ] Cache with Redis (TTL 5 min) for dashboard queries
- [ ] Date range filtering on all dashboard endpoints
- [ ] Permission: `finance.report.read` for finance dashboard, role-based for others

---

## Phase 9 — Notification Center 🔔 (Planned)

### 9.1 Notification Model & Migration
- [ ] Model: `Notification` (id, user_id, org_id, type ENUM, title, message, link, is_read, created_at)
- [ ] Type ENUM: APPROVAL_REQUEST, APPROVAL_RESULT, STOCK_ALERT, WO_STATUS, LEAVE_RESULT, SYSTEM
- [ ] Migration: `j_phase9_notification.py`
- [ ] Index: `(user_id, is_read, created_at DESC)` for fast unread queries

### 9.2 Notification Service
- [ ] `backend/app/services/notification.py` — create, mark_read, mark_all_read, list, count_unread
- [ ] Event hooks: create notification on approval request, status change, stock alert
- [ ] Integration points: PO/SO approve, Leave approve/reject, WO status change, low stock trigger
- [ ] Batch create for broadcast notifications (e.g., system announcements)

### 9.3 Notification API
- [ ] `GET /api/notifications` — list with pagination, `?is_read=true|false` filter
- [ ] `GET /api/notifications/unread-count` — badge count for header
- [ ] `PATCH /api/notifications/{id}/read` — mark single as read
- [ ] `POST /api/notifications/read-all` — mark all as read
- [ ] Permission: authenticated user only (own notifications)

### 9.4 Frontend: Notification Bell
- [ ] Header component: Bell icon (Lucide `Bell`) + unread badge count
- [ ] Dropdown panel: notification list with type icon, title, time ago, read/unread styling
- [ ] Click notification → navigate to `link` URL + mark as read
- [ ] "Mark all as read" button
- [ ] Polling: fetch unread count every 30 seconds

### 9.5 Real-time Push (Optional)
- [ ] WebSocket endpoint: `ws://api/ws/notifications` or SSE: `GET /api/notifications/stream`
- [ ] Frontend: auto-reconnect on disconnect
- [ ] Fallback: polling if WebSocket not available

### 9.6 Email Integration
- [ ] Dual channel: create in-app notification + send email (reuse Phase 4.6 email service)
- [ ] Email template per notification type
- [ ] Respect user preferences (in-app only / email only / both)

### 9.7 User Notification Preferences
- [ ] Model: `NotificationPreference` (user_id, event_type, channel: in_app|email|both|none)
- [ ] API: `GET/PUT /api/notifications/preferences`
- [ ] Frontend: Settings page — toggle matrix (event type × channel)

---

## Phase 10 — Export & Print 🖨️ (Planned)

### 10.1 PDF Generation Setup
- [ ] Choose library: backend (WeasyPrint/ReportLab) or frontend (jsPDF + html2canvas)
- [ ] If backend: install + base PDF template (company header, footer, page numbers)
- [ ] If frontend: reusable PDF generator component
- [ ] Company logo + address configurable via `OrgConfig`

### 10.2 WO Report PDF
- [ ] Backend: `GET /api/work-orders/{id}/export/pdf` — workorder.order.export
- [ ] Content: WO header, status, customer, cost summary (4 components), material list, manhour breakdown, tools recharge list
- [ ] Frontend: "Export PDF" button on WorkOrderDetailPage

### 10.3 PO / SO Document PDF
- [ ] Backend: `GET /api/purchasing/po/{id}/export/pdf` — purchasing.po.export
- [ ] Backend: `GET /api/sales/orders/{id}/export/pdf` — sales.order.export
- [ ] Content: document header, line items table, subtotal/tax/total, approval status
- [ ] Frontend: "Print" button on PODetailPage / SODetailPage

### 10.4 Payroll PDF
- [ ] Backend: `GET /api/hr/payroll/{id}/export/pdf` — hr.payroll.export
- [ ] Content: employee payslip (regular hours, OT hours, deductions, net pay)
- [ ] Batch export: all employee payslips for a period in single PDF

### 10.5 Excel Export (XLSX)
- [ ] Install: `openpyxl` (backend) or `sheetjs` (frontend)
- [ ] Upgrade existing CSV exports to XLSX format
- [ ] Add export button to: Products, Movements, Employees, Timesheets, Customers
- [ ] Column formatting: dates, currency, percentages

### 10.6 Print-friendly CSS
- [ ] `@media print` stylesheet — hide sidebar, header, actions
- [ ] Print-specific layout: A4 portrait, proper margins
- [ ] Page breaks for long tables

### 10.7 Report Templates
- [ ] Admin: upload company logo via `POST /api/admin/organization/logo`
- [ ] Configurable report header (company name, address, tax ID)
- [ ] Template stored in `OrgConfig`

---

## Phase 11 — Inventory Enhancement 📦 (Planned)

### 11.1 Reorder Point
- [ ] Product model: + `min_stock` (Numeric(12,2), nullable), `reorder_qty` (Numeric(12,2), nullable)
- [ ] Schema: add to ProductCreate/Update
- [ ] Migration: `k_phase11_inventory_enhance.py`

### 11.2 Low Stock Alert
- [ ] Backend: `GET /api/inventory/products/low-stock` — products where on_hand <= min_stock
- [ ] Dashboard widget: Low Stock card with count + link to list
- [ ] Integration with Notification Center (Phase 9): auto-create STOCK_ALERT notification
- [ ] Optional: scheduled check (cron/background task)

### 11.3 Stock Aging Report
- [ ] Backend: `GET /api/inventory/reports/aging` — group by age bracket (0-30, 31-60, 61-90, 90+ days)
- [ ] Calculate based on last RECEIVE movement date per product
- [ ] Frontend: Aging report page with table + chart
- [ ] Permission: `inventory.product.export`

### 11.4 Batch/Lot Tracking
- [ ] StockMovement model: + `batch_number` (string, nullable)
- [ ] FIFO costing option: track cost per batch
- [ ] Frontend: batch_number input on RECEIVE movement form
- [ ] Batch history: trace movements per batch number

### 11.5 Barcode/QR Code
- [ ] Install: `python-barcode` (backend) or `react-barcode` (frontend)
- [ ] Generate barcode from SKU — display on product detail
- [ ] Print label: SKU + barcode + product name
- [ ] QR code option: encode product URL for mobile scanning

### 11.6 Stock Take (Cycle Count)
- [ ] Model: `StockTake` (date, warehouse_id, status DRAFT/IN_PROGRESS/COMPLETED)
- [ ] Model: `StockTakeLine` (product_id, system_qty, counted_qty, variance)
- [ ] Workflow: create → count → review variances → approve → auto ADJUST movements
- [ ] Permission: `inventory.movement.create` for creating, `inventory.movement.delete` for approving adjustments

### 11.7 Multi-warehouse Transfer
- [ ] TRANSFER movement type: source_warehouse_id → destination_warehouse_id
- [ ] Two movements created: ISSUE from source + RECEIVE to destination (atomic)
- [ ] Optional approval for inter-warehouse transfers
- [ ] Frontend: Transfer form with source/destination warehouse selection

---

## Phase 12 — Mobile Responsive 📱 (Planned)

### 12.1 Responsive Layout
- [ ] Ant Design Grid: use `xs`, `sm`, `md`, `lg`, `xl` breakpoints
- [ ] Sidebar: auto-collapse on mobile (< 768px), bottom drawer or hamburger menu
- [ ] Tables: horizontal scroll on mobile, or card-view for small screens
- [ ] Form layouts: single column on mobile, multi-column on desktop

### 12.2 Mobile Staff Portal
- [ ] Daily Report: simplified mobile form (single column, large inputs)
- [ ] Leave request: mobile-optimized date picker
- [ ] My Tasks: card-based task list (swipe actions)
- [ ] Bottom navigation bar: Home / Tasks / Report / Leave / Profile

### 12.3 Mobile Tool Check-in/out
- [ ] Simplified checkout form: scan QR → select WO → confirm
- [ ] Check-in: one-tap return with auto-charge display
- [ ] History: timeline view of recent tool usage

### 12.4 Mobile Approval
- [ ] Approval list: card-based with swipe right (approve) / swipe left (reject)
- [ ] Quick view: expandable card detail without page navigation
- [ ] Batch approve: select multiple → approve all

### 12.5 PWA (Progressive Web App)
- [ ] `manifest.json` — app name, icons, theme color, display: standalone
- [ ] Service worker: cache static assets, offline read for cached data
- [ ] Install prompt: "Add to Home Screen" banner
- [ ] Offline indicator: show badge when no network

### 12.6 Touch-optimized UI
- [ ] Minimum tap target: 44x44px for all interactive elements
- [ ] Touch-friendly date pickers and dropdowns
- [ ] Pull-to-refresh on list pages
- [ ] Gesture support: swipe to go back, long-press for context menu

---

## Phase 13 — Audit & Security Enhancement 🔐 (Planned)

### 13.1 Enhanced Audit Trail
- [ ] Model: `AuditLog` (user_id, org_id, action, resource_type, resource_id, before_value JSON, after_value JSON, ip_address, created_at)
- [ ] Middleware/decorator: auto-log CUD operations on all models
- [ ] API: `GET /api/admin/audit-log` — enhanced with filtering (user, resource, date range, action type)
- [ ] Frontend: AuditLogTab v2 — advanced filters, diff viewer (before/after comparison)

### 13.2 Login History
- [ ] Model: `LoginHistory` (user_id, ip_address, user_agent, device_type, location, success, created_at)
- [ ] Record on every login attempt (success/failure)
- [ ] API: `GET /api/auth/login-history` — own history
- [ ] Admin: `GET /api/admin/login-history` — all users (admin.user.read)
- [ ] Frontend: Login history page in user profile

### 13.3 Session Management
- [ ] Model: `ActiveSession` (user_id, token_hash, device_info, ip_address, last_active, created_at)
- [ ] API: `GET /api/auth/sessions` — list active sessions
- [ ] API: `DELETE /api/auth/sessions/{id}` — remote logout (revoke specific session)
- [ ] API: `DELETE /api/auth/sessions` — logout all other sessions
- [ ] Frontend: Active sessions list with "Logout" button per session

### 13.4 Password Policy
- [ ] Config: `OrgSecurityConfig` (min_length, require_uppercase, require_number, require_special, max_age_days, history_count)
- [ ] Validation on password set/change
- [ ] Password expiry: force change after N days
- [ ] Password history: prevent reuse of last N passwords
- [ ] Frontend: password strength meter on change password form

### 13.5 Two-Factor Authentication (2FA)
- [ ] Install: `pyotp` (TOTP)
- [ ] Model: User + `totp_secret` (encrypted), `is_2fa_enabled`
- [ ] API: `POST /api/auth/2fa/setup` — generate secret + QR code
- [ ] API: `POST /api/auth/2fa/verify` — verify TOTP code during login
- [ ] API: `POST /api/auth/2fa/disable` — disable with password confirmation
- [ ] Frontend: 2FA setup wizard with QR code display + backup codes
- [ ] Login flow: username/password → if 2FA enabled → TOTP code prompt

### 13.6 API Rate Limiting per User
- [ ] Per-user rate limit (in addition to global): e.g., 100 req/min per user
- [ ] Different limits per role (owner gets higher limit)
- [ ] Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] Redis-based counter per user token

### 13.7 Data Export Audit
- [ ] Log all export/download actions: who, what, when, file type
- [ ] Integration with audit trail (Phase 13.1)
- [ ] Admin report: export frequency per user, data sensitivity classification
- [ ] Optional: require approval for bulk exports

---

## Summary

| Phase | Backend | Frontend | Migrations | Status |
|-------|:-------:|:--------:|:----------:|:------:|
| Phase 0 — Foundation | ~15 files | ~10 files | 1 | ✅ |
| Phase 1 — Core Modules | ~20 files | — | 4 | ✅ |
| Phase 2 — HR + Job Costing | ~15 files | — | 1 | ✅ |
| Phase 3 — Business Flow + Frontend | ~10 files | 54 files | — | ✅ |
| Phase 4 — Org + Planning + Production | ~25 files | ~20 files | 6 | ✅ |
| Phase 5 — Staff Portal & Daily Report | ~10 files | ~12 files | 2 | ✅ |
| Phase 6 — Data Scope | ~8 files | 14 files | — | ✅ |
| Phase 7 — My Approval | 2 files | 6 files | — | ✅ |
| Phase 7.9 — PR/PO Redesign | 9 files | 12 files | 1 | ✅ |
| Phase 8 — Dashboard & Analytics | TBD | TBD | — | 📋 Planned |
| Phase 9 — Notification Center | TBD | TBD | 1 | 📋 Planned |
| Phase 10 — Export & Print | TBD | TBD | — | 📋 Planned |
| Phase 11 — Inventory Enhancement | TBD | TBD | 1-2 | 📋 Planned |
| Phase 12 — Mobile Responsive | — | TBD | — | 📋 Planned |
| Phase 13 — Audit & Security | TBD | TBD | 1-2 | 📋 Planned |
| **Total (Done)** | **~104 files** | **~114 files** | **13** | **8/13 ✅** |

**Permissions:** 89 → 105 → 108 → 118 → 123 (Phase 4: +16, Phase 5: +3, Phase 4.9: +10, PR/PO: +5)
**Business Rules:** 35 → 46 → 55 → 68 (Phase 4: +11, Phase 5: +9, PR/PO: +13)
**Routes:** 17 → 20+ → 25+ → 26+ → 28+ (Phase 7.9: +2 PR routes)
**New Components (Phase 6):** ScopeBadge, EmployeeContextSelector, SupervisorDashboard
**New Components (Phase 7):** ApprovalPage, TimesheetApprovalTab, LeaveApprovalTab, POApprovalTab, SOApprovalTab
**New Components (Phase 7.9):** PurchasingPage, PRTab, POTab, PRFormModal, PRDetailPage, ConvertToPOModal, GoodsReceiptModal, PRApprovalTab
**Sidebar (Phase 7):** 3-group layout: ME / อนุมัติ / ระบบงาน (was 2-group)
**Bug Fix (Phase 7):** Leave reject API fixed — now accepts `{action: "approve"|"reject"}` body

**Planned Phases (8-13):**
- Phase 8: Dashboard KPI + Charts + Manager/Staff/Finance dashboards
- Phase 9: In-app notifications + bell icon + WebSocket/SSE + email integration
- Phase 10: PDF/Excel export + print-friendly + report templates
- Phase 11: Reorder point + low stock alert + batch tracking + barcode + stock take
- Phase 12: Mobile responsive + PWA + touch UI + mobile approval
- Phase 13: Enhanced audit trail + login history + 2FA + password policy

---

*Last updated: 2026-03-01 — Phase 7.9 complete (PR/PO Redesign), Phase 8-13 planned (123 permissions, 68 BRs, ~218 files)*
