import { COLORS } from '../utils/constants';

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: COLORS.text }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: COLORS.textSecondary }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}
