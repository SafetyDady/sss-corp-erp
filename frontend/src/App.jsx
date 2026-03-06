import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Layout, Menu, Button, Typography, Spin, theme } from 'antd';
import {
  LayoutDashboard, Package, Warehouse, FileText, ShoppingCart,
  DollarSign, BarChart3, Users, Wrench, Database, Settings,
  UserCheck, LogOut, User, ChevronLeft, ChevronRight, CalendarRange,
  ClipboardList, CalendarOff, Clock, CalendarCheck, Boxes,
  ClipboardCheck, ClipboardPen, Store,
} from 'lucide-react';
import useAuthStore from './stores/authStore';
import { usePermission } from './hooks/usePermission';
import { COLORS, ANT_THEME_TOKEN } from './utils/constants';
import './App.css';
import AppFooter from './components/AppFooter';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

// Lazy-loaded pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductListPage = lazy(() => import('./pages/inventory/ProductListPage'));
const MovementListPage = lazy(() => import('./pages/inventory/MovementListPage'));
const WarehouseListPage = lazy(() => import('./pages/warehouse/WarehouseListPage'));
const LocationListPage = lazy(() => import('./pages/warehouse/LocationListPage'));
const WorkOrderListPage = lazy(() => import('./pages/workorder/WorkOrderListPage'));
const WorkOrderDetailPage = lazy(() => import('./pages/workorder/WorkOrderDetailPage'));
const PurchasingPage = lazy(() => import('./pages/purchasing/PurchasingPage'));
const PRDetailPage = lazy(() => import('./pages/purchasing/PRDetailPage'));
const PODetailPage = lazy(() => import('./pages/purchasing/PODetailPage'));
const SalesPage = lazy(() => import('./pages/sales/SalesPage'));
const SODetailPage = lazy(() => import('./pages/sales/SODetailPage'));
const DODetailPage = lazy(() => import('./pages/sales/DODetailPage'));
const HRPage = lazy(() => import('./pages/hr/HRPage'));
const ToolListPage = lazy(() => import('./pages/tools/ToolListPage'));
const MasterDataPage = lazy(() => import('./pages/master/MasterDataPage'));
const CustomerListPage = lazy(() => import('./pages/customer/CustomerListPage'));
const FinancePage = lazy(() => import('./pages/finance/FinancePage'));
const InvoiceDetailPage = lazy(() => import('./pages/finance/InvoiceDetailPage'));
const ARDetailPage = lazy(() => import('./pages/finance/ARDetailPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const PlanningPage = lazy(() => import('./pages/planning/PlanningPage'));
const SetupWizardPage = lazy(() => import('./pages/setup/SetupWizardPage'));
const MePage = lazy(() => import('./pages/my/MePage'));
const ApprovalPage = lazy(() => import('./pages/approval/ApprovalPage'));
const SupplyChainPage = lazy(() => import('./pages/supply-chain/SupplyChainPage'));
const WithdrawalSlipDetailPage = lazy(() => import('./pages/supply-chain/WithdrawalSlipDetailPage'));
const CommonActPage = lazy(() => import('./pages/common-act/CommonActPage'));
const StoreRoomPage = lazy(() => import('./pages/store/StoreRoomPage'));

// --- Sidebar Menu Groups ---

const MY_MENU_ITEMS = [
  { key: '/me', icon: <User size={18} />, label: 'ME', permission: '_me_check' },
];

const COMMON_ACT_MENU_ITEMS = [
  { key: '/common-act', icon: <ClipboardPen size={18} />, label: 'ดำเนินการ', permission: '_common_act_check' },
];

const APPROVAL_MENU_ITEMS = [
  { key: '/approval', icon: <ClipboardCheck size={18} />, label: 'My Approval', permission: '_approval_check' },
];

const SYSTEM_MENU_ITEMS = [
  { key: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard', permission: null },
  { key: '/supply-chain', icon: <Boxes size={18} />, label: 'Supply Chain', permission: 'inventory.product.read' },
  { key: '/store', icon: <Store size={18} />, label: 'Store & Tools', permission: '_store_check' },
  { key: '/work-orders', icon: <FileText size={18} />, label: 'Work Orders', permission: 'workorder.order.read' },
  { key: '/purchasing', icon: <ShoppingCart size={18} />, label: 'Purchasing', permission: '_purchasing_check' },
  { key: '/sales', icon: <DollarSign size={18} />, label: 'Sales', permission: '_sales_check' },
  { key: '/hr', icon: <Users size={18} />, label: 'HR', permission: 'hr.employee.read' },
  { key: '/customers', icon: <UserCheck size={18} />, label: 'Customers', permission: 'customer.customer.read' },
  { key: '/planning', icon: <CalendarRange size={18} />, label: 'Planning', permission: 'workorder.plan.read' },
  { key: '/master', icon: <Database size={18} />, label: 'Master Data', permission: 'master.costcenter.read' },
  { key: '/finance', icon: <BarChart3 size={18} />, label: 'Finance', permission: 'finance.report.read' },
  { key: '/admin', icon: <Settings size={18} />, label: 'Admin', permission: 'admin.user.read' },
];

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
      <Spin size="large" />
    </div>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { can } = usePermission();
  const [collapsed, setCollapsed] = useState(false);

  // Group 1: ส่วนตัว (ME)
  const myItems = MY_MENU_ITEMS.filter((item) => {
    if (item.permission === '_me_check') {
      return can('hr.timesheet.read') || can('hr.leave.read') || can('hr.payroll.read');
    }
    return !item.permission || can(item.permission);
  }).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));

  // Group 2: ดำเนินการ (Common-Act) — ไม่ใช้ dept menu filter (personal)
  const commonActItems = COMMON_ACT_MENU_ITEMS.filter((item) => {
    if (item.permission === '_common_act_check') {
      return can('inventory.withdrawal.create') || can('inventory.withdrawal.read') ||
             can('purchasing.pr.create') || can('purchasing.pr.read') ||
             can('tools.tool.execute') || can('tools.tool.read') ||
             can('hr.dailyreport.create') || can('hr.dailyreport.read') ||
             can('hr.leave.create') || can('hr.leave.read') ||
             can('workorder.plan.read');
    }
    return !item.permission || can(item.permission);
  }).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));

  // Group 3: อนุมัติ
  const approvalItems = APPROVAL_MENU_ITEMS.filter((item) => {
    if (item.permission === '_approval_check') {
      return can('hr.dailyreport.approve') || can('hr.timesheet.approve') ||
             can('hr.leave.approve') || can('purchasing.pr.approve') ||
             can('purchasing.po.approve') || can('sales.order.approve');
    }
    return !item.permission || can(item.permission);
  }).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));

  // Group 4: ระบบงาน — with dept menu filter (G6)
  const deptMenu = useAuthStore((s) => s.deptMenu);

  const systemItems = SYSTEM_MENU_ITEMS.filter((item) => {
    // 1) Permission check first
    if (item.permission === '_purchasing_check') {
      if (!can('purchasing.pr.read') && !can('purchasing.po.read')) return false;
    } else if (item.permission === '_sales_check') {
      if (!can('sales.order.read') && !can('sales.delivery.read')) return false;
    } else if (item.permission === '_store_check') {
      if (!can('inventory.withdrawal.approve') && !can('inventory.withdrawal.read') && !can('tools.tool.read')) return false;
    } else if (item.permission && !can(item.permission)) {
      return false;
    }
    // 2) Dept menu visibility filter (G6) — skip if no config or dashboard
    if (deptMenu && Object.keys(deptMenu).length > 0) {
      const menuKey = item.key.replace(/^\//, '') || 'dashboard'; // "/" → "dashboard"
      if (deptMenu[menuKey] === false) return false;
    }
    return true;
  }).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));

  const visibleItems = [
    // Group 1: ส่วนตัว
    ...(myItems.length > 0
      ? [
          { key: 'grp-my', type: 'group', label: collapsed ? null : 'ส่วนตัว', children: myItems },
        ]
      : []),
    // Group 2: ดำเนินการ
    ...(commonActItems.length > 0
      ? [
          { key: 'grp-common-act', type: 'group', label: collapsed ? null : 'ดำเนินการ', children: commonActItems },
        ]
      : []),
    // Group 3: อนุมัติ
    ...(approvalItems.length > 0
      ? [
          { key: 'grp-approval', type: 'group', label: collapsed ? null : 'อนุมัติ', children: approvalItems },
        ]
      : []),
    // Group 4: ระบบงาน
    { key: 'grp-system', type: 'group', label: collapsed ? null : 'ระบบงาน', children: systemItems },
  ];

  const selectedKey = (() => {
    const path = location.pathname;
    if (path === '/me' || path === '/my/timesheet') return '/me';
    if (path === '/common-act') return '/common-act';
    if (path === '/approval') return '/approval';
    if (path === '/store') return '/store';
    if (path.startsWith('/supply-chain') || path.startsWith('/inventory') || path.startsWith('/warehouse')) return '/supply-chain';
    if (path.startsWith('/withdrawal-slips')) return '/store';
    return '/' + path.split('/')[1];
  })();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={210}
        collapsedWidth={56}
        collapsed={collapsed}
        style={{ background: COLORS.sidebar, position: 'relative' }}
        theme="dark"
      >
        <div
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: `1px solid ${COLORS.sidebarBorder}`,
          }}
        >
          <Text strong style={{ color: COLORS.accent, fontSize: collapsed ? 14 : 16 }}>
            {collapsed ? 'SSS' : 'SSS Corp'}
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={visibleItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 0, marginTop: 8 }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            padding: collapsed ? '8px 4px' : '8px 16px',
            borderTop: `1px solid ${COLORS.sidebarBorder}`,
          }}
        >
          {!collapsed && (
            <div style={{ marginBottom: 8 }}>
              <Text style={{ color: COLORS.text, fontSize: 12, display: 'block' }}>
                {user?.full_name}
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
                {user?.role}
              </Text>
            </div>
          )}
          <Button
            type="text"
            size="small"
            icon={collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ color: COLORS.textSecondary, width: '100%' }}
          />
        </div>
      </Sider>
      <Layout>
        <Header
          style={{
            background: COLORS.surface,
            height: 48,
            lineHeight: '48px',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 16,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
            <User size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {user?.full_name}
            <span style={{ color: COLORS.textMuted, marginLeft: 8 }}>({user?.role})</span>
          </Text>
          <Button
            type="text"
            size="small"
            icon={<LogOut size={14} />}
            onClick={logout}
            style={{ color: COLORS.textSecondary }}
          >
            {'\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A'}
          </Button>
        </Header>
        <Content style={{ margin: 24, minHeight: 280, flex: 1, overflow: 'auto' }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/me" element={<MePage />} />
              <Route path="/my/timesheet" element={<MePage />} />
              {/* Old /my/* routes redirect to /common-act */}
              <Route path="/my/daily-report" element={<Navigate to="/common-act" replace />} />
              <Route path="/my/leave" element={<Navigate to="/common-act" replace />} />
              <Route path="/my/tasks" element={<Navigate to="/common-act" replace />} />
              <Route path="/common-act" element={<CommonActPage />} />
              <Route path="/store" element={<StoreRoomPage />} />
              <Route path="/approval" element={<ApprovalPage />} />
              <Route path="/supply-chain" element={<SupplyChainPage />} />
              <Route path="/inventory" element={<Navigate to="/supply-chain" replace />} />
              <Route path="/inventory/movements" element={<Navigate to="/supply-chain" replace />} />
              <Route path="/warehouse" element={<Navigate to="/supply-chain" replace />} />
              <Route path="/warehouse/locations" element={<Navigate to="/supply-chain" replace />} />
              <Route path="/tools" element={<Navigate to="/store" replace />} />
              <Route path="/withdrawal-slips/:id" element={<WithdrawalSlipDetailPage />} />
              <Route path="/work-orders" element={<WorkOrderListPage />} />
              <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
              <Route path="/purchasing" element={<PurchasingPage />} />
              <Route path="/purchasing/pr/:id" element={<PRDetailPage />} />
              <Route path="/purchasing/po/:id" element={<PODetailPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/sales/delivery/:id" element={<DODetailPage />} />
              <Route path="/sales/:id" element={<SODetailPage />} />
              <Route path="/hr" element={<HRPage />} />
              <Route path="/master" element={<MasterDataPage />} />
              <Route path="/customers" element={<CustomerListPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/finance/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/finance/ar/:id" element={<ARDetailPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </Content>
        <AppFooter />
      </Layout>
    </Layout>
  );
}

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  if (!hasHydrated) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: ANT_THEME_TOKEN,
        components: {
          Message: { zIndexPopup: 2050 },
          Notification: { zIndexPopup: 2050 },
        },
      }}
    >
      <AntApp message={{ maxCount: 3 }} notification={{ placement: 'topRight' }}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/setup" element={<SetupWizardPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
