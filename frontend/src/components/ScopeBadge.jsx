import { Eye } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import { COLORS } from '../utils/constants';

const SCOPE_CONFIG = {
  staff:      { label: 'ข้อมูลของฉัน',     color: COLORS.accent },
  viewer:     { label: 'ข้อมูลของฉัน',     color: COLORS.accent },
  supervisor: { label: null,                 color: COLORS.purple },
  manager:    { label: 'ทั้งองค์กร',        color: COLORS.success },
  owner:      { label: 'ทั้งองค์กร',        color: COLORS.success },
};

export default function ScopeBadge({ style }) {
  const role = useAuthStore((s) => s.user?.role);
  const departmentName = useAuthStore((s) => s.departmentName);

  if (!role) return null;

  const config = SCOPE_CONFIG[role] || SCOPE_CONFIG.staff;
  let label = config.label;
  if (role === 'supervisor') {
    label = departmentName ? `แผนก: ${departmentName}` : 'แผนกของฉัน';
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: `${config.color}18`,
      color: config.color,
      padding: '3px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.3,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      <Eye size={12} />
      {label}
    </span>
  );
}
