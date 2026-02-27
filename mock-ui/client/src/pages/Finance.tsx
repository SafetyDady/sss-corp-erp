/*
 * SSS Corp ERP — Finance Page
 * Design: Industrial Control Room
 * Tabs: General Ledger, Accounts Payable, Accounts Receivable, Cost Center, Cost Element
 * Note: Cost Center, Cost Element in English per user request
 */

import { useState, type ReactNode } from "react";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  CreditCard,
  Wallet,
  Search,
  Filter,
  Download,
  Eye,
  Layers,
  Target,
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
  { key: "gl", label: "General Ledger", icon: <BarChart3 size={15} /> },
  { key: "ap", label: "Accounts Payable", icon: <CreditCard size={15} /> },
  { key: "ar", label: "Accounts Receivable", icon: <Wallet size={15} /> },
  { key: "costCenter", label: "Cost Center", icon: <Target size={15} /> },
  { key: "costElement", label: "Cost Element", icon: <Layers size={15} /> },
];

const glEntries = [
  { id: "JV-2026-0234", date: "2026-02-27", desc: "Purchase Raw Materials - Thai Steel", account: "1200 - Inventory", debit: "฿245,000", credit: "—", type: "Purchase" },
  { id: "JV-2026-0233", date: "2026-02-27", desc: "Sales Revenue - ABC Manufacturing", account: "4100 - Sales Revenue", debit: "—", credit: "฿890,000", type: "Sales" },
  { id: "JV-2026-0232", date: "2026-02-26", desc: "Payroll - February 2026", account: "5100 - Salary Expense", debit: "฿1,850,000", credit: "—", type: "Payroll" },
  { id: "JV-2026-0231", date: "2026-02-26", desc: "Utility Payment - Electric", account: "5200 - Utility Expense", debit: "฿125,000", credit: "—", type: "Expense" },
  { id: "JV-2026-0230", date: "2026-02-25", desc: "Customer Payment Received", account: "1100 - Cash/Bank", debit: "฿1,250,000", credit: "—", type: "Receipt" },
  { id: "JV-2026-0229", date: "2026-02-25", desc: "Depreciation - Machinery", account: "5300 - Depreciation", debit: "฿85,000", credit: "—", type: "Adjustment" },
  { id: "JV-2026-0228", date: "2026-02-24", desc: "Supplier Payment - Siam Bolt", account: "2100 - Accounts Payable", debit: "฿42,800", credit: "—", type: "Payment" },
];

const apItems = [
  { id: "AP-2026-0089", supplier: "Thai Steel Co., Ltd.", invoice: "INV-TS-2026-045", amount: "฿567,000", due: "2026-03-15", status: "OPEN", aging: "Current" },
  { id: "AP-2026-0088", supplier: "Siam Bolt & Nut", invoice: "INV-SB-2026-112", amount: "฿42,800", due: "2026-03-01", status: "PAID", aging: "—" },
  { id: "AP-2026-0087", supplier: "Bangkok Aluminum", invoice: "INV-BA-2026-078", amount: "฿89,000", due: "2026-02-28", status: "OPEN", aging: "Current" },
  { id: "AP-2026-0086", supplier: "Eastern Chemical", invoice: "INV-EC-2026-034", amount: "฿32,400", due: "2026-02-25", status: "OVERDUE", aging: "1-30 Days" },
  { id: "AP-2026-0085", supplier: "Precision Tools Asia", invoice: "INV-PT-2026-021", amount: "฿156,000", due: "2026-02-20", status: "OVERDUE", aging: "1-30 Days" },
  { id: "AP-2026-0084", supplier: "Thai Steel Co., Ltd.", invoice: "INV-TS-2026-039", amount: "฿245,000", due: "2026-03-10", status: "OPEN", aging: "Current" },
];

const arItems = [
  { id: "AR-2026-0056", customer: "ABC Manufacturing", invoice: "INV-2026-0067", amount: "฿890,000", due: "2026-03-27", status: "OPEN", aging: "Current" },
  { id: "AR-2026-0055", customer: "XYZ Industries", invoice: "INV-2026-0066", amount: "฿1,250,000", due: "2026-03-26", status: "OPEN", aging: "Current" },
  { id: "AR-2026-0054", customer: "Thai Auto Parts", invoice: "INV-2026-0065", amount: "฿345,000", due: "2026-03-25", status: "PAID", aging: "—" },
  { id: "AR-2026-0053", customer: "Global Electronics", invoice: "INV-2026-0064", amount: "฿2,100,000", due: "2026-03-24", status: "OPEN", aging: "Current" },
  { id: "AR-2026-0052", customer: "Siam Construction", invoice: "INV-2026-0060", amount: "฿780,000", due: "2026-02-20", status: "OVERDUE", aging: "1-30 Days" },
  { id: "AR-2026-0051", customer: "Eastern Motors", invoice: "INV-2026-0058", amount: "฿450,000", due: "2026-02-15", status: "OVERDUE", aging: "31-60 Days" },
];

const costCenters = [
  { code: "CC-100", name: "Production Line 1", dept: "Manufacturing", budget: "฿2,500,000", actual: "฿1,890,000", variance: "-24.4%", varPositive: true },
  { code: "CC-200", name: "Production Line 2", dept: "Manufacturing", budget: "฿2,000,000", actual: "฿2,150,000", variance: "+7.5%", varPositive: false },
  { code: "CC-300", name: "Quality Control", dept: "QC", budget: "฿800,000", actual: "฿720,000", variance: "-10.0%", varPositive: true },
  { code: "CC-400", name: "Warehouse Operations", dept: "Logistics", budget: "฿600,000", actual: "฿580,000", variance: "-3.3%", varPositive: true },
  { code: "CC-500", name: "Sales & Marketing", dept: "Sales", budget: "฿1,200,000", actual: "฿1,350,000", variance: "+12.5%", varPositive: false },
  { code: "CC-600", name: "Administration", dept: "Admin", budget: "฿900,000", actual: "฿870,000", variance: "-3.3%", varPositive: true },
  { code: "CC-700", name: "R&D / Engineering", dept: "Engineering", budget: "฿1,500,000", actual: "฿1,420,000", variance: "-5.3%", varPositive: true },
  { code: "CC-800", name: "Maintenance", dept: "Maintenance", budget: "฿500,000", actual: "฿650,000", variance: "+30.0%", varPositive: false },
];

const costElements = [
  { code: "CE-1000", name: "Direct Material", category: "Direct Cost", group: "Material", ytd: "฿12,500,000", monthly: "฿1,890,000", pct: "35.2%" },
  { code: "CE-2000", name: "Direct Labor", category: "Direct Cost", group: "Labor", ytd: "฿8,200,000", monthly: "฿1,230,000", pct: "23.1%" },
  { code: "CE-3000", name: "Manufacturing Overhead", category: "Indirect Cost", group: "Overhead", ytd: "฿4,800,000", monthly: "฿720,000", pct: "13.5%" },
  { code: "CE-4000", name: "Depreciation", category: "Indirect Cost", group: "Overhead", ytd: "฿1,700,000", monthly: "฿255,000", pct: "4.8%" },
  { code: "CE-5000", name: "Utility & Energy", category: "Indirect Cost", group: "Overhead", ytd: "฿2,100,000", monthly: "฿315,000", pct: "5.9%" },
  { code: "CE-6000", name: "Selling Expense", category: "Operating Expense", group: "SG&A", ytd: "฿3,200,000", monthly: "฿480,000", pct: "9.0%" },
  { code: "CE-7000", name: "Administrative Expense", category: "Operating Expense", group: "SG&A", ytd: "฿2,000,000", monthly: "฿300,000", pct: "5.6%" },
  { code: "CE-8000", name: "Maintenance & Repair", category: "Indirect Cost", group: "Overhead", ytd: "฿1,000,000", monthly: "฿150,000", pct: "2.8%" },
];

function GLTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue (YTD)" value="฿35.5M" icon={<TrendingUp size={20} />} accentColor={C.success} trend={{ value: "12.3%", positive: true }} />
        <StatCard title="Total Expense (YTD)" value="฿28.2M" icon={<TrendingDown size={20} />} accentColor={C.danger} />
        <StatCard title="Net Profit (YTD)" value="฿7.3M" icon={<DollarSign size={20} />} accentColor={C.accent} trend={{ value: "8.5%", positive: true }} />
        <StatCard title="Journal Entries (MTD)" value="234" icon={<FileText size={20} />} accentColor={C.purple} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["Journal ID", "Date", "Description", "Account", "Debit", "Credit", "Type"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {glEntries.map((e) => (
                <tr key={e.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.background = C.cardHover; }} onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, ...mono }}>{e.id}</td>
                  <td style={{ ...tdStyle, color: C.textSec, ...mono }}>{e.date}</td>
                  <td style={{ ...tdStyle, maxWidth: 250 }}>{e.desc}</td>
                  <td style={{ ...tdStyle, ...mono, fontSize: 11 }}>{e.account}</td>
                  <td style={{ ...tdStyle, ...mono, fontWeight: 600, color: e.debit !== "—" ? C.danger : C.textMuted }}>{e.debit}</td>
                  <td style={{ ...tdStyle, ...mono, fontWeight: 600, color: e.credit !== "—" ? C.success : C.textMuted }}>{e.credit}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: C.accent + "18", color: C.accent, border: `1px solid ${C.accent}30` }}>{e.type}</span>
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

function APTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="AP Outstanding" value="฿1.13M" icon={<CreditCard size={20} />} accentColor={C.danger} />
        <StatCard title="Current" value="฿901K" icon={<FileText size={20} />} accentColor={C.accent} />
        <StatCard title="Overdue" value="฿188K" icon={<TrendingDown size={20} />} accentColor={C.warning} />
        <StatCard title="Paid (MTD)" value="฿2.4M" icon={<DollarSign size={20} />} accentColor={C.success} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["AP ID", "Supplier", "Invoice No.", "Amount", "Due Date", "Status", "Aging"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {apItems.map((a) => (
                <tr key={a.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, ...mono }}>{a.id}</td>
                  <td style={tdStyle}>{a.supplier}</td>
                  <td style={{ ...tdStyle, ...mono, fontSize: 11 }}>{a.invoice}</td>
                  <td style={{ ...tdStyle, ...mono, fontWeight: 600 }}>{a.amount}</td>
                  <td style={{ ...tdStyle, ...mono, color: C.textSec }}>{a.due}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={a.status} /></td>
                  <td style={{ ...tdStyle, color: a.aging === "—" ? C.textMuted : a.aging === "Current" ? C.success : C.warning }}>{a.aging}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ARTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="AR Outstanding" value="฿5.82M" icon={<Wallet size={20} />} accentColor={C.accent} />
        <StatCard title="Current" value="฿4.59M" icon={<FileText size={20} />} accentColor={C.success} />
        <StatCard title="Overdue" value="฿1.23M" icon={<TrendingDown size={20} />} accentColor={C.danger} />
        <StatCard title="Collected (MTD)" value="฿3.8M" icon={<DollarSign size={20} />} accentColor={C.success} trend={{ value: "15.2%", positive: true }} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["AR ID", "Customer", "Invoice No.", "Amount", "Due Date", "Status", "Aging"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {arItems.map((a) => (
                <tr key={a.id} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, ...mono }}>{a.id}</td>
                  <td style={tdStyle}>{a.customer}</td>
                  <td style={{ ...tdStyle, ...mono, fontSize: 11 }}>{a.invoice}</td>
                  <td style={{ ...tdStyle, ...mono, fontWeight: 600 }}>{a.amount}</td>
                  <td style={{ ...tdStyle, ...mono, color: C.textSec }}>{a.due}</td>
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={a.status} /></td>
                  <td style={{ ...tdStyle, color: a.aging === "—" ? C.textMuted : a.aging === "Current" ? C.success : a.aging.includes("31") ? C.danger : C.warning }}>{a.aging}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CostCenterTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Cost Centers" value="8" icon={<Target size={20} />} accentColor={C.accent} />
        <StatCard title="Total Budget (YTD)" value="฿10.0M" icon={<DollarSign size={20} />} accentColor={C.purple} />
        <StatCard title="Total Actual (YTD)" value="฿9.63M" icon={<TrendingUp size={20} />} accentColor={C.success} />
        <StatCard title="Over Budget" value="3" icon={<TrendingDown size={20} />} accentColor={C.danger} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["Code", "Cost Center Name", "Department", "Budget (YTD)", "Actual (YTD)", "Variance", "Status"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {costCenters.map((cc) => (
                <tr key={cc.code} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, ...mono }}>{cc.code}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{cc.name}</td>
                  <td style={tdStyle}>{cc.dept}</td>
                  <td style={{ ...tdStyle, ...mono }}>{cc.budget}</td>
                  <td style={{ ...tdStyle, ...mono, fontWeight: 600 }}>{cc.actual}</td>
                  <td style={{ ...tdStyle, ...mono, fontWeight: 600, color: cc.varPositive ? C.success : C.danger }}>{cc.variance}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: (cc.varPositive ? C.success : C.danger) + "18", color: cc.varPositive ? C.success : C.danger, border: `1px solid ${cc.varPositive ? C.success : C.danger}30` }}>
                      {cc.varPositive ? "UNDER BUDGET" : "OVER BUDGET"}
                    </span>
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

function CostElementTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Cost Elements" value="8" icon={<Layers size={20} />} accentColor={C.accent} />
        <StatCard title="Direct Cost (YTD)" value="฿20.7M" icon={<DollarSign size={20} />} accentColor={C.success} />
        <StatCard title="Indirect Cost (YTD)" value="฿9.6M" icon={<DollarSign size={20} />} accentColor={C.warning} />
        <StatCard title="SG&A (YTD)" value="฿5.2M" icon={<DollarSign size={20} />} accentColor={C.purple} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              {["Code", "Cost Element Name", "Category", "Group", "YTD Amount", "Monthly Avg", "% of Total"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {costElements.map((ce) => {
                const catColors: Record<string, string> = { "Direct Cost": C.success, "Indirect Cost": C.warning, "Operating Expense": C.purple };
                return (
                  <tr key={ce.code} className="transition-colors duration-100" style={{ borderBottom: `1px solid ${C.borderLight}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ ...tdStyle, color: C.accent, fontWeight: 500, ...mono }}>{ce.code}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{ce.name}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: (catColors[ce.category] || C.accent) + "18", color: catColors[ce.category] || C.accent, border: `1px solid ${(catColors[ce.category] || C.accent)}30` }}>{ce.category}</span>
                    </td>
                    <td style={{ ...tdStyle, color: C.textSec }}>{ce.group}</td>
                    <td style={{ ...tdStyle, ...mono, fontWeight: 600 }}>{ce.ytd}</td>
                    <td style={{ ...tdStyle, ...mono }}>{ce.monthly}</td>
                    <td style={{ ...tdStyle, ...mono }}>{ce.pct}</td>
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

export default function Finance() {
  const [activeTab, setActiveTab] = useState("gl");
  const tabContent: Record<string, ReactNode> = {
    gl: <GLTab />, ap: <APTab />, ar: <ARTab />, costCenter: <CostCenterTab />, costElement: <CostElementTab />,
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
