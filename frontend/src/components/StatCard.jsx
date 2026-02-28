import { COLORS } from '../utils/constants';

/**
 * Reusable stat card with left accent border (Mock UI design pattern).
 * Props:
 *   title     — Label (small uppercase)
 *   value     — Main number/text (large)
 *   subtitle  — Optional description below value
 *   icon      — Lucide icon element (size={20})
 *   color     — Accent color for left border + icon bg (defaults to COLORS.accent)
 *   trend     — Optional { value: string, positive: boolean }
 */
export default function StatCard({ title, value, subtitle, icon, color, trend }) {
  const accent = color || COLORS.accent;

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8,
        padding: '16px 20px',
        transition: 'background 0.15s',
        cursor: 'default',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.cardHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.card; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 500,
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 6,
          }}>
            {title}
          </div>
          <div style={{
            fontSize: 26,
            fontWeight: 700,
            color: COLORS.text,
            lineHeight: 1.1,
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {value}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
              {subtitle}
            </div>
          )}
          {trend && (
            <div style={{
              fontSize: 11,
              fontWeight: 500,
              color: trend.positive ? COLORS.success : COLORS.danger,
              marginTop: 4,
            }}>
              {trend.positive ? '+' : ''}{trend.value}
            </div>
          )}
        </div>
        {icon && (
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `${accent}15`,
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
