/*
 * SSS Corp ERP — Admin Page
 * Design: Industrial Control Room
 * Tabs: Users, Roles & Permissions, Audit Log, System Settings
 */

import { useState, type ReactNode } from "react";
import {
  Shield,
  Users,
  Key,
  FileText,
  Settings,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Search,
  UserCheck,
  Lock,
  Activity,
  Server,
  Database,
  Globe,
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
const mono: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

const tabs = [
  { key: "users", label: "Users", icon: <Users size={15} /> },
  { key: "roles", label: "Roles & Permissions", icon: <Key size={15} /> },
  { key: "audit", label: "Audit Log", icon: <FileText size={15} /> },
  { key: "settings", label: "System Settings", icon: <Settings size={15} /> },
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

const users = [
  { id: "USR-001", username: "owner_admin", name: "Owner Admin", email: "admin@ssscorp.co.th", role: "Owner", lastLogin: "2026-02-27 08:15", status: "ACTIVE" },
  { id: "USR-002", username: "somchai.w", name: "สมชาย วงศ์สวัสดิ์", email: "somchai@ssscorp.co.th", role: "Staff", lastLogin: "2026-02-27 07:55", status: "ACTIVE" },
  { id: "USR-003", username: "anucha.r", name: "อนุชา รักษ์ดี", email: "anucha@ssscorp.co.th", role: "Supervisor", lastLogin: "2026-02-27 07:48", status: "ACTIVE" },
  { id: "USR-004", username: "vipa.s", name: "วิภา สุขสมบูรณ์", email: "vipa@ssscorp.co.th", role: "Manager", lastLogin: "2026-02-27 08:02", status: "ACTIVE" },
  { id: "USR-005", username: "thana.k", name: "ธนา กิจเจริญ", email: "thana@ssscorp.co.th", role: "Supervisor", lastLogin: "2026-02-26 17:30", status: "ACTIVE" },
  { id: "USR-006", username: "sunisa.p", name: "สุนิสา พงศ์ไพบูลย์", email: "sunisa@ssscorp.co.th", role: "Staff", lastLogin: "2026-02-27 08:15", status: "ACTIVE" },
  { id: "USR-007", username: "wittaya.m", name: "วิทยา มั่นคง", email: "wittaya@ssscorp.co.th", role: "Staff", lastLogin: "2026-01-15 09:00", status: "INACTIVE" },
];

const roles = [
  { name: "Owner", desc: "Full system access, organization management", users: 1, permissions: 120, color: C.danger },
  { name: "Manager", desc: "Department management, approvals, reports", users: 5, permissions: 95, color: C.purple },
  { name: "Supervisor", desc: "Team management, daily report approval", users: 12, permissions: 72, color: C.warning },
  { name: "Staff", desc: "Basic operations, self-service portal", users: 130, permissions: 45, color: C.accent },
  { name: "Viewer", desc: "Read-only access to assigned modules", users: 8, permissions: 28, color: C.textSec },
];

const auditLogs = [
  { ts: "2026-02-27 08:15:23", user: "owner_admin", action: "LOGIN", module: "Auth", detail: "Login successful from 192.168.1.100", severity: "INFO" },
  { ts: "2026-02-27 08:12:45", user: "anucha.r", action: "APPROVE", module: "Daily Report", detail: "Approved DR-2026-0087 for ธนา ก.", severity: "INFO" },
  { ts: "2026-02-27 08:10:30", user: "somchai.w", action: "CREATE", module: "Daily Report", detail: "Created DR-2026-0089", severity: "INFO" },
  { ts: "2026-02-27 08:05:12", user: "vipa.s", action: "UPDATE", module: "Purchasing", detail: "Updated PO-2026-0089 status to APPROVED", severity: "INFO" },
  { ts: "2026-02-27 07:58:00", user: "system", action: "BACKUP", module: "System", detail: "Daily backup completed successfully", severity: "INFO" },
  { ts: "2026-02-26 23:00:00", user: "system", action: "CLEANUP", module: "System", detail: "Session cleanup: 12 expired sessions removed", severity: "INFO" },
  { ts: "2026-02-26 17:45:33", user: "wittaya.m", action: "LOGIN_FAILED", module: "Auth", detail: "Failed login attempt from 10.0.0.55", severity: "WARNING" },
  { ts: "2026-02-26 16:30:00", user: "owner_admin", action: "PERMISSION_CHANGE", module: "Admin", detail: "Updated role permissions for Supervisor", severity: "WARNING" },
];

function UsersTab() {
  const [search, setSearch] = useState("");
  const filtered = users.filter((u) => u.name.includes(search) || u.username.includes(search.toLowerCase()) || u.email.includes(search.toLowerCase()));
  const roleColors: Record<string, string> = { Owner: C.danger, Manager: C.purple, Supervisor: C.warning, Staff: C.accent, Viewer: C.textSec };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="ผู้ใช้ทั้งหมด" value="156" icon={<Users size={20} />} accentColor={C.accent} />
        <StatCard title="Active" value="148" icon={<UserCheck size={20} />} accentColor={C.success} />
        <StatCard title="Online Now" value="42" icon={<Activity size={20} />} accentColor={C.success} />
        <StatCard title="Locked" value="2" icon={<Lock size={20} />} accentColor={C.danger} />
      </div>
      <div className="flex items-center gap-3 flex-wrap" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <div className="flex items-center gap-2 flex-1" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", minWidth: 200 }}>
          <Search size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
          <input type="text" placeholder="ค้นหาผู้ใช้..." onChange={(e) => setSearch(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, width: "100%", fontFamily: "inherit" }} />
        </div>
        <button className="flex items-center gap-1.5 rounded-md ml-auto" style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#0a0a0f", background: C.accent, border: "none", borderRadius: 6 }}><Plus size={14} />เพิ่มผู้ใช้</button>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["Username", "ชื่อ-นามสกุล", "Email", "Role", "Login ล่าสุด", "สถานะ", "จัดการ"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, ...mono }}>{u.username}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{u.name}</td>
                  <td style={{ ...tdStyle, ...mono, fontSize: 11 }}>{u.email}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: (roleColors[u.role] || C.accent) + "18", color: roleColors[u.role] || C.accent, border: `1px solid ${(roleColors[u.role] || C.accent)}30` }}>{u.role}</span>
                  </td>
                  <td style={{ ...tdStyle, ...mono, fontSize: 11, color: C.textSec }}>{u.lastLogin}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={u.status} /></td>
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

function RolesTab() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 rounded-md" style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#0a0a0f", background: C.accent, border: "none", borderRadius: 6 }}><Plus size={14} />สร้าง Role ใหม่</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((r) => (
          <div key={r.name} className="rounded-lg p-4 transition-all duration-150" style={{ background: C.card, border: `1px solid ${C.border}` }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = r.color + "60"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center rounded-md" style={{ width: 32, height: 32, background: r.color + "18" }}>
                  <Shield size={16} style={{ color: r.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.textSec }}>{r.users} users</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="flex items-center justify-center rounded" style={{ width: 28, height: 28, color: C.textSec, background: "transparent", border: "none" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; }} onMouseLeave={(e) => { e.currentTarget.style.color = C.textSec; }}>
                  <Pencil size={13} />
                </button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.textSec, marginBottom: 12, lineHeight: 1.5 }}>{r.desc}</p>
            <div className="flex items-center gap-2">
              <Key size={12} style={{ color: C.textMuted }} />
              <span style={{ fontSize: 11, color: C.textMuted }}>{r.permissions} permissions</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditLogTab() {
  const severityColors: Record<string, string> = { INFO: C.accent, WARNING: C.warning, ERROR: C.danger };
  const actionColors: Record<string, string> = { LOGIN: C.success, APPROVE: C.success, CREATE: C.accent, UPDATE: C.warning, BACKUP: C.purple, CLEANUP: C.textSec, LOGIN_FAILED: C.danger, PERMISSION_CHANGE: C.warning };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Events Today" value="234" icon={<Activity size={20} />} accentColor={C.accent} />
        <StatCard title="Warnings" value="5" icon={<FileText size={20} />} accentColor={C.warning} />
        <StatCard title="Failed Logins" value="2" icon={<Lock size={20} />} accentColor={C.danger} />
        <StatCard title="System Events" value="12" icon={<Server size={20} />} accentColor={C.purple} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["Timestamp", "User", "Action", "Module", "Detail", "Severity"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {auditLogs.map((log, i) => (
                <tr key={i} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, ...mono, fontSize: 11, color: C.textSec, whiteSpace: "nowrap" }}>{log.ts}</td>
                  <td style={{ ...tdStyle, ...mono, fontWeight: 500 }}>{log.user}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: (actionColors[log.action] || C.accent) + "18", color: actionColors[log.action] || C.accent, border: `1px solid ${(actionColors[log.action] || C.accent)}30` }}>{log.action}</span>
                  </td>
                  <td style={tdStyle}>{log.module}</td>
                  <td style={{ ...tdStyle, color: C.textSec, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.detail}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: (severityColors[log.severity] || C.accent) + "18", color: severityColors[log.severity] || C.accent }}>{log.severity}</span>
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

function SystemSettingsTab() {
  const settings = [
    { icon: <Globe size={16} />, label: "Organization Name", value: "SSS Intelligence & Solutions Co., Ltd.", type: "text" },
    { icon: <Globe size={16} />, label: "Default Language", value: "ไทย (Thai)", type: "select" },
    { icon: <Globe size={16} />, label: "Timezone", value: "Asia/Bangkok (UTC+7)", type: "select" },
    { icon: <Database size={16} />, label: "Database Version", value: "PostgreSQL 15.4", type: "readonly" },
    { icon: <Server size={16} />, label: "API Version", value: "v1.0.0", type: "readonly" },
    { icon: <Shield size={16} />, label: "Session Timeout", value: "30 minutes", type: "select" },
    { icon: <Lock size={16} />, label: "Password Policy", value: "Min 8 chars, 1 uppercase, 1 number", type: "text" },
    { icon: <Activity size={16} />, label: "Audit Log Retention", value: "90 days", type: "select" },
    { icon: <Server size={16} />, label: "Backup Schedule", value: "Daily at 23:00", type: "select" },
    { icon: <Database size={16} />, label: "Last Backup", value: "2026-02-27 23:00:00", type: "readonly" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        {settings.map((s, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3.5 transition-colors duration-100"
            style={{ borderBottom: i < settings.length - 1 ? `1px solid ${C.borderLight}` : "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center" style={{ color: C.textMuted }}>{s.icon}</div>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: s.type === "readonly" ? C.textMuted : C.textSec, ...mono }}>{s.value}</span>
              {s.type !== "readonly" && (
                <button className="flex items-center justify-center rounded" style={{ width: 24, height: 24, color: C.textMuted, background: "transparent", border: "none" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; }} onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; }}>
                  <Pencil size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");
  const tabContent: Record<string, ReactNode> = {
    users: <UsersTab />, roles: <RolesTab />, audit: <AuditLogTab />, settings: <SystemSettingsTab />,
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
