import { useState } from 'react';
import { Tabs, Card, Typography, Avatar, Button } from 'antd';
import { User, Clock, Receipt, CalendarOff, Building2, Calendar, Pencil } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { usePermission } from '../../hooks/usePermission';
import { COLORS } from '../../utils/constants';
import EmptyState from '../../components/EmptyState';
import dayjs from 'dayjs';

import MyTimesheetPage from './MyTimesheetPage';
import MyPayslipTab from './MyPayslipTab';
import LeaveBalanceReadOnly from './LeaveBalanceReadOnly';
import ProfileEditModal from './ProfileEditModal';

const { Title, Text } = Typography;

/**
 * MePage — ข้อมูลส่วนตัว (Personal Info Only)
 * Tabs: Payslip, Timesheet/ตารางงาน, โควต้าลา
 * ไม่มีปุ่มสร้าง request — ใช้ CommonActPage แทน
 */
export default function MePage() {
  const user = useAuthStore((s) => s.user);
  const employeeName = useAuthStore((s) => s.employeeName);
  const employeeCode = useAuthStore((s) => s.employeeCode);
  const employeeId = useAuthStore((s) => s.employeeId);
  const hireDate = useAuthStore((s) => s.hireDate);
  const departmentName = useAuthStore((s) => s.departmentName);
  const { can } = usePermission();

  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const tenure = hireDate
    ? `${dayjs().diff(dayjs(hireDate), 'year')} ปี ${dayjs().diff(dayjs(hireDate), 'month') % 12} เดือน`
    : null;

  const tabItems = [
    employeeId && {
      key: 'payslip',
      label: (<span><Receipt size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Payslip</span>),
      children: <MyPayslipTab />,
    },
    can('hr.timesheet.read') && {
      key: 'timesheet',
      label: (<span><Clock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Timesheet</span>),
      children: <MyTimesheetPage embedded />,
    },
    can('hr.leave.read') && employeeId && {
      key: 'leave-balance',
      label: (<span><CalendarOff size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />โควต้าลา</span>),
      children: <LeaveBalanceReadOnly />,
    },
  ].filter(Boolean);

  return (
    <div>
      {/* Profile Header */}
      <Card
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          marginBottom: 24,
        }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Avatar
            size={64}
            icon={<User size={28} />}
            style={{ background: `${COLORS.accent}30`, color: COLORS.accent, flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Title level={4} style={{ color: COLORS.text, margin: 0 }}>
                {employeeName || user?.full_name || 'User'}
              </Title>
              {employeeId && (
                <Button
                  type="text"
                  size="small"
                  icon={<Pencil size={13} />}
                  onClick={() => setProfileModalOpen(true)}
                  style={{ color: COLORS.textSecondary }}
                >
                  แก้ไข
                </Button>
              )}
            </div>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
              {employeeCode && <span style={{ marginRight: 12 }}>{employeeCode}</span>}
              {user?.role && (
                <span style={{
                  background: `${COLORS.accent}20`,
                  color: COLORS.accent,
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}>
                  {user.role}
                </span>
              )}
            </Text>
            {departmentName && (
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, display: 'block', marginTop: 4 }}>
                <Building2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                แผนก: {departmentName}
              </Text>
            )}
            {tenure && (
              <Text style={{ color: COLORS.textMuted, fontSize: 12, display: 'block', marginTop: 4 }}>
                <Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                เริ่มงาน {dayjs(hireDate).format('DD MMM YYYY')} — {tenure}
              </Text>
            )}
          </div>
        </div>
      </Card>

      {/* Tabbed Content — Personal Info Only */}
      {tabItems.length === 0 ? (
        <EmptyState message="ไม่มีข้อมูลที่แสดง" hint="บัญชีของคุณไม่มีสิทธิ์เข้าถึงส่วนนี้" />
      ) : (
        <Tabs defaultActiveKey={tabItems[0].key} type="card" items={tabItems} />
      )}

      {/* Profile Edit Modal (G7) */}
      <ProfileEditModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onSuccess={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
