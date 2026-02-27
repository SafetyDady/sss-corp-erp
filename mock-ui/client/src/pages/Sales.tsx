/*
 * SSS Corp ERP — Sales Page
 * Design: Industrial Control Room
 * Features: SO list, Quotation tab, stats, search/filter
 */

import { useState, type ReactNode } from "react";
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  Download,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileText,
  Users,
  Clock,
  CheckCircle,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";

const C = {
  accent: "#06b6d4", success: "#10b981", warning: "#f59e0b", danger: "#ef4444", purple: "#8b5cf6",
  card: "#16161f", cardHover: "#1e1e2a", border: "#2a2a3a", borderLight: "#22222f",
  text: "#e2e8f0", textSec: "#94a3b8", textMuted: "#64748b", bg: "#0a0a0f",
};

const thStyle: React.CSSProperties = {
  padding: "10px 16px", fontSize: 10, fontWeight: 600, color: C.textMuted,
  textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "10px 16px", fontSize: 12, color: C.text };

const salesOrders = [
  { id: "SO-2026-0067", customer: "ABC Manufacturing", items: 3, total: "฿890,000", status: "OPEN", date: "2026-02-27", delivery: "2026-03-10", sales: "ปิยะ จ." },
  { id: "SO-2026-0066", customer: "XYZ Industries", items: 5, total: "฿1,250,000", status: "APPROVED", date: "2026-02-26", delivery: "2026-03-08", sales: "สุนิสา พ." },
  { id: "SO-2026-0065", customer: "Thai Auto Parts", items: 2, total: "฿345,000", status: "FINAL", date: "2026-02-25", delivery: "2026-03-05", sales: "ปิยะ จ." },
  { id: "SO-2026-0064", customer: "Global Electronics", items: 8, total: "฿2,100,000", status: "OPEN", date: "2026-02-24", delivery: "2026-03-15", sales: "อนุชา ร." },
  { id: "SO-2026-0063", customer: "ABC Manufacturing", items: 1, total: "฿450,000", status: "FINAL", date: "2026-02-22", delivery: "2026-02-28", sales: "ปิยะ จ." },
  { id: "SO-2026-0062", customer: "Siam Construction", items: 4, total: "฿780,000", status: "DRAFT", date: "2026-02-21", delivery: "—", sales: "สุนิสา พ." },
  { id: "SO-2026-0061", customer: "Eastern Motors", items: 6, total: "฿1,890,000", status: "APPROVED", date: "2026-02-20", delivery: "2026-03-12", sales: "อนุชา ร." },
];

const quotations = [
  { id: "QT-2026-0045", customer: "New Tech Solutions", items: 4, total: "฿560,000", status: "PENDING", date: "2026-02-27", validUntil: "2026-03-27", sales: "ปิยะ จ." },
  { id: "QT-2026-0044", customer: "ABC Manufacturing", items: 2, total: "฿320,000", status: "APPROVED", date: "2026-02-25", validUntil: "2026-03-25", sales: "สุนิสา พ." },
  { id: "QT-2026-0043", customer: "Thai Auto Parts", items: 6, total: "฿1,450,000", status: "PENDING", date: "2026-02-24", validUntil: "2026-03-24", sales: "อนุชา ร." },
  { id: "QT-2026-0042", customer: "Global Electronics", items: 3, total: "฿890,000", status: "REJECTED", date: "2026-02-22", validUntil: "2026-03-22", sales: "ปิยะ จ." },
  { id: "QT-2026-0041", customer: "Siam Construction", items: 5, total: "฿2,200,000", status: "APPROVED", date: "2026-02-20", validUntil: "2026-03-20", sales: "สุนิสา พ." },
];

const tabs = [
  { key: "orders", label: "Sales Orders", icon: <FileText size={15} /> },
  { key: "quotations", label: "Quotations", icon: <DollarSign size={15} /> },
];

function RowActions() {
  return (
    <div className="flex items-center gap-1">
      {[{ icon: <Eye size={13} />, c: C.accent }, { icon: <Pencil size={13} />, c: C.accent }, { icon: <Trash2 size={13} />, c: C.danger }].map((a, i) => (
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

function SalesOrdersTab() {
  const [search, setSearch] = useState("");
  const filtered = salesOrders.filter(
    (so) => so.id.toLowerCase().includes(search.toLowerCase()) || so.customer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="SO เดือนนี้" value="18" icon={<FileText size={20} />} accentColor={C.accent} />
        <StatCard title="ยอดขายเดือนนี้" value="฿8.5M" icon={<TrendingUp size={20} />} accentColor={C.success} trend={{ value: "18.5%", positive: true }} />
        <StatCard title="รอส่งมอบ" value="6" icon={<Clock size={20} />} accentColor={C.warning} />
        <StatCard title="ลูกค้า Active" value="24" icon={<Users size={20} />} accentColor={C.purple} />
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <div className="flex items-center gap-2 flex-1" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", minWidth: 200 }}>
          <Search size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
          <input type="text" placeholder="ค้นหา SO หรือลูกค้า..." onChange={(e) => setSearch(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, width: "100%", fontFamily: "inherit" }} />
        </div>
        <button className="flex items-center gap-1.5 rounded-md" style={{ padding: "6px 12px", fontSize: 12, color: C.textSec, background: "transparent", border: `1px solid ${C.border}` }}><Filter size={14} />ตัวกรอง</button>
        <button className="flex items-center gap-1.5 rounded-md" style={{ padding: "6px 12px", fontSize: 12, color: C.textSec, background: "transparent", border: `1px solid ${C.border}` }}><Download size={14} />ส่งออก</button>
        <button className="flex items-center gap-1.5 rounded-md ml-auto" style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#0a0a0f", background: C.accent, border: "none", borderRadius: 6 }}><Plus size={14} />สร้าง SO</button>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                {["เลขที่ SO", "ลูกค้า", "รายการ", "มูลค่ารวม", "สถานะ", "วันที่", "กำหนดส่ง", "พนักงานขาย", "จัดการ"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((so) => (
                <tr key={so.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{so.id}</td>
                  <td style={tdStyle}>{so.customer}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>{so.items}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{so.total}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={so.status} /></td>
                  <td style={{ ...tdStyle, color: C.textSec, fontFamily: "'IBM Plex Mono', monospace" }}>{so.date}</td>
                  <td style={{ ...tdStyle, color: C.textSec, fontFamily: "'IBM Plex Mono', monospace" }}>{so.delivery}</td>
                  <td style={tdStyle}>{so.sales}</td>
                  <td style={{ padding: "10px 16px" }}><RowActions /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function QuotationsTab() {
  const [search, setSearch] = useState("");
  const filtered = quotations.filter(
    (q) => q.id.toLowerCase().includes(search.toLowerCase()) || q.customer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Quotation เดือนนี้" value="12" icon={<FileText size={20} />} accentColor={C.accent} />
        <StatCard title="รอตอบรับ" value="4" icon={<Clock size={20} />} accentColor={C.warning} />
        <StatCard title="Win Rate" value="68%" icon={<CheckCircle size={20} />} accentColor={C.success} />
        <StatCard title="มูลค่า Pipeline" value="฿5.4M" icon={<TrendingUp size={20} />} accentColor={C.purple} />
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <div className="flex items-center gap-2 flex-1" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", minWidth: 200 }}>
          <Search size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
          <input type="text" placeholder="ค้นหา Quotation..." onChange={(e) => setSearch(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, width: "100%", fontFamily: "inherit" }} />
        </div>
        <button className="flex items-center gap-1.5 rounded-md ml-auto" style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#0a0a0f", background: C.accent, border: "none", borderRadius: 6 }}><Plus size={14} />สร้าง Quotation</button>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                {["เลขที่ QT", "ลูกค้า", "รายการ", "มูลค่ารวม", "สถานะ", "วันที่", "ใช้ได้ถึง", "พนักงานขาย", "จัดการ"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{q.id}</td>
                  <td style={tdStyle}>{q.customer}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>{q.items}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{q.total}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={q.status} /></td>
                  <td style={{ ...tdStyle, color: C.textSec, fontFamily: "'IBM Plex Mono', monospace" }}>{q.date}</td>
                  <td style={{ ...tdStyle, color: C.textSec, fontFamily: "'IBM Plex Mono', monospace" }}>{q.validUntil}</td>
                  <td style={tdStyle}>{q.sales}</td>
                  <td style={{ padding: "10px 16px" }}><RowActions /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Sales() {
  const [activeTab, setActiveTab] = useState("orders");
  const tabContent: Record<string, ReactNode> = { orders: <SalesOrdersTab />, quotations: <QuotationsTab /> };

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
