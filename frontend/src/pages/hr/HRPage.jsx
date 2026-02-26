import { Tabs } from 'antd';
import { Users, Clock, CalendarDays, Banknote } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { usePermission } from '../../hooks/usePermission';
import EmployeeTab from './EmployeeTab';
import TimesheetTab from './TimesheetTab';
import LeaveTab from './LeaveTab';
import PayrollTab from './PayrollTab';
import { COLORS } from '../../utils/constants';

const tabLabel = (Icon, text) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
    <Icon size={15} /> {text}
  </span>
);

export default function HRPage() {
  const { can } = usePermission();

  const items = [
    can('hr.employee.read') && {
      key: 'employees',
      label: tabLabel(Users, 'พนักงาน'),
      children: <EmployeeTab />,
    },
    can('hr.timesheet.read') && {
      key: 'timesheet',
      label: tabLabel(Clock, 'Timesheet'),
      children: <TimesheetTab />,
    },
    can('hr.leave.read') && {
      key: 'leave',
      label: tabLabel(CalendarDays, 'ลาหยุด'),
      children: <LeaveTab />,
    },
    can('hr.payroll.read') && {
      key: 'payroll',
      label: tabLabel(Banknote, 'Payroll'),
      children: <PayrollTab />,
    },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="HR"
        subtitle="บริหารจัดการทรัพยากรบุคคล — พนักงาน, Timesheet, ลาหยุด, Payroll"
      />
      {items.length > 0 ? (
        <Tabs defaultActiveKey={items[0]?.key} items={items} />
      ) : (
        <div style={{ textAlign: 'center', padding: 48, color: COLORS.textMuted }}>
          คุณไม่มีสิทธิ์เข้าถึงข้อมูล HR
        </div>
      )}
    </div>
  );
}
