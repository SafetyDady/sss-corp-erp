/*
 * SSS Corp ERP — Purchasing Page
 * Design: Industrial Control Room
 * Features: PO list, stats, search/filter, create modal placeholder
 * Language: EN titles + TH labels, EN for financial terms
 */

import { useState } from "react";
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Download,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  FileText,
  Truck,
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

const purchaseOrders = [
  { id: "PO-2026-0128", supplier: "Thai Steel Co., Ltd.", items: 5, total: "฿245,000", status: "PENDING", date: "2026-02-27", delivery: "2026-03-05", buyer: "วิภา ส." },
  { id: "PO-2026-0127", supplier: "Siam Bolt & Nut", items: 3, total: "฿18,500", status: "APPROVED", date: "2026-02-26", delivery: "2026-03-02", buyer: "สมชาย ว." },
  { id: "PO-2026-0126", supplier: "Bangkok Aluminum", items: 2, total: "฿89,000", status: "APPROVED", date: "2026-02-25", delivery: "2026-03-01", buyer: "วิภา ส." },
  { id: "PO-2026-0125", supplier: "Eastern Chemical Supply", items: 4, total: "฿32,400", status: "RECEIVED", date: "2026-02-24", delivery: "2026-02-28", buyer: "ธนา ก." },
  { id: "PO-2026-0124", supplier: "Thai Steel Co., Ltd.", items: 8, total: "฿567,000", status: "RECEIVED", date: "2026-02-22", delivery: "2026-02-26", buyer: "วิภา ส." },
  { id: "PO-2026-0123", supplier: "Precision Tools Asia", items: 2, total: "฿156,000", status: "DRAFT", date: "2026-02-21", delivery: "—", buyer: "สุนิสา พ." },
  { id: "PO-2026-0122", supplier: "Siam Bolt & Nut", items: 6, total: "฿42,800", status: "REJECTED", date: "2026-02-20", delivery: "—", buyer: "สมชาย ว." },
  { id: "PO-2026-0121", supplier: "Bangkok Aluminum", items: 1, total: "฿445,000", status: "RECEIVED", date: "2026-02-18", delivery: "2026-02-22", buyer: "วิภา ส." },
];

export default function Purchasing() {
  const [search, setSearch] = useState("");
  const filtered = purchaseOrders.filter(
    (po) => po.id.toLowerCase().includes(search.toLowerCase()) || po.supplier.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="PO ทั้งหมด (เดือนนี้)" value="28" icon={<ShoppingCart size={20} />} accentColor={C.accent} />
        <StatCard title="รออนุมัติ" value="5" icon={<Clock size={20} />} accentColor={C.warning} />
        <StatCard title="มูลค่ารวม" value="฿2.8M" icon={<DollarSign size={20} />} accentColor={C.success} trend={{ value: "12.3%", positive: true }} />
        <StatCard title="รอรับสินค้า" value="8" icon={<Truck size={20} />} accentColor={C.purple} />
      </div>

      {/* Search/Filter */}
      <div className="flex items-center gap-3 flex-wrap" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <div className="flex items-center gap-2 flex-1" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", minWidth: 200 }}>
          <Search size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
          <input type="text" placeholder="ค้นหา PO หรือ Supplier..." onChange={(e) => setSearch(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, width: "100%", fontFamily: "inherit" }} />
        </div>
        {[{ icon: <Filter size={14} />, label: "ตัวกรอง" }, { icon: <Download size={14} />, label: "ส่งออก" }].map((btn, i) => (
          <button key={i} className="flex items-center gap-1.5 rounded-md transition-colors duration-150"
            style={{ padding: "6px 12px", fontSize: 12, color: C.textSec, background: "transparent", border: `1px solid ${C.border}` }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            {btn.icon}{btn.label}
          </button>
        ))}
        <button className="flex items-center gap-1.5 rounded-md transition-colors duration-150 ml-auto"
          style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#0a0a0f", background: C.accent, border: "none", borderRadius: 6 }}>
          <Plus size={14} />สร้าง PO
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                {["เลขที่ PO", "Supplier", "รายการ", "มูลค่ารวม", "สถานะ", "วันที่สั่ง", "กำหนดรับ", "ผู้จัดซื้อ", "จัดการ"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => (
                <tr key={po.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{po.id}</td>
                  <td style={tdStyle}>{po.supplier}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>{po.items}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{po.total}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={po.status} /></td>
                  <td style={{ ...tdStyle, color: C.textSec, fontFamily: "'IBM Plex Mono', monospace" }}>{po.date}</td>
                  <td style={{ ...tdStyle, color: C.textSec, fontFamily: "'IBM Plex Mono', monospace" }}>{po.delivery}</td>
                  <td style={tdStyle}>{po.buyer}</td>
                  <td style={{ padding: "10px 16px" }}>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
