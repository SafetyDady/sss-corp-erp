# UI_GUIDELINES.md — SSS Corp ERP

> ไฟล์นี้เป็นส่วนเสริมของ CLAUDE.md — กำหนดแนวทาง UI ทั้งหมด
> AI ต้องอ่านร่วมกับ CLAUDE.md เสมอ
> อัปเดต: 2026-02-26 v2

---

## HARD RULES (ห้ามฝ่าฝืน)

1. **ห้ามใช้ emoji** ในทุกที่ — sidebar, ปุ่ม, header, badge, stat card, title
2. **ห้ามใช้ Ant Design Icons** (@ant-design/icons) — ใช้ Lucide เท่านั้น
3. **Theme: Full Dark เท่านั้น** — ห้ามมีหน้าสีขาว/สว่าง
4. **ภาษา: ไทย label + อังกฤษ data/menu** — เช่น เมนู "Inventory" แต่ label "คงเหลือ"
5. **ห้ามใช้ inline style สำหรับ Badge** — ใช้ `<StatusBadge>` component เท่านั้น

---

## Theme — Full Dark

### Color System
```
// Accent (Primary)
accent:         #06b6d4   (Cyan — ปุ่มหลัก, active menu, links)
accentHover:    #0891b2   (Cyan dark — hover state)
accentMuted:    #06b6d420 (Cyan 12% — background highlight)

// Semantic
success:        #10b981   (Green — approved, open, available)
warning:        #f59e0b   (Amber — pending, checked-out, draft)
danger:         #ef4444   (Red — error, delete, locked, overdue)
purple:         #8b5cf6   (Purple — HR, payroll, final)

// Surfaces
bg:             #0a0a0f   (Darkest — page background)
surface:        #111118   (Dark — header, elevated areas)
surfaceHover:   #1a1a24   (Dark — hover state on rows)
card:           #16161f   (Dark — cards, tables, modals)
cardHover:      #1e1e2a   (Dark — card hover)

// Sidebar
sidebar:        #0d0d14   (Darkest — sidebar background)
sidebarHover:   #1a1a26   (Dark — menu item hover)
sidebarActive:  #06b6d418 (Cyan 10% — active menu item background)
sidebarBorder:  #1a1a26   (Dark — sidebar dividers)

// Borders
border:         #2a2a3a   (Medium — card borders, dividers)
borderLight:    #22222f   (Subtle — row separators)

// Text
text:           #e2e8f0   (Light — primary text)
textSecondary:  #94a3b8   (Medium — secondary text)
textMuted:      #718096   (Dim — labels, placeholders) ← แก้จาก #64748b เพื่อผ่าน WCAG AA บน card
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

### Ant Design Dark Theme Config
```jsx
import { ConfigProvider, theme } from "antd";

<ConfigProvider
  theme={{
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: "#06b6d4",
      colorBgContainer: "#16161f",
      colorBgElevated: "#1e1e2a",
      colorBgLayout: "#0a0a0f",
      colorBorder: "#2a2a3a",
      colorText: "#e2e8f0",
      colorTextSecondary: "#94a3b8",
      borderRadius: 8,
    },
  }}
>
```

---

## Icon System — Lucide React

### Module Icons
| Module | Icon | Import |
|--------|------|--------|
| Dashboard | LayoutDashboard | `LayoutDashboard` |
| Inventory | Package | `Package` |
| Warehouse | Warehouse | `Warehouse` |
| Work Orders | FileText | `FileText` |
| Purchasing | ShoppingCart | `ShoppingCart` |
| Sales | DollarSign | `DollarSign` |
| Finance | BarChart3 | `BarChart3` |
| HR | Users | `Users` |
| Tools | Wrench | `Wrench` |
| Master Data | Database | `Database` |
| Admin | Settings | `Settings` |
| Customer | UserCheck | `UserCheck` |

### Action Icons
| Action | Icon | Import |
|--------|------|--------|
| Create/Add | Plus | `Plus` |
| Edit | Pencil | `Pencil` |
| Delete | Trash2 | `Trash2` |
| Search | Search | `Search` |
| Filter | Filter | `Filter` |
| Export | Download | `Download` |
| Approve | Check | `Check` |
| Reject | X | `X` |
| Lock | Lock | `Lock` |
| Unlock | Unlock | `Unlock` |
| Check-in | LogIn | `LogIn` |
| Check-out | LogOut | `LogOut` |
| Refresh | RefreshCw | `RefreshCw` |
| Notification | Bell | `Bell` |
| Logout | LogOut | `LogOut` |
| User | User | `User` |
| Calendar | Calendar | `Calendar` |
| Clock | Clock | `Clock` |
| Alert | AlertTriangle | `AlertTriangle` |
| Collapse sidebar | ChevronLeft | `ChevronLeft` |
| Expand sidebar | ChevronRight | `ChevronRight` |

### Usage Pattern
```jsx
import { Package, Plus, Download } from "lucide-react";
import { Button, Table } from "antd";

// Icon in Button
<Button type="primary" icon={<Plus size={16} />}>เพิ่มสินค้า</Button>

// Sidebar menu
<Package size={18} /> Inventory

// Icon size guide:
// Sidebar menu: 18
// Button icon: 14-16
// Inline/table: 12-14
// Stat card: 20
```

---

## Layout — Sidebar + Header

```
+----------+------------------------------------------+
| Sidebar  |  Header (breadcrumb + bell + logout)      |
| 210px    |------------------------------------------|
| (56px    |                                           |
| collapsed)|  Page Content                            |
|          |  +------------------------------------+   |
| Logo     |  |  Title + Action Buttons (top)      |   |
| Menu     |  |  Stat Cards (row)                  |   |
| (Lucide) |  |  Search + Filter (bar)             |   |
|          |  |  Table / Cards / Form              |   |
|          |  |  Pagination (bottom)               |   |
| User     |  +------------------------------------+   |
| (bottom) |                                           |
+----------+------------------------------------------+
```

- Sidebar: Collapsible (210px <-> 56px) กดลูกศรยุบ/ขยาย
- Header: 48px สูง, breadcrumb ซ้าย, bell + logout ขวา
- Content: padding 24px, overflow-y auto

---

## StatusBadge Component (บังคับใช้)

ห้ามเขียน badge ด้วย inline style — ใช้ component นี้เท่านั้น:

```jsx
// src/components/StatusBadge.jsx
const STATUS_CONFIG = {
  DRAFT:         { color: "#f59e0b" },
  OPEN:          { color: "#10b981" },
  CLOSED:        { color: "#718096" },
  APPROVED:      { color: "#10b981" },
  PENDING:       { color: "#f59e0b" },
  FINAL:         { color: "#8b5cf6" },
  LOCKED:        { color: "#718096" },
  REJECTED:      { color: "#ef4444" },
  "CHECKED-OUT": { color: "#f59e0b" },
  AVAILABLE:     { color: "#10b981" },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { color: "#718096" };
  return (
    <span style={{
      background: config.color + "18",
      color: config.color,
      padding: "3px 10px",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.3,
      whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
}
```

### Usage
```jsx
import StatusBadge from "@/components/StatusBadge";

<StatusBadge status="OPEN" />
<StatusBadge status="DRAFT" />
<StatusBadge status="REJECTED" />
```

### Status-Color Mapping

| Status | Color | Usage |
|--------|-------|-------|
| DRAFT | #f59e0b (warning) | WO draft, Timesheet pending |
| OPEN | #10b981 (success) | WO open, Tool available |
| CLOSED | #718096 (muted) | WO closed |
| APPROVED | #10b981 (success) | Timesheet approved |
| PENDING | #f59e0b (warning) | รอ approve |
| FINAL | #8b5cf6 (purple) | HR final approve |
| LOCKED | #718096 (muted) | Timesheet locked (7 days) |
| REJECTED | #ef4444 (danger) | Rejected items |
| CHECKED-OUT | #f59e0b (warning) | Tool checked out |
| AVAILABLE | #10b981 (success) | Tool available |

---

## Component States

### Disabled State
ปุ่มหรือ input ที่ปิดใช้งาน:
```jsx
// Ant Design จัดการ disabled ให้อัตโนมัติ:
<Button disabled>ปิดใช้งาน</Button>
<Input disabled />

// ถ้าเป็น custom component ให้ใช้:
// - opacity: 0.4
// - cursor: not-allowed
// - ห้ามเปลี่ยนสีเป็นสีอื่น แค่ลด opacity
```

### Empty State
เมื่อตารางหรือรายการไม่มีข้อมูล:
```jsx
import { Inbox } from "lucide-react";

function EmptyState({ message = "ไม่พบข้อมูล", hint = "ลองเปลี่ยนเงื่อนไขการค้นหา หรือเพิ่มรายการใหม่" }) {
  return (
    <div style={{
      textAlign: "center",
      padding: "48px 24px",
      color: "#718096",
    }}>
      <Inbox size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
      <div style={{ fontSize: 14, fontWeight: 500 }}>{message}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>{hint}</div>
    </div>
  );
}

// สำหรับ Ant Design Table:
<Table
  locale={{ emptyText: <EmptyState /> }}
  ...
/>
```

### Loading State
```jsx
// ใช้ Ant Design Spin + Skeleton
import { Spin, Skeleton } from "antd";

// Table loading — ใช้ loading prop ของ Ant Table
<Table loading={isLoading} ... />

// Card loading — ใช้ Skeleton
<Skeleton active paragraph={{ rows: 3 }} />
```

---

## Component Patterns

### Page Header
```jsx
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
  <div>
    <h2>Work Orders</h2>             {/* อังกฤษ */}
    <p>จัดการใบสั่งงานและต้นทุน</p>    {/* ไทย */}
  </div>
  <Button type="primary" icon={<Plus size={14} />}>
    สร้าง Work Order               {/* ไทย action + อังกฤษ noun */}
  </Button>
</div>
```

### Table
- Dark background (#16161f)
- Header: uppercase, muted color, small font
- Row hover: #1a1a24
- Border: subtle #22222f
- Pagination ด้านล่าง
- Empty: ใช้ EmptyState component

### Form / Modal
- Dark background
- Input borders: #2a2a3a
- Label: ภาษาไทย
- Placeholder: ภาษาไทย
- Disabled fields: opacity 0.4

---

## Language Rules

| Element | ภาษา | ตัวอย่าง |
|---------|------|---------|
| Sidebar menu | อังกฤษ | "Inventory", "Work Orders", "HR" |
| Page title | อังกฤษ | "Dashboard", "Inventory" |
| Page subtitle | ไทย | "จัดการสินค้าและวัตถุดิบ" |
| Button text | ผสม | "เพิ่มสินค้า", "สร้าง Work Order" |
| Table header | ผสม | "สินค้า", "Status", "ต้นทุน" |
| Form label | ไทย | "ชื่อสินค้า", "ประเภท", "ต้นทุน" |
| System codes | อังกฤษ | "MTL-001", "WO-2026-0043" |
| Currency | ฿ + ตัวเลข | "฿45.00", "฿1,200.00" |
| Status badge | อังกฤษ UPPERCASE | "OPEN", "DRAFT", "APPROVED" |
| Error message | ไทย | "กรุณากรอกข้อมูลให้ครบ" |
| Confirmation | ไทย | "คุณแน่ใจหรือไม่ที่จะลบ?" |
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

## Backlog — ทำภายหลัง (Phase 3-4)

| รายการ | เหตุผลที่ยังไม่ทำ |
|--------|-----------------|
| Focus state (keyboard nav) | Internal ERP ใช้เมาส์เป็นหลัก |
| CSS Custom Properties | ใช้ ConfigProvider เป็น single source แล้ว |
| Animation / Transition spec | ไม่จำเป็นระยะแรก |
| Responsive / Mobile layout | ERP ใช้บน desktop เท่านั้น |

---

*End of UI_GUIDELINES.md — SSS Corp ERP v3 (v2)*
