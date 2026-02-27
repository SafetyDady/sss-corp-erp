/*
 * SSS Corp ERP — Inventory Page
 * Design: Industrial Control Room
 * Language: EN title + TH labels/actions
 * Features: Search, Filter, Table, Pagination, Add button
 */

import { useState } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";

const WAREHOUSE_IMG = "https://private-us-east-1.manuscdn.com/sessionFile/iHfJ4jbc59CC0DZ1b45uGT/sandbox/dfMAQ8k9MijE73lJyR15q0-img-2_1772092714000_na1fn_ZXJwLXdhcmVob3VzZS1iZw.jpg?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvaUhmSjRqYmM1OUNDMERaMWI0NXVHVC9zYW5kYm94L2RmTUFROGs5TWlqRTczbEp5UjE1cTAtaW1nLTJfMTc3MjA5MjcxNDAwMF9uYTFmbl9aWEp3TFhkaGNtVm9iM1Z6WlMxaVp3LmpwZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=AQwvAHiNFaGpFBGg2QLVMa7f~K-jkDEid94VnwQsGuatvWTL8Fe268oMLt~wi6BOX7h4vz~7uRZ0~A~A7wQvHyCrs5s7eHCgVGw6WDoFqKZ~vIDHwezUTbNDhu1e7CmSSdqaNPDNGPv90NojCz8LZ~86sUITXmhYfsN~YPgeVTgoyqae9PQ24QyPE8TsecDFZD0-XVCxpoeJg2GsIutCnghd2u-s4eYJNjTr6Uv2vjV-LQeJ03cdIPMI85CL3zqSV9DZNPzBruiJZzmNgIpIBAx016xZ2U6YyRXIE5UW0hXbPWgIhPvswfijOI2pNu4A-sn7z4OyJ5yLs38HuxC4PA__";

const inventoryData = [
  { id: "MTL-001", name: "เหล็กแผ่น SS400", category: "วัตถุดิบ", qty: 450, unit: "แผ่น", cost: "฿125.00", location: "WH-A01", status: "NORMAL" },
  { id: "MTL-002", name: "สลักเกลียว M10x40", category: "วัตถุดิบ", qty: 12500, unit: "ตัว", cost: "฿2.50", location: "WH-A02", status: "NORMAL" },
  { id: "MTL-003", name: "ท่อเหล็ก 2 นิ้ว", category: "วัตถุดิบ", qty: 85, unit: "เส้น", cost: "฿350.00", location: "WH-B01", status: "NORMAL" },
  { id: "MTL-012", name: "แผ่นอลูมิเนียม 6061", category: "วัตถุดิบ", qty: 8, unit: "แผ่น", cost: "฿890.00", location: "WH-A01", status: "LOW" },
  { id: "FG-001", name: "Bracket Assembly A", category: "สินค้าสำเร็จรูป", qty: 230, unit: "ชิ้น", cost: "฿450.00", location: "WH-C01", status: "NORMAL" },
  { id: "FG-002", name: "Housing Unit B", category: "สินค้าสำเร็จรูป", qty: 45, unit: "ชิ้น", cost: "฿1,200.00", location: "WH-C02", status: "LOW" },
  { id: "SP-001", name: "Bearing 6205-2RS", category: "อะไหล่", qty: 320, unit: "ตัว", cost: "฿85.00", location: "WH-D01", status: "NORMAL" },
  { id: "SP-002", name: "สายพาน V-Belt A68", category: "อะไหล่", qty: 25, unit: "เส้น", cost: "฿180.00", location: "WH-D01", status: "NORMAL" },
  { id: "MTL-045", name: "น้ำมันหล่อเย็น CNC", category: "วัสดุสิ้นเปลือง", qty: 120, unit: "ลิตร", cost: "฿45.00", location: "WH-E01", status: "NORMAL" },
  { id: "MTL-046", name: "ดอกสว่าน HSS 8mm", category: "วัสดุสิ้นเปลือง", qty: 3, unit: "ตัว", cost: "฿65.00", location: "WH-E02", status: "LOW" },
];

const columns = ["รหัสสินค้า", "ชื่อสินค้า", "ประเภท", "คงเหลือ", "หน่วย", "ต้นทุน/หน่วย", "ตำแหน่ง", "สถานะ", "จัดการ"];

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = inventoryData.filter(
    (item) =>
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header with background */}
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          height: 120,
          background: `linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(10,10,15,0.95) 50%), url(${WAREHOUSE_IMG})`,
          backgroundSize: "cover",
          backgroundPosition: "center 40%",
          border: "1px solid #2a2a3a",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-between px-6">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>
              Inventory
            </h2>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>
              จัดการสินค้าและวัตถุดิบ
            </p>
          </div>
          <button
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
            เพิ่มสินค้า
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="สินค้าทั้งหมด"
          value="1,247"
          icon={<Package size={20} />}
          accentColor="#06b6d4"
        />
        <StatCard
          title="ต่ำกว่า Safety Stock"
          value="18"
          icon={<Package size={20} />}
          accentColor="#ef4444"
        />
        <StatCard
          title="รับเข้าวันนี้"
          value="12"
          icon={<Package size={20} />}
          accentColor="#10b981"
        />
        <StatCard
          title="มูลค่าคงเหลือ"
          value="฿4.2M"
          icon={<Package size={20} />}
          accentColor="#f59e0b"
        />
      </div>

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
        {/* Search */}
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
            placeholder="ค้นหาสินค้า..."
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

        {/* Filter buttons */}
        {[
          { icon: <Filter size={14} />, label: "ตัวกรอง" },
          { icon: <Download size={14} />, label: "ส่งออก" },
          { icon: <RefreshCw size={14} />, label: "รีเฟรช" },
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
                {columns.map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "10px 16px",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
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
                    {item.id}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#e2e8f0" }}>
                    {item.name}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
                    {item.category}
                  </td>
                  <td
                    style={{
                      padding: "10px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: item.status === "LOW" ? "#ef4444" : "#e2e8f0",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {item.qty.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
                    {item.unit}
                  </td>
                  <td
                    style={{
                      padding: "10px 16px",
                      fontSize: 12,
                      color: "#e2e8f0",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {item.cost}
                  </td>
                  <td
                    style={{
                      padding: "10px 16px",
                      fontSize: 12,
                      color: "#94a3b8",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {item.location}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex items-center gap-1">
                      <button
                        className="flex items-center justify-center rounded transition-colors duration-150"
                        style={{
                          width: 28,
                          height: 28,
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
                      <button
                        className="flex items-center justify-center rounded transition-colors duration-150"
                        style={{
                          width: 28,
                          height: 28,
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
            {[1, 2, 3].map((p) => (
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
