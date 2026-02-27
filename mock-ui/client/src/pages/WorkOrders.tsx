/*
 * SSS Corp ERP — Work Orders Page
 * Design: Industrial Control Room
 * Language: EN title + TH labels/actions
 * Features: Table, Create modal/form, Status badges, Actions
 */

import { useState } from "react";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Pencil,
  Trash2,
  Check,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";

const FACTORY_IMG = "https://private-us-east-1.manuscdn.com/sessionFile/iHfJ4jbc59CC0DZ1b45uGT/sandbox/dfMAQ8k9MijE73lJyR15q0-img-3_1772092712000_na1fn_ZXJwLWZhY3RvcnktYmc.jpg?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvaUhmSjRqYmM1OUNDMERaMWI0NXVHVC9zYW5kYm94L2RmTUFROGs5TWlqRTczbEp5UjE1cTAtaW1nLTNfMTc3MjA5MjcxMjAwMF9uYTFmbl9aWEp3TFdaaFkzUnZjbmt0WW1jLmpwZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=TNE~Dctjtbyv8E8I9IXWkVgPm1wHpZmElcrtMjjLuyqFnO~tMKClC9MUoGpAahpjzJimiCGXCKWTv33lJr9q0ULSSdOriHwbyzx9KSOWj6GgS9PtWYrGJRRAwW9iGBIT-c8Rm7COhCq06mxfGTbi2YqN8AdbYZ02aubqCeDBgta1ocT8uo0kpKjmsupUrtNWaWc6ostYsSuvbv0XmHfNYgB~K5PKelchDPFXfIUEhs2Ud42aWP3nEHrL3sOmPauyrRFgIz7lLEsdDqQEH9uLd1p91hyIuI4vwIun8i-skpPKIsueJTj8YWyjt1clkBeZVNg-sEtA6mfTAYqfIcw7QA__";

const workOrders = [
  { id: "WO-2026-0043", product: "Bracket Assembly A", qty: 100, unit: "ชิ้น", status: "OPEN", priority: "HIGH", assignee: "สมชาย ว.", startDate: "2026-02-24", dueDate: "2026-02-28", cost: "฿45,000", progress: 35 },
  { id: "WO-2026-0042", product: "Housing Unit B", qty: 50, unit: "ชิ้น", status: "DRAFT", priority: "NORMAL", assignee: "สุนิสา พ.", startDate: "2026-02-25", dueDate: "2026-03-05", cost: "฿60,000", progress: 0 },
  { id: "WO-2026-0041", product: "Shaft Component C", qty: 200, unit: "ชิ้น", status: "OPEN", priority: "HIGH", assignee: "ธนา ก.", startDate: "2026-02-20", dueDate: "2026-02-26", cost: "฿28,000", progress: 78 },
  { id: "WO-2026-0040", product: "Gear Assembly D", qty: 75, unit: "ชิ้น", status: "APPROVED", priority: "NORMAL", assignee: "วิภา ส.", startDate: "2026-02-18", dueDate: "2026-02-25", cost: "฿52,000", progress: 100 },
  { id: "WO-2026-0039", product: "Frame Structure E", qty: 30, unit: "ชิ้น", status: "REJECTED", priority: "HIGH", assignee: "อนุชา ร.", startDate: "2026-02-15", dueDate: "2026-02-22", cost: "฿95,000", progress: 45 },
  { id: "WO-2026-0038", product: "Bracket Assembly A", qty: 150, unit: "ชิ้น", status: "CLOSED", priority: "NORMAL", assignee: "ปิยะ จ.", startDate: "2026-02-10", dueDate: "2026-02-20", cost: "฿67,500", progress: 100 },
  { id: "WO-2026-0037", product: "Cover Plate F", qty: 500, unit: "ชิ้น", status: "OPEN", priority: "NORMAL", assignee: "สมชาย ว.", startDate: "2026-02-22", dueDate: "2026-03-01", cost: "฿35,000", progress: 52 },
  { id: "WO-2026-0036", product: "Pin Assembly G", qty: 1000, unit: "ชิ้น", status: "APPROVED", priority: "NORMAL", assignee: "ธนา ก.", startDate: "2026-02-12", dueDate: "2026-02-19", cost: "฿18,000", progress: 100 },
];

const priorityColors: Record<string, string> = {
  HIGH: "#ef4444",
  NORMAL: "#10b981",
  LOW: "#64748b",
};

export default function WorkOrders() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = workOrders.filter(
    (wo) =>
      wo.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.product.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          height: 120,
          background: `linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(10,10,15,0.95) 50%), url(${FACTORY_IMG})`,
          backgroundSize: "cover",
          backgroundPosition: "center 60%",
          border: "1px solid #2a2a3a",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-between px-6">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>
              Work Orders
            </h2>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>
              จัดการใบสั่งงานและต้นทุน
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-md transition-all duration-150"
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              color: "#0a0a0f",
              background: "#06b6d4",
              border: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#0891b2";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#06b6d4";
            }}
          >
            <Plus size={14} />
            สร้าง Work Order
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="ใบสั่งงานทั้งหมด"
          value="156"
          icon={<FileText size={20} />}
          accentColor="#06b6d4"
        />
        <StatCard
          title="กำลังดำเนินการ"
          value="23"
          icon={<Clock size={20} />}
          accentColor="#10b981"
        />
        <StatCard
          title="เลยกำหนดส่ง"
          value="4"
          icon={<Calendar size={20} />}
          accentColor="#ef4444"
        />
        <StatCard
          title="ต้นทุนเดือนนี้"
          value="฿1.8M"
          icon={<FileText size={20} />}
          accentColor="#f59e0b"
        />
      </div>

      {/* Create Form (toggle) */}
      {showForm && (
        <div
          className="rounded-lg overflow-hidden"
          style={{
            background: "#16161f",
            border: "1px solid #2a2a3a",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid #22222f" }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
              สร้าง Work Order ใหม่
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center justify-center rounded transition-colors duration-150"
              style={{
                width: 28,
                height: 28,
                color: "#94a3b8",
                background: "transparent",
                border: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: "สินค้า/ชิ้นงาน", placeholder: "เลือกสินค้าที่จะผลิต", type: "select" },
                { label: "จำนวน", placeholder: "ระบุจำนวนที่ต้องการผลิต", type: "number" },
                { label: "หน่วย", placeholder: "ชิ้น", type: "text" },
                { label: "ผู้รับผิดชอบ", placeholder: "เลือกผู้รับผิดชอบ", type: "select" },
                { label: "วันที่เริ่ม", placeholder: "เลือกวันที่", type: "date" },
                { label: "กำหนดส่ง", placeholder: "เลือกวันที่", type: "date" },
              ].map((field, i) => (
                <div key={i}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#94a3b8",
                      marginBottom: 6,
                    }}
                  >
                    {field.label}
                  </label>
                  <input
                    type={field.type === "select" ? "text" : field.type}
                    placeholder={field.placeholder}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: 13,
                      color: "#e2e8f0",
                      background: "#0a0a0f",
                      border: "1px solid #2a2a3a",
                      borderRadius: 6,
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#06b6d4";
                      e.currentTarget.style.boxShadow = "0 0 0 2px #06b6d420";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#2a2a3a";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              ))}
            </div>
            {/* Remarks */}
            <div className="mt-4">
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#94a3b8",
                  marginBottom: 6,
                }}
              >
                หมายเหตุ
              </label>
              <textarea
                placeholder="ระบุรายละเอียดเพิ่มเติม..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "#e2e8f0",
                  background: "#0a0a0f",
                  border: "1px solid #2a2a3a",
                  borderRadius: 6,
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#06b6d4";
                  e.currentTarget.style.boxShadow = "0 0 0 2px #06b6d420";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#2a2a3a";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
            {/* Actions */}
            <div className="flex items-center gap-3 mt-5">
              <button
                className="flex items-center gap-2 rounded-md transition-all duration-150"
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#0a0a0f",
                  background: "#06b6d4",
                  border: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#0891b2";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#06b6d4";
                }}
              >
                <Check size={14} />
                บันทึก
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex items-center gap-2 rounded-md transition-all duration-150"
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#94a3b8",
                  background: "transparent",
                  border: "1px solid #2a2a3a",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1a1a24";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter Bar */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{
          background: "#16161f",
          border: "1px solid #2a2a3a",
          borderRadius: 8,
          padding: "12px 16px",
        }}
      >
        <div
          className="flex items-center gap-2 flex-1"
          style={{
            background: "#0a0a0f",
            border: "1px solid #2a2a3a",
            borderRadius: 6,
            padding: "6px 12px",
            minWidth: 200,
          }}
        >
          <Search size={14} style={{ color: "#64748b", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="ค้นหาใบสั่งงาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#e2e8f0",
              fontSize: 13,
              width: "100%",
              fontFamily: "inherit",
            }}
          />
        </div>
        {[
          { icon: <Filter size={14} />, label: "ตัวกรอง" },
          { icon: <Download size={14} />, label: "ส่งออก" },
        ].map((btn, i) => (
          <button
            key={i}
            className="flex items-center gap-1.5 rounded-md transition-colors duration-150"
            style={{
              padding: "6px 12px",
              fontSize: 12,
              color: "#94a3b8",
              background: "transparent",
              border: "1px solid #2a2a3a",
              fontWeight: 500,
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
            {btn.icon}
            {btn.label}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "#16161f",
          border: "1px solid #2a2a3a",
        }}
      >
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #22222f" }}>
                {["รหัส WO", "สินค้า", "จำนวน", "สถานะ", "ความสำคัญ", "ผู้รับผิดชอบ", "กำหนดส่ง", "ต้นทุน", "ความคืบหน้า", "จัดการ"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((wo) => (
                <tr
                  key={wo.id}
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
                      padding: "10px 14px",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#06b6d4",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {wo.id}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#e2e8f0" }}>
                    {wo.product}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 12,
                      color: "#e2e8f0",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {wo.qty.toLocaleString()} {wo.unit}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <StatusBadge status={wo.status} />
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: priorityColors[wo.priority] || "#64748b",
                      }}
                    >
                      {wo.priority}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#94a3b8" }}>
                    {wo.assignee}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 12,
                      color: "#94a3b8",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {wo.dueDate}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 12,
                      color: "#e2e8f0",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {wo.cost}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: 60,
                          height: 4,
                          borderRadius: 2,
                          background: "#22222f",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${wo.progress}%`,
                            height: "100%",
                            borderRadius: 2,
                            background:
                              wo.progress === 100
                                ? "#10b981"
                                : wo.progress > 60
                                ? "#06b6d4"
                                : "#f59e0b",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        {wo.progress}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-1">
                      <button
                        className="flex items-center justify-center rounded transition-colors duration-150"
                        style={{
                          width: 26,
                          height: 26,
                          color: "#94a3b8",
                          background: "transparent",
                          border: "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#1a1a24";
                          e.currentTarget.style.color = "#06b6d4";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#94a3b8";
                        }}
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        className="flex items-center justify-center rounded transition-colors duration-150"
                        style={{
                          width: 26,
                          height: 26,
                          color: "#94a3b8",
                          background: "transparent",
                          border: "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#1a1a24";
                          e.currentTarget.style.color = "#06b6d4";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#94a3b8";
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      {wo.status === "DRAFT" && (
                        <button
                          className="flex items-center justify-center rounded transition-colors duration-150"
                          style={{
                            width: 26,
                            height: 26,
                            color: "#94a3b8",
                            background: "transparent",
                            border: "none",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#1a1a24";
                            e.currentTarget.style.color = "#ef4444";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "#94a3b8";
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: "1px solid #22222f" }}
        >
          <span style={{ fontSize: 12, color: "#64748b" }}>
            แสดง 1-{filtered.length} จาก {filtered.length} รายการ
          </span>
          <div className="flex items-center gap-1">
            <button
              className="flex items-center justify-center rounded transition-colors duration-150"
              style={{
                width: 28,
                height: 28,
                color: "#64748b",
                background: "transparent",
                border: "1px solid #2a2a3a",
              }}
            >
              <ChevronLeft size={14} />
            </button>
            {[1, 2].map((p) => (
              <button
                key={p}
                className="flex items-center justify-center rounded transition-colors duration-150"
                style={{
                  width: 28,
                  height: 28,
                  fontSize: 12,
                  fontWeight: p === 1 ? 600 : 400,
                  color: p === 1 ? "#06b6d4" : "#64748b",
                  background: p === 1 ? "#06b6d418" : "transparent",
                  border: p === 1 ? "1px solid #06b6d430" : "1px solid #2a2a3a",
                }}
              >
                {p}
              </button>
            ))}
            <button
              className="flex items-center justify-center rounded transition-colors duration-150"
              style={{
                width: 28,
                height: 28,
                color: "#64748b",
                background: "transparent",
                border: "1px solid #2a2a3a",
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
