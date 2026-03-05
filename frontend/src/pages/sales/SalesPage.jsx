import { useState, useEffect } from 'react';
import { Tabs, Row, Col } from 'antd';
import { DollarSign, Truck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { COLORS } from '../../utils/constants';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';

import SOTab from './SOTab';
import DOTab from './DOTab';

export default function SalesPage() {
  const { can } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState({ so: 0, soApproved: 0, do: 0, doShipped: 0 });

  const defaultTab = searchParams.get('tab') || 'so';

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const requests = [];
        const keys = [];

        if (can('sales.order.read')) {
          requests.push(api.get('/api/sales/orders', { params: { limit: 1, offset: 0 } }));
          keys.push('so');
          requests.push(api.get('/api/sales/orders', { params: { limit: 1, offset: 0, status: 'APPROVED' } }));
          keys.push('soApproved');
        }
        if (can('sales.delivery.read')) {
          requests.push(api.get('/api/sales/delivery', { params: { limit: 1, offset: 0 } }));
          keys.push('do');
          requests.push(api.get('/api/sales/delivery', { params: { limit: 1, offset: 0, status: 'SHIPPED' } }));
          keys.push('doShipped');
        }

        const results = await Promise.allSettled(requests);
        const newStats = { ...stats };
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            newStats[keys[i]] = r.value.data?.total || 0;
          }
        });
        setStats(newStats);
      } catch {
        /* ignore */
      }
    };
    fetchStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tabItems = [];

  if (can('sales.order.read')) {
    tabItems.push({
      key: 'so',
      label: (
        <span><DollarSign size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{'ใบสั่งขาย (SO)'}</span>
      ),
      children: <SOTab />,
    });
  }

  if (can('sales.delivery.read')) {
    tabItems.push({
      key: 'do',
      label: (
        <span><Truck size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{'ใบส่งของ (DO)'}</span>
      ),
      children: <DOTab />,
    });
  }

  return (
    <div>
      <PageHeader title="Sales" subtitle={'ระบบขาย \u2014 ใบสั่งขาย (SO) และ ใบส่งของ (DO)'} />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {can('sales.order.read') && (
          <>
            <Col xs={12} sm={6}>
              <StatCard
                title={'SO \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14'}
                value={stats.so}
                subtitle={'\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E02\u0E32\u0E22'}
                icon={<DollarSign size={20} />}
                color={COLORS.accent}
              />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard
                title={'SO \u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E41\u0E25\u0E49\u0E27'}
                value={stats.soApproved}
                subtitle="APPROVED"
                icon={<DollarSign size={20} />}
                color={COLORS.success}
              />
            </Col>
          </>
        )}
        {can('sales.delivery.read') && (
          <>
            <Col xs={12} sm={6}>
              <StatCard
                title={'DO \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14'}
                value={stats.do}
                subtitle={'\u0E43\u0E1A\u0E2A\u0E48\u0E07\u0E02\u0E2D\u0E07'}
                icon={<Truck size={20} />}
                color={COLORS.purple}
              />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard
                title={'DO \u0E2A\u0E48\u0E07\u0E41\u0E25\u0E49\u0E27'}
                value={stats.doShipped}
                subtitle="SHIPPED"
                icon={<Truck size={20} />}
                color={'#10b981'}
              />
            </Col>
          </>
        )}
      </Row>

      <Tabs
        defaultActiveKey={defaultTab}
        type="card"
        items={tabItems}
        destroyOnHidden
        onChange={(key) => setSearchParams({ tab: key })}
      />
    </div>
  );
}
