import { useState, useEffect, useMemo } from 'react';
import { Tabs, Card, Typography, Avatar, Row, Col } from 'antd';
import { User, CalendarCheck, Clock, FileText, ClipboardList, Briefcase, Calendar, Building2 } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { usePermission } from '../../hooks/usePermission';
import { COLORS } from '../../utils/constants';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import api from '../../services/api';
import dayjs from 'dayjs';

import MyTasksPage from './MyTasksPage';
import MyTimesheetPage from './MyTimesheetPage';
import MyLeavePage from './MyLeavePage';
import MyDailyReportPage from './MyDailyReportPage';

const { Title, Text } = Typography;

export default function MePage() {
  const user = useAuthStore((s) => s.user);
  const employeeName = useAuthStore((s) => s.employeeName);
  const employeeCode = useAuthStore((s) => s.employeeCode);
  const employeeId = useAuthStore((s) => s.employeeId);
  const hireDate = useAuthStore((s) => s.hireDate);
  const departmentName = useAuthStore((s) => s.departmentName);
  const { can } = usePermission();

  const [stats, setStats] = useState({ tasks: 0, pendingLeave: 0, todayHours: 0, reports: 0 });

  useEffect(() => {
    if (!employeeId) return;
    const fetchStats = async () => {
      try {
        const today = dayjs().format('YYYY-MM-DD');
        const requests = [
          api.get('/api/planning/daily', { params: { date_from: today, date_to: today, limit: 100, employee_id: employeeId } }),
        ];
        const hasLeave = can('hr.leave.read');
        const hasReport = can('hr.dailyreport.read');
        if (hasLeave) requests.push(api.get('/api/hr/leave', { params: { limit: 100, employee_id: employeeId } }));
        if (hasReport) requests.push(api.get('/api/daily-report', { params: { date_from: today, date_to: today, limit: 1, employee_id: employeeId } }));

        const results = await Promise.allSettled(requests);

        const tasks = results[0].status === 'fulfilled' ? (results[0].value.data?.total || results[0].value.data?.items?.length || 0) : 0;
        let pending = 0;
        let report = 0;
        let idx = 1;
        if (hasLeave) {
          pending = results[idx]?.status === 'fulfilled'
            ? (results[idx].value.data?.items || []).filter((l) => l.status === 'PENDING').length
            : 0;
          idx++;
        }
        if (hasReport) {
          report = results[idx]?.status === 'fulfilled' ? (results[idx].value.data?.total || 0) : 0;
        }

        setStats({ tasks, pendingLeave: pending, todayHours: 0, reports: report });
      } catch {
        /* ignore */
      }
    };
    fetchStats();
  }, [employeeId]);

  const tenure = hireDate
    ? `${dayjs().diff(dayjs(hireDate), 'year')} ปี ${dayjs().diff(dayjs(hireDate), 'month') % 12} เดือน`
    : null;

  const tabItems = [
    can('workorder.plan.read') && {
      key: 'tasks',
      label: (<span><CalendarCheck size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />งานของฉัน</span>),
      children: <MyTasksPage embedded />,
    },
    can('hr.timesheet.read') && {
      key: 'timesheet',
      label: (<span><Clock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Timesheet</span>),
      children: <MyTimesheetPage embedded />,
    },
    can('hr.leave.read') && {
      key: 'leave',
      label: (<span><FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />ใบลา</span>),
      children: <MyLeavePage embedded />,
    },
    can('hr.dailyreport.read') && {
      key: 'daily-report',
      label: (<span><ClipboardList size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />รายงานประจำวัน</span>),
      children: <MyDailyReportPage embedded />,
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
            <Title level={4} style={{ color: COLORS.text, margin: 0 }}>
              {employeeName || user?.full_name || 'User'}
            </Title>
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

      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard
            title="งานวันนี้"
            value={stats.tasks}
            subtitle="Work Orders"
            icon={<Briefcase size={20} />}
            color={COLORS.accent}
          />
        </Col>
        {can('hr.dailyreport.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="รายงานวันนี้"
              value={stats.reports > 0 ? 'กรอกแล้ว' : 'ยังไม่กรอก'}
              icon={<ClipboardList size={20} />}
              color={stats.reports > 0 ? COLORS.success : COLORS.warning}
            />
          </Col>
        )}
        {can('hr.leave.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="ใบลารออนุมัติ"
              value={stats.pendingLeave}
              subtitle="Pending"
              icon={<FileText size={20} />}
              color={COLORS.warning}
            />
          </Col>
        )}
        {can('hr.timesheet.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="Timesheet"
              value="—"
              subtitle="สัปดาห์นี้"
              icon={<Clock size={20} />}
              color={COLORS.purple}
            />
          </Col>
        )}
      </Row>

      {/* Tabbed Content */}
      {tabItems.length === 0 ? (
        <EmptyState message="ไม่มีข้อมูลที่แสดง" hint="บัญชีของคุณไม่มีสิทธิ์เข้าถึงส่วนนี้" />
      ) : (
        <Tabs defaultActiveKey={tabItems[0].key} type="card" items={tabItems} />
      )}
    </div>
  );
}
