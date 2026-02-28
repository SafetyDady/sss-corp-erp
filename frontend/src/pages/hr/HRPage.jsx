import { Tabs } from 'antd';
import { Users, Clock, CalendarDays, Banknote, ClipboardList, CalendarCheck, FileCheck, BookOpen } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import ScopeBadge from '../../components/ScopeBadge';
import { usePermission } from '../../hooks/usePermission';
import EmployeeTab from './EmployeeTab';
import TimesheetTab from './TimesheetTab';
import WOTimeEntryForm from './WOTimeEntryForm';
import StandardTimesheetView from './StandardTimesheetView';
import LeaveTab from './LeaveTab';
import LeaveBalanceTab from './LeaveBalanceTab';
import PayrollTab from './PayrollTab';
import DailyReportApprovalTab from './DailyReportApprovalTab';
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
    can('hr.timesheet.create') && {
      key: 'wo-time-entry',
      label: tabLabel(ClipboardList, 'กรอกชั่วโมง WO'),
      children: <WOTimeEntryForm />,
    },
    can('hr.timesheet.read') && {
      key: 'standard-timesheet',
      label: tabLabel(CalendarCheck, 'Standard Timesheet'),
      children: <StandardTimesheetView />,
    },
    can('hr.leave.read') && {
      key: 'leave',
      label: tabLabel(CalendarDays, 'ลาหยุด'),
      children: <LeaveTab />,
    },
    can('hr.leave.read') && {
      key: 'leave-balance',
      label: tabLabel(BookOpen, 'โควต้าลา'),
      children: <LeaveBalanceTab />,
    },
    can('hr.payroll.read') && {
      key: 'payroll',
      label: tabLabel(Banknote, 'Payroll'),
      children: <PayrollTab />,
    },
    can('hr.dailyreport.approve') && {
      key: 'daily-report-approval',
      label: tabLabel(FileCheck, 'อนุมัติรายงาน'),
      children: <DailyReportApprovalTab />,
    },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="HR"
        subtitle={<span>บริหารจัดการทรัพยากรบุคคล <ScopeBadge /></span>}
      />
      {items.length > 0 ? (
        <Tabs defaultActiveKey={items[0]?.key} items={items} destroyOnHidden />
      ) : (
        <div style={{ textAlign: 'center', padding: 48, color: COLORS.textMuted }}>
          คุณไม่มีสิทธิ์เข้าถึงข้อมูล HR
        </div>
      )}
    </div>
  );
}
