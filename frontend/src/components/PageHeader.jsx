import { COLORS } from '../utils/constants';
import useBreakpoint from '../hooks/useBreakpoint';

export default function PageHeader({ title, subtitle, actions }) {
  const { isMobile } = useBreakpoint();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        marginBottom: isMobile ? 16 : 24,
        gap: isMobile ? 8 : 0,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 600, color: COLORS.text }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: COLORS.textSecondary }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
