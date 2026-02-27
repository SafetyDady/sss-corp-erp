/*
 * SSS Corp ERP — AppLayout
 * Design: Industrial Control Room
 * Layout: Sidebar (210px / 56px collapsed) + Header (48px) + Content
 * Icons: Lucide only | Language: EN menu + TH labels
 *
 * Sidebar changes:
 *   - "ME" replaces old "ของฉัน" sub-items (My Tasks, Timesheet, Leave, Daily Report → tabs inside ME page)
 *   - "Supply Chain" replaces Inventory, Warehouse, Tools (→ tabs inside Supply Chain page)
 */

import { useState, type ReactNode } from "react";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  DollarSign,
  BarChart3,
  Users,
  Database,
  Settings,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
  User,
  Search,
  Link2,
  CalendarCheck,
} from "lucide-react";

interface MenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  path: string;
  section?: string;
}

const menuItems: MenuItem[] = [
  /* ── ME section ── */
  { key: "me", label: "ME", icon: <User size={18} />, path: "/me", section: "me" },

  /* ── System section ── */
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} />, path: "/", section: "system" },
  { key: "supply-chain", label: "Supply Chain", icon: <Link2 size={18} />, path: "/supply-chain", section: "system" },
  { key: "work-orders", label: "Work Orders", icon: <FileText size={18} />, path: "/work-orders", section: "system" },
  { key: "purchasing", label: "Purchasing", icon: <ShoppingCart size={18} />, path: "/purchasing", section: "system" },
  { key: "sales", label: "Sales", icon: <DollarSign size={18} />, path: "/sales", section: "system" },
  { key: "finance", label: "Finance", icon: <BarChart3 size={18} />, path: "/finance", section: "system" },
  { key: "hr", label: "HR", icon: <Users size={18} />, path: "/hr", section: "system" },
  { key: "customers", label: "Customers", icon: <UserCheck size={18} />, path: "/customers", section: "system" },
  { key: "planning", label: "Planning", icon: <CalendarCheck size={18} />, path: "/planning", section: "system" },
  { key: "master-data", label: "Master Data", icon: <Database size={18} />, path: "/master-data", section: "system" },
  { key: "admin", label: "Admin", icon: <Settings size={18} />, path: "/admin", section: "system" },
];

const breadcrumbMap: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "ภาพรวมระบบ" },
  "/me": { title: "ME", subtitle: "ข้อมูลส่วนตัวและงานของฉัน" },
  "/supply-chain": { title: "Supply Chain", subtitle: "คลังสินค้า วัตถุดิบ และเครื่องมือ" },
  "/work-orders": { title: "Work Orders", subtitle: "จัดการใบสั่งงานและต้นทุน" },
  "/purchasing": { title: "Purchasing", subtitle: "จัดการการจัดซื้อ" },
  "/sales": { title: "Sales", subtitle: "จัดการการขาย" },
  "/finance": { title: "Finance", subtitle: "จัดการบัญชีและการเงิน" },
  "/hr": { title: "HR", subtitle: "จัดการทรัพยากรบุคคล" },
  "/customers": { title: "Customers", subtitle: "จัดการลูกค้า" },
  "/planning": { title: "Planning", subtitle: "วางแผนการผลิต" },
  "/master-data": { title: "Master Data", subtitle: "จัดการข้อมูลหลัก" },
  "/admin": { title: "Admin", subtitle: "ตั้งค่าระบบ" },
};

const sectionLabels: Record<string, string> = {
  me: "ME",
  system: "SYSTEM",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();

  const currentPage = breadcrumbMap[location] || { title: "Page", subtitle: "" };
  const sidebarWidth = collapsed ? 56 : 210;

  // Group items by section
  const sections = ["me", "system"];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0a0a0f" }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col shrink-0 transition-all duration-200 ease-out"
        style={{
          width: sidebarWidth,
          background: "#0d0d14",
          borderRight: "1px solid #1a1a26",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 shrink-0"
          style={{
            height: 48,
            padding: collapsed ? "0 12px" : "0 16px",
            borderBottom: "1px solid #1a1a26",
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 28,
              height: 28,
              background: "#06b6d4",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 13,
              color: "#0a0a0f",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            S
          </div>
          {!collapsed && (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: "#e2e8f0",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
              }}
            >
              SSS Corp ERP
            </span>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "none" }}>
          {sections.map((section) => {
            const sectionItems = menuItems.filter((m) => m.section === section);
            if (sectionItems.length === 0) return null;

            return (
              <div key={section}>
                {/* Section label */}
                {!collapsed && (
                  <div
                    style={{
                      padding: "12px 16px 4px",
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#4a5568",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {sectionLabels[section]}
                  </div>
                )}
                {collapsed && section !== "me" && (
                  <div style={{ margin: "6px 12px", borderTop: "1px solid #1a1a26" }} />
                )}

                {sectionItems.map((item) => {
                  const isActive = location === item.path;
                  return (
                    <Link key={item.key} href={item.path}>
                      <div
                        className="flex items-center gap-3 mx-1.5 rounded-md transition-colors duration-150"
                        style={{
                          padding: collapsed ? "8px 0" : "8px 12px",
                          justifyContent: collapsed ? "center" : "flex-start",
                          background: isActive ? "#06b6d418" : "transparent",
                          color: isActive ? "#06b6d4" : "#94a3b8",
                          fontSize: 13,
                          fontWeight: isActive ? 500 : 400,
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "#1a1a26";
                            e.currentTarget.style.color = "#e2e8f0";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "#94a3b8";
                          }
                        }}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        {!collapsed && <span>{item.label}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle + User */}
        <div style={{ borderTop: "1px solid #1a1a26" }}>
          {/* User */}
          <div
            className="flex items-center gap-2"
            style={{
              padding: collapsed ? "10px 0" : "10px 16px",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#1a1a24",
                border: "1px solid #2a2a3a",
              }}
            >
              <User size={14} style={{ color: "#94a3b8" }} />
            </div>
            {!collapsed && (
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", whiteSpace: "nowrap" }}>
                  Admin User
                </div>
                <div style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>
                  admin@sss-corp.com
                </div>
              </div>
            )}
          </div>

          {/* Collapse button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full transition-colors duration-150"
            style={{
              height: 36,
              color: "#64748b",
              background: "transparent",
              border: "none",
              borderTop: "1px solid #1a1a26",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#e2e8f0";
              e.currentTarget.style.background = "#1a1a26";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#64748b";
              e.currentTarget.style.background = "transparent";
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center justify-between shrink-0 px-6"
          style={{
            height: 48,
            background: "#111118",
            borderBottom: "1px solid #2a2a3a",
          }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
              {currentPage.title}
            </span>
            {currentPage.subtitle && (
              <>
                <span style={{ color: "#2a2a3a" }}>/</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {currentPage.subtitle}
                </span>
              </>
            )}
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-1">
            <button
              className="flex items-center justify-center rounded-md transition-colors duration-150"
              style={{
                width: 32,
                height: 32,
                color: "#94a3b8",
                background: "transparent",
                border: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1a1a24";
                e.currentTarget.style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              <Search size={16} />
            </button>
            <button
              className="flex items-center justify-center rounded-md transition-colors duration-150 relative"
              style={{
                width: 32,
                height: 32,
                color: "#94a3b8",
                background: "transparent",
                border: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1a1a24";
                e.currentTarget.style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              <Bell size={16} />
              <span
                className="absolute"
                style={{
                  top: 6,
                  right: 6,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#ef4444",
                }}
              />
            </button>
            <button
              className="flex items-center justify-center rounded-md transition-colors duration-150"
              style={{
                width: 32,
                height: 32,
                color: "#94a3b8",
                background: "transparent",
                border: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1a1a24";
                e.currentTarget.style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ padding: 24 }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
