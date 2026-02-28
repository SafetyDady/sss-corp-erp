import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip, Tag } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import ShiftTypeFormModal from './ShiftTypeFormModal';
import { COLORS } from '../../utils/constants';

export default function ShiftTypeTab() {
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
      const { data } = await api.get('/api/master/shift-types', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to load shift types');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/api/master/shift-types/${id}`);
      message.success(`Deleted shift type "${name}"`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Cannot delete — may be in use');
    }
  };

  const columns = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Time', key: 'time', width: 140,
      render: (_, record) => (
        <span style={{ fontFamily: 'monospace' }}>
          {record.start_time?.slice(0, 5)} - {record.end_time?.slice(0, 5)}
        </span>
      ),
    },
    {
      title: 'Break (min)', dataIndex: 'break_minutes', key: 'break_minutes', width: 100,
      align: 'center',
    },
    {
      title: 'Hours', dataIndex: 'working_hours', key: 'working_hours', width: 80,
      align: 'center',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.accent }}>
          {parseFloat(v).toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Overnight', dataIndex: 'is_overnight', key: 'is_overnight', width: 100,
      align: 'center',
      render: (v) => v ? <Tag color="purple">Overnight</Tag> : null,
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('master.shifttype.update') && (
            <Tooltip title="Edit">
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => { setEditItem(record); setModalOpen(true); }} />
            </Tooltip>
          )}
          {can('master.shifttype.delete') && (
            <Popconfirm
              title="Confirm deletion"
              description={`Delete shift type "${record.name}"?`}
              onConfirm={() => handleDelete(record.id, record.name)}
              okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <SearchInput onSearch={setSearch} placeholder="Search by code or name..." />
        {can('master.shifttype.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setModalOpen(true); }}>
            Add Shift Type
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="No shift types yet" hint="Click 'Add Shift Type' to define shift time windows (e.g. Morning 06:00-14:00)" /> }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `Total ${t} items`,
        }}
        size="middle"
      />
      <ShiftTypeFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
