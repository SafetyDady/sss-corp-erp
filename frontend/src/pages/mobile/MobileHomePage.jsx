import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Spin, Row, Col } from 'antd';
import {
  FileText, CalendarOff, CalendarCheck, Receipt,
  Clock, CheckCircle, AlertCircle,
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { COLORS } from '../../utils/constants';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function MobileHomePage() {
  const employeeName = useAuthStore((s) => s.employeeName);
  const employeeId = useAuthStore((s) => s.employeeId);
  const user = useAuthStore((s) => s.user);
  const departmentName = useAuthStore((s) => s.departmentName);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [reportToday, setReportToday] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [tasksToday, setTasksToday] = useState(null);
  const [latestPayslip, setLatestPayslip] = useState(null);

  // Time-based greeting
  const hour = dayjs().hour();
  const greeting = hour < 12 ? 'อรุณสวัสดิ์' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    loadDashboardData();
  }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDashboardData = async () => {
    setLoading(true);
    const today = dayjs().format('YYYY-MM-DD');

    const promises = [];

    // 1) Check daily report for today
    promises.push(
      api.get('/api/daily-report', { params: { limit: 1 } })
        .then(({ data }) => {
          const reports = data.items || data || [];
          const todayReport = reports.find(
            (r) => dayjs(r.work_date).format('YYYY-MM-DD') === today
          );
          setReportToday(todayReport || false);
        })
        .catch(() => setReportToday(false))
    );

    // 2) Leave balance (fields: quota, used)
    promises.push(
      api.get('/api/hr/leave-balance')
        .then(({ data }) => {
          const balances = Array.isArray(data) ? data : data.items || [];
          const totalRemaining = balances.reduce(
            (sum, b) => sum + ((Number(b.quota) || 0) - (Number(b.used) || 0)),
            0
          );
          setLeaveBalance(totalRemaining);
        })
        .catch(() => setLeaveBalance(null))
    );

    // 3) Tasks today (daily plans)
    promises.push(
      api.get('/api/planning/daily', { params: { start_date: today, end_date: today } })
        .then(({ data }) => {
          const plans = Array.isArray(data) ? data : data.items || [];
          setTasksToday(plans.length);
        })
        .catch(() => setTasksToday(null))
    );

    // 4) Latest payslip
    promises.push(
      api.get('/api/hr/payslips/me')
        .then(({ data }) => {
          const slips = Array.isArray(data) ? data : data.items || [];
          setLatestPayslip(slips.length > 0 ? slips[0] : null);
        })
        .catch(() => setLatestPayslip(null))
    );

    await Promise.allSettled(promises);
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Header */}
      <Card
        style={{
          background: `linear-gradient(135deg, ${COLORS.accent}15 0%, ${COLORS.card} 100%)`,
          border: `1px solid ${COLORS.border}`,
          marginBottom: 16,
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Title level={4} style={{ color: COLORS.text, margin: 0 }}>
          {greeting}
        </Title>
        <Text style={{ color: COLORS.accent, fontSize: 16, fontWeight: 600 }}>
          {employeeName || user?.full_name || 'User'}
        </Text>
        {departmentName && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, display: 'block', marginTop: 4 }}>
            แผนก: {departmentName} | {user?.role}
          </Text>
        )}
      </Card>

      {/* Summary Cards Grid */}
      <Row gutter={[12, 12]}>
        {/* Daily Report Card */}
        <Col span={12}>
          <Card
            hoverable
            onClick={() => navigate('/m/report')}
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              height: '100%',
            }}
            styles={{ body: { padding: 16, textAlign: 'center' } }}
          >
            <FileText
              size={28}
              color={reportToday && reportToday.status !== 'DRAFT' ? COLORS.success : COLORS.warning}
              style={{ marginBottom: 8 }}
            />
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, display: 'block' }}>
              รายงานวันนี้
            </Text>
            {reportToday === false ? (
              <Text style={{ color: COLORS.warning, fontSize: 13, fontWeight: 600, display: 'block', marginTop: 4 }}>
                <AlertCircle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                ยังไม่กรอก
              </Text>
            ) : reportToday ? (
              <Text style={{ color: COLORS.success, fontSize: 13, fontWeight: 600, display: 'block', marginTop: 4 }}>
                <CheckCircle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {reportToday.status === 'DRAFT' ? 'แบบร่าง' : 'กรอกแล้ว'}
              </Text>
            ) : (
              <Text style={{ color: COLORS.textMuted, fontSize: 13, display: 'block', marginTop: 4 }}>-</Text>
            )}
          </Card>
        </Col>

        {/* Leave Balance Card */}
        <Col span={12}>
          <Card
            hoverable
            onClick={() => navigate('/m/leave')}
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              height: '100%',
            }}
            styles={{ body: { padding: 16, textAlign: 'center' } }}
          >
            <CalendarOff size={28} color={COLORS.accent} style={{ marginBottom: 8 }} />
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, display: 'block' }}>
              ลาคงเหลือ
            </Text>
            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 700, display: 'block', marginTop: 4 }}>
              {leaveBalance != null ? `${leaveBalance} วัน` : '-'}
            </Text>
          </Card>
        </Col>

        {/* Tasks Today Card */}
        <Col span={12}>
          <Card
            hoverable
            onClick={() => navigate('/m/tasks')}
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              height: '100%',
            }}
            styles={{ body: { padding: 16, textAlign: 'center' } }}
          >
            <CalendarCheck size={28} color={COLORS.accent} style={{ marginBottom: 8 }} />
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, display: 'block' }}>
              งานวันนี้
            </Text>
            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 700, display: 'block', marginTop: 4 }}>
              {tasksToday != null ? `${tasksToday} งาน` : '-'}
            </Text>
          </Card>
        </Col>

        {/* Timesheet Card */}
        <Col span={12}>
          <Card
            hoverable
            onClick={() => navigate('/m/me')}
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              height: '100%',
            }}
            styles={{ body: { padding: 16, textAlign: 'center' } }}
          >
            <Clock size={28} color={COLORS.accent} style={{ marginBottom: 8 }} />
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, display: 'block' }}>
              Timesheet
            </Text>
            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: 600, display: 'block', marginTop: 4 }}>
              ดูข้อมูล
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Latest Payslip Card */}
      {latestPayslip && (
        <Card
          hoverable
          onClick={() => navigate('/m/me')}
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            marginTop: 12,
          }}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Receipt size={28} color={COLORS.success} />
            <div style={{ flex: 1 }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, display: 'block' }}>
                สลิปเงินเดือนล่าสุด
              </Text>
              <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 600 }}>
                {latestPayslip.period_start
                  ? `${dayjs(latestPayslip.period_start).format('DD/MM')} - ${dayjs(latestPayslip.period_end).format('DD/MM/YYYY')}`
                  : 'ล่าสุด'}
              </Text>
            </div>
            {latestPayslip.net_amount != null && (
              <Text style={{ color: COLORS.success, fontSize: 16, fontWeight: 700 }}>
                {Number(latestPayslip.net_amount).toLocaleString('th-TH')} ฿
              </Text>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
