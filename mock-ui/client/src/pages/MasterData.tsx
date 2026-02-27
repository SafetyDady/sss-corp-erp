/*
 * SSS Corp ERP — Master Data Page
 * Design: Industrial Control Room
 * Tabs: Units of Measure, Product Categories, Departments, OT Types, Leave Types, Locations
 */

import { useState, type ReactNode } from "react";
import {
  Database,
  Plus,
  Pencil,
  Trash2,
  Ruler,
  FolderTree,
  Building,
  Clock,
  CalendarDays,
  MapPin,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const C = {
  accent: "#06b6d4", success: "#10b981", warning: "#f59e0b", danger: "#ef4444", purple: "#8b5cf6",
  card: "#16161f", cardHover: "#1e1e2a", border: "#2a2a3a", borderLight: "#22222f",
  text: "#e2e8f0", textSec: "#94a3b8", textMuted: "#64748b", bg: "#0a0a0f",
};
const thStyle: React.CSSProperties = { padding: "10px 16px", fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "10px 16px", fontSize: 12, color: C.text };
const mono: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

const tabs = [
  { key: "uom", label: "Units of Measure", icon: <Ruler size={15} /> },
  { key: "categories", label: "Product Categories", icon: <FolderTree size={15} /> },
  { key: "departments", label: "Departments", icon: <Building size={15} /> },
  { key: "otTypes", label: "OT Types", icon: <Clock size={15} /> },
  { key: "leaveTypes", label: "Leave Types", icon: <CalendarDays size={15} /> },
  { key: "locations", label: "Locations", icon: <MapPin size={15} /> },
];

function RowActions() {
  return (
    <div className="flex items-center gap-1">
      {[{ icon: <Pencil size={13} />, c: C.accent }, { icon: <Trash2 size={13} />, c: C.danger }].map((a, i) => (
        <button key={i} className="flex items-center justify-center rounded transition-colors duration-150"
          style={{ width: 28, height: 28, color: C.textSec, background: "transparent", border: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.color = a.c; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSec; }}>
          {a.icon}
        </button>
      ))}
    </div>
  );
}

function AddButton({ label }: { label: string }) {
  return (
    <div className="flex justify-end mb-3">
      <button className="flex items-center gap-1.5 rounded-md" style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#0a0a0f", background: C.accent, border: "none", borderRadius: 6 }}><Plus size={14} />{label}</button>
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
            {headers.map((h) => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                {row.map((cell, j) => <td key={j} style={j === 0 ? { ...tdStyle, color: C.accent, fontWeight: 500, ...mono } : tdStyle}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UoMTab() {
  const data = [
    ["UOM-01", "ชิ้น (Piece)", "PCS", "นับ", <RowActions key="a" />],
    ["UOM-02", "แผ่น (Sheet)", "SHT", "นับ", <RowActions key="b" />],
    ["UOM-03", "เส้น (Bar)", "BAR", "ความยาว", <RowActions key="c" />],
    ["UOM-04", "ตัว (Unit)", "EA", "นับ", <RowActions key="d" />],
    ["UOM-05", "ลิตร (Liter)", "LTR", "ปริมาตร", <RowActions key="e" />],
    ["UOM-06", "กิโลกรัม (Kilogram)", "KG", "น้ำหนัก", <RowActions key="f" />],
    ["UOM-07", "เมตร (Meter)", "M", "ความยาว", <RowActions key="g" />],
    ["UOM-08", "กล่อง (Box)", "BOX", "บรรจุภัณฑ์", <RowActions key="h" />],
  ];
  return (<div className="space-y-3"><AddButton label="เพิ่มหน่วยวัด" /><SimpleTable headers={["รหัส", "ชื่อหน่วย", "ย่อ", "กลุ่ม", "จัดการ"]} rows={data} /></div>);
}

function CategoriesTab() {
  const data = [
    ["CAT-01", "วัตถุดิบ (Raw Material)", "MTL", "245", <StatusBadge key="a" status="ACTIVE" />, <RowActions key="a2" />],
    ["CAT-02", "สินค้าสำเร็จรูป (Finished Goods)", "FG", "89", <StatusBadge key="b" status="ACTIVE" />, <RowActions key="b2" />],
    ["CAT-03", "อะไหล่ (Spare Parts)", "SP", "412", <StatusBadge key="c" status="ACTIVE" />, <RowActions key="c2" />],
    ["CAT-04", "วัสดุสิ้นเปลือง (Consumables)", "CON", "78", <StatusBadge key="d" status="ACTIVE" />, <RowActions key="d2" />],
    ["CAT-05", "เครื่องมือ (Tools)", "TL", "56", <StatusBadge key="e" status="ACTIVE" />, <RowActions key="e2" />],
    ["CAT-06", "บรรจุภัณฑ์ (Packaging)", "PKG", "34", <StatusBadge key="f" status="ACTIVE" />, <RowActions key="f2" />],
  ];
  return (<div className="space-y-3"><AddButton label="เพิ่มหมวดหมู่" /><SimpleTable headers={["รหัส", "ชื่อหมวดหมู่", "ย่อ", "จำนวนสินค้า", "สถานะ", "จัดการ"]} rows={data} /></div>);
}

function DepartmentsTab() {
  const data = [
    ["DEPT-01", "แผนกผลิต (Manufacturing)", "อนุชา รักษ์ดี", "45", <StatusBadge key="a" status="ACTIVE" />, <RowActions key="a2" />],
    ["DEPT-02", "จัดซื้อ (Purchasing)", "วิภา สุขสมบูรณ์", "8", <StatusBadge key="b" status="ACTIVE" />, <RowActions key="b2" />],
    ["DEPT-03", "คลังสินค้า (Warehouse)", "ธนา กิจเจริญ", "12", <StatusBadge key="c" status="ACTIVE" />, <RowActions key="c2" />],
    ["DEPT-04", "ควบคุมคุณภาพ (QC)", "สุนิสา พงศ์ไพบูลย์", "10", <StatusBadge key="d" status="ACTIVE" />, <RowActions key="d2" />],
    ["DEPT-05", "ขาย (Sales)", "ปิยะ จันทร์สว่าง", "15", <StatusBadge key="e" status="ACTIVE" />, <RowActions key="e2" />],
    ["DEPT-06", "บัญชี (Finance)", "รัชนี ศรีสุข", "6", <StatusBadge key="f" status="ACTIVE" />, <RowActions key="f2" />],
    ["DEPT-07", "ซ่อมบำรุง (Maintenance)", "วิทยา มั่นคง", "8", <StatusBadge key="g" status="ACTIVE" />, <RowActions key="g2" />],
    ["DEPT-08", "วิศวกรรม (Engineering)", "ดร.สมศักดิ์ เจริญดี", "5", <StatusBadge key="h" status="ACTIVE" />, <RowActions key="h2" />],
    ["DEPT-09", "ทรัพยากรบุคคล (HR)", "คุณนภา ศรีสุข", "4", <StatusBadge key="i" status="ACTIVE" />, <RowActions key="i2" />],
    ["DEPT-10", "IT", "คุณพิมพ์ใจ วงศ์ดี", "3", <StatusBadge key="j" status="ACTIVE" />, <RowActions key="j2" />],
  ];
  return (<div className="space-y-3"><AddButton label="เพิ่มแผนก" /><SimpleTable headers={["รหัส", "ชื่อแผนก", "หัวหน้าแผนก", "จำนวนพนักงาน", "สถานะ", "จัดการ"]} rows={data} /></div>);
}

function OTTypesTab() {
  const data = [
    ["OT-01", "OT ปกติ (OT 1.5x)", "1.5x", "วันทำงานปกติ หลัง 17:00", <StatusBadge key="a" status="ACTIVE" />, <RowActions key="a2" />],
    ["OT-02", "OT วันหยุด (OT 2x)", "2x", "วันหยุดประจำสัปดาห์", <StatusBadge key="b" status="ACTIVE" />, <RowActions key="b2" />],
    ["OT-03", "OT วันนักขัตฤกษ์ (OT 3x)", "3x", "วันหยุดนักขัตฤกษ์", <StatusBadge key="c" status="ACTIVE" />, <RowActions key="c2" />],
    ["OT-04", "OT กะดึก (Night Shift OT)", "2x", "กะดึก 22:00-06:00", <StatusBadge key="d" status="ACTIVE" />, <RowActions key="d2" />],
  ];
  return (<div className="space-y-3"><AddButton label="เพิ่มประเภท OT" /><SimpleTable headers={["รหัส", "ชื่อประเภท", "อัตรา", "เงื่อนไข", "สถานะ", "จัดการ"]} rows={data} /></div>);
}

function LeaveTypesTab() {
  const leaveColors: Record<string, string> = { "ลาพักร้อน": "#06b6d4", "ลาป่วย": "#ef4444", "ลากิจ": "#8b5cf6", "ลาคลอด": "#f472b6", "ลาบวช": "#f59e0b" };
  const leaves = [
    { code: "LT-01", name: "ลาพักร้อน (Annual Leave)", quota: "6-15 วัน/ปี", carry: "ได้ (สูงสุด 5 วัน)", paid: true },
    { code: "LT-02", name: "ลาป่วย (Sick Leave)", quota: "30 วัน/ปี", carry: "ไม่ได้", paid: true },
    { code: "LT-03", name: "ลากิจ (Personal Leave)", quota: "5 วัน/ปี", carry: "ไม่ได้", paid: true },
    { code: "LT-04", name: "ลาคลอด (Maternity Leave)", quota: "98 วัน", carry: "ไม่ได้", paid: true },
    { code: "LT-05", name: "ลาบวช (Ordination Leave)", quota: "15 วัน", carry: "ไม่ได้", paid: true },
  ];
  return (
    <div className="space-y-3">
      <AddButton label="เพิ่มประเภทลา" />
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["รหัส", "ประเภทลา", "โควต้า", "ยกยอดได้", "จ่ายเงิน", "จัดการ"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {leaves.map((lv) => {
                const color = Object.entries(leaveColors).find(([k]) => lv.name.includes(k))?.[1] || C.accent;
                return (
                  <tr key={lv.code} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, ...mono }}>{lv.code}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: C.text }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        {lv.name}
                      </span>
                    </td>
                    <td style={tdStyle}>{lv.quota}</td>
                    <td style={tdStyle}>{lv.carry}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: C.success + "18", color: C.success, border: `1px solid ${C.success}30` }}>จ่าย</span>
                    </td>
                    <td style={{ padding: "10px 16px" }}><RowActions /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LocationsTab() {
  const data = [
    ["LOC-01", "โรงงาน SSS Corp (Main)", "123 นิคมอุตสาหกรรม อมตะนคร", "ชลบุรี", <StatusBadge key="a" status="ACTIVE" />, <RowActions key="a2" />],
    ["LOC-02", "คลังสินค้า ศรีราชา", "456 ถ.สุขุมวิท", "ชลบุรี", <StatusBadge key="b" status="ACTIVE" />, <RowActions key="b2" />],
    ["LOC-03", "สำนักงานขาย กรุงเทพ", "789 อาคารเอ็มไพร์ ชั้น 15", "กรุงเทพ", <StatusBadge key="c" status="ACTIVE" />, <RowActions key="c2" />],
    ["LOC-04", "คลังสินค้า ลาดกระบัง", "321 ซ.ลาดกระบัง 54", "กรุงเทพ", <StatusBadge key="d" status="INACTIVE" />, <RowActions key="d2" />],
  ];
  return (<div className="space-y-3"><AddButton label="เพิ่มสถานที่" /><SimpleTable headers={["รหัส", "ชื่อสถานที่", "ที่อยู่", "จังหวัด", "สถานะ", "จัดการ"]} rows={data} /></div>);
}

export default function MasterData() {
  const [activeTab, setActiveTab] = useState("uom");
  const tabContent: Record<string, ReactNode> = {
    uom: <UoMTab />, categories: <CategoriesTab />, departments: <DepartmentsTab />,
    otTypes: <OTTypesTab />, leaveTypes: <LeaveTypesTab />, locations: <LocationsTab />,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 overflow-x-auto" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 4 }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 rounded-md transition-all duration-150 whitespace-nowrap"
              style={{ padding: "8px 16px", fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? C.accent : C.textSec, background: isActive ? C.accent + "15" : "transparent", border: "none" }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.color = C.text; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSec; } }}>
              {tab.icon}{tab.label}
            </button>
          );
        })}
      </div>
      {tabContent[activeTab]}
    </div>
  );
}
