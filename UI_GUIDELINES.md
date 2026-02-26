# UI_GUIDELINES.md — SSS Corp ERP

> ไฟล์นี้เป็นส่วนเสริมของ CLAUDE.md — กำหนดแนวทาง UI ทั้งหมด
> AI ต้องอ่านร่วมกับ CLAUDE.md เสมอ
> อัปเดต: 2026-02-26 v4 — Synced with Frontend Implementation (45 pages, 54 files)

---

## HARD RULES (ห้ามฝ่าฝืน)

1. **ห้ามใช้ emoji** ในทุกที่ — sidebar, ปุ่ม, header, badge, stat card, title
2. **ห้ามใช้ Ant Design Icons** (@ant-design/icons) — ใช้ Lucide React เท่านั้น
3. **Theme: Full Dark เท่านั้น** — ห้ามมีหน้าสีขาว/สว่าง (`theme.darkAlgorithm`)
4. **ภาษา: ไทย label + อังกฤษ data/menu** — เช่น เมนู "Inventory" แต่ label "คงเหลือ"
5. **ห้ามใช้ hardcoded color** — ใช้ `COLORS` จาก `utils/constants.js` เท่านั้น
6. **ห้ามใช้ inline styles สำหรับ status** — ใช้ `<StatusBadge status="..." />` component เท่านั้น
7. **ตัวเลข/รหัส ต้องใช้ monospace** — `fontFamily: 'monospace'` สำหรับ codes, currency, numbers
8. **ทุก action button ต้องมี Tooltip** — อธิบายว่าปุ่มทำอะไร (ภาษาไทย)
9. **ทุก destructive action ต้องมี Confirm** — `Modal.confirm()` ก่อนลบ/ยกเลิก

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | Ant Design | 5.x |
| Icons | Lucide React | 0.453+ |
| Routing | React Router DOM | 6.x |
| State | Zustand (`authStore`) | 4.x |
| HTTP Client | Axios (`services/api.js`) | 1.x |
| Theme | `ConfigProvider` + `theme.darkAlgorithm` | — |

---

## Theme — Full Dark

### Color System (`utils/constants.js`)

```js
export const COLORS = {
  // Accent (Primary)
  accent:         '#06b6d4',   // Cyan — ปุ่มหลัก, active menu, links
  accentHover:    '#0891b2',   // Cyan dark — hover state
  accentMuted:    '#06b6d420', // Cyan 12% — background highlight, info alerts

  // Semantic
  success:        '#10b981',   // Green — approved, open, available, active, received, invoiced
  warning:        '#f59e0b',   // Amber — pending, checked-out, draft, maintenance
  danger:         '#ef4444',   // Red — error, delete, rejected, cancelled, sick leave
  purple:         '#8b5cf6',   // Purple — final, executed, personal leave, consumable

  // Surfaces
  bg:             '#0a0a0f',   // Darkest — page background
  surface:        '#111118',   // Dark — header, elevated areas
  surfaceHover:   '#1a1a24',   // Dark — hover state on rows
  card:           '#16161f',   // Dark — cards, tables, modals
  cardHover:      '#1e1e2a',   // Dark — card hover

  // Sidebar
  sidebar:        '#0d0d14',   // Darkest — sidebar background
  sidebarHover:   '#1a1a26',   // Dark — menu item hover
  sidebarActive:  '#06b6d418', // Cyan 10% — active menu item background
  sidebarBorder:  '#1a1a26',   // Dark — sidebar dividers

  // Borders
  border:         '#2a2a3a',   // Medium — card borders, dividers
  borderLight:    '#22222f',   // Subtle — row separators

  // Text
  text:           '#e2e8f0',   // Light — primary text
  textSecondary:  '#94a3b8',   // Medium — secondary text, subtitles
  textMuted:      '#718096',   // Dim — labels, placeholders, disabled text
};
```

### Contrast Ratios (ตรวจสอบแล้ว WCAG 2.1 AA)

```
text (#e2e8f0)          บน bg (#0a0a0f)   = 15.4:1  ✅ AAA
text (#e2e8f0)          บน card (#16161f) = 12.2:1  ✅ AAA
textSecondary (#94a3b8) บน bg (#0a0a0f)   =  6.8:1  ✅ AA
textSecondary (#94a3b8) บน card (#16161f) =  5.4:1  ✅ AA
textMuted (#718096)     บน bg (#0a0a0f)   =  5.2:1  ✅ AA
textMuted (#718096)     บน card (#16161f) =  4.1:1  ✅ AA (ใช้กับ font ≥14px bold หรือ ≥18px)
```

> หมายเหตุ: textMuted ใช้เฉพาะกับ label ขนาดเล็ก (≤12px) ที่เป็นข้อมูลเสริม ไม่ใช่ข้อมูลหลัก
> ถ้าเป็นข้อมูลที่ต้องอ่านได้ชัด ให้ใช้ textSecondary ขึ้นไป

### Ant Design Theme Config (`utils/constants.js`)

```js
export const ANT_THEME_TOKEN = {
  colorPrimary:      '#06b6d4',
  colorBgContainer:  '#16161f',
  colorBgElevated:   '#1e1e2a',
  colorBgLayout:     '#0a0a0f',
  colorBorder:       '#2a2a3a',
  colorText:         '#e2e8f0',
  colorTextSecondary:'#94a3b8',
  borderRadius:      8,
};
```

### Usage in App.jsx

```jsx
import { ConfigProvider, theme } from 'antd';
import { ANT_THEME_TOKEN } from './utils/constants';

<ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: ANT_THEME_TOKEN }}>
  <AntApp>...</AntApp>
</ConfigProvider>
```

---

## Shared Components (บังคับใช้)

ทุกหน้าต้องใช้ shared components เหล่านี้ — ห้ามสร้างใหม่ซ้ำซ้อน:

### PageHeader (`components/PageHeader.jsx`)

```jsx
import PageHeader from '../../components/PageHeader';

<PageHeader
  title="Work Orders"           // อังกฤษ
  subtitle="จัดการใบสั่งงาน"      // ไทย
  actions={<Button type="primary" icon={<Plus size={14} />}>สร้าง Work Order</Button>}
/>
```

- `title`: อังกฤษ, fontSize 20, fontWeight 600, color `COLORS.text`
- `subtitle`: ไทย, fontSize 13, color `COLORS.textSecondary`
- `actions`: JSX ปุ่มด้านขวา (optional)

### StatusBadge (`components/StatusBadge.jsx`)

```jsx
import StatusBadge from '../../components/StatusBadge';

<StatusBadge status="APPROVED" />
```

รองรับ status ทั้งหมด 28 ค่า:

| Status | Color | Usage |
|--------|-------|-------|
| DRAFT | `#f59e0b` (warning) | WO draft, Timesheet pending |
| OPEN | `#10b981` (success) | WO open |
| CLOSED | `#718096` (muted) | WO closed |
| APPROVED | `#10b981` (success) | Timesheet approved, Leave approved |
| PENDING | `#f59e0b` (warning) | รอ approve |
| SUBMITTED | `#06b6d4` (accent) | Timesheet submitted |
| FINAL | `#8b5cf6` (purple) | HR final approve |
| LOCKED | `#718096` (muted) | Timesheet locked (7 days) |
| REJECTED | `#ef4444` (danger) | Rejected items |
| CANCELLED | `#ef4444` (danger) | Cancelled items |
| CHECKED-OUT / CHECKED_OUT | `#f59e0b` (warning) | Tool checked out |
| AVAILABLE | `#10b981` (success) | Tool available |
| RECEIVED | `#10b981` (success) | PO goods received |
| EXECUTED | `#8b5cf6` (purple) | Payroll executed |
| EXPORTED | `#06b6d4` (accent) | Payroll exported |
| INVOICED | `#10b981` (success) | SO invoiced |
| MAINTENANCE | `#f59e0b` (warning) | Tool maintenance |
| RETIRED | `#718096` (muted) | Tool retired |
| ACTIVE | `#10b981` (success) | Employee/item active |
| INACTIVE | `#718096` (muted) | Employee/item inactive |
| MATERIAL | `#06b6d4` (accent) | Product type |
| CONSUMABLE | `#8b5cf6` (purple) | Product type |
| ANNUAL | `#06b6d4` (accent) | Leave type |
| SICK | `#ef4444` (danger) | Leave type |
| PERSONAL | `#8b5cf6` (purple) | Leave type |

Badge style: `background: color + '18'` (10% opacity), `borderRadius: 6`, `fontSize: 11`, `fontWeight: 600`, `letterSpacing: 0.3`

### EmptyState (`components/EmptyState.jsx`)

```jsx
import EmptyState from '../../components/EmptyState';

<EmptyState
  message="ยังไม่มีข้อมูลพนักงาน"
  hint="กดปุ่ม 'เพิ่มพนักงาน' เพื่อเริ่มต้น"
/>
```

- Icon: `Inbox` (Lucide), size 40, opacity 0.5
- Default message: "ไม่พบข้อมูล"
- Default hint: "ลองเปลี่ยนเงื่อนไขการค้นหา หรือเพิ่มรายการใหม่"
- ใช้ใน Table `locale={{ emptyText: <EmptyState /> }}`

### SearchInput (`components/SearchInput.jsx`)

```jsx
import SearchInput from '../../components/SearchInput';

<SearchInput onSearch={setSearch} placeholder="ค้นหาสินค้า..." />
```

- Debounce 300ms
- Icon: `Search` (Lucide), size 14
- maxWidth: 320px

---

## Icon System — Lucide React

### Module Icons (Sidebar — 12 items)

| Module | Icon | Import | Route | Permission |
|--------|------|--------|-------|-----------|
| Dashboard | LayoutDashboard | `LayoutDashboard` | `/` | null (ทุกคนเข้าได้) |
| Inventory | Package | `Package` | `/inventory` | `inventory.product.read` |
| Warehouse | Warehouse | `Warehouse` | `/warehouse` | `warehouse.warehouse.read` |
| Work Orders | FileText | `FileText` | `/work-orders` | `workorder.order.read` |
| Purchasing | ShoppingCart | `ShoppingCart` | `/purchasing` | `purchasing.po.read` |
| Sales | DollarSign | `DollarSign` | `/sales` | `sales.order.read` |
| HR | Users | `Users` | `/hr` | `hr.timesheet.read` |
| Tools | Wrench | `Wrench` | `/tools` | `tools.tool.read` |
| Customers | UserCheck | `UserCheck` | `/customers` | `customer.customer.read` |
| Master Data | Database | `Database` | `/master` | `master.costcenter.read` |
| Finance | BarChart3 | `BarChart3` | `/finance` | `finance.report.read` |
| Admin | Settings | `Settings` | `/admin` | `admin.user.read` |

### Action Icons

| Action | Icon | Import | Size |
|--------|------|--------|------|
| Create/Add | Plus | `Plus` | 14 |
| Edit | Pencil | `Pencil` | 14 |
| Delete | Trash2 | `Trash2` | 14 |
| Search | Search | `Search` | 14 |
| Filter | Filter | `Filter` | 14 |
| Export/Download | Download | `Download` | 14 |
| Approve/Check | Check | `Check` | 14 |
| Reject | XCircle | `XCircle` | 14 |
| Lock | Lock | `Lock` | 14 |
| Unlock | Unlock | `Unlock` | 14 |
| Check-in | LogIn | `LogIn` | 14 |
| Check-out | LogOut | `LogOut` | 14 |
| Refresh | RefreshCw | `RefreshCw` | 14 |
| Back | ArrowLeft | `ArrowLeft` | 14 |
| View/Detail | Eye | `Eye` | 14 |
| Save | Save | `Save` | 14 |
| Play/Execute | Play | `Play` | 14 |
| History | History | `History` | 14 |
| Info | Info | `Info` | 14 |
| Calendar | CalendarDays | `CalendarDays` | 14 |
| Clock | Clock | `Clock` | 14 |
| Alert | AlertTriangle | `AlertTriangle` | 14 |
| Collapse sidebar | ChevronLeft | `ChevronLeft` | 14 |
| Expand sidebar | ChevronRight | `ChevronRight` | 14 |
| User | User | `User` | 14 |
| Logout | LogOut | `LogOut` | 14 |

### Additional Icons Used in Specific Pages

| Context | Icon | Import |
|---------|------|--------|
| HR/Employee | Building2 | `Building2` |
| HR/Employee | Mail | `Mail` |
| HR/Employee | MapPin | `MapPin` |
| Finance stat | Banknote | `Banknote` |
| Finance stat | Layers | `Layers` |
| Finance stat | TrendingUp | `TrendingUp` |
| Admin/Roles | Shield, ShieldCheck | `Shield`, `ShieldCheck` |
| Purchasing/GR | PackageCheck | `PackageCheck` |
| Purchasing/GR | ArrowRightLeft | `ArrowRightLeft` |
| Calendar confirm | CalendarCheck | `CalendarCheck` |
| Undo/Rollback | RotateCcw | `RotateCcw` |
| Checkbox | Square, CheckCircle | `Square`, `CheckCircle` |

### Icon Size Guide

```
Sidebar menu:     18
Button icon:      14
Inline/table:     14
Stat card:        16–20
EmptyState:       40
Header user:      14
```

---

## Layout — Sidebar + Header

```
+----------+------------------------------------------+
| Sidebar  |  Header (user info + logout)              |
| 210px    |------------------------------------------|
| (56px    |                                           |
| collapsed)|  Page Content (Suspense + Spin)          |
|          |  +------------------------------------+   |
| Logo     |  |  PageHeader (title + actions)      |   |
| "SSS     |  |  Filter Bar (search + selects)     |   |
| Corp"    |  |  Stat Cards (optional row)         |   |
| Menu     |  |  Table / Tabs / Form               |   |
| (Lucide) |  |  Pagination (bottom)               |   |
|          |  +------------------------------------+   |
| User     |                                           |
| (bottom) |                                           |
| Collapse |                                           |
+----------+------------------------------------------+
```

### Sidebar Details

- Width: 210px expanded, 56px collapsed
- Background: `COLORS.sidebar` (#0d0d14)
- Logo: "SSS Corp" (expanded) / "SSS" (collapsed), color `COLORS.accent`
- Menu: Ant Design `<Menu>` with `theme="dark"`, `mode="inline"`
- 12 items, RBAC-filtered via `usePermission().can(permission)`
- User info at bottom: `full_name` + `role` (hidden when collapsed)
- Collapse button: `ChevronLeft` / `ChevronRight`

### Header Details

- Height: 48px
- Background: `COLORS.surface` (#111118)
- Layout: `justify-content: flex-end` (ไม่มี breadcrumb — ใช้ PageHeader ในแต่ละหน้าแทน)
- Content: `<User size={14} />` + full_name + (role) + Logout button ("ออกจากระบบ")
- Border bottom: `1px solid COLORS.border`

### Content Area

- Padding: 24px
- Wrapped in `<Suspense>` with `<Spin>` fallback

---

## Component States

### Disabled State

```jsx
// Ant Design จัดการ disabled ให้อัตโนมัติ:
<Button disabled>ปิดใช้งาน</Button>
<Input disabled />

// ถ้าเป็น custom component ให้ใช้:
// - opacity: 0.4
// - cursor: not-allowed
// - ห้ามเปลี่ยนสีเป็นสีอื่น แค่ลด opacity
```

### Loading State

```jsx
// Button loading — ใช้ loading prop
<Button loading={actionLoading === record.id} onClick={...}>

// Table loading — ใช้ loading prop
<Table loading={loading} ... />

// Page loading — ใช้ Spin
{loading ? <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div> : content}
```

---

## Page Patterns

### List Page Pattern

ทุก List Page ใช้โครงสร้างเดียวกัน:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Tooltip, Modal } from 'antd';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

// Pattern:
// 1. PageHeader (title EN + subtitle TH + create button)
// 2. Filter bar (SearchInput + Select filters) — flex, gap 12, flexWrap wrap
// 3. Table with columns (StatusBadge, monospace codes/currency, Tooltip actions)
// 4. FormModal for create/edit (destroyOnClose)
// 5. RBAC-aware actions via usePermission().can()
```

### Tab Page Pattern (HR, Admin, Master Data)

```jsx
import { Tabs } from 'antd';
import { usePermission } from '../../hooks/usePermission';
import PageHeader from '../../components/PageHeader';

// Tabs with RBAC filtering
const { can } = usePermission();
const items = [
  can('hr.employee.read') && { key: 'employees', label: 'พนักงาน', children: <EmployeeTab /> },
  can('hr.timesheet.read') && { key: 'timesheet', label: 'Timesheet', children: <TimesheetTab /> },
  can('hr.leave.read') && { key: 'leave', label: 'การลา', children: <LeaveTab /> },
  can('hr.payroll.read') && { key: 'payroll', label: 'Payroll', children: <PayrollTab /> },
].filter(Boolean);
```

### Detail Page Pattern (WO, PO, SO)

```jsx
// 1. Back button (ArrowLeft) — navigate(-1)
// 2. PageHeader with status badge inline
// 3. Info cards (Descriptions or custom cards) — background COLORS.card
// 4. Sub-tables (line items, timesheets, goods receipts, etc.)
// 5. Action buttons (approve, close, receive goods, etc.)
```

### Form Modal Pattern

```jsx
import { Modal, Form, Input, Select, InputNumber, DatePicker, App } from 'antd';

// Pattern:
// 1. useEffect to populate form on edit (form.setFieldsValue)
// 2. form.validateFields() on submit
// 3. Loading state on submit button (confirmLoading)
// 4. Thai validation messages in rules: { required: true, message: 'กรุณากรอก...' }
// 5. Helper text via Form.Item `extra` prop (ไทย)
// 6. destroyOnClose on Modal
// 7. form.resetFields() in afterClose
```

---

## Data Formatting (`utils/formatters.js`)

| Function | Input | Output | Usage |
|----------|-------|--------|-------|
| `formatCurrency(value)` | `45000` | `฿45,000.00` | ราคา, ต้นทุน, เงินเดือน |
| `formatDate(isoString)` | `2026-02-26T...` | `26/02/2569` | วันที่ (th-TH locale) |
| `formatDateTime(isoString)` | `2026-02-26T10:30:00Z` | `26/02/2569 10:30` | วันที่+เวลา |
| `formatNumber(value)` | `1234567` | `1,234,567` | จำนวน (en-US locale) |

ทุกตัวเลขใน Table ต้องใช้ `fontFamily: 'monospace'` ร่วมกับ formatter:

```jsx
render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>
```

---

## RBAC Pattern (`hooks/usePermission.js`)

```jsx
import { usePermission } from '../../hooks/usePermission';

const { can } = usePermission();

// ซ่อน/แสดง elements ตาม permission
{can('inventory.product.create') && <Button>เพิ่มสินค้า</Button>}

// ซ่อน/แสดง tabs
const items = [
  can('hr.employee.read') && { key: 'employees', ... },
].filter(Boolean);
```

Permission format: `module.resource.action` เช่น:
- `inventory.product.read`, `inventory.product.create`, `inventory.product.update`, `inventory.product.delete`
- `hr.timesheet.approve`, `hr.timesheet.execute`
- `finance.report.read`, `finance.report.export`
- `admin.user.read`, `admin.role.manage`

---

## UX Standards

### Confirmation Dialogs

```jsx
Modal.confirm({
  title: 'ยืนยันการลบ',
  content: `คุณแน่ใจหรือไม่ที่จะลบ "${record.name}" (${record.code})?`,
  okText: 'ลบ',
  cancelText: 'ยกเลิก',
  okButtonProps: { danger: true },
  onOk: () => handleDelete(record.id),
});
```

### Success/Error Messages

```jsx
const { message } = App.useApp();

// Success — include item identifier
message.success(`เพิ่มสินค้า "${values.name}" สำเร็จ`);
message.success(`อนุมัติ Timesheet สำเร็จ`);

// Error — show backend detail or fallback
message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
```

### Tooltips on Action Buttons

```jsx
<Tooltip title="แก้ไขข้อมูล">
  <Button type="text" size="small" icon={<Pencil size={14} />} onClick={...} />
</Tooltip>
<Tooltip title="ลบรายการนี้">
  <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={...} />
</Tooltip>
```

---

## Table Conventions

### Column Patterns

```jsx
// Code column — monospace
{ title: 'รหัส', dataIndex: 'code',
  render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span> }

// Status column — StatusBadge
{ title: 'Status', dataIndex: 'status',
  render: (v) => <StatusBadge status={v} /> }

// Currency column — right-aligned monospace
{ title: 'ต้นทุน', dataIndex: 'cost', align: 'right',
  render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span> }

// Date column
{ title: 'วันที่', dataIndex: 'created_at',
  render: (v) => formatDate(v) }

// Action column — right-aligned, no title
{ title: '', key: 'actions', width: 120, align: 'right',
  render: (_, record) => <Space>...</Space> }
```

### Pagination

```jsx
pagination={{
  current: Math.floor(offset / limit) + 1,
  pageSize: limit,
  total: total,
  showSizeChanger: false,
  onChange: (page) => setOffset((page - 1) * limit),
}}
```

---

## Language Rules

| Element | ภาษา | ตัวอย่าง |
|---------|------|---------|
| Sidebar menu | อังกฤษ | "Inventory", "Work Orders", "HR" |
| Page title (PageHeader) | อังกฤษ | "Dashboard", "Inventory", "Finance" |
| Page subtitle (PageHeader) | ไทย | "จัดการสินค้าและวัตถุดิบ" |
| Tab labels | ผสม | "พนักงาน", "Timesheet", "Payroll", "การลา" |
| Button text | ผสม | "เพิ่มสินค้า", "สร้าง Work Order", "Export CSV" |
| Table header | ผสม | "สินค้า", "Status", "ต้นทุน", "Work Order" |
| Form label | ไทย | "ชื่อสินค้า", "ประเภท", "ต้นทุน/หน่วย" |
| Form placeholder | ไทย | "กรุณากรอกชื่อสินค้า" |
| Form helper text (`extra`) | ไทย | "จะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ" |
| System codes | อังกฤษ monospace | "MTL-001", "WO-2026-0043" |
| Currency | ฿ + ตัวเลข monospace | "฿45.00", "฿1,200.00" |
| Status badge | อังกฤษ UPPERCASE | "OPEN", "DRAFT", "APPROVED", "FINAL" |
| Error/validation message | ไทย | "กรุณากรอกข้อมูลให้ครบ" |
| Success message | ไทย + อังกฤษ noun | "เพิ่มสินค้า \"MTL-001\" สำเร็จ" |
| Confirmation dialog | ไทย | "คุณแน่ใจหรือไม่ที่จะลบ?" |
| Alert/Info box | ไทย | "ข้อมูลต้นทุนรวบรวมจาก Timesheet..." |
| Tooltip | ไทย | "แก้ไขข้อมูล", "ลบรายการนี้" |
| Logout button | ไทย | "ออกจากระบบ" |
| Toast/Notification | ไทย | "บันทึกสำเร็จ", "เกิดข้อผิดพลาด" |

### Free-text Data (ข้อมูลที่ผู้ใช้กรอกเอง)

| Field | ภาษาหลัก | หมายเหตุ |
|-------|---------|---------|
| ชื่อสินค้า / Product name | ไทย | ผู้ใช้กรอกไทยเป็นหลัก เช่น "เหล็กแผ่น SS400" |
| รายละเอียด / Description | ไทย | คำอธิบายเป็นไทย |
| ชื่อพนักงาน / Employee name | ไทย | "สมชาย มั่นคง" |
| ชื่อลูกค้า / Customer name | อังกฤษ/ไทย | ตามชื่อจริงของบริษัท เช่น "Thai Auto Parts" |
| ชื่อ Cost Center | อังกฤษ | ใช้รหัส เช่น "CC-PROD-01" |
| หมายเหตุ / Notes | ไทย | "ส่งซ่อม 24 ก.พ." |

> กฎ: ข้อมูลที่ user กรอกเป็น free-text ให้ใช้ **ภาษาไทยเป็นหลัก**
> ยกเว้น field ที่เป็นรหัสระบบ (SKU, WO number, Cost Center code) ใช้อังกฤษ

---

## File Structure

```
frontend/src/
├── App.jsx                    # Routes (17) + Layout + Theme
├── App.css                    # Dark theme overrides
├── components/
│   ├── EmptyState.jsx         # Empty state with icon + hint
│   ├── PageHeader.jsx         # Title + subtitle + actions
│   ├── SearchInput.jsx        # Debounced search input (300ms)
│   └── StatusBadge.jsx        # Universal status badge (28 statuses)
├── hooks/
│   └── usePermission.js       # RBAC permission check
├── stores/
│   └── authStore.js           # Zustand auth state (user, token, login, logout)
├── services/
│   └── api.js                 # Axios instance with auth interceptor
├── utils/
│   ├── constants.js           # COLORS + ANT_THEME_TOKEN
│   └── formatters.js          # formatCurrency, formatDate, formatDateTime, formatNumber
└── pages/
    ├── LoginPage.jsx
    ├── DashboardPage.jsx
    ├── inventory/
    │   ├── ProductListPage.jsx
    │   ├── ProductFormModal.jsx
    │   ├── MovementListPage.jsx
    │   └── MovementCreateModal.jsx
    ├── warehouse/
    │   ├── WarehouseListPage.jsx
    │   ├── WarehouseFormModal.jsx
    │   ├── LocationListPage.jsx
    │   └── LocationFormModal.jsx
    ├── workorder/
    │   ├── WorkOrderListPage.jsx
    │   ├── WorkOrderFormModal.jsx
    │   └── WorkOrderDetailPage.jsx
    ├── purchasing/
    │   ├── POListPage.jsx
    │   ├── POFormModal.jsx
    │   └── PODetailPage.jsx
    ├── sales/
    │   ├── SOListPage.jsx
    │   ├── SOFormModal.jsx
    │   └── SODetailPage.jsx
    ├── customer/
    │   ├── CustomerListPage.jsx
    │   └── CustomerFormModal.jsx
    ├── hr/
    │   ├── HRPage.jsx              # 4 tabs (RBAC-filtered)
    │   ├── EmployeeTab.jsx
    │   ├── EmployeeFormModal.jsx
    │   ├── TimesheetTab.jsx
    │   ├── TimesheetFormModal.jsx
    │   ├── LeaveTab.jsx
    │   ├── LeaveFormModal.jsx
    │   ├── PayrollTab.jsx
    │   └── PayrollFormModal.jsx
    ├── tools/
    │   ├── ToolListPage.jsx
    │   ├── ToolFormModal.jsx
    │   └── ToolCheckoutModal.jsx
    ├── master/
    │   ├── MasterDataPage.jsx       # 3 tabs (RBAC-filtered)
    │   ├── CostCenterTab.jsx
    │   ├── CostCenterFormModal.jsx
    │   ├── CostElementTab.jsx
    │   ├── CostElementFormModal.jsx
    │   ├── OTTypeTab.jsx
    │   └── OTTypeFormModal.jsx
    ├── admin/
    │   ├── AdminPage.jsx            # 3 tabs (RBAC-filtered)
    │   ├── UserTab.jsx
    │   ├── RoleTab.jsx
    │   └── AuditLogTab.jsx
    └── finance/
        └── FinancePage.jsx
```

---

## API Path Reference (Frontend → Backend)

### Auth
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/auth/login` | POST | `/api/auth/login` |
| `/api/auth/me` | GET | `/api/auth/me` |

### Inventory
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/inventory/products` | GET, POST | `/api/inventory/products` |
| `/api/inventory/products/{id}` | GET, PUT, DELETE | `/api/inventory/products/{id}` |
| `/api/inventory/movements` | GET, POST | `/api/inventory/movements` |

### Warehouse
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/warehouse/warehouses` | GET, POST | `/api/warehouse/warehouses` |
| `/api/warehouse/warehouses/{id}` | PUT, DELETE | `/api/warehouse/warehouses/{id}` |
| `/api/warehouse/locations` | GET, POST | `/api/warehouse/locations` |
| `/api/warehouse/locations/{id}` | PUT, DELETE | `/api/warehouse/locations/{id}` |

### Work Orders
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/work-orders` | GET, POST | `/api/work-orders` |
| `/api/work-orders/{id}` | GET, PUT | `/api/work-orders/{id}` |

### Purchasing
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/purchasing/orders` | GET, POST | `/api/purchasing/orders` |
| `/api/purchasing/orders/{id}` | GET | `/api/purchasing/orders/{id}` |

### Sales
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/sales/orders` | GET, POST | `/api/sales/orders` |
| `/api/sales/orders/{id}` | GET | `/api/sales/orders/{id}` |

### Customer
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/customers` | GET, POST | `/api/customers` |
| `/api/customers/{id}` | PUT, DELETE | `/api/customers/{id}` |

### HR
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/hr/employees` | GET, POST | `/api/hr/employees` |
| `/api/hr/employees/{id}` | GET, PUT, DELETE | `/api/hr/employees/{emp_id}` |
| `/api/hr/timesheet` | GET, POST | `/api/hr/timesheet` |
| `/api/hr/timesheet/{id}` | PUT | `/api/hr/timesheet/{ts_id}` |
| `/api/hr/timesheet/{id}/approve` | POST | `/api/hr/timesheet/{ts_id}/approve` |
| `/api/hr/timesheet/{id}/final` | POST | `/api/hr/timesheet/{ts_id}/final` |
| `/api/hr/timesheet/{id}/unlock` | POST | `/api/hr/timesheet/{ts_id}/unlock` |
| `/api/hr/leave` | GET, POST | `/api/hr/leave` |
| `/api/hr/leave/{id}/approve` | POST | `/api/hr/leave/{leave_id}/approve` |
| `/api/hr/payroll` | GET, POST | `/api/hr/payroll` |
| `/api/hr/payroll/run` | POST | `/api/hr/payroll/run` |
| `/api/hr/payroll/export` | GET | `/api/hr/payroll/export` |

### Tools
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/tools` | GET, POST | `/api/tools` |
| `/api/tools/{id}` | GET, PUT, DELETE | `/api/tools/{tool_id}` |
| `/api/tools/{id}/checkout` | POST | `/api/tools/{tool_id}/checkout` |
| `/api/tools/{id}/checkin` | POST | `/api/tools/{tool_id}/checkin` |
| `/api/tools/{id}/history` | GET | `/api/tools/{tool_id}/history` |

### Master Data
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/master/cost-centers` | GET, POST | `/api/master/cost-centers` |
| `/api/master/cost-centers/{id}` | GET, PUT, DELETE | `/api/master/cost-centers/{cc_id}` |
| `/api/master/cost-elements` | GET, POST | `/api/master/cost-elements` |
| `/api/master/cost-elements/{id}` | GET, PUT, DELETE | `/api/master/cost-elements/{ce_id}` |
| `/api/master/ot-types` | GET, POST | `/api/master/ot-types` |
| `/api/master/ot-types/{id}` | GET, PUT, DELETE | `/api/master/ot-types/{ot_id}` |

### Finance
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/finance/reports` | GET | `/api/finance/reports` |
| `/api/finance/reports/export` | GET | `/api/finance/reports/export` |

### Admin
| Frontend Path | Method | Backend Endpoint |
|---------------|--------|-----------------|
| `/api/admin/users` | GET | `/api/admin/users` |
| `/api/admin/users/{id}/role` | PATCH | `/api/admin/users/{user_id}/role` |
| `/api/admin/roles` | GET | `/api/admin/roles` |
| `/api/admin/roles/{role}/permissions` | PUT | `/api/admin/roles/{role_name}/permissions` |
| `/api/admin/audit-log` | GET | `/api/admin/audit-log` |
| `/api/admin/seed-permissions` | POST | `/api/admin/seed-permissions` |

---

## Business Rules Enforced in Frontend

| BR# | Rule | Frontend Implementation |
|-----|------|----------------------|
| BR#24 | OT ceiling >= OT factor | `OTTypeFormModal.jsx` — validation ก่อน submit |
| BR#26 | Payroll uses only FINAL timesheets | `PayrollTab.jsx` — Alert info message แจ้งผู้ใช้ |
| BR#28 | Tool cost = rate_per_hour x hours | `ToolFormModal.jsx` — แสดง rate, `ToolCheckoutModal.jsx` — แสดง cost hint |
| BR#30 | Overhead rate on cost center | `CostCenterFormModal.jsx` — InputNumber field |
| BR#31 | Owner role cannot be changed | `UserTab.jsx` — disable role Select สำหรับ owner |

---

## Backlog — ทำภายหลัง (Phase 4)

| รายการ | เหตุผลที่ยังไม่ทำ |
|--------|-----------------|
| Focus state (keyboard nav) | Internal ERP ใช้เมาส์เป็นหลัก |
| CSS Custom Properties | ใช้ ConfigProvider + COLORS constants เป็น single source แล้ว |
| Animation / Transition spec | ไม่จำเป็นระยะแรก |
| Responsive / Mobile layout | ERP ใช้บน desktop เท่านั้น |

---

*End of UI_GUIDELINES.md — SSS Corp ERP v4*
