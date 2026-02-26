import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Select } from 'antd';
import { Plus, Pencil, Trash2, Eye, Play, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import WorkOrderFormModal from './WorkOrderFormModal';
import { formatDateTime } from '../../utils/formatters';

export default function WorkOrderListPage() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/work-orders', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/work-orders/${id}`);
      message.success('\u0E25\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E25\u0E1A\u0E44\u0E14\u0E49');
    }
  };

  const handleOpen = async (id) => {
    try {
      await api.post(`/api/work-orders/${id}/open`);
      message.success('\u0E40\u0E1B\u0E34\u0E14 Work Order \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E1B\u0E34\u0E14\u0E44\u0E14\u0E49');
    }
  };

  const handleClose = async (id) => {
    try {
      await api.post(`/api/work-orders/${id}/close`);
      message.success('\u0E1B\u0E34\u0E14 Work Order \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1B\u0E34\u0E14\u0E44\u0E14\u0E49');
    }
  };

  const columns = [
    { title: 'WO Number', dataIndex: 'wo_number', key: 'wo_number', width: 150 },
    { title: '\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D', dataIndex: 'opened_at', key: 'opened_at', width: 150,
      render: (v) => formatDateTime(v),
    },
    {
      title: '\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D', dataIndex: 'closed_at', key: 'closed_at', width: 150,
      render: (v) => formatDateTime(v),
    },
    {
      title: '', key: 'actions', width: 160, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<Eye size={14} />}
            onClick={() => navigate(`/work-orders/${record.id}`)} />
          {record.status === 'DRAFT' && can('workorder.order.update') && (
            <Popconfirm title={'\u0E40\u0E1B\u0E34\u0E14 Work Order?'} onConfirm={() => handleOpen(record.id)}>
              <Button type="text" size="small" icon={<Play size={14} />} style={{ color: '#10b981' }} />
            </Popconfirm>
          )}
          {record.status === 'OPEN' && can('workorder.order.approve') && (
            <Popconfirm title={'\u0E1B\u0E34\u0E14 Work Order?'} onConfirm={() => handleClose(record.id)}>
              <Button type="text" size="small" icon={<Square size={14} />} style={{ color: '#f59e0b' }} />
            </Popconfirm>
          )}
          {record.status !== 'CLOSED' && can('workorder.order.update') && (
            <Button type="text" size="small" icon={<Pencil size={14} />}
              onClick={() => { setEditItem(record); setModalOpen(true); }} />
          )}
          {record.status === 'DRAFT' && can('workorder.order.delete') && (
            <Popconfirm title={'\u0E25\u0E1A Work Order?'} onConfirm={() => handleDelete(record.id)}>
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
        title="Work Orders"
        subtitle={'\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19'}
        actions={
          can('workorder.order.create') && (
            <Button type="primary" icon={<Plus size={14} />}
              onClick={() => { setEditItem(null); setModalOpen(true); }}>
              {'\u0E2A\u0E23\u0E49\u0E32\u0E07 Work Order'}
            </Button>
          )
        }
      />
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <SearchInput onSearch={setSearch} />
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={['DRAFT', 'OPEN', 'CLOSED'].map((v) => ({ value: v, label: v }))}
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
      <WorkOrderFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
