import { useState, useEffect } from 'react';
import { Tabs, Row, Col } from 'antd';
import { ClipboardList, ShoppingCart } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { COLORS } from '../../utils/constants';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';

import PRTab from './PRTab';
import POTab from './POTab';

export default function PurchasingPage() {
  const { can } = usePermission();
  const [stats, setStats] = useState({ pr: 0, prPending: 0, po: 0, poApproved: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const requests = [];
        const keys = [];

        if (can('purchasing.pr.read')) {
          requests.push(api.get('/api/purchasing/pr', { params: { limit: 1, offset: 0 } }));
          keys.push('pr');
          requests.push(api.get('/api/purchasing/pr', { params: { limit: 1, offset: 0, status: 'SUBMITTED' } }));
          keys.push('prPending');
        }
        if (can('purchasing.po.read')) {
          requests.push(api.get('/api/purchasing/po', { params: { limit: 1, offset: 0 } }));
          keys.push('po');
          requests.push(api.get('/api/purchasing/po', { params: { limit: 1, offset: 0, status: 'APPROVED' } }));
          keys.push('poApproved');
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

  if (can('purchasing.pr.read')) {
    tabItems.push({
      key: 'pr',
      label: (
        <span><ClipboardList size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />ใบขอซื้อ (PR)</span>
      ),
      children: <PRTab />,
    });
  }

  if (can('purchasing.po.read')) {
    tabItems.push({
      key: 'po',
      label: (
        <span><ShoppingCart size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />ใบสั่งซื้อ (PO)</span>
      ),
      children: <POTab />,
    });
  }

  return (
    <div>
      <PageHeader title="Purchasing" subtitle="ระบบจัดซื้อ — ใบขอซื้อ (PR) และ ใบสั่งซื้อ (PO)" />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {can('purchasing.pr.read') && (
          <>
            <Col xs={12} sm={6}>
              <StatCard
                title="PR ทั้งหมด"
                value={stats.pr}
                subtitle="ใบขอซื้อ"
                icon={<ClipboardList size={20} />}
                color={COLORS.accent}
              />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard
                title="PR รออนุมัติ"
                value={stats.prPending}
                subtitle="SUBMITTED"
                icon={<ClipboardList size={20} />}
                color={COLORS.warning}
              />
            </Col>
          </>
        )}
        {can('purchasing.po.read') && (
          <>
            <Col xs={12} sm={6}>
              <StatCard
                title="PO ทั้งหมด"
                value={stats.po}
                subtitle="ใบสั่งซื้อ"
                icon={<ShoppingCart size={20} />}
                color={COLORS.success}
              />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard
                title="PO รอรับของ"
                value={stats.poApproved}
                subtitle="APPROVED"
                icon={<ShoppingCart size={20} />}
                color={COLORS.purple}
              />
            </Col>
          </>
        )}
      </Row>

      <Tabs defaultActiveKey={tabItems[0]?.key} type="card" items={tabItems} destroyOnHidden />
    </div>
  );
}
