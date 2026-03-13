import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, CalendarOff, CalendarCheck, User } from 'lucide-react';
import { COLORS } from '../utils/constants';

const NAV_ITEMS = [
  { key: '/m', icon: Home, label: 'หน้าแรก' },
  { key: '/m/report', icon: FileText, label: 'รายงาน' },
  { key: '/m/leave', icon: CalendarOff, label: 'ลางาน' },
  { key: '/m/tasks', icon: CalendarCheck, label: 'งาน' },
  { key: '/m/me', icon: User, label: 'โปรไฟล์' },
];

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = NAV_ITEMS.find((item) => location.pathname === item.key)?.key
    || NAV_ITEMS.find((item) => item.key !== '/m' && location.pathname.startsWith(item.key))?.key
    || '/m';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1000,
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeKey === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              flex: 1,
              height: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              color: isActive ? COLORS.accent : COLORS.textMuted,
              transition: 'color 0.2s',
              minWidth: 0,
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
