/*
 * SSS Corp ERP — Customers Page
 * Design: Industrial Control Room
 * Features: Customer list, contact info, stats, search/filter
 */

import { useState } from "react";
import {
  Users,
  Plus,
  Search,
  Filter,
  Download,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Building2,
  Phone,
  Mail,
  TrendingUp,
  Star,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";

const C = {
  accent: "#06b6d4", success: "#10b981", warning: "#f59e0b", danger: "#ef4444", purple: "#8b5cf6",
  card: "#16161f", cardHover: "#1e1e2a", border: "#2a2a3a", borderLight: "#22222f",
  text: "#e2e8f0", textSec: "#94a3b8", textMuted: "#64748b", bg: "#0a0a0f",
};
const thStyle: React.CSSProperties = { padding: "10px 16px", fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "10px 16px", fontSize: 12, color: C.text };

const customers = [
  { id: "CUS-001", name: "ABC Manufacturing Co., Ltd.", contact: "คุณวิชัย สมบูรณ์", phone: "02-123-4567", email: "vichai@abc-mfg.co.th", type: "Manufacturer", tier: "Gold", revenue: "฿8.5M", orders: 24, status: "ACTIVE" },
  { id: "CUS-002", name: "XYZ Industries", contact: "คุณสมศักดิ์ เจริญดี", phone: "02-234-5678", email: "somsak@xyz-ind.com", type: "Manufacturer", tier: "Platinum", revenue: "฿12.3M", orders: 38, status: "ACTIVE" },
  { id: "CUS-003", name: "Thai Auto Parts Co., Ltd.", contact: "คุณนภา ศรีสุข", phone: "02-345-6789", email: "napa@thaiap.co.th", type: "Automotive", tier: "Gold", revenue: "฿5.2M", orders: 15, status: "ACTIVE" },
  { id: "CUS-004", name: "Global Electronics (Thailand)", contact: "Mr. James Chen", phone: "02-456-7890", email: "james@globalelec.th", type: "Electronics", tier: "Platinum", revenue: "฿18.9M", orders: 42, status: "ACTIVE" },
  { id: "CUS-005", name: "Siam Construction Group", contact: "คุณประเสริฐ มั่นคง", phone: "02-567-8901", email: "prasert@siamcon.co.th", type: "Construction", tier: "Silver", revenue: "฿3.1M", orders: 8, status: "ACTIVE" },
  { id: "CUS-006", name: "Eastern Motors", contact: "คุณอรุณ แสงทอง", phone: "02-678-9012", email: "arun@easternmotors.com", type: "Automotive", tier: "Gold", revenue: "฿6.8M", orders: 19, status: "ACTIVE" },
  { id: "CUS-007", name: "New Tech Solutions", contact: "คุณพิมพ์ใจ วงศ์ดี", phone: "02-789-0123", email: "pimjai@newtech.co.th", type: "Technology", tier: "Silver", revenue: "฿1.5M", orders: 5, status: "ACTIVE" },
  { id: "CUS-008", name: "Pacific Trading Co.", contact: "Mr. David Lee", phone: "02-890-1234", email: "david@pacifictrading.com", type: "Trading", tier: "Bronze", revenue: "฿800K", orders: 3, status: "INACTIVE" },
];

const tierColors: Record<string, string> = { Platinum: "#a78bfa", Gold: "#f59e0b", Silver: "#94a3b8", Bronze: "#d97706" };

export default function Customers() {
  const [search, setSearch] = useState("");
  const filtered = customers.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()) || c.contact.includes(search)
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="ลูกค้าทั้งหมด" value="45" icon={<Building2 size={20} />} accentColor={C.accent} />
        <StatCard title="Active" value="42" icon={<Users size={20} />} accentColor={C.success} />
        <StatCard title="ยอดขายรวม (YTD)" value="฿57.1M" icon={<TrendingUp size={20} />} accentColor={C.success} trend={{ value: "15.8%", positive: true }} />
        <StatCard title="Platinum Tier" value="5" icon={<Star size={20} />} accentColor={C.purple} />
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <div className="flex items-center gap-2 flex-1" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", minWidth: 200 }}>
          <Search size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
          <input type="text" placeholder="ค้นหาลูกค้า..." onChange={(e) => setSearch(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, width: "100%", fontFamily: "inherit" }} />
        </div>
        <button className="flex items-center gap-1.5 rounded-md" style={{ padding: "6px 12px", fontSize: 12, color: C.textSec, background: "transparent", border: `1px solid ${C.border}` }}><Filter size={14} />ตัวกรอง</button>
        <button className="flex items-center gap-1.5 rounded-md" style={{ padding: "6px 12px", fontSize: 12, color: C.textSec, background: "transparent", border: `1px solid ${C.border}` }}><Download size={14} />ส่งออก</button>
        <button className="flex items-center gap-1.5 rounded-md ml-auto" style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#0a0a0f", background: C.accent, border: "none", borderRadius: 6 }}><Plus size={14} />เพิ่มลูกค้า</button>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["รหัส", "ชื่อบริษัท", "ผู้ติดต่อ", "โทรศัพท์", "ประเภท", "Tier", "ยอดขาย (YTD)", "Orders", "สถานะ", "จัดการ"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{c.id}</td>
                  <td style={{ ...tdStyle, fontWeight: 500, maxWidth: 200 }}>{c.name}</td>
                  <td style={tdStyle}>{c.contact}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{c.phone}</td>
                  <td style={{ ...tdStyle, color: C.textSec }}>{c.type}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: (tierColors[c.tier] || C.accent) + "18", color: tierColors[c.tier] || C.accent, border: `1px solid ${(tierColors[c.tier] || C.accent)}30` }}>{c.tier}</span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{c.revenue}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", textAlign: "center" }}>{c.orders}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={c.status} /></td>
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
      </div>
    </div>
  );
}
