import { Tabs } from 'antd';
import { CalendarDays, Package } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { usePermission } from '../../hooks/usePermission';
import DailyPlanTab from './DailyPlanTab';
import ReservationTab from './ReservationTab';
import { COLORS } from '../../utils/constants';

const tabLabel = (Icon, text) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
    <Icon size={15} /> {text}
  </span>
);

export default function PlanningPage() {
  const { can } = usePermission();

  const items = [
    can('workorder.plan.read') && {
      key: 'daily-plan',
      label: tabLabel(CalendarDays, 'แผนงานรายวัน'),
      children: <DailyPlanTab />,
    },
    can('workorder.reservation.read') && {
      key: 'reservations',
      label: tabLabel(Package, 'จองวัสดุ/เครื่องมือ'),
      children: <ReservationTab />,
    },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="Planning"
        subtitle="วางแผนงาน — แผนงานรายวัน, จองวัสดุ, จองเครื่องมือ"
      />
      {items.length > 0 ? (
        <Tabs defaultActiveKey={items[0]?.key} items={items} />
      ) : (
        <div style={{ textAlign: 'center', padding: 48, color: COLORS.textMuted }}>
          คุณไม่มีสิทธิ์เข้าถึงข้อมูล Planning
        </div>
      )}
    </div>
  );
}
