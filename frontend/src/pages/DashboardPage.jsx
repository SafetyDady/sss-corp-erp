import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Row, Col, Table, App, Typography, Space } from 'antd';
import {
  FileText, Package, Users, Wrench, ClipboardList, CalendarOff,
  CalendarCheck, Clock, ArrowRight, Edit, CheckCircle,
} from 'lucide-react';
import dayjs from 'dayjs';
import useAuthStore from '../stores/authStore';
import { usePermission } from '../hooks/usePermission';
import { COLORS } from '../utils/constants';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import ScopeBadge from '../components/ScopeBadge';
import api from '../services/api';

const { Text } = Typography;

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
    },
    {
      title: 'วันลาเหลือ',
      value: leaveBalance ? `${Number(leaveBalance.quota || 0) - Number(leaveBalance.used || 0)}` : '—',
      suffix: leaveBalance ? 'วัน' : '',
      icon: <CalendarOff size={20} />,
      color: COLORS.accent,
    },
    {
      title: 'งานวันนี้',
      value: todayTasks,
      suffix: 'WO',
      icon: <CalendarCheck size={20} />,
      color: COLORS.purple,
    },
    {
      title: 'คำขอรออนุมัติ',
      value: pendingLeaves,
      suffix: 'ใบลา',
      icon: <Clock size={20} />,
      color: COLORS.warning,
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
        title={`สวัสดี, ${employeeName || user?.full_name || 'User'}!`}
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
            onClick={() => navigate('/me')}
          >
            กรอก Report วันนี้
          </Button>
          <Button icon={<CalendarOff size={14} />} onClick={() => navigate('/me')}>
            ขอลา
          </Button>
          <Button icon={<CalendarCheck size={14} />} onClick={() => navigate('/me')}>
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
          <Button type="link" size="small" onClick={() => navigate('/me')}>
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
  const [myReport, setMyReport] = useState(null);
  const [myLeaveBalance, setMyLeaveBalance] = useState(null);

  useEffect(() => {
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
    requests.push(
      api.get('/api/daily-report', { params: { status: 'SUBMITTED', limit: 1, offset: 0 } })
        .then((r) => ({ key: 'pendingApprovals', value: r.data.total || 0 }))
        .catch(() => ({ key: 'pendingApprovals', value: 0 }))
    );
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

    Promise.all(requests).then((results) => {
      setStats((prev) => {
        const newStats = { ...prev };
        results.forEach((r) => {
          if (r.key === '_myReport') setMyReport(r.value);
          else if (r.key === '_myBalance') {
            const annual = r.value.find((b) => b.leave_type_code === 'ANNUAL');
            setMyLeaveBalance(annual || (r.value.length > 0 ? r.value[0] : null));
          }
          else newStats[r.key] = r.value;
        });
        return newStats;
      });
    });
  }, [employeeId]);

  const deptCards = [
    { title: 'พนักงานในแผนก', value: stats.deptEmployees, icon: <Users size={20} />, color: COLORS.purple },
    { title: 'รายงานวันนี้', value: stats.todayReports, icon: <ClipboardList size={20} />, color: COLORS.accent },
    { title: 'รอการอนุมัติ', value: stats.pendingApprovals, icon: <CheckCircle size={20} />, color: COLORS.warning },
    { title: 'Work Orders', value: stats.workOrders, icon: <FileText size={20} />, color: '#3b82f6' },
  ];

  return (
    <div>
      <PageHeader
        title={`สวัสดี, ${employeeName || user?.full_name || 'User'}!`}
        subtitle={<span>ภาพรวมแผนก <ScopeBadge /></span>}
      />

      {/* Department Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {deptCards.map((card, i) => (
          <Col xs={12} sm={12} md={6} key={i}>
            <StatCard title={card.title} value={card.value} icon={card.icon} color={card.color} />
          </Col>
        ))}
      </Row>

      {/* Quick Actions */}
      <Card
        size="small"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}
      >
        <Space wrap>
          {can('hr.dailyreport.approve') && (
            <Button type="primary" icon={<CheckCircle size={14} />} onClick={() => navigate('/hr')}>
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
            />
          </Col>
          <Col xs={12}>
            <StatCard
              title="วันลาเหลือ"
              value={myLeaveBalance ? `${Number(myLeaveBalance.quota || 0) - Number(myLeaveBalance.used || 0)}` : '—'}
              subtitle={myLeaveBalance ? 'วัน' : ''}
              icon={<CalendarOff size={20} />}
              color={COLORS.accent}
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
  const user = useAuthStore((s) => s.user);
  const { can } = usePermission();
  const [stats, setStats] = useState({ workOrders: 0, products: 0, employees: 0, tools: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const requests = [];
        if (can('workorder.order.read')) {
          requests.push(
            api.get('/api/work-orders', { params: { limit: 1, offset: 0 } })
              .then((r) => ({ key: 'workOrders', value: r.data.total }))
              .catch(() => ({ key: 'workOrders', value: 0 }))
          );
        }
        if (can('inventory.product.read')) {
          requests.push(
            api.get('/api/inventory/products', { params: { limit: 1, offset: 0 } })
              .then((r) => ({ key: 'products', value: r.data.total }))
              .catch(() => ({ key: 'products', value: 0 }))
          );
        }
        if (can('hr.employee.read')) {
          requests.push(
            api.get('/api/hr/employees', { params: { limit: 1, offset: 0 } })
              .then((r) => ({ key: 'employees', value: r.data.total }))
              .catch(() => ({ key: 'employees', value: 0 }))
          );
        }
        if (can('tools.tool.read')) {
          requests.push(
            api.get('/api/tools', { params: { limit: 1, offset: 0 } })
              .then((r) => ({ key: 'tools', value: r.data.total }))
              .catch(() => ({ key: 'tools', value: 0 }))
          );
        }
        const results = await Promise.all(requests);
        const newStats = { ...stats };
        results.forEach((r) => { newStats[r.key] = r.value; });
        setStats(newStats);
      } catch {
        // silently fail
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { title: 'Work Orders', value: stats.workOrders, icon: <FileText size={20} />, color: '#3b82f6' },
    { title: 'Inventory Items', value: stats.products, icon: <Package size={20} />, color: COLORS.success },
    { title: 'Employees', value: stats.employees, icon: <Users size={20} />, color: COLORS.purple },
    { title: 'Tools', value: stats.tools, icon: <Wrench size={20} />, color: COLORS.warning },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`สวัสดี, ${user?.full_name || 'User'}`}
      />
      <Row gutter={[16, 16]}>
        {statCards.map((stat, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <StatCard
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
            />
          </Col>
        ))}
      </Row>
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
