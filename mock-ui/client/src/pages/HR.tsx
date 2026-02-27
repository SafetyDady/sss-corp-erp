/*
 * SSS Corp ERP — HR Page
 * Design: Industrial Control Room
 * Tabs: Employees, Leave Management, Attendance, Daily Report Approval, Leave Balance
 */

import { useState, type ReactNode } from "react";
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
  UserCheck,
  CalendarDays,
  Clock,
  ClipboardList,
  FileText,
  Wallet,
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

const employees = [
  { id: "EMP-001", name: "สมชาย วงศ์สวัสดิ์", dept: "แผนกผลิต", position: "ช่างเทคนิค", hireDate: "2023-06-15", status: "ACTIVE", phone: "081-234-5678" },
  { id: "EMP-002", name: "วิภา สุขสมบูรณ์", dept: "จัดซื้อ", position: "เจ้าหน้าที่จัดซื้อ", hireDate: "2022-03-01", status: "ACTIVE", phone: "089-876-5432" },
  { id: "EMP-003", name: "ธนา กิจเจริญ", dept: "คลังสินค้า", position: "หัวหน้าคลัง", hireDate: "2021-01-15", status: "ACTIVE", phone: "086-111-2222" },
  { id: "EMP-004", name: "สุนิสา พงศ์ไพบูลย์", dept: "ควบคุมคุณภาพ", position: "QC Inspector", hireDate: "2023-09-01", status: "ACTIVE", phone: "082-333-4444" },
  { id: "EMP-005", name: "อนุชา รักษ์ดี", dept: "แผนกผลิต", position: "หัวหน้าสายผลิต", hireDate: "2020-05-10", status: "ACTIVE", phone: "084-555-6666" },
  { id: "EMP-006", name: "ปิยะ จันทร์สว่าง", dept: "ขาย", position: "พนักงานขาย", hireDate: "2024-01-08", status: "ACTIVE", phone: "087-777-8888" },
  { id: "EMP-007", name: "รัชนี ศรีสุข", dept: "บัญชี", position: "นักบัญชี", hireDate: "2022-07-15", status: "ACTIVE", phone: "083-999-0000" },
  { id: "EMP-008", name: "วิทยา มั่นคง", dept: "แผนกผลิต", position: "ช่างเชื่อม", hireDate: "2024-06-01", status: "INACTIVE", phone: "085-222-3333" },
];

const leaveRequests = [
  { id: "LV-2026-045", emp: "สมชาย ว.", type: "ลาพักร้อน", from: "2026-03-10", to: "2026-03-12", days: 3, status: "PENDING", reason: "ท่องเที่ยวกับครอบครัว" },
  { id: "LV-2026-044", emp: "วิภา ส.", type: "ลาป่วย", from: "2026-02-26", to: "2026-02-26", days: 1, status: "APPROVED", reason: "ไม่สบาย" },
  { id: "LV-2026-043", emp: "ธนา ก.", type: "ลากิจ", from: "2026-02-28", to: "2026-02-28", days: 1, status: "PENDING", reason: "ธุระส่วนตัว" },
  { id: "LV-2026-042", emp: "ปิยะ จ.", type: "ลาพักร้อน", from: "2026-03-05", to: "2026-03-07", days: 3, status: "APPROVED", reason: "พักผ่อน" },
  { id: "LV-2026-041", emp: "อนุชา ร.", type: "ลาป่วย", from: "2026-02-20", to: "2026-02-21", days: 2, status: "APPROVED", reason: "ไข้หวัด" },
  { id: "LV-2026-040", emp: "สุนิสา พ.", type: "ลาพักร้อน", from: "2026-03-15", to: "2026-03-18", days: 4, status: "REJECTED", reason: "ช่วงงานเร่ง" },
];

const attendanceData = [
  { emp: "สมชาย ว.", dept: "แผนกผลิต", date: "2026-02-27", checkIn: "07:55", checkOut: "17:05", hours: "8:10", ot: "1:30", status: "PRESENT" },
  { emp: "วิภา ส.", dept: "จัดซื้อ", date: "2026-02-27", checkIn: "08:02", checkOut: "17:00", hours: "7:58", ot: "—", status: "PRESENT" },
  { emp: "ธนา ก.", dept: "คลังสินค้า", date: "2026-02-27", checkIn: "07:48", checkOut: "17:30", hours: "8:42", ot: "2:00", status: "PRESENT" },
  { emp: "สุนิสา พ.", dept: "ควบคุมคุณภาพ", date: "2026-02-27", checkIn: "08:15", checkOut: "17:00", hours: "7:45", ot: "—", status: "LATE" },
  { emp: "อนุชา ร.", dept: "แผนกผลิต", date: "2026-02-27", checkIn: "—", checkOut: "—", hours: "—", ot: "—", status: "ABSENT" },
  { emp: "ปิยะ จ.", dept: "ขาย", date: "2026-02-27", checkIn: "08:00", checkOut: "17:00", hours: "8:00", ot: "—", status: "PRESENT" },
  { emp: "รัชนี ศ.", dept: "บัญชี", date: "2026-02-27", checkIn: "07:50", checkOut: "17:15", hours: "8:25", ot: "1:00", status: "PRESENT" },
];

const dailyReports = [
  { id: "DR-2026-0089", emp: "สมชาย ว.", date: "2026-02-27", wo: "WO-2026-0043", hours: 8.5, ot: 1.5, status: "SUBMITTED" },
  { id: "DR-2026-0088", emp: "อนุชา ร.", date: "2026-02-27", wo: "WO-2026-0041", hours: 8.0, ot: 2.0, status: "SUBMITTED" },
  { id: "DR-2026-0087", emp: "ธนา ก.", date: "2026-02-26", wo: "WO-2026-0037", hours: 8.0, ot: 0, status: "APPROVED" },
  { id: "DR-2026-0086", emp: "สุนิสา พ.", date: "2026-02-26", wo: "WO-2026-0044", hours: 8.0, ot: 0, status: "APPROVED" },
  { id: "DR-2026-0085", emp: "วิทยา ม.", date: "2026-02-26", wo: "WO-2026-0043", hours: 7.5, ot: 0, status: "REJECTED" },
];

const leaveColors: Record<string, string> = { "ลาพักร้อน": "#06b6d4", "ลาป่วย": "#ef4444", "ลากิจ": "#8b5cf6" };

const tabs = [
  { key: "employees", label: "Employees", icon: <Users size={15} /> },
  { key: "leave", label: "Leave Management", icon: <CalendarDays size={15} /> },
  { key: "attendance", label: "Attendance", icon: <Clock size={15} /> },
  { key: "dailyReport", label: "Daily Report Approval", icon: <ClipboardList size={15} /> },
  { key: "leaveBalance", label: "Leave Balance", icon: <Wallet size={15} /> },
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

function EmployeesTab() {
  const [search, setSearch] = useState("");
  const filtered = employees.filter((e) => e.name.includes(search) || e.id.toLowerCase().includes(search.toLowerCase()) || e.dept.includes(search));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="พนักงานทั้งหมด" value="156" icon={<Users size={20} />} accentColor={C.accent} />
        <StatCard title="Active" value="148" icon={<UserCheck size={20} />} accentColor={C.success} />
        <StatCard title="เข้าใหม่เดือนนี้" value="3" icon={<Plus size={20} />} accentColor={C.warning} />
        <StatCard title="ลาออกเดือนนี้" value="1" icon={<Users size={20} />} accentColor={C.danger} />
      </div>
      <div className="flex items-center gap-3 flex-wrap" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <div className="flex items-center gap-2 flex-1" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", minWidth: 200 }}>
          <Search size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
          <input type="text" placeholder="ค้นหาพนักงาน..." onChange={(e) => setSearch(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, width: "100%", fontFamily: "inherit" }} />
        </div>
        <button className="flex items-center gap-1.5 rounded-md" style={{ padding: "6px 12px", fontSize: 12, color: C.textSec, background: "transparent", border: `1px solid ${C.border}` }}><Filter size={14} />ตัวกรอง</button>
        <button className="flex items-center gap-1.5 rounded-md" style={{ padding: "6px 12px", fontSize: 12, color: C.textSec, background: "transparent", border: `1px solid ${C.border}` }}><Download size={14} />ส่งออก</button>
        <button className="flex items-center gap-1.5 rounded-md ml-auto" style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#0a0a0f", background: C.accent, border: "none", borderRadius: 6 }}><Plus size={14} />เพิ่มพนักงาน</button>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["รหัส", "ชื่อ-นามสกุล", "แผนก", "ตำแหน่ง", "วันเริ่มงาน", "โทรศัพท์", "สถานะ", "จัดการ"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.background = C.cardHover; }} onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{e.id}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{e.name}</td>
                  <td style={tdStyle}>{e.dept}</td>
                  <td style={tdStyle}>{e.position}</td>
                  <td style={{ ...tdStyle, color: C.textSec, fontFamily: "'IBM Plex Mono', monospace" }}>{e.hireDate}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace" }}>{e.phone}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={e.status} /></td>
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

function LeaveManagementTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="คำขอลาเดือนนี้" value="14" icon={<CalendarDays size={20} />} accentColor={C.accent} />
        <StatCard title="รออนุมัติ" value="3" icon={<Clock size={20} />} accentColor={C.warning} />
        <StatCard title="อนุมัติแล้ว" value="10" icon={<UserCheck size={20} />} accentColor={C.success} />
        <StatCard title="ไม่อนุมัติ" value="1" icon={<Users size={20} />} accentColor={C.danger} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["เลขที่", "พนักงาน", "ประเภท", "วันเริ่ม", "วันสิ้นสุด", "จำนวนวัน", "เหตุผล", "สถานะ", "จัดการ"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {leaveRequests.map((lv) => (
                <tr key={lv.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{lv.id}</td>
                  <td style={tdStyle}>{lv.emp}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 4, background: (leaveColors[lv.type] || C.accent) + "18", color: leaveColors[lv.type] || C.accent, border: `1px solid ${(leaveColors[lv.type] || C.accent)}30` }}>{lv.type}</span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.textSec }}>{lv.from}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.textSec }}>{lv.to}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>{lv.days}</td>
                  <td style={{ ...tdStyle, color: C.textSec, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lv.reason}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={lv.status} /></td>
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

function AttendanceTab() {
  const statusColors: Record<string, string> = { PRESENT: C.success, LATE: C.warning, ABSENT: C.danger };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="มาทำงาน" value="142" icon={<UserCheck size={20} />} accentColor={C.success} />
        <StatCard title="สาย" value="5" icon={<Clock size={20} />} accentColor={C.warning} />
        <StatCard title="ขาด" value="3" icon={<Users size={20} />} accentColor={C.danger} />
        <StatCard title="ลา" value="6" icon={<CalendarDays size={20} />} accentColor={C.purple} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["พนักงาน", "แผนก", "วันที่", "เข้างาน", "ออกงาน", "ชั่วโมงทำงาน", "OT", "สถานะ"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {attendanceData.map((a, i) => (
                <tr key={i} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{a.emp}</td>
                  <td style={tdStyle}>{a.dept}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.textSec }}>{a.date}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace" }}>{a.checkIn}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace" }}>{a.checkOut}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace" }}>{a.hours}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: a.ot !== "—" ? C.warning : C.textMuted }}>{a.ot}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 4, background: (statusColors[a.status] || C.accent) + "18", color: statusColors[a.status] || C.accent, border: `1px solid ${(statusColors[a.status] || C.accent)}30` }}>{a.status}</span>
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

function DailyReportApprovalTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="รายงานวันนี้" value="12" icon={<ClipboardList size={20} />} accentColor={C.accent} />
        <StatCard title="รออนุมัติ" value="4" icon={<Clock size={20} />} accentColor={C.warning} />
        <StatCard title="อนุมัติแล้ว" value="7" icon={<UserCheck size={20} />} accentColor={C.success} />
        <StatCard title="ส่งกลับแก้ไข" value="1" icon={<FileText size={20} />} accentColor={C.danger} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["เลขที่", "พนักงาน", "วันที่", "Work Order", "ชั่วโมงปกติ", "OT", "สถานะ", "จัดการ"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {dailyReports.map((dr) => (
                <tr key={dr.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{dr.id}</td>
                  <td style={tdStyle}>{dr.emp}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.textSec }}>{dr.date}</td>
                  <td style={{ ...tdStyle, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{dr.wo}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace" }}>{dr.hours}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: dr.ot > 0 ? C.warning : C.textMuted }}>{dr.ot || "—"}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={dr.status} /></td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex items-center gap-1">
                      <button className="flex items-center justify-center rounded transition-colors duration-150" style={{ width: 28, height: 28, color: C.textSec, background: "transparent", border: "none" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = C.success; }} onMouseLeave={(e) => { e.currentTarget.style.color = C.textSec; }}>
                        <UserCheck size={13} />
                      </button>
                      <button className="flex items-center justify-center rounded transition-colors duration-150" style={{ width: 28, height: 28, color: C.textSec, background: "transparent", border: "none" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = C.danger; }} onMouseLeave={(e) => { e.currentTarget.style.color = C.textSec; }}>
                        <Trash2 size={13} />
                      </button>
                      <button className="flex items-center justify-center rounded transition-colors duration-150" style={{ width: 28, height: 28, color: C.textSec, background: "transparent", border: "none" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; }} onMouseLeave={(e) => { e.currentTarget.style.color = C.textSec; }}>
                        <Eye size={13} />
                      </button>
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

function LeaveBalanceTab() {
  const balances = [
    { emp: "สมชาย ว.", dept: "แผนกผลิต", annual: { used: 2, total: 10 }, sick: { used: 1, total: 30 }, personal: { used: 1, total: 5 } },
    { emp: "วิภา ส.", dept: "จัดซื้อ", annual: { used: 5, total: 12 }, sick: { used: 3, total: 30 }, personal: { used: 2, total: 5 } },
    { emp: "ธนา ก.", dept: "คลังสินค้า", annual: { used: 3, total: 15 }, sick: { used: 0, total: 30 }, personal: { used: 1, total: 5 } },
    { emp: "สุนิสา พ.", dept: "ควบคุมคุณภาพ", annual: { used: 1, total: 10 }, sick: { used: 2, total: 30 }, personal: { used: 0, total: 5 } },
    { emp: "อนุชา ร.", dept: "แผนกผลิต", annual: { used: 8, total: 15 }, sick: { used: 5, total: 30 }, personal: { used: 3, total: 5 } },
    { emp: "ปิยะ จ.", dept: "ขาย", annual: { used: 0, total: 8 }, sick: { used: 1, total: 30 }, personal: { used: 0, total: 5 } },
  ];

  const BalanceBar = ({ used, total, color }: { used: number; total: number; color: string }) => (
    <div className="flex items-center gap-2" style={{ minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${(used / total) * 100}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.textSec, whiteSpace: "nowrap" }}>{used}/{total}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["พนักงาน", "แผนก", "ลาพักร้อน", "ลาป่วย", "ลากิจ"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {balances.map((b, i) => (
                <tr key={i} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{b.emp}</td>
                  <td style={tdStyle}>{b.dept}</td>
                  <td style={{ padding: "10px 16px" }}><BalanceBar used={b.annual.used} total={b.annual.total} color={leaveColors["ลาพักร้อน"]} /></td>
                  <td style={{ padding: "10px 16px" }}><BalanceBar used={b.sick.used} total={b.sick.total} color={leaveColors["ลาป่วย"]} /></td>
                  <td style={{ padding: "10px 16px" }}><BalanceBar used={b.personal.used} total={b.personal.total} color={leaveColors["ลากิจ"]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function HRPage() {
  const [activeTab, setActiveTab] = useState("employees");
  const tabContent: Record<string, ReactNode> = {
    employees: <EmployeesTab />, leave: <LeaveManagementTab />, attendance: <AttendanceTab />,
    dailyReport: <DailyReportApprovalTab />, leaveBalance: <LeaveBalanceTab />,
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
