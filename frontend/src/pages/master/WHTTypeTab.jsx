import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import WHTTypeFormModal from './WHTTypeFormModal';
import { COLORS } from '../../utils/constants';

export default function WHTTypeTab() {
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
      const { data } = await api.get('/api/master/wht-types', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to load WHT types');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/api/master/wht-types/${id}`);
      message.success(`Deleted WHT type "${name}"`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Cannot delete — may be in use');
    }
  };

  const columns = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 100,
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Section', dataIndex: 'section', key: 'section', width: 180,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'Rate', dataIndex: 'rate', key: 'rate', width: 90,
      align: 'center',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.accent }}>
          {parseFloat(v).toFixed(2)}%
        </span>
      ),
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('master.whttype.update') && (
            <Tooltip title="Edit">
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => { setEditItem(record); setModalOpen(true); }} />
            </Tooltip>
          )}
          {can('master.whttype.delete') && (
            <Popconfirm
              title="Confirm deletion"
              description={`Delete WHT type "${record.name}"?`}
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
        {can('master.whttype.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setModalOpen(true); }}>
            Add WHT Type
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="No WHT types yet" hint="Click 'Add WHT Type' to define withholding tax rates (e.g. 3% services)" /> }}
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
      <WHTTypeFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
