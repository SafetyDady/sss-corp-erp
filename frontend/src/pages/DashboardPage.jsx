import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, App } from 'antd';
import { FileText, Package, Users, Wrench } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import { usePermission } from '../hooks/usePermission';
import { COLORS } from '../utils/constants';
import PageHeader from '../components/PageHeader';
import api from '../services/api';

export default function DashboardPage() {
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
        subtitle={`\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35, ${user?.full_name || 'User'}`}
      />

      <Row gutter={[16, 16]}>
        {statCards.map((stat, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <Statistic
                title={<span style={{ color: COLORS.textSecondary }}>{stat.title}</span>}
                value={stat.value}
                prefix={<span style={{ color: stat.color }}>{stat.icon}</span>}
                valueStyle={{ color: stat.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
