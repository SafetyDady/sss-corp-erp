import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Select } from 'antd';
import { Plus, RotateCcw } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import MovementCreateModal from './MovementCreateModal';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export default function MovementListPage({ embedded = false }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [products, setProducts] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/stock/movements', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
          movement_type: typeFilter || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } })
      .then((r) => setProducts(r.data.items))
      .catch(() => {});
  }, []);

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const handleReverse = async (id) => {
    try {
      await api.post(`/api/stock/movements/${id}/reverse`);
      message.success('\u0E01\u0E25\u0E31\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E01\u0E25\u0E31\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E44\u0E14\u0E49');
    }
  };

  const columns = [
    {
      title: '\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: (v) => formatDateTime(v),
    },
    {
      title: '\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17', dataIndex: 'movement_type', key: 'movement_type', width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', dataIndex: 'product_id', key: 'product_id',
      render: (v) => productMap[v]?.name || v,
    },
    { title: '\u0E08\u0E33\u0E19\u0E27\u0E19', dataIndex: 'quantity', key: 'quantity', width: 80, align: 'right' },
    {
      title: '\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19/\u0E2B\u0E19\u0E48\u0E27\u0E22', dataIndex: 'unit_cost', key: 'unit_cost', width: 120, align: 'right',
      render: (v) => formatCurrency(v),
    },
    { title: '\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07', dataIndex: 'reference', key: 'reference', width: 120 },
    {
      title: '\u0E2A\u0E16\u0E32\u0E19\u0E30', dataIndex: 'is_reversed', key: 'is_reversed', width: 100,
      render: (v) => v ? <StatusBadge status="REVERSED" /> : null,
    },
    {
      title: '', key: 'actions', width: 60, align: 'right',
      render: (_, record) => (
        !record.is_reversed && can('inventory.movement.delete') && (
          <Popconfirm title={'\u0E01\u0E25\u0E31\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E19\u0E35\u0E49?'} onConfirm={() => handleReverse(record.id)}>
            <Button type="text" size="small" icon={<RotateCcw size={14} />} />
          </Popconfirm>
        )
      ),
    },
  ];

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Stock Movements"
          subtitle={'\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E2A\u0E15\u0E47\u0E2D\u0E01'}
          actions={
            can('inventory.movement.create') && (
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
                {'\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23'}
              </Button>
            )
          }
        />
      )}
      {embedded && can('inventory.movement.create') && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
            {'\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23'}
          </Button>
        </div>
      )}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <SearchInput onSearch={setSearch} />
        <Select
          allowClear
          placeholder={'\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17'}
          style={{ width: 160 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={['RECEIVE', 'ISSUE', 'TRANSFER', 'ADJUST', 'CONSUME', 'REVERSAL'].map((v) => ({ value: v, label: v }))}
        />
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState /> }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 ${t} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23`,
        }}
      />
      <MovementCreateModal
        open={modalOpen}
        products={products}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
