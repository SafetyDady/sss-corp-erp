/*
 * SSS Corp ERP — Planning Page
 * Design: Industrial Control Room
 * Tabs: Production Plan, Master Plan, Capacity Planning
 */

import { useState, type ReactNode } from "react";
import {
  Calendar,
  BarChart3,
  Gauge,
  Clock,
  CheckCircle,
  AlertTriangle,
  Target,
  Layers,
  TrendingUp,
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
  { key: "production", label: "Production Plan", icon: <Calendar size={15} /> },
  { key: "master", label: "Master Plan", icon: <BarChart3 size={15} /> },
  { key: "capacity", label: "Capacity Planning", icon: <Gauge size={15} /> },
];

const productionPlans = [
  { id: "PP-2026-W09", period: "Week 9 (Feb 24 - Mar 2)", wo: 12, planned: 450, actual: 380, completion: 84, status: "IN_PROGRESS" },
  { id: "PP-2026-W08", period: "Week 8 (Feb 17 - Feb 23)", wo: 15, planned: 520, actual: 498, completion: 96, status: "COMPLETED" },
  { id: "PP-2026-W07", period: "Week 7 (Feb 10 - Feb 16)", wo: 11, planned: 400, actual: 412, completion: 103, status: "COMPLETED" },
  { id: "PP-2026-W06", period: "Week 6 (Feb 3 - Feb 9)", wo: 14, planned: 480, actual: 465, completion: 97, status: "COMPLETED" },
  { id: "PP-2026-W10", period: "Week 10 (Mar 3 - Mar 9)", wo: 13, planned: 500, actual: 0, completion: 0, status: "PLANNED" },
  { id: "PP-2026-W11", period: "Week 11 (Mar 10 - Mar 16)", wo: 10, planned: 380, actual: 0, completion: 0, status: "PLANNED" },
];

const masterPlans = [
  { id: "MP-2026-Q1", product: "Bracket Assembly A", demand: 2500, planned: 2500, produced: 1890, onTrack: true, quarter: "Q1 2026" },
  { id: "MP-2026-Q1-2", product: "Housing Unit B", demand: 800, planned: 850, produced: 520, onTrack: false, quarter: "Q1 2026" },
  { id: "MP-2026-Q1-3", product: "Shaft Component C", demand: 1200, planned: 1200, produced: 980, onTrack: true, quarter: "Q1 2026" },
  { id: "MP-2026-Q1-4", product: "Cover Plate F", demand: 3000, planned: 3000, produced: 2100, onTrack: false, quarter: "Q1 2026" },
  { id: "MP-2026-Q1-5", product: "Gear Assembly D", demand: 600, planned: 650, produced: 510, onTrack: true, quarter: "Q1 2026" },
  { id: "MP-2026-Q2", product: "Bracket Assembly A", demand: 2800, planned: 2800, produced: 0, onTrack: true, quarter: "Q2 2026" },
  { id: "MP-2026-Q2-2", product: "Housing Unit B", demand: 900, planned: 950, produced: 0, onTrack: true, quarter: "Q2 2026" },
];

const capacityData = [
  { line: "Production Line 1", machine: "CNC Machining", capacity: 160, scheduled: 148, utilization: 92.5, status: "HIGH" },
  { line: "Production Line 1", machine: "Welding Station", capacity: 120, scheduled: 95, utilization: 79.2, status: "NORMAL" },
  { line: "Production Line 2", machine: "Assembly Line", capacity: 200, scheduled: 185, utilization: 92.5, status: "HIGH" },
  { line: "Production Line 2", machine: "Laser Cutting", capacity: 80, scheduled: 72, utilization: 90.0, status: "HIGH" },
  { line: "QC Station", machine: "CMM Inspection", capacity: 100, scheduled: 65, utilization: 65.0, status: "NORMAL" },
  { line: "Maintenance", machine: "Repair Bay", capacity: 40, scheduled: 35, utilization: 87.5, status: "HIGH" },
  { line: "Warehouse", machine: "Packing Station", capacity: 150, scheduled: 88, utilization: 58.7, status: "LOW" },
];

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 100 }}>
      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, ...mono, color: C.textSec, whiteSpace: "nowrap" }}>{value}%</span>
    </div>
  );
}

function ProductionPlanTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="แผนสัปดาห์นี้" value="12 WO" icon={<Calendar size={20} />} accentColor={C.accent} />
        <StatCard title="เป้าหมาย" value="450 ชิ้น" icon={<Target size={20} />} accentColor={C.purple} />
        <StatCard title="ผลิตแล้ว" value="380 ชิ้น" icon={<CheckCircle size={20} />} accentColor={C.success} />
        <StatCard title="Completion Rate" value="84%" icon={<TrendingUp size={20} />} accentColor={C.warning} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["Plan ID", "Period", "Work Orders", "Planned (ชิ้น)", "Actual (ชิ้น)", "Completion", "Status"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {productionPlans.map((p) => (
                <tr key={p.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, ...mono }}>{p.id}</td>
                  <td style={tdStyle}>{p.period}</td>
                  <td style={{ ...tdStyle, ...mono, textAlign: "center" }}>{p.wo}</td>
                  <td style={{ ...tdStyle, ...mono }}>{p.planned.toLocaleString()}</td>
                  <td style={{ ...tdStyle, ...mono, fontWeight: 600 }}>{p.actual > 0 ? p.actual.toLocaleString() : "—"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <ProgressBar value={p.completion} color={p.completion >= 95 ? C.success : p.completion >= 80 ? C.warning : p.completion > 0 ? C.accent : C.textMuted} />
                  </td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MasterPlanTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Products Planned" value="5" icon={<Layers size={20} />} accentColor={C.accent} />
        <StatCard title="Total Demand (Q1)" value="8,100" icon={<Target size={20} />} accentColor={C.purple} />
        <StatCard title="On Track" value="3/5" icon={<CheckCircle size={20} />} accentColor={C.success} />
        <StatCard title="Behind Schedule" value="2" icon={<AlertTriangle size={20} />} accentColor={C.danger} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["Plan ID", "Product", "Quarter", "Demand", "Planned", "Produced", "Progress", "Status"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {masterPlans.map((m) => {
                const pct = m.planned > 0 ? Math.round((m.produced / m.planned) * 100) : 0;
                return (
                  <tr key={m.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, ...mono }}>{m.id}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{m.product}</td>
                    <td style={{ ...tdStyle, ...mono }}>{m.quarter}</td>
                    <td style={{ ...tdStyle, ...mono }}>{m.demand.toLocaleString()}</td>
                    <td style={{ ...tdStyle, ...mono }}>{m.planned.toLocaleString()}</td>
                    <td style={{ ...tdStyle, ...mono, fontWeight: 600 }}>{m.produced > 0 ? m.produced.toLocaleString() : "—"}</td>
                    <td style={{ padding: "10px 16px" }}><ProgressBar value={pct} color={m.onTrack ? C.success : C.danger} /></td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: (m.onTrack ? C.success : C.danger) + "18", color: m.onTrack ? C.success : C.danger, border: `1px solid ${m.onTrack ? C.success : C.danger}30` }}>
                        {m.produced === 0 ? "NOT STARTED" : m.onTrack ? "ON TRACK" : "BEHIND"}
                      </span>
                    </td>
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

function CapacityPlanningTab() {
  const statusColors: Record<string, string> = { HIGH: C.danger, NORMAL: C.success, LOW: C.accent };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Stations" value="7" icon={<Gauge size={20} />} accentColor={C.accent} />
        <StatCard title="Avg Utilization" value="80.8%" icon={<TrendingUp size={20} />} accentColor={C.success} />
        <StatCard title="High Utilization" value="4" icon={<AlertTriangle size={20} />} accentColor={C.danger} />
        <StatCard title="Available Capacity" value="162 hrs" icon={<Clock size={20} />} accentColor={C.purple} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["Production Line", "Machine/Station", "Capacity (hrs/wk)", "Scheduled (hrs)", "Utilization", "Load Status"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {capacityData.map((c, i) => (
                <tr key={i} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={tdStyle}>{c.line}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{c.machine}</td>
                  <td style={{ ...tdStyle, ...mono, textAlign: "center" }}>{c.capacity}</td>
                  <td style={{ ...tdStyle, ...mono, textAlign: "center", fontWeight: 600 }}>{c.scheduled}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <ProgressBar value={c.utilization} color={c.utilization >= 90 ? C.danger : c.utilization >= 70 ? C.warning : C.success} />
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: (statusColors[c.status] || C.accent) + "18", color: statusColors[c.status] || C.accent, border: `1px solid ${(statusColors[c.status] || C.accent)}30` }}>{c.status}</span>
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

export default function Planning() {
  const [activeTab, setActiveTab] = useState("production");
  const tabContent: Record<string, ReactNode> = {
    production: <ProductionPlanTab />, master: <MasterPlanTab />, capacity: <CapacityPlanningTab />,
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
