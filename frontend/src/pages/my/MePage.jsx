import { useState, useEffect } from 'react';
import { Tabs, Card, Typography, Avatar, Row, Col } from 'antd';
import { User, CalendarCheck, Clock, FileText, ClipboardList, Briefcase, Calendar } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { COLORS } from '../../utils/constants';
import StatCard from '../../components/StatCard';
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
  const hireDate = useAuthStore((s) => s.hireDate);

  const [stats, setStats] = useState({ tasks: 0, pendingLeave: 0, todayHours: 0, reports: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = dayjs().format('YYYY-MM-DD');
        const [tasksRes, leaveRes, reportRes] = await Promise.allSettled([
          api.get('/api/planning/daily', { params: { date_from: today, date_to: today, limit: 100 } }),
          api.get('/api/hr/leave', { params: { limit: 100 } }),
          api.get('/api/daily-report', { params: { date_from: today, date_to: today, limit: 1 } }),
        ]);

        const tasks = tasksRes.status === 'fulfilled' ? (tasksRes.value.data?.total || tasksRes.value.data?.items?.length || 0) : 0;
        const pending = leaveRes.status === 'fulfilled'
          ? (leaveRes.value.data?.items || []).filter((l) => l.status === 'PENDING').length
          : 0;
        const report = reportRes.status === 'fulfilled' ? (reportRes.value.data?.total || 0) : 0;

        setStats({ tasks, pendingLeave: pending, todayHours: 0, reports: report });
      } catch {
        /* ignore */
      }
    };
    fetchStats();
  }, []);

  const tenure = hireDate
    ? `${dayjs().diff(dayjs(hireDate), 'year')} ปี ${dayjs().diff(dayjs(hireDate), 'month') % 12} เดือน`
    : null;

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
        <Col xs={12} sm={6}>
          <StatCard
            title="รายงานวันนี้"
            value={stats.reports > 0 ? 'กรอกแล้ว' : 'ยังไม่กรอก'}
            icon={<ClipboardList size={20} />}
            color={stats.reports > 0 ? COLORS.success : COLORS.warning}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="ใบลารออนุมัติ"
            value={stats.pendingLeave}
            subtitle="Pending"
            icon={<FileText size={20} />}
            color={COLORS.warning}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Timesheet"
            value="—"
            subtitle="สัปดาห์นี้"
            icon={<Clock size={20} />}
            color={COLORS.purple}
          />
        </Col>
      </Row>

      {/* Tabbed Content */}
      <Tabs
        defaultActiveKey="tasks"
        type="card"
        items={[
          {
            key: 'tasks',
            label: (
              <span><CalendarCheck size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />งานของฉัน</span>
            ),
            children: <MyTasksPage embedded />,
          },
          {
            key: 'timesheet',
            label: (
              <span><Clock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Timesheet</span>
            ),
            children: <MyTimesheetPage embedded />,
          },
          {
            key: 'leave',
            label: (
              <span><FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />ใบลา</span>
            ),
            children: <MyLeavePage embedded />,
          },
          {
            key: 'daily-report',
            label: (
              <span><ClipboardList size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />รายงานประจำวัน</span>
            ),
            children: <MyDailyReportPage embedded />,
          },
        ]}
      />
    </div>
  );
}
