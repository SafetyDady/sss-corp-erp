import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

export default function LineChartCard({ data = [], lines = [], xKey = 'label', height = 220 }) {
  if (!data.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, fontSize: 13 }}>
        ไม่มีข้อมูล
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderLight} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
        <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={45} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [formatCurrency(v) + ' ฿', name]} />
        <Legend wrapperStyle={{ fontSize: 11, color: COLORS.textSecondary }} />
        {lines.map((l) => (
          <Line key={l.dataKey} type="monotone" dataKey={l.dataKey} name={l.name} stroke={l.color} strokeWidth={2} dot={{ r: 3, fill: l.color }} activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
