/*
 * SSS Corp ERP — StatusBadge (Reusable)
 * Implements review suggestion: Badge as reusable component instead of inline styles
 * Colors from UI_GUIDELINES.md Badge / Status Colors
 */

const statusColors: Record<string, string> = {
  DRAFT: "#f59e0b",
  OPEN: "#10b981",
  CLOSED: "#64748b",
  APPROVED: "#10b981",
  PENDING: "#f59e0b",
  FINAL: "#8b5cf6",
  LOCKED: "#64748b",
  REJECTED: "#ef4444",
  "CHECKED-OUT": "#f59e0b",
  AVAILABLE: "#10b981",
  ACTIVE: "#06b6d4",
  INACTIVE: "#64748b",
  LOW: "#ef4444",
  NORMAL: "#10b981",
  HIGH: "#f59e0b",
};

interface StatusBadgeProps {
  status: string;
  color?: string;
}

export default function StatusBadge({ status, color }: StatusBadgeProps) {
  const c = color || statusColors[status.toUpperCase()] || "#64748b";

  return (
    <span
      style={{
        background: c + "18",
        color: c,
        padding: "3px 10px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {status}
    </span>
  );
}
