import { Typography, Card, Row, Col, Statistic } from 'antd';
import {
  ShoppingCartOutlined,
  TeamOutlined,
  ToolOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import useAuthStore from '../stores/authStore';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <Title level={4}>
        สวัสดี, {user?.full_name || 'User'} 👋
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Role: {user?.role} • Permissions: {user?.permissions?.length || 0}
      </Text>

      <Row gutter={[16, 16]}>
        {[
          { title: 'Work Orders', value: 0, icon: <FileTextOutlined />, color: '#3b82f6' },
          { title: 'Inventory Items', value: 0, icon: <ShoppingCartOutlined />, color: '#10b981' },
          { title: 'Employees', value: 0, icon: <TeamOutlined />, color: '#8b5cf6' },
          { title: 'Tools', value: 0, icon: <ToolOutlined />, color: '#f59e0b' },
        ].map((stat, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={stat.icon}
                valueStyle={{ color: stat.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
