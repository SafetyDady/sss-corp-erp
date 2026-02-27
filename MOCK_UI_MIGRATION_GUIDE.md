# Mock UI → ERP Frontend Migration Guide

> **Purpose:** This document enables a Local AI agent (Claude Code, Cursor, etc.) or a developer to understand the Mock UI prototype and systematically apply its design patterns to the real SSS Corp ERP frontend. Read this file completely before making any changes.

---

## 1. Architecture Comparison

| Aspect | Mock UI (`mock-ui/`) | Real ERP (`frontend/`) |
|---|---|---|
| **Framework** | React 19 + TypeScript | React 18 + JavaScript (JSX) |
| **UI Library** | shadcn/ui (Radix primitives) | Ant Design (antd) |
| **Styling** | Tailwind CSS 4 + CSS variables | Inline styles + `COLORS` object + antd theme tokens |
| **Routing** | Wouter | React Router v6 |
| **State** | Local state only (mock data) | Zustand (`authStore.js`) + API calls |
| **Data** | Hardcoded arrays in each page | Axios → FastAPI backend → PostgreSQL |
| **Icons** | Lucide React | Lucide React (same) |

**Key takeaway:** You cannot copy Mock UI files directly. Instead, use them as a **design reference** and translate the layout, structure, and visual patterns into the real ERP's Ant Design + inline style system.

---

## 2. Design System — Shared Foundation

Both Mock UI and real ERP already share the same color palette. The design tokens are defined in `frontend/src/utils/constants.js`:

```javascript
// Already in the real ERP — DO NOT change these
export const COLORS = {
  accent: '#06b6d4',      // Cyan — primary actions, links, active states
  accentHover: '#0891b2',
  success: '#10b981',     // Green — approved, completed
  warning: '#f59e0b',     // Amber — pending, attention
  danger: '#ef4444',      // Red — rejected, errors, overdue
  purple: '#8b5cf6',
  bg: '#0a0a0f',          // Darkest — page background
  surface: '#111118',     // Header, elevated areas
  card: '#16161f',        // Card backgrounds
  sidebar: '#0d0d14',     // Sidebar background
  border: '#2a2a3a',
  text: '#e2e8f0',        // Primary text
  textSecondary: '#94a3b8',
  textMuted: '#718096',
};
```

The antd theme tokens in `ANT_THEME_TOKEN` also match. No color changes needed.

---

## 3. Sidebar Restructuring

### Current Sidebar (Real ERP — `App.jsx`)

The sidebar currently has two groups: **"ของฉัน"** (My) and **"ระบบงาน"** (System), with flat menu items.

### Target Sidebar (Mock UI)

The Mock UI consolidates items:

| Sidebar Item | Route | What's Inside | Change Type |
|---|---|---|---|
| **ME** | `/me` | Tabs: My Tasks, Timesheet, Leave, Daily Report | **NEW** — replaces 4 separate `/my/*` routes |
| Dashboard | `/` | Overview stats, activity, alerts | No change |
| **Supply Chain** | `/supply-chain` | Tabs: Inventory, Warehouse, Tools | **NEW** — replaces 3 separate routes |
| Work Orders | `/work-orders` | WO list + detail | No change |
| Purchasing | `/purchasing` | PO list + detail | No change |
| Sales | `/sales` | SO list + detail | No change |
| Finance | `/finance` | Tabs: GL, AP, AR, Cost Center, Cost Element | Expand existing |
| HR | `/hr` | Tabs: Employees, Leave, Attendance, DR Approval, Leave Balance | No change |
| Customers | `/customers` | Customer list | No change |
| Planning | `/planning` | Tabs: Production Plan, Master Plan, Capacity | Expand existing |
| Master Data | `/master` | Tabs: UoM, Categories, Departments, OT Types, Leave Types, Locations | No change |
| Admin | `/admin` | Tabs: Users, Roles, Audit Log, Settings | No change |

### How to Apply — Step by Step

**Step 1: Update `MY_MENU_ITEMS` in `App.jsx`**

Replace the 4 individual "my" menu items with a single "ME" item:

```javascript
// BEFORE (current)
const MY_MENU_ITEMS = [
  { key: '/my/leave', icon: <FileText size={18} />, label: 'ใบลาของฉัน' },
  { key: '/my/timesheet', icon: <Clock size={18} />, label: 'Timesheet' },
  { key: '/my/tasks', icon: <CalendarCheck size={18} />, label: 'งานของฉัน' },
  { key: '/my/daily-report', icon: <ClipboardList size={18} />, label: 'รายงานประจำวัน' },
];

// AFTER (target)
const MY_MENU_ITEMS = [
  { key: '/me', icon: <User size={18} />, label: 'ME' },
];
```

**Step 2: Update `SYSTEM_MENU_ITEMS` in `App.jsx`**

Replace Inventory, Warehouse, Tools with a single Supply Chain item:

```javascript
// REMOVE these 3:
{ key: '/inventory', ... label: 'Inventory' },
{ key: '/warehouse', ... label: 'Warehouse' },
{ key: '/tools',     ... label: 'Tools' },

// ADD this 1 (place after Dashboard):
{ key: '/supply-chain', icon: <Package size={18} />, label: 'Supply Chain', permission: 'inventory.product.read' },
```

**Step 3: Update group label**

```javascript
// Change 'ของฉัน' to 'ME'
{ key: 'grp-my', type: 'group', label: collapsed ? null : 'ME', children: myItems },
```

**Step 4: Update Routes in `App.jsx`**

```jsx
// ADD new routes:
<Route path="/me" element={<MePage />} />
<Route path="/supply-chain" element={<SupplyChainPage />} />

// KEEP existing routes as fallback (optional):
<Route path="/my/*" element={<Navigate to="/me" replace />} />
<Route path="/inventory" element={<Navigate to="/supply-chain" replace />} />
<Route path="/warehouse" element={<Navigate to="/supply-chain" replace />} />
<Route path="/tools" element={<Navigate to="/supply-chain" replace />} />
```

---

## 4. New Pages to Create

### 4.1 ME Page (`frontend/src/pages/my/MePage.jsx`)

This page consolidates all "my" sub-pages into a single tabbed view.

**Structure:**
```
MePage
├── Profile Header (employee name, position, department, hire date, tenure)
├── Ant Design <Tabs>
│   ├── Tab 1: "งานของฉัน" → embed <MyTasksPage /> content
│   ├── Tab 2: "Timesheet" → embed <MyTimesheetPage /> content
│   ├── Tab 3: "ใบลา" → embed <MyLeavePage /> content
│   └── Tab 4: "รายงานประจำวัน" → embed <MyDailyReportPage /> content
```

**API Endpoints Used:**
- `GET /api/auth/me` — user profile with employee fields
- `GET /api/work-orders?assigned_to_me=true` — my tasks
- `GET /api/hr/timesheets?employee_id={id}` — my timesheets
- `GET /api/hr/leaves?employee_id={id}` — my leaves
- `GET /api/hr/leave-balance?employee_id={id}` — leave balance
- `GET /api/daily-report?employee_id={id}` — my daily reports

**Implementation approach:** Import existing page components and render them inside `<Tabs.TabPane>`. No need to rewrite the logic — just wrap them.

```jsx
import { Tabs } from 'antd';
import MyTasksPage from './MyTasksPage';
import MyTimesheetPage from './MyTimesheetPage';
import MyLeavePage from './MyLeavePage';
import MyDailyReportPage from './MyDailyReportPage';

export default function MePage() {
  const user = useAuthStore((s) => s.user);
  return (
    <div style={{ padding: 24 }}>
      {/* Profile header card */}
      <Card style={{ background: COLORS.card, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar size={64} icon={<User />} style={{ background: COLORS.accent }} />
          <div>
            <Title level={4} style={{ color: COLORS.text, margin: 0 }}>{user?.full_name}</Title>
            <Text style={{ color: COLORS.textSecondary }}>{user?.employee_position} — {user?.department_name}</Text>
          </div>
        </div>
      </Card>
      <Tabs defaultActiveKey="tasks" items={[
        { key: 'tasks', label: 'งานของฉัน', children: <MyTasksPage embedded /> },
        { key: 'timesheet', label: 'Timesheet', children: <MyTimesheetPage embedded /> },
        { key: 'leave', label: 'ใบลา', children: <MyLeavePage embedded /> },
        { key: 'daily-report', label: 'รายงานประจำวัน', children: <MyDailyReportPage embedded /> },
      ]} />
    </div>
  );
}
```

> **Note:** Add an `embedded` prop to existing My* pages so they skip rendering their own `<PageHeader>` when used inside MePage.

### 4.2 Supply Chain Page (`frontend/src/pages/supply-chain/SupplyChainPage.jsx`)

This page consolidates Inventory, Warehouse, and Tools into tabs.

**Structure:**
```
SupplyChainPage
├── Stat Cards Row (total products, open movements, warehouse count, tools checked out)
├── Ant Design <Tabs>
│   ├── Tab 1: "Inventory" → embed ProductListPage + MovementListPage
│   ├── Tab 2: "Warehouse" → embed WarehouseListPage + LocationListPage
│   └── Tab 3: "Tools" → embed ToolListPage
```

**API Endpoints Used:**
- `GET /api/inventory/products` — product list
- `GET /api/stock/movements` — stock movements
- `POST /api/stock/movements` — create movement (IN/OUT/ADJUST/TRANSFER)
- `GET /api/warehouse/warehouses` — warehouse list
- `GET /api/warehouse/locations` — location list
- `GET /api/tools` — tool list
- `POST /api/tools/{id}/checkout` — tool checkout
- `POST /api/tools/{id}/checkin` — tool checkin

**Implementation approach:** Same as MePage — import existing list pages and wrap in tabs.

---

## 5. Page-by-Page API Mapping

This is the complete mapping of every Mock UI page to the real backend API endpoints. Use this when converting mock data to real API calls.

### 5.1 Dashboard (`/`)

| Mock UI Data | API Endpoint | Method |
|---|---|---|
| Total inventory items | `GET /api/inventory/products?count_only=true` | GET |
| Open work orders | `GET /api/work-orders?status=OPEN` | GET |
| Monthly sales | `GET /api/finance/summary` | GET |
| Employee count | `GET /api/hr/employees` | GET |
| Recent activity | Aggregate from multiple endpoints | GET |

### 5.2 Work Orders (`/work-orders`)

| Mock UI Data | API Endpoint | Method |
|---|---|---|
| WO list | `GET /api/work-orders` | GET |
| WO detail | `GET /api/work-orders/{id}` | GET |
| Create WO | `POST /api/work-orders` | POST |
| Update WO | `PUT /api/work-orders/{id}` | PUT |
| Delete WO | `DELETE /api/work-orders/{id}` | DELETE |
| Approve/Close WO | `POST /api/work-orders/{id}/approve` | POST |
| ManHour Summary | `GET /api/work-orders/{id}/manhour-summary` | GET |
| Master Plan | `GET /api/work-orders/master-plan` | GET |

### 5.3 Purchasing (`/purchasing`)

| Mock UI Data | API Endpoint | Method |
|---|---|---|
| PO list | `GET /api/purchasing/orders` | GET |
| PO detail | `GET /api/purchasing/orders/{id}` | GET |
| Create PO | `POST /api/purchasing/orders` | POST |
| Update PO | `PUT /api/purchasing/orders/{id}` | PUT |
| Approve PO | `POST /api/purchasing/orders/{id}/approve` | POST |
| Receive PO | `POST /api/purchasing/orders/{id}/receive` | POST |

### 5.4 Sales (`/sales`)

| Mock UI Data | API Endpoint | Method |
|---|---|---|
| SO list | `GET /api/sales/orders` | GET |
| SO detail | `GET /api/sales/orders/{id}` | GET |
| Create SO | `POST /api/sales/orders` | POST |
| Update SO | `PUT /api/sales/orders/{id}` | PUT |
| Approve SO | `POST /api/sales/orders/{id}/approve` | POST |

### 5.5 Finance (`/finance`)

| Mock UI Data | API Endpoint | Method |
|---|---|---|
| Finance summary | `GET /api/finance/summary` | GET |
| Finance report | `GET /api/finance/report` | GET |
| Cost Centers | `GET /api/master/cost-centers` | GET |
| Cost Elements | `GET /api/master/cost-elements` | GET |

> **Note:** The Mock UI shows GL, AP, AR tabs. The real backend currently has limited finance endpoints. These tabs should show data from `/api/finance/summary` and `/api/finance/report`, with Cost Center and Cost Element data from the master API.

### 5.6 HR (`/hr`)

| Mock UI Data | API Endpoint | Method |
|---|---|---|
| Employee list | `GET /api/hr/employees` | GET |
| Create employee | `POST /api/hr/employees` | POST |
| Leave requests | `GET /api/hr/leaves` | GET |
| Create leave | `POST /api/hr/leaves` | POST |
| Approve leave | `POST /api/hr/leaves/{id}/approve` | POST |
| Leave balance | `GET /api/hr/leave-balance?employee_id={id}` | GET |
| Timesheets | `GET /api/hr/timesheets` | GET |
| Generate timesheet | `POST /api/hr/timesheets/generate` | POST |
| Daily Report list | `GET /api/daily-report` | GET |
| Approve DR | `POST /api/daily-report/{id}/approve` | POST |
| Reject DR | `POST /api/daily-report/{id}/reject` | POST |
| Batch approve | `POST /api/daily-report/batch-approve` | POST |

### 5.7 Customers (`/customers`)

| Mock UI Data | API Endpoint | Method |
|---|---|---|
| Customer list | `GET /api/customers` | GET |
| Create customer | `POST /api/customers` | POST |
| Update customer | `PUT /api/customers/{id}` | PUT |
| Delete customer | `DELETE /api/customers/{id}` | DELETE |

### 5.8 Planning (`/planning`)

| Mock UI Data | API Endpoint | Method |
|---|---|---|
| Daily plans | `GET /api/planning/daily-plans` | GET |
| Create daily plan | `POST /api/planning/daily-plans` | POST |
| Reservations | `GET /api/planning/reservations` | GET |
| Create reservation | `POST /api/planning/reservations` | POST |
| Master plan | `GET /api/work-orders/master-plan` | GET |

### 5.9 Master Data (`/master`)

| Mock UI Data | API Endpoint | Method |
|---|---|---|
| UoM list | `GET /api/master/uom` | GET |
| Product categories | `GET /api/master/categories` | GET |
| Departments | `GET /api/master/departments` | GET |
| OT types | `GET /api/master/ot-types` | GET |
| Leave types | `GET /api/master/leave-types` | GET |
| Locations | `GET /api/warehouse/locations` | GET |
| Cost Centers | `GET /api/master/cost-centers` | GET |
| Cost Elements | `GET /api/master/cost-elements` | GET |

### 5.10 Admin (`/admin`)

| Mock UI Data | API Endpoint | Method |
|---|---|---|
| User list | `GET /api/admin/users` | GET |
| Create user | `POST /api/admin/users` | POST |
| Role list | `GET /api/admin/roles` | GET |
| Update role permissions | `PUT /api/admin/roles/{id}` | PUT |
| Audit log | `GET /api/admin/audit-log` | GET |
| Org settings | `GET /api/admin/org` | GET |
| Update org settings | `PUT /api/admin/org` | PUT |

---

## 6. Design Patterns to Apply

### 6.1 Stat Cards Row

Every page in the Mock UI starts with a row of 3-4 stat cards. Apply this pattern using antd:

```jsx
import { Card, Row, Col, Typography } from 'antd';
const { Text, Title } = Typography;

function StatCard({ label, value, suffix, icon, trend }) {
  return (
    <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>{label}</Text>
          <Title level={3} style={{ color: COLORS.text, margin: '4px 0 0' }}>
            {value} {suffix && <span style={{ fontSize: 14, color: COLORS.textSecondary }}>{suffix}</span>}
          </Title>
          {trend && <Text style={{ color: COLORS.success, fontSize: 12 }}>{trend}</Text>}
        </div>
        <div style={{ color: COLORS.accent, opacity: 0.6 }}>{icon}</div>
      </div>
    </Card>
  );
}

// Usage:
<Row gutter={16} style={{ marginBottom: 24 }}>
  <Col span={6}><StatCard label="สินค้าคงเหลือ" value="1,247" suffix="รายการ" /></Col>
  <Col span={6}><StatCard label="ใบสั่งงานเปิด" value="23" suffix="Work Orders" /></Col>
  <Col span={6}><StatCard label="ยอดขายเดือนนี้" value="฿2.4M" trend="+18.5%" /></Col>
  <Col span={6}><StatCard label="พนักงาน" value="156" suffix="Active" /></Col>
</Row>
```

### 6.2 Table Styling

The Mock UI uses a consistent dark table style. Apply to antd `<Table>`:

```jsx
<Table
  dataSource={data}
  columns={columns}
  rowKey="id"
  pagination={{ pageSize: 10, showSizeChanger: true }}
  style={{ background: COLORS.card }}
  rowClassName={() => 'dark-table-row'}
/>
```

Add to `App.css`:
```css
.dark-table-row:hover > td {
  background: rgba(6, 182, 212, 0.05) !important;
}
```

### 6.3 Page Header Pattern

```jsx
<PageHeader
  title="Work Orders"
  subtitle="จัดการใบสั่งงาน"
/>
```

The existing `<PageHeader>` component in `frontend/src/components/PageHeader.jsx` already follows this pattern.

### 6.4 Search + Filter + Action Bar

```jsx
<div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
  <SearchInput placeholder="ค้นหา..." onSearch={handleSearch} style={{ flex: 1 }} />
  <Button icon={<Filter size={14} />}>ตัวกรอง</Button>
  <Button icon={<Download size={14} />}>ส่งออก</Button>
  <Button type="primary" icon={<Plus size={14} />}>สร้างใหม่</Button>
</div>
```

### 6.5 Status Badge Colors

Use the existing `<StatusBadge>` component. The color mapping:

| Status | Color | COLORS key |
|---|---|---|
| DRAFT | `textMuted` | `#718096` |
| OPEN / SUBMITTED / PENDING | `warning` | `#f59e0b` |
| IN_PROGRESS | `accent` | `#06b6d4` |
| APPROVED / COMPLETED / ACTIVE | `success` | `#10b981` |
| REJECTED / CANCELLED / OVERDUE | `danger` | `#ef4444` |
| CLOSED | `purple` | `#8b5cf6` |

---

## 7. Migration Priority Order

Execute in this order to minimize disruption:

| Priority | Task | Effort | Impact |
|---|---|---|---|
| **P1** | Sidebar restructuring (ME + Supply Chain) | 2-3 hours | High — changes navigation for all users |
| **P2** | Create `MePage.jsx` with tabs wrapping existing My* pages | 1-2 hours | High — consolidates user experience |
| **P3** | Create `SupplyChainPage.jsx` with tabs wrapping existing pages | 1-2 hours | High — consolidates 3 pages into 1 |
| **P4** | Add stat cards to Dashboard | 1 hour | Medium — visual improvement |
| **P5** | Add stat cards to all list pages | 2-3 hours | Medium — consistent visual pattern |
| **P6** | Expand Finance page with GL/AP/AR tabs | 2-3 hours | Medium — new functionality |
| **P7** | Expand Planning page with Capacity tab | 1-2 hours | Low — new tab |
| **P8** | Polish: search bars, filter buttons, export buttons | 2-3 hours | Low — UX improvement |

**Total estimated effort: 12-19 hours**

---

## 8. Important Notes for Local AI

1. **DO NOT change the backend.** All changes are frontend-only (`frontend/src/`).

2. **DO NOT change `constants.js`.** The color palette is already correct.

3. **Use Ant Design components**, not shadcn/ui. The real ERP uses antd exclusively.

4. **Use inline styles with `COLORS` object**, not Tailwind classes. Example:
   ```jsx
   // ✅ Correct (real ERP style)
   <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
   
   // ❌ Wrong (Mock UI style — do not use)
   <div className="bg-[#16161f] border border-[#2a2a3a]">
   ```

5. **Financial terms in English.** Cost Center, Cost Element, GL (General Ledger), AP (Accounts Payable), AR (Accounts Receivable) must remain in English — do not translate to Thai.

6. **Permission checks.** Every menu item and action button must check permissions using the `usePermission` hook:
   ```jsx
   const { can } = usePermission();
   if (can('inventory.product.create')) { /* show create button */ }
   ```

7. **API calls use `api.js`.** Import from `services/api.js`:
   ```jsx
   import api from '../services/api';
   const { data } = await api.get('/api/inventory/products');
   ```

8. **Test after each change.** Run the frontend dev server and verify:
   - Sidebar renders correctly with new grouping
   - Tab navigation works within ME and Supply Chain pages
   - Existing pages still function when accessed via new tab layout
   - Permission-based visibility still works

---

## 9. File Reference — Mock UI → Real ERP Mapping

| Mock UI File | Real ERP Equivalent | Action |
|---|---|---|
| `mock-ui/client/src/components/AppLayout.tsx` | `frontend/src/App.jsx` (AppLayout function) | Reference for sidebar structure |
| `mock-ui/client/src/pages/Me.tsx` | `frontend/src/pages/my/MePage.jsx` | **CREATE NEW** |
| `mock-ui/client/src/pages/SupplyChain.tsx` | `frontend/src/pages/supply-chain/SupplyChainPage.jsx` | **CREATE NEW** |
| `mock-ui/client/src/pages/Dashboard.tsx` | `frontend/src/pages/DashboardPage.jsx` | Reference for stat cards layout |
| `mock-ui/client/src/pages/Purchasing.tsx` | `frontend/src/pages/purchasing/POListPage.jsx` | Reference for stat cards |
| `mock-ui/client/src/pages/Sales.tsx` | `frontend/src/pages/sales/SOListPage.jsx` | Reference for stat cards |
| `mock-ui/client/src/pages/Finance.tsx` | `frontend/src/pages/finance/FinancePage.jsx` | Reference for GL/AP/AR tabs |
| `mock-ui/client/src/pages/HR.tsx` | `frontend/src/pages/hr/HRPage.jsx` | Reference (already has tabs) |
| `mock-ui/client/src/pages/Customers.tsx` | `frontend/src/pages/customer/CustomerListPage.jsx` | Reference for stat cards + tier |
| `mock-ui/client/src/pages/Planning.tsx` | `frontend/src/pages/planning/PlanningPage.jsx` | Reference for Capacity tab |
| `mock-ui/client/src/pages/MasterData.tsx` | `frontend/src/pages/master/MasterDataPage.jsx` | Reference (already has tabs) |
| `mock-ui/client/src/pages/Admin.tsx` | `frontend/src/pages/admin/AdminPage.jsx` | Reference (already has tabs) |
| `mock-ui/client/src/components/StatCard.tsx` | `frontend/src/components/StatCard.jsx` | **CREATE NEW** (reusable component) |

---

## 10. Quick Start Command for Local AI

If you are a Local AI agent (Claude Code), execute these tasks in order:

```
Task 1: Create frontend/src/components/StatCard.jsx (reusable stat card component using antd + COLORS)
Task 2: Create frontend/src/pages/my/MePage.jsx (tabs wrapping existing My* pages)  
Task 3: Create frontend/src/pages/supply-chain/SupplyChainPage.jsx (tabs wrapping Inventory/Warehouse/Tools)
Task 4: Update frontend/src/App.jsx sidebar menu items (ME + Supply Chain consolidation)
Task 5: Update frontend/src/App.jsx routes (add /me and /supply-chain, redirect old routes)
Task 6: Add stat cards row to DashboardPage.jsx, POListPage.jsx, SOListPage.jsx, CustomerListPage.jsx
Task 7: Expand FinancePage.jsx with GL, AP, AR tabs (mock data initially, connect API later)
Task 8: Test all navigation paths and verify permission-based visibility
```

Reference the Mock UI files in `mock-ui/client/src/pages/` for the exact layout, data structure, and visual design of each page.
