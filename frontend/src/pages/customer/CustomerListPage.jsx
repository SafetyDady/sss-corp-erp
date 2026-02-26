import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import SearchInput from '../../components/SearchInput';
import EmptyState from '../../components/EmptyState';
import CustomerFormModal from './CustomerFormModal';

export default function CustomerListPage() {
  const { can } = usePermission();
  const { message } = App.useApp();
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
      const { data } = await api.get('/api/customers', {
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
      await api.delete(`/api/customers/${id}`);
      message.success('\u0E25\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E25\u0E1A\u0E44\u0E14\u0E49');
    }
  };

  const columns = [
    { title: '\u0E23\u0E2B\u0E31\u0E2A', dataIndex: 'code', key: 'code', width: 120 },
    { title: '\u0E0A\u0E37\u0E48\u0E2D\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32', dataIndex: 'name', key: 'name' },
    { title: '\u0E1C\u0E39\u0E49\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D', dataIndex: 'contact_name', key: 'contact_name' },
    { title: '\u0E2D\u0E35\u0E40\u0E21\u0E25', dataIndex: 'email', key: 'email' },
    { title: '\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C', dataIndex: 'phone', key: 'phone', width: 130 },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('customer.customer.update') && (
            <Button type="text" size="small" icon={<Pencil size={14} />}
              onClick={() => { setEditItem(record); setModalOpen(true); }} />
          )}
          {can('customer.customer.delete') && (
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
      <PageHeader
        title="Customers"
        subtitle={'\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32'}
        actions={
          can('customer.customer.create') && (
            <Button type="primary" icon={<Plus size={14} />}
              onClick={() => { setEditItem(null); setModalOpen(true); }}>
              {'\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32'}
            </Button>
          )
        }
      />
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
      <CustomerFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
