/*
 * SSS Corp ERP — StatCard
 * Design: Left border accent color per UI Guidelines
 * Stat card icon size: 20 per Guidelines
 */

import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  accentColor: string;
  trend?: { value: string; positive: boolean };
}

export default function StatCard({ title, value, subtitle, icon, accentColor, trend }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg transition-colors duration-150"
      style={{
        background: "#16161f",
        border: "1px solid #2a2a3a",
        padding: "16px 20px",
        borderLeft: `3px solid ${accentColor}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#1e1e2a";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#16161f";
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 6,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#e2e8f0",
              lineHeight: 1.1,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {value}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              {subtitle}
            </div>
          )}
          {trend && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: trend.positive ? "#10b981" : "#ef4444",
                marginTop: 4,
              }}
            >
              {trend.positive ? "+" : ""}{trend.value}
            </div>
          )}
        </div>
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: accentColor + "15",
            color: accentColor,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
