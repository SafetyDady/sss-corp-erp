/**
 * StockByBatchTab — Stock breakdown by Batch/Lot Number (Phase 11.12)
 * Table: Batch Number, Product, Location, Warehouse, On Hand, Unit Cost, Received Date
 */
import { useState, useEffect, useCallback } from 'react';
import { Table, Select, App, Input, Tag } from 'antd';
import { Layers, RefreshCw } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import EmptyState from '../../components/EmptyState';

export default function StockByBatchTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ product_id: null, location_id: null, batch_number: '' });
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);

  // Fetch dropdowns
  useEffect(() => {
    if (can('inventory.product.read')) {
      api.get('/api/inventory/products', { params: { limit: 200, offset: 0 } })
        .then((r) => setProducts(r.data?.items || []))
        .catch(() => {});
    }
    if (can('warehouse.location.read')) {
      api.get('/api/warehouse/locations', { params: { limit: 200, offset: 0 } })
        .then((r) => setLocations(r.data?.items || []))
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
      };
      if (filters.product_id) params.product_id = filters.product_id;
      if (filters.location_id) params.location_id = filters.location_id;
      if (filters.batch_number) params.batch_number = filters.batch_number;

      const res = await api.get('/api/inventory/stock-by-batch', { params });
      setItems(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูล Batch ได้');
    } finally {
      setLoading(false);
    }
  }, [pagination, filters, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      title: 'Batch/Lot No.', dataIndex: 'batch_number', key: 'batch_number', width: 180,
      render: (v) => (
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'SKU', dataIndex: 'product_sku', key: 'sku', width: 120,
      render: (v) => (
        <span style={{ fontFamily: 'monospace', color: COLORS.accent, fontSize: 12 }}>
          {v || '-'}
        </span>
      ),
    },
    {
      title: 'Product', dataIndex: 'product_name', key: 'product_name', ellipsis: true,
    },
    {
      title: 'Unit', dataIndex: 'product_unit', key: 'unit', width: 70,
      render: (v) => v || '-',
    },
    {
      title: 'Location', key: 'location', width: 180,
      render: (_, record) => {
        if (!record.location_name) return <span style={{ color: COLORS.textSecondary }}>-</span>;
        return (
          <span>
            {record.warehouse_name && (
              <span style={{ color: COLORS.textSecondary }}>{record.warehouse_name} / </span>
            )}
            {record.location_name}
          </span>
        );
      },
    },
    {
      title: 'On Hand', dataIndex: 'on_hand', key: 'on_hand', width: 100, align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{v?.toLocaleString('th-TH') || 0}</span>,
    },
    {
      title: 'Unit Cost', dataIndex: 'unit_cost', key: 'unit_cost', width: 120, align: 'right',
      render: (v) => formatCurrency(v),
    },
    {
      title: 'Received', dataIndex: 'received_date', key: 'received_date', width: 160,
      render: (v) => v ? formatDateTime(v) : '-',
    },
  ];

  return (
    <div>
      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input.Search
          placeholder="ค้นหา Batch No."
          allowClear
          style={{ width: 200 }}
          onSearch={(val) => {
            setFilters((prev) => ({ ...prev, batch_number: val }));
            setPagination((prev) => ({ ...prev, current: 1 }));
          }}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Product"
          style={{ width: 220 }}
          value={filters.product_id}
          onChange={(v) => {
            setFilters((prev) => ({ ...prev, product_id: v || null }));
            setPagination((prev) => ({ ...prev, current: 1 }));
          }}
          options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Location"
          style={{ width: 200 }}
          value={filters.location_id}
          onChange={(v) => {
            setFilters((prev) => ({ ...prev, location_id: v || null }));
            setPagination((prev) => ({ ...prev, current: 1 }));
          }}
          options={locations.map((l) => ({ value: l.id, label: `${l.code} - ${l.name}` }))}
        />
        <RefreshCw
          size={16}
          style={{ cursor: 'pointer', color: COLORS.accent }}
          onClick={fetchData}
        />
      </div>

      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState description="ไม่มีข้อมูล Batch" /> }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `${t} รายการ`,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
        }}
        size="small"
        scroll={{ x: 900 }}
      />
    </div>
  );
}
