/*
 * SSS Corp ERP — Supply Chain Page
 * Design: Industrial Control Room
 * Consolidates Inventory, Warehouse, Tools into tab menu
 */

import { useState, type ReactNode } from "react";
import {
  Package,
  Warehouse,
  Wrench,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ArrowUpDown,
  CheckCircle,
  AlertTriangle,
  Eye,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";

/* ─── Colors ─── */
const C = {
  accent: "#06b6d4",
  accentHover: "#0891b2",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  bg: "#0a0a0f",
  surface: "#111118",
  card: "#16161f",
  cardHover: "#1e1e2a",
  border: "#2a2a3a",
  borderLight: "#22222f",
  text: "#e2e8f0",
  textSec: "#94a3b8",
  textMuted: "#64748b",
};

/* ─── Tab definition ─── */
interface TabDef {
  key: string;
  label: string;
  icon: ReactNode;
}

const tabs: TabDef[] = [
  { key: "inventory", label: "Inventory", icon: <Package size={15} /> },
  { key: "warehouse", label: "Warehouse", icon: <Warehouse size={15} /> },
  { key: "tools", label: "Tools", icon: <Wrench size={15} /> },
];

/* ─── Shared styles ─── */
const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 10,
  fontWeight: 600,
  color: C.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 12,
  color: C.text,
};

/* ─── Search/Filter bar reusable ─── */
function SearchFilterBar({ placeholder, onSearch }: { placeholder: string; onSearch: (v: string) => void }) {
  return (
    <div
      className="flex items-center gap-3 flex-wrap"
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}
    >
      <div
        className="flex items-center gap-2 flex-1"
        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", minWidth: 200 }}
      >
        <Search size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
        <input
          type="text"
          placeholder={placeholder}
          onChange={(e) => onSearch(e.target.value)}
          style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, width: "100%", fontFamily: "inherit" }}
        />
      </div>
      {[
        { icon: <Filter size={14} />, label: "ตัวกรอง" },
        { icon: <Download size={14} />, label: "ส่งออก" },
        { icon: <RefreshCw size={14} />, label: "รีเฟรช" },
      ].map((btn, i) => (
        <button
          key={i}
          className="flex items-center gap-1.5 rounded-md transition-colors duration-150"
          style={{ padding: "6px 12px", fontSize: 12, color: C.textSec, background: "transparent", border: `1px solid ${C.border}`, fontWeight: 500 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSec; }}
        >
          {btn.icon}
          {btn.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Action buttons ─── */
function RowActions() {
  return (
    <div className="flex items-center gap-1">
      {[
        { icon: <Pencil size={13} />, hoverColor: C.accent },
        { icon: <Trash2 size={13} />, hoverColor: C.danger },
      ].map((a, i) => (
        <button
          key={i}
          className="flex items-center justify-center rounded transition-colors duration-150"
          style={{ width: 28, height: 28, color: C.textSec, background: "transparent", border: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.color = a.hoverColor; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSec; }}
        >
          {a.icon}
        </button>
      ))}
    </div>
  );
}

/* ─── Mock Data ─── */
const inventoryData = [
  { id: "MTL-001", name: "เหล็กแผ่น SS400", category: "วัตถุดิบ", qty: 450, unit: "แผ่น", cost: "฿125.00", location: "WH-A01", status: "NORMAL" },
  { id: "MTL-002", name: "สลักเกลียว M10x40", category: "วัตถุดิบ", qty: 12500, unit: "ตัว", cost: "฿2.50", location: "WH-A02", status: "NORMAL" },
  { id: "MTL-003", name: "ท่อเหล็ก 2 นิ้ว", category: "วัตถุดิบ", qty: 85, unit: "เส้น", cost: "฿350.00", location: "WH-B01", status: "NORMAL" },
  { id: "MTL-012", name: "แผ่นอลูมิเนียม 6061", category: "วัตถุดิบ", qty: 8, unit: "แผ่น", cost: "฿890.00", location: "WH-A01", status: "LOW" },
  { id: "FG-001", name: "Bracket Assembly A", category: "สินค้าสำเร็จรูป", qty: 230, unit: "ชิ้น", cost: "฿450.00", location: "WH-C01", status: "NORMAL" },
  { id: "FG-002", name: "Housing Unit B", category: "สินค้าสำเร็จรูป", qty: 45, unit: "ชิ้น", cost: "฿1,200.00", location: "WH-C02", status: "LOW" },
  { id: "SP-001", name: "Bearing 6205-2RS", category: "อะไหล่", qty: 320, unit: "ตัว", cost: "฿85.00", location: "WH-D01", status: "NORMAL" },
  { id: "SP-002", name: "สายพาน V-Belt A68", category: "อะไหล่", qty: 25, unit: "เส้น", cost: "฿180.00", location: "WH-D01", status: "NORMAL" },
  { id: "MTL-045", name: "น้ำมันหล่อเย็น CNC", category: "วัสดุสิ้นเปลือง", qty: 120, unit: "ลิตร", cost: "฿45.00", location: "WH-E01", status: "NORMAL" },
  { id: "MTL-046", name: "ดอกสว่าน HSS 8mm", category: "วัสดุสิ้นเปลือง", qty: 3, unit: "ตัว", cost: "฿65.00", location: "WH-E02", status: "LOW" },
];

const warehouseData = [
  { id: "WH-A", name: "คลังวัตถุดิบ A", zone: "โซน A", capacity: 500, used: 380, items: 245, manager: "สมชาย ว." },
  { id: "WH-B", name: "คลังวัตถุดิบ B", zone: "โซน B", capacity: 300, used: 210, items: 132, manager: "วิภา ส." },
  { id: "WH-C", name: "คลังสินค้าสำเร็จรูป", zone: "โซน C", capacity: 400, used: 275, items: 89, manager: "ธนา ก." },
  { id: "WH-D", name: "คลังอะไหล่", zone: "โซน D", capacity: 200, used: 165, items: 412, manager: "สุนิสา พ." },
  { id: "WH-E", name: "คลังวัสดุสิ้นเปลือง", zone: "โซน E", capacity: 150, used: 95, items: 78, manager: "อนุชา ร." },
];

const toolsData = [
  { id: "TL-001", name: "เครื่องเชื่อม MIG 350A", serial: "WM-2024-001", status: "AVAILABLE", location: "WH-D01", lastCal: "2026-01-15", nextCal: "2026-07-15" },
  { id: "TL-002", name: "เครื่องกลึง CNC Mazak", serial: "CNC-2023-004", status: "CHECKED-OUT", location: "สายผลิต 2", lastCal: "2025-12-20", nextCal: "2026-06-20" },
  { id: "TL-003", name: "สว่านไฟฟ้า Bosch", serial: "DR-2024-012", status: "AVAILABLE", location: "WH-D01", lastCal: "2026-02-01", nextCal: "2026-08-01" },
  { id: "TL-004", name: "เครื่องตัดเลเซอร์ Trumpf", serial: "LS-2022-002", status: "CHECKED-OUT", location: "สายผลิต 1", lastCal: "2025-11-10", nextCal: "2026-05-10" },
  { id: "TL-005", name: "ประแจทอร์ค 50-350 Nm", serial: "TW-2024-008", status: "AVAILABLE", location: "WH-D01", lastCal: "2026-01-28", nextCal: "2026-07-28" },
  { id: "TL-006", name: "เครื่องวัดพิกัด CMM", serial: "CMM-2023-001", status: "AVAILABLE", location: "ห้อง QC", lastCal: "2026-02-10", nextCal: "2026-08-10" },
  { id: "TL-007", name: "เครื่องเจียร์ Makita", serial: "GR-2024-003", status: "INACTIVE", location: "WH-D01", lastCal: "2025-09-15", nextCal: "2026-03-15" },
];

/* ─── Inventory Tab ─── */
function InventoryTab() {
  const [search, setSearch] = useState("");
  const filtered = inventoryData.filter(
    (item) => item.id.toLowerCase().includes(search.toLowerCase()) || item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="สินค้าทั้งหมด" value="1,247" icon={<Package size={20} />} accentColor={C.accent} />
        <StatCard title="ต่ำกว่า Safety Stock" value="18" icon={<AlertTriangle size={20} />} accentColor={C.danger} />
        <StatCard title="รับเข้าวันนี้" value="12" icon={<ArrowUpDown size={20} />} accentColor={C.success} />
        <StatCard title="มูลค่าคงเหลือ" value="฿4.2M" icon={<Package size={20} />} accentColor={C.warning} />
      </div>

      <SearchFilterBar placeholder="ค้นหาสินค้า..." onSearch={setSearch} />

      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                {["รหัสสินค้า", "ชื่อสินค้า", "ประเภท", "คงเหลือ", "หน่วย", "ต้นทุน/หน่วย", "ตำแหน่ง", "สถานะ", "จัดการ"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors duration-100"
                  style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{item.id}</td>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={{ ...tdStyle, color: C.textSec }}>{item.category}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: item.status === "LOW" ? C.danger : C.text, fontFamily: "'IBM Plex Mono', monospace" }}>{item.qty.toLocaleString()}</td>
                  <td style={{ ...tdStyle, color: C.textSec }}>{item.unit}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace" }}>{item.cost}</td>
                  <td style={{ ...tdStyle, color: C.textSec, fontFamily: "'IBM Plex Mono', monospace" }}>{item.location}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={item.status} /></td>
                  <td style={{ padding: "10px 16px" }}><RowActions /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${C.borderLight}` }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>แสดง 1-{filtered.length} จาก {filtered.length} รายการ</span>
          <div className="flex items-center gap-1">
            <button className="flex items-center justify-center rounded" style={{ width: 28, height: 28, color: C.textMuted, background: "transparent", border: `1px solid ${C.border}` }}><ChevronLeft size={14} /></button>
            {[1, 2, 3].map((p) => (
              <button key={p} className="flex items-center justify-center rounded" style={{ width: 28, height: 28, fontSize: 12, fontWeight: p === 1 ? 600 : 400, color: p === 1 ? C.accent : C.textMuted, background: p === 1 ? C.accent + "18" : "transparent", border: p === 1 ? `1px solid ${C.accent}30` : `1px solid ${C.border}` }}>{p}</button>
            ))}
            <button className="flex items-center justify-center rounded" style={{ width: 28, height: 28, color: C.textMuted, background: "transparent", border: `1px solid ${C.border}` }}><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Warehouse Tab ─── */
function WarehouseTab() {
  const totalCapacity = warehouseData.reduce((s, w) => s + w.capacity, 0);
  const totalUsed = warehouseData.reduce((s, w) => s + w.used, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="คลังทั้งหมด" value={warehouseData.length.toString()} icon={<Warehouse size={20} />} accentColor={C.accent} />
        <StatCard title="ความจุรวม" value={totalCapacity.toLocaleString()} subtitle="พาเลท" icon={<Package size={20} />} accentColor={C.success} />
        <StatCard title="ใช้งานแล้ว" value={`${Math.round((totalUsed / totalCapacity) * 100)}%`} icon={<MapPin size={20} />} accentColor={C.warning} />
        <StatCard title="รายการสินค้ารวม" value="956" icon={<Package size={20} />} accentColor={C.purple} />
      </div>

      {/* Warehouse Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {warehouseData.map((wh) => {
          const pct = Math.round((wh.used / wh.capacity) * 100);
          const barColor = pct > 85 ? C.danger : pct > 65 ? C.warning : C.success;
          return (
            <div
              key={wh.id}
              className="rounded-lg transition-colors duration-150"
              style={{ background: C.card, border: `1px solid ${C.border}`, padding: "20px", borderLeft: `3px solid ${C.accent}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.card; }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{wh.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{wh.id} — {wh.zone}</div>
                </div>
                <div
                  className="flex items-center justify-center"
                  style={{ width: 32, height: 32, borderRadius: 8, background: C.accent + "15", color: C.accent }}
                >
                  <Warehouse size={16} />
                </div>
              </div>

              {/* Capacity bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 11, color: C.textMuted }}>ความจุ</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: barColor, fontFamily: "'IBM Plex Mono', monospace" }}>{pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: C.border }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: barColor, transition: "width 0.3s" }} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span style={{ fontSize: 10, color: C.textMuted }}>{wh.used}/{wh.capacity} พาเลท</span>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{wh.items} รายการ</span>
                </div>
              </div>

              <div style={{ fontSize: 11, color: C.textSec }}>
                ผู้ดูแล: <span style={{ fontWeight: 500, color: C.text }}>{wh.manager}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Tools Tab ─── */
function ToolsTab() {
  const [search, setSearch] = useState("");
  const filtered = toolsData.filter(
    (t) => t.id.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase())
  );

  const available = toolsData.filter((t) => t.status === "AVAILABLE").length;
  const checkedOut = toolsData.filter((t) => t.status === "CHECKED-OUT").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="เครื่องมือทั้งหมด" value={toolsData.length.toString()} icon={<Wrench size={20} />} accentColor={C.accent} />
        <StatCard title="พร้อมใช้งาน" value={available.toString()} icon={<CheckCircle size={20} />} accentColor={C.success} />
        <StatCard title="เบิกใช้งาน" value={checkedOut.toString()} icon={<ArrowUpDown size={20} />} accentColor={C.warning} />
        <StatCard title="ใกล้ครบ Calibration" value="2" icon={<AlertTriangle size={20} />} accentColor={C.danger} />
      </div>

      <SearchFilterBar placeholder="ค้นหาเครื่องมือ..." onSearch={setSearch} />

      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                {["รหัส", "ชื่อเครื่องมือ", "Serial No.", "สถานะ", "ตำแหน่ง", "Calibrate ล่าสุด", "Calibrate ถัดไป", "จัดการ"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="transition-colors duration-100"
                  style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{t.id}</td>
                  <td style={tdStyle}>{t.name}</td>
                  <td style={{ ...tdStyle, color: C.textSec, fontFamily: "'IBM Plex Mono', monospace" }}>{t.serial}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={t.status} /></td>
                  <td style={{ ...tdStyle, color: C.textSec }}>{t.location}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.textSec }}>{t.lastCal}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: t.nextCal < "2026-04-01" ? C.danger : C.textSec, fontWeight: t.nextCal < "2026-04-01" ? 600 : 400 }}>{t.nextCal}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex items-center gap-1">
                      <button
                        className="flex items-center justify-center rounded transition-colors duration-150"
                        style={{ width: 28, height: 28, color: C.textSec, background: "transparent", border: "none" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.color = C.accent; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSec; }}
                      >
                        <Eye size={13} />
                      </button>
                      <RowActions />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Supply Chain Page ─── */
export default function SupplyChain() {
  const [activeTab, setActiveTab] = useState("inventory");

  const tabContent: Record<string, ReactNode> = {
    inventory: <InventoryTab />,
    warehouse: <WarehouseTab />,
    tools: <ToolsTab />,
  };

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div
        className="flex items-center gap-1 overflow-x-auto"
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 4,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 rounded-md transition-all duration-150 whitespace-nowrap"
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? C.accent : C.textSec,
                background: isActive ? C.accent + "15" : "transparent",
                border: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = C.cardHover;
                  e.currentTarget.style.color = C.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = C.textSec;
                }
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tabContent[activeTab]}
    </div>
  );
}
