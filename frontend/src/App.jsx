import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Layout, Menu, Button, Typography, Spin, theme } from 'antd';
import {
  LayoutDashboard, Package, Warehouse, FileText, ShoppingCart,
  DollarSign, BarChart3, Users, Wrench, Database, Settings,
  UserCheck, LogOut, User, ChevronLeft, ChevronRight,
} from 'lucide-react';
import useAuthStore from './stores/authStore';
import { usePermission } from './hooks/usePermission';
import { COLORS, ANT_THEME_TOKEN } from './utils/constants';
import './App.css';

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
const POListPage = lazy(() => import('./pages/purchasing/POListPage'));
const PODetailPage = lazy(() => import('./pages/purchasing/PODetailPage'));
const SOListPage = lazy(() => import('./pages/sales/SOListPage'));
const SODetailPage = lazy(() => import('./pages/sales/SODetailPage'));
const HRPage = lazy(() => import('./pages/hr/HRPage'));
const ToolListPage = lazy(() => import('./pages/tools/ToolListPage'));
const MasterDataPage = lazy(() => import('./pages/master/MasterDataPage'));
const CustomerListPage = lazy(() => import('./pages/customer/CustomerListPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));

const MENU_ITEMS = [
  { key: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard', permission: null },
  { key: '/inventory', icon: <Package size={18} />, label: 'Inventory', permission: 'inventory.product.read' },
  { key: '/warehouse', icon: <Warehouse size={18} />, label: 'Warehouse', permission: 'warehouse.warehouse.read' },
  { key: '/work-orders', icon: <FileText size={18} />, label: 'Work Orders', permission: 'workorder.order.read' },
  { key: '/purchasing', icon: <ShoppingCart size={18} />, label: 'Purchasing', permission: 'purchasing.po.read' },
  { key: '/sales', icon: <DollarSign size={18} />, label: 'Sales', permission: 'sales.order.read' },
  { key: '/hr', icon: <Users size={18} />, label: 'HR', permission: 'hr.timesheet.read' },
  { key: '/tools', icon: <Wrench size={18} />, label: 'Tools', permission: 'tools.tool.read' },
  { key: '/customers', icon: <UserCheck size={18} />, label: 'Customers', permission: 'customer.customer.read' },
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

  const visibleItems = MENU_ITEMS.filter(
    (item) => !item.permission || can(item.permission)
  ).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));

  const selectedKey = '/' + location.pathname.split('/')[1];

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
        <Content style={{ margin: 24, minHeight: 280 }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/inventory" element={<ProductListPage />} />
              <Route path="/inventory/movements" element={<MovementListPage />} />
              <Route path="/warehouse" element={<WarehouseListPage />} />
              <Route path="/warehouse/locations" element={<LocationListPage />} />
              <Route path="/work-orders" element={<WorkOrderListPage />} />
              <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
              <Route path="/purchasing" element={<POListPage />} />
              <Route path="/purchasing/:id" element={<PODetailPage />} />
              <Route path="/sales" element={<SOListPage />} />
              <Route path="/sales/:id" element={<SODetailPage />} />
              <Route path="/hr" element={<HRPage />} />
              <Route path="/tools" element={<ToolListPage />} />
              <Route path="/master" element={<MasterDataPage />} />
              <Route path="/customers" element={<CustomerListPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: ANT_THEME_TOKEN,
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
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
