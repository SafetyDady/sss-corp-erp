import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Row, Col, Table, Typography, Space, Skeleton } from 'antd';
import {
  FileText, Package, Users, ClipboardList, CalendarOff,
  CalendarCheck, Clock, ArrowRight, Edit, CheckCircle,
  ArrowDownLeft, ArrowUpRight, TrendingUp, Landmark,
  AlertTriangle, ClipboardCheck, BarChart3,
} from 'lucide-react';
import dayjs from 'dayjs';
import useAuthStore from '../stores/authStore';
import { usePermission } from '../hooks/usePermission';
import { COLORS } from '../utils/constants';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import ScopeBadge from '../components/ScopeBadge';
const BarChartCard = lazy(() => import('../components/BarChartCard'));
const LineChartCard = lazy(() => import('../components/LineChartCard'));
import api from '../services/api';

const { Text } = Typography;

const formatCurrency = (v) =>
  typeof v === 'number'
    ? v.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '—';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'สวัสดีตอนเช้า';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
};

// ============================================================
// Staff Dashboard
// ============================================================
function StaffDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const employeeId = useAuthStore((s) => s.employeeId);
  const employeeName = useAuthStore((s) => s.employeeName);
  const employeeCode = useAuthStore((s) => s.employeeCode);
  const hireDate = useAuthStore((s) => s.hireDate);

  const [todayReport, setTodayReport] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [todayTasks, setTodayTasks] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [loading, setLoading] = useState(true);

  const tenure = useMemo(() => {
    if (!hireDate) return '';
    const hd = dayjs(hireDate);
    const now = dayjs();
    const years = now.diff(hd, 'year');
    const months = now.diff(hd.add(years, 'year'), 'month');
    const parts = [];
    if (years > 0) parts.push(`${years} ปี`);
    if (months > 0) parts.push(`${months} เดือน`);
    return parts.join(' ') || 'น้อยกว่า 1 เดือน';
  }, [hireDate]);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    const today = dayjs().format('YYYY-MM-DD');
    const year = dayjs().year();

    const fetchData = async () => {
      try {
        const [reportRes, recentRes, balanceRes, tasksRes, leaveRes] = await Promise.all([
          api
            .get('/api/daily-report', { params: { employee_id: employeeId, date_from: today, date_to: today, limit: 1, offset: 0 } })
            .catch(() => ({ data: { items: [] } })),
          api
            .get('/api/daily-report', { params: { employee_id: employeeId, limit: 5, offset: 0 } })
            .catch(() => ({ data: { items: [] } })),
          api
            .get('/api/hr/leave-balance', { params: { employee_id: employeeId, year, limit: 100, offset: 0 } })
            .catch(() => ({ data: { items: [] } })),
          api
            .get('/api/planning/daily', { params: { date: today, employee_id: employeeId, limit: 50, offset: 0 } })
            .catch(() => ({ data: { items: [], total: 0 } })),
          api
            .get('/api/hr/leave', { params: { employee_id: employeeId, status: 'PENDING', limit: 1, offset: 0 } })
            .catch(() => ({ data: { items: [], total: 0 } })),
        ]);

        const items = reportRes.data.items || [];
        setTodayReport(items.length > 0 ? items[0] : null);
        setRecentReports((recentRes.data.items || []).slice(0, 5));

        const bals = balanceRes.data.items || balanceRes.data || [];
        const annualBal = bals.find((b) => b.leave_type_code === 'ANNUAL');
        setLeaveBalance(annualBal || (bals.length > 0 ? bals[0] : null));

        const taskItems = tasksRes.data.items || tasksRes.data || [];
        setTodayTasks(Array.isArray(taskItems) ? taskItems.length : tasksRes.data.total || 0);

        setPendingLeaves(leaveRes.data.total || (leaveRes.data.items || []).length || 0);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId]);

  const summaryCards = [
    {
      title: 'Report วันนี้',
      value: todayReport ? todayReport.status : 'ยังไม่กรอก',
      icon: <ClipboardList size={20} />,
      color: todayReport ? COLORS.success : COLORS.warning,
      onClick: () => navigate('/common-act'),
    },
    {
      title: 'วันลาเหลือ',
      value: leaveBalance ? `${Number(leaveBalance.quota || 0) - Number(leaveBalance.used || 0)}` : '—',
      suffix: leaveBalance ? 'วัน' : '',
      icon: <CalendarOff size={20} />,
      color: COLORS.accent,
      onClick: () => navigate('/me'),
    },
    {
      title: 'งานวันนี้',
      value: todayTasks,
      suffix: 'WO',
      icon: <CalendarCheck size={20} />,
      color: COLORS.purple,
      onClick: () => navigate('/common-act'),
    },
    {
      title: 'คำขอรออนุมัติ',
      value: pendingLeaves,
      suffix: 'ใบลา',
      icon: <Clock size={20} />,
      color: COLORS.warning,
      onClick: () => navigate('/common-act'),
    },
  ];

  const recentColumns = [
    {
      title: 'วันที่',
      dataIndex: 'report_date',
      key: 'date',
      render: (v) => dayjs(v).format('DD/MM'),
      width: 60,
    },
    {
      title: 'ชั่วโมง',
      key: 'hours',
      render: (_, r) => {
        const reg = Number(r.total_regular_hours || 0);
        const ot = Number(r.total_ot_hours || 0);
        return `${reg}${ot > 0 ? `+${ot} OT` : ''} ชม.`;
      },
      width: 120,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <StatusBadge status={v} />,
      width: 100,
    },
  ];

  return (
    <div>
      <PageHeader
        title={`${getGreeting()}, ${employeeName || user?.full_name || 'User'}!`}
        subtitle={
          employeeCode
            ? `รหัส: ${employeeCode}${tenure ? ` | อายุงาน: ${tenure}` : ''}`
            : `ยินดีต้อนรับสู่ SSS Corp ERP`
        }
      />

      {/* Summary Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {summaryCards.map((card, i) => (
          <Col xs={12} sm={12} md={6} key={i}>
            <StatCard
              title={card.title}
              value={card.value}
              subtitle={card.suffix}
              icon={card.icon}
              color={card.color}
              onClick={card.onClick}
            />
          </Col>
        ))}
      </Row>

      {/* Quick Actions */}
      <Card
        size="small"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}
      >
        <Space wrap>
          <Button
            type="primary"
            icon={<Edit size={14} />}
            onClick={() => navigate('/common-act')}
          >
            กรอก Report วันนี้
          </Button>
          <Button icon={<CalendarOff size={14} />} onClick={() => navigate('/common-act')}>
            ขอลา
          </Button>
          <Button icon={<CalendarCheck size={14} />} onClick={() => navigate('/common-act')}>
            ดูงานวันนี้
          </Button>
          <Button icon={<Clock size={14} />} onClick={() => navigate('/me')}>
            Timesheet
          </Button>
        </Space>
      </Card>

      {/* Recent Reports */}
      <Card
        title={<span style={{ fontSize: 14 }}>Report ล่าสุด</span>}
        size="small"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        extra={
          <Button type="link" size="small" onClick={() => navigate('/common-act')}>
            ดูทั้งหมด <ArrowRight size={12} />
          </Button>
        }
      >
        <Table
          dataSource={recentReports}
          columns={recentColumns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          locale={{ emptyText: 'ยังไม่มี Report' }}
        />
      </Card>
    </div>
  );
}

// ============================================================
// Supervisor Dashboard
// ============================================================
function SupervisorDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const employeeId = useAuthStore((s) => s.employeeId);
  const employeeName = useAuthStore((s) => s.employeeName);
  const departmentName = useAuthStore((s) => s.departmentName);
  const { can } = usePermission();

  const [stats, setStats] = useState({
    deptEmployees: 0, todayReports: 0, pendingApprovals: 0, workOrders: 0,
  });
  const [approvalBreakdown, setApprovalBreakdown] = useState({ dailyReport: 0, timesheet: 0, leave: 0 });
  const [myReport, setMyReport] = useState(null);
  const [myLeaveBalance, setMyLeaveBalance] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    const today = dayjs().format('YYYY-MM-DD');
    const year = dayjs().year();
    const requests = [];

    // Department stats
    if (can('hr.employee.read')) {
      requests.push(
        api.get('/api/hr/employees', { params: { limit: 1, offset: 0 } })
          .then((r) => ({ key: 'deptEmployees', value: r.data.total || 0 }))
          .catch(() => ({ key: 'deptEmployees', value: 0 }))
      );
    }
    requests.push(
      api.get('/api/daily-report', { params: { date_from: today, date_to: today, limit: 1, offset: 0 } })
        .then((r) => ({ key: 'todayReports', value: r.data.total || 0 }))
        .catch(() => ({ key: 'todayReports', value: 0 }))
    );

    // Approval breakdown
    if (can('hr.dailyreport.approve')) {
      requests.push(
        api.get('/api/daily-report', { params: { status: 'SUBMITTED', limit: 1, offset: 0 } })
          .then((r) => ({ key: '_ap_daily', value: r.data.total || 0 }))
          .catch(() => ({ key: '_ap_daily', value: 0 }))
      );
    }
    if (can('hr.timesheet.approve')) {
      requests.push(
        api.get('/api/hr/timesheet', { params: { status: 'SUBMITTED', limit: 1, offset: 0 } })
          .then((r) => ({ key: '_ap_ts', value: r.data.total || 0 }))
          .catch(() => ({ key: '_ap_ts', value: 0 }))
      );
    }
    if (can('hr.leave.approve')) {
      requests.push(
        api.get('/api/hr/leave', { params: { status: 'PENDING', limit: 1, offset: 0 } })
          .then((r) => ({ key: '_ap_leave', value: r.data.total || 0 }))
          .catch(() => ({ key: '_ap_leave', value: 0 }))
      );
    }

    if (can('workorder.order.read')) {
      requests.push(
        api.get('/api/work-orders', { params: { limit: 1, offset: 0 } })
          .then((r) => ({ key: 'workOrders', value: r.data.total || 0 }))
          .catch(() => ({ key: 'workOrders', value: 0 }))
      );
    }

    // Personal data
    if (employeeId) {
      requests.push(
        api.get('/api/daily-report', { params: { employee_id: employeeId, date_from: today, date_to: today, limit: 1 } })
          .then((r) => ({ key: '_myReport', value: (r.data.items || [])[0] || null }))
          .catch(() => ({ key: '_myReport', value: null }))
      );
      requests.push(
        api.get('/api/hr/leave-balance', { params: { employee_id: employeeId, year, limit: 100 } })
          .then((r) => ({ key: '_myBalance', value: r.data.items || r.data || [] }))
          .catch(() => ({ key: '_myBalance', value: [] }))
      );
    }

    const results = await Promise.all(requests);
    let apDaily = 0, apTs = 0, apLeave = 0;

    setStats((prev) => {
      const newStats = { ...prev };
      results.forEach((r) => {
        if (r.key === '_myReport') setMyReport(r.value);
        else if (r.key === '_myBalance') {
          const annual = r.value.find((b) => b.leave_type_code === 'ANNUAL');
          setMyLeaveBalance(annual || (r.value.length > 0 ? r.value[0] : null));
        }
        else if (r.key === '_ap_daily') apDaily = r.value;
        else if (r.key === '_ap_ts') apTs = r.value;
        else if (r.key === '_ap_leave') apLeave = r.value;
        else newStats[r.key] = r.value;
      });
      newStats.pendingApprovals = apDaily + apTs + apLeave;
      return newStats;
    });
    setApprovalBreakdown({ dailyReport: apDaily, timesheet: apTs, leave: apLeave });
    setLastUpdated(dayjs().format('HH:mm'));
  }, [employeeId, can]);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData();
    }, 300_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const deptCards = [
    { title: 'พนักงานในแผนก', value: stats.deptEmployees, icon: <Users size={20} />, color: COLORS.purple, onClick: () => navigate('/hr') },
    { title: 'รายงานวันนี้', value: stats.todayReports, icon: <ClipboardList size={20} />, color: COLORS.accent, onClick: () => navigate('/approval') },
    { title: 'รอการอนุมัติ', value: stats.pendingApprovals, icon: <CheckCircle size={20} />, color: COLORS.warning, onClick: () => navigate('/approval') },
    { title: 'Work Orders', value: stats.workOrders, icon: <FileText size={20} />, color: '#3b82f6', onClick: () => navigate('/workorders') },
  ];

  return (
    <div>
      <PageHeader
        title={`${getGreeting()}, ${employeeName || user?.full_name || 'User'}!`}
        subtitle={
          <span>
            ภาพรวมแผนก <ScopeBadge />
            {lastUpdated && <span style={{ marginLeft: 12, fontSize: 11, color: COLORS.textMuted }}>อัปเดต: {lastUpdated}</span>}
          </span>
        }
      />

      {/* Department Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {deptCards.map((card, i) => (
          <Col xs={12} sm={12} md={6} key={i}>
            <StatCard title={card.title} value={card.value} icon={card.icon} color={card.color} onClick={card.onClick} />
          </Col>
        ))}
      </Row>

      {/* Approval Breakdown + Quick Actions */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card
            title={<span style={{ fontSize: 14 }}>รายการรออนุมัติ</span>}
            size="small"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            extra={<Button type="link" size="small" onClick={() => navigate('/approval')}>ดูทั้งหมด <ArrowRight size={12} /></Button>}
          >
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {approvalBreakdown.dailyReport > 0 && (
                <div style={{ fontSize: 13, color: COLORS.text }}>
                  <span style={{ color: COLORS.textMuted }}>Daily Report: </span>
                  <span style={{ fontWeight: 600, color: COLORS.warning }}>{approvalBreakdown.dailyReport}</span>
                </div>
              )}
              {approvalBreakdown.timesheet > 0 && (
                <div style={{ fontSize: 13, color: COLORS.text }}>
                  <span style={{ color: COLORS.textMuted }}>Timesheet: </span>
                  <span style={{ fontWeight: 600, color: COLORS.warning }}>{approvalBreakdown.timesheet}</span>
                </div>
              )}
              {approvalBreakdown.leave > 0 && (
                <div style={{ fontSize: 13, color: COLORS.text }}>
                  <span style={{ color: COLORS.textMuted }}>ใบลา: </span>
                  <span style={{ fontWeight: 600, color: COLORS.warning }}>{approvalBreakdown.leave}</span>
                </div>
              )}
              {stats.pendingApprovals === 0 && (
                <div style={{ fontSize: 13, color: COLORS.success }}>ไม่มีรายการรออนุมัติ</div>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            size="small"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, height: '100%' }}
          >
            <Space wrap>
              {can('hr.dailyreport.approve') && (
                <Button type="primary" icon={<CheckCircle size={14} />} onClick={() => navigate('/approval')}>
                  อนุมัติรายงาน
                </Button>
              )}
              {can('workorder.plan.create') && (
                <Button icon={<CalendarCheck size={14} />} onClick={() => navigate('/planning')}>
                  วางแผนงาน
                </Button>
              )}
              <Button icon={<Users size={14} />} onClick={() => navigate('/hr')}>
                จัดการพนักงาน
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Personal Section */}
      <Card
        title={<Text style={{ fontSize: 14 }}>ข้อมูลของฉัน</Text>}
        size="small"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        extra={<Button type="link" size="small" onClick={() => navigate('/me')}>ดูทั้งหมด <ArrowRight size={12} /></Button>}
      >
        <Row gutter={[12, 12]}>
          <Col xs={12}>
            <StatCard
              title="Report วันนี้"
              value={myReport ? myReport.status : 'ยังไม่กรอก'}
              icon={<ClipboardList size={20} />}
              color={myReport ? COLORS.success : COLORS.warning}
              onClick={() => navigate('/common-act')}
            />
          </Col>
          <Col xs={12}>
            <StatCard
              title="วันลาเหลือ"
              value={myLeaveBalance ? `${Number(myLeaveBalance.quota || 0) - Number(myLeaveBalance.used || 0)}` : '—'}
              subtitle={myLeaveBalance ? 'วัน' : ''}
              icon={<CalendarOff size={20} />}
              color={COLORS.accent}
              onClick={() => navigate('/me')}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
}

// ============================================================
// Manager/Admin Dashboard
// ============================================================
function AdminDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { can } = usePermission();

  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [data, setData] = useState({
    apSummary: null,
    arSummary: null,
    finReport: null,
    assetSummary: null,
    woOpen: 0,
    woTotal: 0,
    lowStock: 0,
    employees: 0,
    pendingApprovals: 0,
    monthlySummary: [],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const tasks = [];

    // Row 1 — Financial
    if (can('finance.invoice.read'))
      tasks.push({ key: 'apSummary', req: api.get('/api/finance/invoices/summary').catch(() => null) });
    if (can('finance.ar.read'))
      tasks.push({ key: 'arSummary', req: api.get('/api/finance/ar/summary').catch(() => null) });
    if (can('finance.report.read'))
      tasks.push({ key: 'finReport', req: api.get('/api/finance/reports').catch(() => null) });
    if (can('asset.asset.read'))
      tasks.push({ key: 'assetSummary', req: api.get('/api/asset/assets/summary').catch(() => null) });

    // Row 2 — Operations
    if (can('workorder.order.read')) {
      tasks.push({ key: 'woOpen', req: api.get('/api/work-orders', { params: { limit: 1, status: 'OPEN' } }).catch(() => null) });
      tasks.push({ key: 'woTotal', req: api.get('/api/work-orders', { params: { limit: 1 } }).catch(() => null) });
    }
    if (can('inventory.product.read'))
      tasks.push({ key: 'lowStock', req: api.get('/api/inventory/low-stock-count').catch(() => null) });
    if (can('hr.employee.read'))
      tasks.push({ key: 'employees', req: api.get('/api/hr/employees', { params: { limit: 1 } }).catch(() => null) });

    // Approval counts
    const approvalKeys = [];
    if (can('hr.dailyreport.approve')) {
      tasks.push({ key: 'ap_daily', req: api.get('/api/daily-report', { params: { status: 'SUBMITTED', limit: 1 } }).catch(() => null) });
      approvalKeys.push('ap_daily');
    }
    if (can('hr.timesheet.approve')) {
      tasks.push({ key: 'ap_ts', req: api.get('/api/hr/timesheet', { params: { status: 'SUBMITTED', limit: 1 } }).catch(() => null) });
      approvalKeys.push('ap_ts');
    }
    if (can('hr.leave.approve')) {
      tasks.push({ key: 'ap_leave', req: api.get('/api/hr/leave', { params: { status: 'PENDING', limit: 1 } }).catch(() => null) });
      approvalKeys.push('ap_leave');
    }
    if (can('purchasing.pr.approve')) {
      tasks.push({ key: 'ap_pr', req: api.get('/api/purchasing/pr', { params: { status: 'SUBMITTED', limit: 1 } }).catch(() => null) });
      approvalKeys.push('ap_pr');
    }
    if (can('purchasing.po.approve')) {
      tasks.push({ key: 'ap_po', req: api.get('/api/purchasing/po', { params: { status: 'SUBMITTED', limit: 1 } }).catch(() => null) });
      approvalKeys.push('ap_po');
    }
    if (can('sales.order.approve')) {
      tasks.push({ key: 'ap_so', req: api.get('/api/sales/orders', { params: { status: 'SUBMITTED', limit: 1 } }).catch(() => null) });
      approvalKeys.push('ap_so');
    }

    // Charts
    if (can('finance.report.read'))
      tasks.push({ key: 'monthlySummary', req: api.get('/api/finance/reports/monthly-summary', { params: { months: 6 } }).catch(() => null) });

    // Execute all
    const results = await Promise.allSettled(tasks.map((t) => t.req));

    let totalPending = 0;

    setData((prev) => {
      const newData = { ...prev };
      results.forEach((result, i) => {
        const key = tasks[i].key;
        const res = result.status === 'fulfilled' ? result.value : null;
        if (!res) return;

        switch (key) {
          case 'apSummary': newData.apSummary = res.data; break;
          case 'arSummary': newData.arSummary = res.data; break;
          case 'finReport': newData.finReport = res.data; break;
          case 'assetSummary': newData.assetSummary = res.data; break;
          case 'woOpen': newData.woOpen = res.data?.total || 0; break;
          case 'woTotal': newData.woTotal = res.data?.total || 0; break;
          case 'lowStock': newData.lowStock = res.data?.count || 0; break;
          case 'employees': newData.employees = res.data?.total || 0; break;
          case 'monthlySummary': newData.monthlySummary = res.data?.months || []; break;
          default:
            if (approvalKeys.includes(key)) {
              const count = res.data?.total || (res.data?.items || []).length || 0;
              totalPending += count;
            }
        }
      });
      newData.pendingApprovals = totalPending;
      return newData;
    });
    setLoading(false);
    setLastUpdated(dayjs().format('HH:mm'));
  }, [can]);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData();
    }, 300_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const { apSummary, arSummary, finReport, assetSummary } = data;

  // Row 1 — Financial cards
  const financialCards = [];
  if (can('finance.invoice.read')) {
    financialCards.push({
      title: 'ค้างชำระ (AP)',
      value: apSummary ? `${formatCurrency(apSummary.total_payable)} ฿` : '—',
      subtitle: apSummary?.total_overdue > 0 ? `${apSummary.total_overdue} รายการเกินกำหนด` : 'ไม่มีค้าง',
      icon: <ArrowDownLeft size={20} />,
      color: apSummary?.total_overdue > 0 ? COLORS.danger : COLORS.success,
      onClick: () => navigate('/finance'),
    });
  }
  if (can('finance.ar.read')) {
    financialCards.push({
      title: 'ลูกหนี้ (AR)',
      value: arSummary ? `${formatCurrency(arSummary.total_receivable)} ฿` : '—',
      subtitle: arSummary?.total_overdue > 0 ? `${arSummary.total_overdue} รายการค้างรับ` : 'ไม่มีค้าง',
      icon: <ArrowUpRight size={20} />,
      color: arSummary?.total_overdue > 0 ? COLORS.warning : COLORS.success,
      onClick: () => navigate('/finance'),
    });
  }
  if (can('finance.report.read')) {
    financialCards.push({
      title: 'ยอดขาย (SO)',
      value: finReport ? `${formatCurrency(finReport.sales?.total_amount)} ฿` : '—',
      subtitle: finReport ? `${finReport.sales?.total_orders || 0} ใบสั่งขาย` : '',
      icon: <TrendingUp size={20} />,
      color: COLORS.purple,
      onClick: () => navigate('/sales'),
    });
  }
  if (can('asset.asset.read')) {
    financialCards.push({
      title: 'สินทรัพย์ (NBV)',
      value: assetSummary ? `${formatCurrency(assetSummary.total_net_book_value)} ฿` : '—',
      subtitle: assetSummary ? `${assetSummary.total_assets || 0} รายการ` : '',
      icon: <Landmark size={20} />,
      color: COLORS.accent,
      onClick: () => navigate('/asset'),
    });
  }

  // Row 2 — Operations cards
  const opsCards = [];
  if (can('workorder.order.read')) {
    opsCards.push({
      title: 'WO เปิดอยู่',
      value: data.woOpen,
      subtitle: `จาก ${data.woTotal} ทั้งหมด`,
      icon: <FileText size={20} />,
      color: '#3b82f6',
      onClick: () => navigate('/workorders'),
    });
  }
  if (can('inventory.product.read')) {
    opsCards.push({
      title: 'Low Stock',
      value: data.lowStock,
      subtitle: 'รายการต่ำกว่าขั้นต่ำ',
      icon: <AlertTriangle size={20} />,
      color: data.lowStock > 0 ? COLORS.danger : COLORS.success,
      onClick: () => navigate('/supply-chain'),
    });
  }
  opsCards.push({
    title: 'รออนุมัติ',
    value: data.pendingApprovals,
    subtitle: 'รายการรอดำเนินการ',
    icon: <ClipboardCheck size={20} />,
    color: data.pendingApprovals > 0 ? COLORS.warning : COLORS.success,
    onClick: () => navigate('/approval'),
  });
  if (can('hr.employee.read')) {
    opsCards.push({
      title: 'พนักงาน',
      value: data.employees,
      icon: <Users size={20} />,
      color: COLORS.purple,
      onClick: () => navigate('/hr'),
    });
  }

  // Skeleton cards while loading
  const SkeletonRow = ({ count }) => (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Col xs={24} sm={12} lg={6} key={i}>
          <Skeleton.Button active style={{ width: '100%', height: 90, borderRadius: 8 }} block />
        </Col>
      ))}
    </Row>
  );

  return (
    <div>
      <PageHeader
        title={`${getGreeting()}, ${user?.full_name || 'User'}!`}
        subtitle={
          <span>
            ภาพรวมองค์กร
            {lastUpdated && <span style={{ marginLeft: 12, fontSize: 11, color: COLORS.textMuted }}>อัปเดต: {lastUpdated}</span>}
          </span>
        }
      />

      {loading ? (
        <>
          <SkeletonRow count={4} />
          <SkeletonRow count={4} />
        </>
      ) : (
        <>
          {/* Row 1 — Financial Overview */}
          {financialCards.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 500, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Financial Overview
              </div>
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {financialCards.map((card, i) => (
                  <Col xs={24} sm={12} lg={6} key={i}>
                    <StatCard {...card} />
                  </Col>
                ))}
              </Row>
            </>
          )}

          {/* Row 2 — Operations */}
          <div style={{ fontSize: 12, fontWeight: 500, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Operations
          </div>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {opsCards.map((card, i) => (
              <Col xs={24} sm={12} lg={6} key={i}>
                <StatCard {...card} />
              </Col>
            ))}
          </Row>

          {/* Row 3 — Charts */}
          {can('finance.report.read') && data.monthlySummary.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} lg={14}>
                <Card
                  title={<span style={{ fontSize: 14 }}>รายรับ vs รายจ่าย (6 เดือน)</span>}
                  size="small"
                  style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
                >
                  <Suspense fallback={<Skeleton active />}>
                  <LineChartCard
                    data={data.monthlySummary}
                    lines={[
                      { dataKey: 'so_amount', name: 'รายรับ (SO)', color: COLORS.success },
                      { dataKey: 'po_amount', name: 'รายจ่าย (PO)', color: COLORS.danger },
                    ]}
                    xKey="label"
                  />
                  </Suspense>
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card
                  title={<span style={{ fontSize: 14 }}>Work Orders ปิดต่อเดือน</span>}
                  size="small"
                  style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
                >
                  <Suspense fallback={<Skeleton active />}>
                  <BarChartCard
                    data={data.monthlySummary}
                    bars={[{ dataKey: 'wo_closed', name: 'WO ปิด', color: '#3b82f6' }]}
                    xKey="label"
                  />
                  </Suspense>
                </Card>
              </Col>
            </Row>
          )}

          {/* Row 4 — Quick Links */}
          <Card
            size="small"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
          >
            <Space wrap>
              {can('workorder.order.create') && (
                <Button type="primary" icon={<FileText size={14} />} onClick={() => navigate('/workorders')}>
                  สร้าง Work Order
                </Button>
              )}
              <Button icon={<ClipboardCheck size={14} />} onClick={() => navigate('/approval')}>
                Approve รายการ
              </Button>
              {can('finance.report.read') && (
                <Button icon={<BarChart3 size={14} />} onClick={() => navigate('/finance')}>
                  Finance Report
                </Button>
              )}
              {can('inventory.movement.create') && (
                <Button icon={<Package size={14} />} onClick={() => navigate('/supply-chain')}>
                  Stock Movement
                </Button>
              )}
            </Space>
          </Card>
        </>
      )}
    </div>
  );
}

// ============================================================
// Main Dashboard — routes by role
// ============================================================
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  if (role === 'staff' || role === 'viewer') {
    return <StaffDashboard />;
  }
  if (role === 'supervisor') {
    return <SupervisorDashboard />;
  }
  return <AdminDashboard />;
}
