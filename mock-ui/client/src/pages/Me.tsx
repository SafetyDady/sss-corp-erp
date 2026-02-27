/*
 * SSS Corp ERP — ME Page
 * Design: Industrial Control Room
 * Consolidates "ของฉัน" sub-items into tab menu:
 *   - My Tasks (งานของฉัน)
 *   - My Timesheet (ใบลงเวลา)
 *   - My Leave (ใบลาของฉัน)
 *   - My Daily Report (รายงานประจำวัน)
 */

import { useState, type ReactNode } from "react";
import {
  CalendarCheck,
  Clock,
  FileText,
  ClipboardList,
  User,
  Calendar,
  Send,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
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
  { key: "tasks", label: "My Tasks", icon: <CalendarCheck size={15} /> },
  { key: "timesheet", label: "Timesheet", icon: <Clock size={15} /> },
  { key: "leave", label: "Leave", icon: <FileText size={15} /> },
  { key: "daily-report", label: "Daily Report", icon: <ClipboardList size={15} /> },
];

/* ─── Mock Data ─── */
const myTasks = [
  { id: "WO-2026-0043", desc: "ซ่อมบำรุงเครื่อง CNC-04", status: "OPEN", dueDate: "2026-02-28", priority: "HIGH" },
  { id: "WO-2026-0041", desc: "ผลิตชิ้นส่วน Shaft Component C", status: "OPEN", dueDate: "2026-02-26", priority: "HIGH" },
  { id: "WO-2026-0037", desc: "ผลิต Cover Plate F", status: "OPEN", dueDate: "2026-03-01", priority: "NORMAL" },
  { id: "WO-2026-0044", desc: "ตรวจสอบคุณภาพ Lot #79", status: "DRAFT", dueDate: "2026-03-02", priority: "NORMAL" },
  { id: "WO-2026-0045", desc: "ประกอบ Housing Unit B", status: "OPEN", dueDate: "2026-03-05", priority: "NORMAL" },
];

const timesheetData = [
  { date: "2026-02-27", regular: 8.0, ot: 1.5, wo: "WO-2026-0043", status: "DRAFT" },
  { date: "2026-02-26", regular: 8.0, ot: 2.0, wo: "WO-2026-0041", status: "APPROVED" },
  { date: "2026-02-25", regular: 8.0, ot: 0, wo: "WO-2026-0037", status: "APPROVED" },
  { date: "2026-02-24", regular: 8.0, ot: 3.0, wo: "WO-2026-0043", status: "APPROVED" },
  { date: "2026-02-23", regular: 0, ot: 0, wo: "—", status: "LOCKED" },
  { date: "2026-02-22", regular: 0, ot: 0, wo: "—", status: "LOCKED" },
  { date: "2026-02-21", regular: 8.0, ot: 1.0, wo: "WO-2026-0041", status: "APPROVED" },
];

const leaveData = [
  { id: "LV-001", type: "ANNUAL", typeName: "ลาพักร้อน", start: "2026-03-10", end: "2026-03-12", days: 3, status: "PENDING" },
  { id: "LV-002", type: "SICK", typeName: "ลาป่วย", start: "2026-02-15", end: "2026-02-15", days: 1, status: "APPROVED" },
  { id: "LV-003", type: "PERSONAL", typeName: "ลากิจ", start: "2026-01-20", end: "2026-01-20", days: 1, status: "APPROVED" },
];

const leaveBalance = [
  { type: "ANNUAL", name: "ลาพักร้อน", quota: 10, used: 2 },
  { type: "SICK", name: "ลาป่วย", quota: 30, used: 1 },
  { type: "PERSONAL", name: "ลากิจ", quota: 5, used: 1 },
];

const dailyReports = [
  { date: "2026-02-27", status: "DRAFT", totalHours: 9.5, lines: 3 },
  { date: "2026-02-26", status: "APPROVED", totalHours: 10.0, lines: 4 },
  { date: "2026-02-25", status: "APPROVED", totalHours: 8.0, lines: 2 },
  { date: "2026-02-24", status: "SUBMITTED", totalHours: 11.0, lines: 5 },
  { date: "2026-02-23", status: "—", totalHours: 0, lines: 0 },
  { date: "2026-02-21", status: "REJECTED", totalHours: 9.0, lines: 3 },
];

const leaveTypeColors: Record<string, string> = {
  ANNUAL: C.accent,
  SICK: C.danger,
  PERSONAL: C.purple,
  MATERNITY: C.warning,
};

const priorityColors: Record<string, string> = {
  HIGH: C.danger,
  NORMAL: C.success,
  LOW: C.textMuted,
};

/* ─── Shared table styles ─── */
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

/* ─── Sub-components ─── */
function MyTasksTab() {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="งานทั้งหมด" value="5" icon={<CalendarCheck size={20} />} accentColor={C.accent} />
        <StatCard title="กำลังดำเนินการ" value="3" icon={<Clock size={20} />} accentColor={C.success} />
        <StatCard title="เลยกำหนด" value="1" icon={<AlertTriangle size={20} />} accentColor={C.danger} />
        <StatCard title="รอเริ่ม" value="1" icon={<Calendar size={20} />} accentColor={C.warning} />
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                {["เลขที่ WO", "รายละเอียด", "สถานะ", "ความสำคัญ", "กำหนดส่ง"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myTasks.map((t) => (
                <tr
                  key={t.id}
                  className="transition-colors duration-100"
                  style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{t.id}</td>
                  <td style={tdStyle}>{t.desc}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={t.status} /></td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ color: priorityColors[t.priority] || C.textMuted, fontSize: 12, fontWeight: 600 }}>{t.priority}</span>
                  </td>
                  <td style={{ ...tdStyle, color: C.textSec, fontFamily: "'IBM Plex Mono', monospace" }}>{t.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MyTimesheetTab() {
  const totalRegular = timesheetData.reduce((s, r) => s + r.regular, 0);
  const totalOT = timesheetData.reduce((s, r) => s + r.ot, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="ชั่วโมงปกติ (สัปดาห์)" value={totalRegular.toFixed(1)} icon={<Clock size={20} />} accentColor={C.accent} />
        <StatCard title="ชั่วโมง OT (สัปดาห์)" value={totalOT.toFixed(1)} icon={<Clock size={20} />} accentColor={C.warning} />
        <StatCard title="วันทำงาน" value="5" icon={<Calendar size={20} />} accentColor={C.success} />
        <StatCard title="รอส่ง" value="1" icon={<Send size={20} />} accentColor={C.purple} />
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                {["วันที่", "ชั่วโมงปกติ", "OT", "รวม", "WO", "สถานะ"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timesheetData.map((r) => (
                <tr
                  key={r.date}
                  className="transition-colors duration-100"
                  style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.textSec }}>{r.date}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{r.regular.toFixed(1)}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: r.ot > 0 ? C.warning : C.textMuted }}>{r.ot.toFixed(1)}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: C.accent }}>{(r.regular + r.ot).toFixed(1)}</td>
                  <td style={{ ...tdStyle, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{r.wo}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MyLeaveTab() {
  return (
    <div className="space-y-4">
      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {leaveBalance.map((b) => {
          const remaining = b.quota - b.used;
          const pct = b.quota > 0 ? Math.round((b.used / b.quota) * 100) : 0;
          const typeColor = leaveTypeColors[b.type] || C.textMuted;
          return (
            <div
              key={b.type}
              className="rounded-lg"
              style={{ background: C.card, border: `1px solid ${C.border}`, padding: "16px 20px" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: 13, fontWeight: 600, color: typeColor }}>{b.name}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>{b.used}/{b.quota} วัน</span>
              </div>
              {/* Progress bar */}
              <div style={{ height: 6, borderRadius: 3, background: C.border }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: typeColor, transition: "width 0.3s" }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span style={{ fontSize: 11, color: C.textMuted }}>เหลือ</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: remaining <= 2 ? C.danger : C.success, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {remaining} วัน
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Leave History */}
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                {["เลขที่", "ประเภท", "วันเริ่ม", "วันสิ้นสุด", "จำนวนวัน", "สถานะ"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaveData.map((l) => (
                <tr
                  key={l.id}
                  className="transition-colors duration-100"
                  style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.accent, fontWeight: 500 }}>{l.id}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ background: (leaveTypeColors[l.type] || C.textMuted) + "18", color: leaveTypeColors[l.type] || C.textMuted, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                      {l.typeName}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.textSec }}>{l.start}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.textSec }}>{l.end}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, textAlign: "center" }}>{l.days}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MyDailyReportTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="รายงานวันนี้" value="DRAFT" icon={<ClipboardList size={20} />} accentColor={C.warning} />
        <StatCard title="ชั่วโมงวันนี้" value="9.5" icon={<Clock size={20} />} accentColor={C.accent} />
        <StatCard title="อนุมัติแล้ว (เดือนนี้)" value="18" icon={<Check size={20} />} accentColor={C.success} />
        <StatCard title="ถูกปฏิเสธ" value="1" icon={<AlertTriangle size={20} />} accentColor={C.danger} />
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                {["วันที่", "สถานะ", "จำนวนบรรทัด", "ชั่วโมงรวม"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dailyReports.map((r) => (
                <tr
                  key={r.date}
                  className="transition-colors duration-100"
                  style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.textSec }}>{r.date}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {r.status === "—" ? <span style={{ color: C.textMuted, fontSize: 12 }}>ยังไม่กรอก</span> : <StatusBadge status={r.status} />}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, textAlign: "center" }}>{r.lines || "—"}</td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: r.totalHours > 0 ? C.accent : C.textMuted }}>
                    {r.totalHours > 0 ? r.totalHours.toFixed(1) : "—"}
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

/* ─── Main ME Page ─── */
export default function Me() {
  const [activeTab, setActiveTab] = useState("tasks");

  const tabContent: Record<string, ReactNode> = {
    tasks: <MyTasksTab />,
    timesheet: <MyTimesheetTab />,
    leave: <MyLeaveTab />,
    "daily-report": <MyDailyReportTab />,
  };

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div
        className="flex items-center gap-4 rounded-lg"
        style={{ background: C.card, border: `1px solid ${C.border}`, padding: "16px 24px" }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: C.accent + "20",
            border: `2px solid ${C.accent}`,
          }}
        >
          <User size={22} style={{ color: C.accent }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>สมชาย วงศ์สวัสดิ์</div>
          <div style={{ fontSize: 12, color: C.textSec }}>ช่างเทคนิค — แผนกผลิต | เริ่มงาน: 2023-06-15</div>
        </div>
      </div>

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
