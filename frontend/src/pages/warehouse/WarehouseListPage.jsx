import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm } from 'antd';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import SearchInput from '../../components/SearchInput';
import EmptyState from '../../components/EmptyState';
import WarehouseFormModal from './WarehouseFormModal';

export default function WarehouseListPage({ embedded = false }) {
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
      const { data } = await api.get('/api/warehouse/warehouses', {
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
      await api.delete(`/api/warehouse/warehouses/${id}`);
      message.success('\u0E25\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E25\u0E1A\u0E44\u0E14\u0E49');
    }
  };

  const columns = [
    { title: '\u0E23\u0E2B\u0E31\u0E2A', dataIndex: 'code', key: 'code', width: 120 },
    { title: '\u0E0A\u0E37\u0E48\u0E2D\u0E04\u0E25\u0E31\u0E07', dataIndex: 'name', key: 'name' },
    { title: '\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14', dataIndex: 'description', key: 'description' },
    { title: '\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48', dataIndex: 'address', key: 'address' },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('warehouse.warehouse.update') && (
            <Button type="text" size="small" icon={<Pencil size={14} />}
              onClick={() => { setEditItem(record); setModalOpen(true); }} />
          )}
          {can('warehouse.warehouse.delete') && (
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
          title="Warehouse"
          subtitle={'\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E04\u0E25\u0E31\u0E07\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E41\u0E25\u0E30\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07'}
          actions={
            <Space>
              {can('warehouse.location.read') && (
                <Button icon={<MapPin size={14} />} onClick={() => navigate('/warehouse/locations')}>
                  Locations
                </Button>
              )}
              {can('warehouse.warehouse.create') && (
                <Button type="primary" icon={<Plus size={14} />}
                  onClick={() => { setEditItem(null); setModalOpen(true); }}>
                  {'\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E04\u0E25\u0E31\u0E07'}
                </Button>
              )}
            </Space>
          }
        />
      )}
      {embedded && can('warehouse.warehouse.create') && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setModalOpen(true); }}>
            {'\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E04\u0E25\u0E31\u0E07'}
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
      <WarehouseFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
