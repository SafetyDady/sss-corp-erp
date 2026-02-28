import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm } from 'antd';
import { Plus, Pencil, Trash2, ArrowRightLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import ProductFormModal from './ProductFormModal';
import { formatCurrency } from '../../utils/formatters';

export default function ProductListPage({ embedded = false }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/inventory/products', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/inventory/products/${id}`);
      message.success('\u0E25\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E25\u0E1A\u0E44\u0E14\u0E49');
    }
  };

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', dataIndex: 'name', key: 'name' },
    {
      title: '\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17', dataIndex: 'product_type', key: 'product_type', width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    { title: '\u0E2B\u0E19\u0E48\u0E27\u0E22', dataIndex: 'unit', key: 'unit', width: 80 },
    {
      title: '\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19', dataIndex: 'cost', key: 'cost', width: 120, align: 'right',
      render: (v) => formatCurrency(v),
    },
    {
      title: '\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D', dataIndex: 'on_hand', key: 'on_hand', width: 100, align: 'right',
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('inventory.product.update') && (
            <Button type="text" size="small" icon={<Pencil size={14} />}
              onClick={() => { setEditItem(record); setModalOpen(true); }} />
          )}
          {can('inventory.product.delete') && (
            <Popconfirm title={'\u0E04\u0E38\u0E13\u0E41\u0E19\u0E48\u0E43\u0E08\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E17\u0E35\u0E48\u0E08\u0E30\u0E25\u0E1A?'} onConfirm={() => handleDelete(record.id)}>
              <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Inventory"
          subtitle={'\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E41\u0E25\u0E30\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A'}
          actions={
            <Space>
              {can('inventory.movement.read') && (
                <Button icon={<ArrowRightLeft size={14} />} onClick={() => navigate('/inventory/movements')}>
                  Stock Movements
                </Button>
              )}
              {can('inventory.product.create') && (
                <Button type="primary" icon={<Plus size={14} />}
                  onClick={() => { setEditItem(null); setModalOpen(true); }}>
                  {'\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}
                </Button>
              )}
            </Space>
          }
        />
      )}
      {embedded && can('inventory.product.create') && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setModalOpen(true); }}>
            {'\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}
          </Button>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <SearchInput onSearch={setSearch} />
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
      <ProductFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
