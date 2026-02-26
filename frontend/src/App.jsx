import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Layout, Menu, Button, Typography, theme } from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  HomeOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  DollarOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
  LogoutOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import useAuthStore from './stores/authStore';
import { usePermission } from './hooks/usePermission';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

// Module menu config with required permissions
const MENU_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard', permission: null },
  { key: '/inventory', icon: <ShoppingCartOutlined />, label: 'Inventory', permission: 'inventory.product.read' },
  { key: '/warehouse', icon: <HomeOutlined />, label: 'Warehouse', permission: 'warehouse.location.read' },
  { key: '/work-orders', icon: <FileTextOutlined />, label: 'Work Orders', permission: 'workorder.order.read' },
  { key: '/purchasing', icon: <ShoppingOutlined />, label: 'Purchasing', permission: 'purchasing.po.read' },
  { key: '/sales', icon: <DollarOutlined />, label: 'Sales', permission: 'sales.order.read' },
  { key: '/hr', icon: <TeamOutlined />, label: 'HR', permission: 'hr.employee.read' },
  { key: '/tools', icon: <ToolOutlined />, label: 'Tools', permission: 'tools.tool.read' },
  { key: '/master', icon: <AppstoreOutlined />, label: 'Master Data', permission: 'master.category.read' },
  { key: '/admin', icon: <SettingOutlined />, label: 'Admin', permission: 'admin.user.read' },
];

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { can } = usePermission();

  // Filter menu items by permission
  const visibleItems = MENU_ITEMS.filter(
    (item) => !item.permission || can(item.permission)
  ).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{ background: '#0f172a' }}
        theme="dark"
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Text strong style={{ color: '#fff', fontSize: 18 }}>
            SSS Corp
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={visibleItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 16,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          <Text>
            <UserOutlined /> {user?.full_name}
            <Text type="secondary" style={{ marginLeft: 8 }}>
              ({user?.role})
            </Text>
          </Text>
          <Button icon={<LogoutOutlined />} size="small" onClick={logout}>
            ออกจากระบบ
          </Button>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            {/* Phase 1+ routes will be added here */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
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
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1e40af',
          borderRadius: 8,
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
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
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
