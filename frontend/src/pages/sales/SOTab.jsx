import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Select, Tooltip } from 'antd';
import { Plus, Eye, Trash2, Check, Pencil, Send, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import { downloadExcel } from '../../utils/download';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import SOFormModal from './SOFormModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function SOTab() {
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
  const [editRecord, setEditRecord] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await downloadExcel('/api/sales/orders/export', 'sales_orders');
      message.success('Export สำเร็จ');
    } catch {
      message.error('ไม่สามารถ Export ได้');
    } finally {
      setExportLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/sales/orders', {
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

  const handleApprove = async (id) => {
    try {
      await api.post(`/api/sales/orders/${id}/approve`, { action: 'approve' });
      message.success('\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E44\u0E14\u0E49');
    }
  };

  const handleSubmit = async (id) => {
    try {
      await api.post(`/api/sales/orders/${id}/submit`);
      message.success('\u0E2A\u0E48\u0E07\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E48\u0E07\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E44\u0E14\u0E49');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/sales/orders/${id}`);
      message.success('\u0E25\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E25\u0E1A\u0E44\u0E14\u0E49');
    }
  };

  const openEdit = (record) => {
    setEditRecord(record);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditRecord(null);
    setModalOpen(true);
  };

  const columns = [
    { title: 'SO Number', dataIndex: 'so_number', key: 'so_number', width: 150,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32', dataIndex: 'customer_name', key: 'customer_name', ellipsis: true,
      render: (v, r) => v || (
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.textSecondary }}>
          {r.customer_id?.slice(0, 8)}...
        </span>
      ),
    },
    {
      title: '\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E48\u0E07', dataIndex: 'order_date', key: 'order_date', width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: '\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21', dataIndex: 'total_amount', key: 'total_amount', width: 130, align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>,
    },
    {
      title: '\u0E2A\u0E16\u0E32\u0E19\u0E30', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '', key: 'actions', width: 160, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title={'\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14'}>
            <Button type="text" size="small" icon={<Eye size={14} />}
              onClick={() => navigate(`/sales/${record.id}`)} />
          </Tooltip>
          {['DRAFT', 'SUBMITTED'].includes(record.status) && can('sales.order.update') && (
            <Tooltip title={'\u0E41\u0E01\u0E49\u0E44\u0E02'}>
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => openEdit(record)} />
            </Tooltip>
          )}
          {record.status === 'DRAFT' && can('sales.order.create') && (
            <Tooltip title={'\u0E2A\u0E48\u0E07\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34'}>
              <Popconfirm title={'\u0E2A\u0E48\u0E07\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34 SO?'} onConfirm={() => handleSubmit(record.id)}>
                <Button type="text" size="small" icon={<Send size={14} />} style={{ color: COLORS.accent }} />
              </Popconfirm>
            </Tooltip>
          )}
          {record.status === 'SUBMITTED' && can('sales.order.approve') && (
            <Tooltip title={'\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34'}>
              <Popconfirm title={'\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34 SO?'} onConfirm={() => handleApprove(record.id)}>
                <Button type="text" size="small" icon={<Check size={14} />} style={{ color: '#10b981' }} />
              </Popconfirm>
            </Tooltip>
          )}
          {record.status === 'DRAFT' && can('sales.order.delete') && (
            <Tooltip title={'\u0E25\u0E1A'}>
              <Popconfirm title={'\u0E25\u0E1A SO?'} onConfirm={() => handleDelete(record.id)}>
                <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <SearchInput onSearch={setSearch} />
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={['DRAFT', 'SUBMITTED', 'APPROVED', 'INVOICED', 'CANCELLED'].map((v) => ({ value: v, label: v }))}
        />
        <div style={{ flex: 1 }} />
        {can('sales.order.export') && (
          <Button icon={<Download size={14} />} loading={exportLoading} onClick={handleExport}>Export</Button>
        )}
        {can('sales.order.create') && (
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
            {'\u0E2A\u0E23\u0E49\u0E32\u0E07 SO'}
          </Button>
        )}
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
      <SOFormModal
        open={modalOpen}
        editRecord={editRecord}
        onClose={() => { setModalOpen(false); setEditRecord(null); }}
        onSuccess={() => { setModalOpen(false); setEditRecord(null); fetchData(); }}
      />
    </div>
  );
}
