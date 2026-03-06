import { useState, useEffect } from 'react';
import { Tabs, Row, Col, Table, Card, Typography } from 'antd';
import { ClipboardList, Wrench, Package, AlertTriangle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { COLORS } from '../../utils/constants';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';

import WithdrawalSlipTab from '../supply-chain/WithdrawalSlipTab';
import ToolListPage from '../tools/ToolListPage';
import ProductListPage from '../inventory/ProductListPage';

const { Text } = Typography;

/**
 * StoreRoomPage — Store & Tools Room (เจ้าหน้าที่ Store)
 *
 * 3 Workflows:
 * 1. System pre-prepared: ดูใบเบิก PENDING → เตรียมของ → Issue
 * 2. System walk-in: requester submit ผ่าน Common-Act → ขึ้นจอ store ทันที
 * 3. Manual paper-based: เจ้าหน้าที่ store สร้าง slip แทน requester → กรอกของ → Issue ทันที
 */
export default function StoreRoomPage() {
  const { can } = usePermission();
  const [stats, setStats] = useState({ pendingSlips: 0, lowStock: 0, checkedOutTools: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const requests = [];
        const keys = [];

        // Pending withdrawal slips
        if (can('inventory.withdrawal.read')) {
          requests.push(api.get('/api/inventory/withdrawal-slips', {
            params: { limit: 1, offset: 0, status: 'PENDING' },
          }));
          keys.push('pendingSlips');
        }
        // Low stock count
        if (can('inventory.product.read')) {
          requests.push(api.get('/api/inventory/low-stock-count'));
          keys.push('lowStock');
        }
        // Tools
        if (can('tools.tool.read')) {
          requests.push(api.get('/api/tools', { params: { limit: 1, offset: 0 } }));
          keys.push('checkedOutTools');
        }

        const results = await Promise.allSettled(requests);
        const newStats = { ...stats };
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            if (keys[i] === 'lowStock') {
              newStats[keys[i]] = r.value.data?.count || 0;
            } else {
              newStats[keys[i]] = r.value.data?.total || 0;
            }
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

  // Tab 1: รอจ่ายของ (DEFAULT — store mode)
  if (can('inventory.withdrawal.read')) {
    tabItems.push({
      key: 'pending',
      label: (
        <span><ClipboardList size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />รอจ่ายของ</span>
      ),
      children: <WithdrawalSlipTab storeMode />,
    });
  }

  // Tab 2: เครื่องมือ (full management mode for store officer)
  if (can('tools.tool.read')) {
    tabItems.push({
      key: 'tools',
      label: (
        <span><Wrench size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />เครื่องมือ</span>
      ),
      children: <ToolListPage embedded />,
    });
  }

  // Tab 3: สินค้าคงคลัง (lookup)
  if (can('inventory.product.read')) {
    tabItems.push({
      key: 'products',
      label: (
        <span><Package size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />สินค้าคงคลัง</span>
      ),
      children: <ProductListPage embedded />,
    });
  }

  // Tab 4: Low Stock Alerts
  if (can('inventory.product.read')) {
    tabItems.push({
      key: 'low-stock',
      label: (
        <span><AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />แจ้งเตือน Stock</span>
      ),
      children: <LowStockAlertTab />,
    });
  }

  return (
    <div>
      <PageHeader title="Store & Tools Room" subtitle="คลังเครื่องมือ — จัดการใบเบิก, เครื่องมือ, สินค้าคงคลัง" />

      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {can('inventory.withdrawal.read') && (
          <Col xs={12} sm={8}>
            <StatCard
              title="รอจ่ายของ"
              value={stats.pendingSlips}
              subtitle="PENDING Slips"
              icon={<ClipboardList size={20} />}
              color="#f59e0b"
            />
          </Col>
        )}
        {can('inventory.product.read') && (
          <Col xs={12} sm={8}>
            <StatCard
              title="Low Stock"
              value={stats.lowStock}
              subtitle="ต่ำกว่า Min Stock"
              icon={<AlertTriangle size={20} />}
              color={COLORS.danger}
            />
          </Col>
        )}
        {can('tools.tool.read') && (
          <Col xs={12} sm={8}>
            <StatCard
              title="เครื่องมือ"
              value={stats.checkedOutTools}
              subtitle="Tools"
              icon={<Wrench size={20} />}
              color={COLORS.purple}
            />
          </Col>
        )}
      </Row>

      <Tabs defaultActiveKey={tabItems[0]?.key} type="card" items={tabItems} destroyOnHidden />
    </div>
  );
}

/**
 * LowStockAlertTab — Inline tab showing products below min_stock
 */
function LowStockAlertTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/api/inventory/products', {
          params: {
            limit: pagination.pageSize,
            offset: (pagination.current - 1) * pagination.pageSize,
          },
        });
        // Client-side filter: show only low stock items (min_stock > 0 && on_hand <= min_stock)
        const allItems = data.items || [];
        const lowStockItems = allItems.filter(
          (p) => p.min_stock > 0 && p.on_hand <= p.min_stock,
        );
        setItems(lowStockItems);
        setTotal(lowStockItems.length);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pagination]);

  const columns = [
    {
      title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{v}</span>,
    },
    {
      title: 'ชื่อสินค้า', dataIndex: 'name', key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'คงเหลือ', dataIndex: 'on_hand', key: 'on_hand', width: 100, align: 'right',
      render: (v) => <span style={{ color: COLORS.danger, fontWeight: 600, fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'Min Stock', dataIndex: 'min_stock', key: 'min_stock', width: 100, align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'Unit', dataIndex: 'unit', key: 'unit', width: 80,
    },
    {
      title: 'ประเภท', dataIndex: 'type', key: 'type', width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
  ];

  return (
    <div>
      <Card
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text style={{ color: COLORS.textSecondary }}>
            <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: COLORS.danger }} />
            สินค้าที่คงเหลือต่ำกว่า Min Stock — ควรสั่งซื้อเพิ่ม
          </Text>
        </div>
        <Table
          loading={loading}
          dataSource={items}
          columns={columns}
          rowKey="id"
          locale={{ emptyText: <EmptyState message="ไม่มีสินค้าต่ำกว่า Min Stock" /> }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          }}
          size="small"
        />
      </Card>
    </div>
  );
}
