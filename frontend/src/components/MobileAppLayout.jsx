import { Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout, Button, Typography, Spin } from 'antd';
import { LogOut } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useNotificationStore from '../stores/notificationStore';
import { COLORS } from '../utils/constants';
import NotificationBell from './NotificationBell';
import NotificationDrawer from './NotificationDrawer';
import MobileBottomNav from './MobileBottomNav';
import AppFooter from './AppFooter';
import { lazy } from 'react';

const { Header, Content } = Layout;
const { Text } = Typography;

// Lazy-loaded mobile pages
const MobileHomePage = lazy(() => import('../pages/mobile/MobileHomePage'));
const MyDailyReportPage = lazy(() => import('../pages/my/MyDailyReportPage'));
const MyLeavePage = lazy(() => import('../pages/my/MyLeavePage'));
const MyTasksPage = lazy(() => import('../pages/my/MyTasksPage'));
const MePage = lazy(() => import('../pages/my/MePage'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
      <Spin size="large" />
    </div>
  );
}

export default function MobileAppLayout() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Notification polling lifecycle ──
  useEffect(() => {
    useNotificationStore.getState().startPolling();
    return () => useNotificationStore.getState().stopPolling();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Compact Header */}
      <Header
        style={{
          background: COLORS.surface,
          height: 48,
          lineHeight: '48px',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}
      >
        <Text strong style={{ color: COLORS.accent, fontSize: 16 }}>
          SSS Corp
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell onClick={() => setDrawerOpen(true)} />
          <Button
            type="text"
            size="small"
            icon={<LogOut size={14} />}
            onClick={handleLogout}
            style={{ color: COLORS.textSecondary }}
          />
        </div>
      </Header>

      {/* Content Area */}
      <Content
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 12,
          paddingBottom: 68, // 56px bottom nav + 12px spacing
        }}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/m" element={<MobileHomePage />} />
            <Route path="/m/report" element={<MyDailyReportPage embedded />} />
            <Route path="/m/leave" element={<MyLeavePage embedded />} />
            <Route path="/m/tasks" element={<MyTasksPage embedded />} />
            <Route path="/m/me" element={<MePage />} />
            <Route path="*" element={<Navigate to="/m" replace />} />
          </Routes>
        </Suspense>
      </Content>

      {/* Bottom Navigation */}
      <MobileBottomNav />

      {/* Notification Drawer */}
      <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Layout>
  );
}
