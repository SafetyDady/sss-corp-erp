import { useState, useEffect } from 'react';
import { Tabs, Row, Col, App } from 'antd';
import { Package, Warehouse, Wrench, ArrowRightLeft, MapPin } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { COLORS } from '../../utils/constants';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';

import ProductListPage from '../inventory/ProductListPage';
import MovementListPage from '../inventory/MovementListPage';
import WarehouseListPage from '../warehouse/WarehouseListPage';
import LocationListPage from '../warehouse/LocationListPage';
import ToolListPage from '../tools/ToolListPage';

export default function SupplyChainPage() {
  const { can } = usePermission();
  const [stats, setStats] = useState({ products: 0, movements: 0, warehouses: 0, tools: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const requests = [];
        const keys = [];

        if (can('inventory.product.read')) {
          requests.push(api.get('/api/inventory/products', { params: { limit: 1, offset: 0 } }));
          keys.push('products');
        }
        if (can('inventory.movement.read')) {
          requests.push(api.get('/api/stock/movements', { params: { limit: 1, offset: 0 } }));
          keys.push('movements');
        }
        if (can('warehouse.warehouse.read')) {
          requests.push(api.get('/api/warehouse/warehouses', { params: { limit: 1, offset: 0 } }));
          keys.push('warehouses');
        }
        if (can('tools.tool.read')) {
          requests.push(api.get('/api/tools', { params: { limit: 1, offset: 0 } }));
          keys.push('tools');
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

  if (can('inventory.product.read')) {
    tabItems.push({
      key: 'products',
      label: (
        <span><Package size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Inventory</span>
      ),
      children: <ProductListPage embedded />,
    });
  }

  if (can('inventory.movement.read')) {
    tabItems.push({
      key: 'movements',
      label: (
        <span><ArrowRightLeft size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Stock Movements</span>
      ),
      children: <MovementListPage embedded />,
    });
  }

  if (can('warehouse.warehouse.read')) {
    tabItems.push({
      key: 'warehouses',
      label: (
        <span><Warehouse size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Warehouse</span>
      ),
      children: <WarehouseListPage embedded />,
    });
  }

  if (can('warehouse.location.read')) {
    tabItems.push({
      key: 'locations',
      label: (
        <span><MapPin size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Locations</span>
      ),
      children: <LocationListPage embedded />,
    });
  }

  if (can('tools.tool.read')) {
    tabItems.push({
      key: 'tools',
      label: (
        <span><Wrench size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />เครื่องมือ</span>
      ),
      children: <ToolListPage embedded />,
    });
  }

  return (
    <div>
      <PageHeader title="Supply Chain" subtitle="Inventory, Warehouse & Tools" />

      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {can('inventory.product.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="Products"
              value={stats.products}
              subtitle="รายการสินค้า"
              icon={<Package size={20} />}
              color={COLORS.accent}
            />
          </Col>
        )}
        {can('inventory.movement.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="Movements"
              value={stats.movements}
              subtitle="รายการเคลื่อนไหว"
              icon={<ArrowRightLeft size={20} />}
              color={COLORS.success}
            />
          </Col>
        )}
        {can('warehouse.warehouse.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="Warehouses"
              value={stats.warehouses}
              subtitle="คลังสินค้า"
              icon={<Warehouse size={20} />}
              color={COLORS.warning}
            />
          </Col>
        )}
        {can('tools.tool.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="Tools"
              value={stats.tools}
              subtitle="เครื่องมือ"
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
