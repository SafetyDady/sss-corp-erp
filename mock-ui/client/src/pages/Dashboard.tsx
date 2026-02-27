/*
 * SSS Corp ERP — Dashboard Page
 * Design: Industrial Control Room
 * Language: EN titles + TH subtitles
 */

import {
  Package,
  FileText,
  Users,
  DollarSign,
  ShoppingCart,
  Wrench,
  TrendingUp,
  AlertTriangle,
  Clock,
  Check,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";

const HERO_IMG = "https://private-us-east-1.manuscdn.com/sessionFile/iHfJ4jbc59CC0DZ1b45uGT/sandbox/dfMAQ8k9MijE73lJyR15q0-img-1_1772092696000_na1fn_ZXJwLWRhc2hib2FyZC1oZXJv.jpg?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvaUhmSjRqYmM1OUNDMERaMWI0NXVHVC9zYW5kYm94L2RmTUFROGs5TWlqRTczbEp5UjE1cTAtaW1nLTFfMTc3MjA5MjY5NjAwMF9uYTFmbl9aWEp3TFdSaGMyaGliMkZ5WkMxb1pYSnYuanBnP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=tAcHGvLJeDX7qXcNN-MV76dQVERM0NE2Mcml76B9naHsBYYPl3pZmbNHouOW7xKx747qhe2xgp-lhMx2oWtkUlSsqNVoh9Hm2IJWDWzINI9V2xUSGsEX13JMdL7OqM88Au3LGpcwQCQvr91N0doEt3BijSGdrqkS-EN7ij4rOIBKbF~S0q7HWAdiN7hTg3AFURmuEfS8wWE4LVj2fRCvP7NTWRxQVB2NHLpw60ANtqmV3048Wdsub-HwLwZvtzixar0HfyQGH0YsqfaK9DnO6cBumuZqP5xEyXM0ubhERS3Qa~bfK~Z4OuQ8ZPcn6AWxMZGVJgTxAfgyR3BQ1o5mzg__";

const recentActivities = [
  { id: "WO-2026-0043", type: "Work Order", desc: "ซ่อมบำรุงเครื่อง CNC-04", status: "OPEN", time: "10 นาทีที่แล้ว", user: "สมชาย ว." },
  { id: "PO-2026-0128", type: "Purchase Order", desc: "สั่งซื้อวัตถุดิบ Lot #78", status: "PENDING", time: "25 นาทีที่แล้ว", user: "วิภา ส." },
  { id: "INV-2026-0891", type: "Inventory", desc: "รับเข้าสินค้า MTL-045", status: "APPROVED", time: "1 ชั่วโมงที่แล้ว", user: "ธนา ก." },
  { id: "WO-2026-0042", type: "Work Order", desc: "ผลิตชิ้นส่วน Bracket-A", status: "DRAFT", time: "2 ชั่วโมงที่แล้ว", user: "สุนิสา พ." },
  { id: "TS-2026-0215", type: "Timesheet", desc: "บันทึกเวลาทำงานประจำวัน", status: "LOCKED", time: "3 ชั่วโมงที่แล้ว", user: "อนุชา ร." },
  { id: "SO-2026-0067", type: "Sales Order", desc: "ส่งมอบสินค้า Order #67", status: "FINAL", time: "5 ชั่วโมงที่แล้ว", user: "ปิยะ จ." },
];

const alerts = [
  { msg: "สินค้า MTL-012 ต่ำกว่า Safety Stock", level: "danger" },
  { msg: "Work Order WO-2026-0039 เลยกำหนดส่ง", level: "danger" },
  { msg: "รอ Approve ใบสั่งซื้อ 3 รายการ", level: "warning" },
  { msg: "Timesheet ยังไม่ส่ง 5 คน", level: "warning" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          height: 160,
          background: `linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(10,10,15,0.95) 60%), url(${HERO_IMG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          border: "1px solid #2a2a3a",
        }}
      >
        <div className="absolute inset-0 flex items-center px-8">
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#e2e8f0",
                marginBottom: 4,
              }}
            >
              SSS Corp ERP
            </h1>
            <p style={{ fontSize: 13, color: "#94a3b8", maxWidth: 400 }}>
              ระบบบริหารจัดการทรัพยากรองค์กร — ข้อมูล ณ วันที่ 26 กุมภาพันธ์ 2569
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="สินค้าคงเหลือ"
          value="1,247"
          subtitle="รายการ"
          icon={<Package size={20} />}
          accentColor="#06b6d4"
          trend={{ value: "12 รายการใหม่", positive: true }}
        />
        <StatCard
          title="ใบสั่งงานเปิด"
          value="23"
          subtitle="Work Orders"
          icon={<FileText size={20} />}
          accentColor="#10b981"
          trend={{ value: "3 เสร็จวันนี้", positive: true }}
        />
        <StatCard
          title="ยอดขายเดือนนี้"
          value="฿2.4M"
          subtitle="เป้า ฿3.0M"
          icon={<DollarSign size={20} />}
          accentColor="#f59e0b"
          trend={{ value: "18.5%", positive: true }}
        />
        <StatCard
          title="พนักงาน"
          value="156"
          subtitle="Active"
          icon={<Users size={20} />}
          accentColor="#8b5cf6"
          trend={{ value: "2 ลาวันนี้", positive: false }}
        />
      </div>

      {/* Two-column: Recent Activity + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity Table */}
        <div
          className="lg:col-span-2 rounded-lg overflow-hidden"
          style={{
            background: "#16161f",
            border: "1px solid #2a2a3a",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid #22222f" }}
          >
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                Recent Activity
              </h3>
              <p style={{ fontSize: 11, color: "#64748b" }}>กิจกรรมล่าสุดในระบบ</p>
            </div>
            <button
              className="flex items-center gap-1.5 rounded-md transition-colors duration-150"
              style={{
                padding: "5px 12px",
                fontSize: 12,
                color: "#06b6d4",
                background: "#06b6d415",
                border: "1px solid #06b6d430",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#06b6d425";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#06b6d415";
              }}
            >
              <Clock size={12} />
              ดูทั้งหมด
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #22222f" }}>
                {["รหัส", "ประเภท", "รายละเอียด", "สถานะ", "เวลา", "ผู้ดำเนินการ"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 16px",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      textAlign: "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentActivities.map((a) => (
                <tr
                  key={a.id}
                  className="transition-colors duration-100"
                  style={{ borderBottom: "1px solid #22222f" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#1a1a24";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td
                    style={{
                      padding: "10px 16px",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#06b6d4",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {a.id}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
                    {a.type}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#e2e8f0" }}>
                    {a.desc}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge status={a.status} />
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 11, color: "#64748b" }}>
                    {a.time}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
                    {a.user}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Alerts Panel */}
        <div
          className="rounded-lg overflow-hidden"
          style={{
            background: "#16161f",
            border: "1px solid #2a2a3a",
          }}
        >
          <div
            className="flex items-center gap-2 px-5 py-3"
            style={{ borderBottom: "1px solid #22222f" }}
          >
            <AlertTriangle size={14} style={{ color: "#f59e0b" }} />
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                Alerts
              </h3>
              <p style={{ fontSize: 11, color: "#64748b" }}>การแจ้งเตือนที่ต้องดำเนินการ</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-md p-3 transition-colors duration-150"
                style={{
                  background: alert.level === "danger" ? "#ef444410" : "#f59e0b10",
                  border: `1px solid ${alert.level === "danger" ? "#ef444425" : "#f59e0b25"}`,
                }}
              >
                <AlertTriangle
                  size={14}
                  className="shrink-0 mt-0.5"
                  style={{ color: alert.level === "danger" ? "#ef4444" : "#f59e0b" }}
                />
                <span style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.5 }}>
                  {alert.msg}
                </span>
              </div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="px-4 pb-4 space-y-2">
            <div
              style={{
                borderTop: "1px solid #22222f",
                paddingTop: 12,
                marginTop: 4,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                สรุปวันนี้
              </div>
              {[
                { label: "สั่งซื้อรออนุมัติ", value: "3", icon: <ShoppingCart size={12} />, color: "#f59e0b" },
                { label: "เครื่องมือถูกยืม", value: "12", icon: <Wrench size={12} />, color: "#06b6d4" },
                { label: "ยอดผลิตวันนี้", value: "89 ชิ้น", icon: <TrendingUp size={12} />, color: "#10b981" },
                { label: "งานเสร็จแล้ว", value: "7/10", icon: <Check size={12} />, color: "#8b5cf6" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: item.color }}>{item.icon}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{item.label}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#e2e8f0",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
