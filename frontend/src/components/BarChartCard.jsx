import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { COLORS } from '../utils/constants';

const formatCompact = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
};

const formatCurrency = (v) =>
  typeof v === 'number' ? v.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : v;

const tooltipStyle = {
  backgroundColor: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  color: COLORS.text,
  fontSize: 12,
};

export default function BarChartCard({ data = [], bars = [], xKey = 'label', height = 220, isCurrency = false }) {
  if (!data.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, fontSize: 13 }}>
        ไม่มีข้อมูล
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderLight} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
        <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={isCurrency ? formatCompact : undefined} width={45} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [isCurrency ? formatCurrency(v) + ' ฿' : v, name]} />
        <Legend wrapperStyle={{ fontSize: 11, color: COLORS.textSecondary }} />
        {bars.map((b) => (
          <Bar key={b.dataKey} dataKey={b.dataKey} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={40} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
