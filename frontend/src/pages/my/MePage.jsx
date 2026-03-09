import { useState } from 'react';
import { Tabs, Card, Typography, Avatar, Button, Tag, App, Popconfirm, Space } from 'antd';
import { User, Clock, Receipt, CalendarOff, Building2, Calendar, Pencil, ShieldCheck, ShieldOff, Lock } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { usePermission } from '../../hooks/usePermission';
import { COLORS } from '../../utils/constants';
import EmptyState from '../../components/EmptyState';
import dayjs from 'dayjs';
import api from '../../services/api';

import MyTimesheetPage from './MyTimesheetPage';
import MyPayslipTab from './MyPayslipTab';
import LeaveBalanceReadOnly from './LeaveBalanceReadOnly';
import ProfileEditModal from './ProfileEditModal';
import Setup2FAModal from './Setup2FAModal';
import ChangePasswordModal from './ChangePasswordModal';
import SessionsSection from './SessionsSection';

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
  const is2FAEnabled = useAuthStore((s) => s.is2FAEnabled);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const { can } = usePermission();
  const { message } = App.useApp();

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [setup2FAOpen, setSetup2FAOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);

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

            {/* Security Actions: 2FA + Change Password */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {is2FAEnabled ? (
                <>
                  <Tag color={COLORS.success} icon={<ShieldCheck size={12} />}>
                    2FA เปิดใช้งาน
                  </Tag>
                  <Popconfirm
                    title="ปิด 2FA"
                    description="คุณต้องกรอก OTP จากแอป Authenticator เพื่อยืนยัน"
                    okText="ปิด 2FA"
                    cancelText="ยกเลิก"
                    onConfirm={async () => {
                      const code = window.prompt('กรอก OTP 6 หลัก เพื่อยืนยันการปิด 2FA:');
                      if (!code || code.length !== 6) {
                        message.warning('กรุณากรอก OTP 6 หลัก');
                        return;
                      }
                      setDisabling2FA(true);
                      try {
                        await api.post('/api/auth/2fa/disable', { code });
                        message.success('ปิด 2FA สำเร็จ');
                        await fetchMe();
                      } catch (err) {
                        message.error(err.response?.data?.detail || 'OTP ไม่ถูกต้อง');
                      } finally {
                        setDisabling2FA(false);
                      }
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<ShieldOff size={13} />}
                      loading={disabling2FA}
                      style={{ color: COLORS.textMuted }}
                    >
                      ปิด 2FA
                    </Button>
                  </Popconfirm>
                </>
              ) : (
                <Button
                  type="default"
                  size="small"
                  icon={<ShieldCheck size={13} />}
                  onClick={() => setSetup2FAOpen(true)}
                  style={{ borderColor: COLORS.success, color: COLORS.success }}
                >
                  ตั้งค่า 2FA
                </Button>
              )}
              <Button
                type="default"
                size="small"
                icon={<Lock size={13} />}
                onClick={() => setChangePasswordOpen(true)}
              >
                เปลี่ยนรหัสผ่าน
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Active Sessions (Phase 13.3) */}
      <SessionsSection />

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

      {/* 2FA Setup Modal (Phase 13) */}
      <Setup2FAModal
        open={setup2FAOpen}
        onClose={() => setSetup2FAOpen(false)}
        onSuccess={() => { setSetup2FAOpen(false); fetchMe(); }}
      />

      {/* Change Password Modal (Phase 13) */}
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSuccess={() => setChangePasswordOpen(false)}
      />
    </div>
  );
}
