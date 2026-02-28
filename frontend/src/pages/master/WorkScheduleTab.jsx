import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip, Tag } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import WorkScheduleFormModal from './WorkScheduleFormModal';
import { COLORS } from '../../utils/constants';

const DAY_LABELS = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

export default function WorkScheduleTab() {
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
      const { data } = await api.get('/api/master/work-schedules', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to load work schedules');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/api/master/work-schedules/${id}`);
      message.success(`Deleted work schedule "${name}"`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Cannot delete — employees may be using this schedule');
    }
  };

  const columns = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 160,
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Type', dataIndex: 'schedule_type', key: 'schedule_type', width: 120,
      render: (v) => (
        <Tag color={v === 'FIXED' ? 'blue' : 'volcano'}>{v}</Tag>
      ),
    },
    {
      title: 'Pattern', key: 'pattern', ellipsis: true,
      render: (_, record) => {
        if (record.schedule_type === 'FIXED' && record.working_days) {
          return record.working_days.map(d => DAY_LABELS[d] || d).join(', ');
        }
        if (record.schedule_type === 'ROTATING' && record.rotation_pattern) {
          return (
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {record.rotation_pattern.join(' > ')} ({record.rotation_pattern.length}d cycle)
            </span>
          );
        }
        return <span style={{ color: COLORS.textMuted }}>-</span>;
      },
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('master.schedule.update') && (
            <Tooltip title="Edit">
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => { setEditItem(record); setModalOpen(true); }} />
            </Tooltip>
          )}
          {can('master.schedule.delete') && (
            <Popconfirm
              title="Confirm deletion"
              description={`Delete work schedule "${record.name}"?`}
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
        {can('master.schedule.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setModalOpen(true); }}>
            Add Work Schedule
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="No work schedules yet" hint="Click 'Add Work Schedule' to create a FIXED (Mon-Fri) or ROTATING (3-shift cycle) schedule" /> }}
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
      <WorkScheduleFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
