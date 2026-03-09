import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Select, Tooltip, Popconfirm } from 'antd';
import { Plus, Eye, Trash2, Ban, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import { downloadExcel } from '../../utils/download';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import DOFormModal from './DOFormModal';
import { formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function DOTab() {
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
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await downloadExcel('/api/sales/delivery/export', 'delivery_orders');
    } catch (err) {
      message.error('Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/sales/delivery', {
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
      await api.delete(`/api/sales/delivery/${id}`);
      message.success('\u0E25\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E25\u0E1A\u0E44\u0E14\u0E49');
    }
  };

  const handleCancel = async (id) => {
    try {
      await api.post(`/api/sales/delivery/${id}/cancel`);
      message.success('\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E44\u0E14\u0E49');
    }
  };

  const columns = [
    {
      title: 'DO Number', dataIndex: 'do_number', key: 'do_number', width: 150,
      render: (v, r) => (
        <Button type="link" size="small" style={{ fontFamily: 'monospace', padding: 0 }}
          onClick={() => navigate(`/sales/delivery/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'SO Number', dataIndex: 'so_number', key: 'so_number', width: 150,
      render: (v) => <span style={{ fontFamily: 'monospace', color: COLORS.textSecondary }}>{v}</span>,
    },
    {
      title: '\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32', dataIndex: 'customer_name', key: 'customer_name', ellipsis: true,
    },
    {
      title: '\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07', dataIndex: 'delivery_date', key: 'delivery_date', width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: '\u0E2A\u0E16\u0E32\u0E19\u0E30', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07\u0E08\u0E23\u0E34\u0E07', dataIndex: 'shipped_at', key: 'shipped_at', width: 140,
      render: (v) => v ? formatDate(v) : '-',
    },
    {
      title: '', key: 'actions', width: 120, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title={'\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14'}>
            <Button type="text" size="small" icon={<Eye size={14} />}
              onClick={() => navigate(`/sales/delivery/${record.id}`)} />
          </Tooltip>
          {record.status === 'DRAFT' && can('sales.delivery.update') && (
            <Tooltip title={'\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01'}>
              <Popconfirm title={'\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 DO?'} onConfirm={() => handleCancel(record.id)}>
                <Button type="text" size="small" icon={<Ban size={14} />} style={{ color: COLORS.warning }} />
              </Popconfirm>
            </Tooltip>
          )}
          {record.status === 'DRAFT' && can('sales.delivery.delete') && (
            <Tooltip title={'\u0E25\u0E1A'}>
              <Popconfirm title={'\u0E25\u0E1A DO?'} onConfirm={() => handleDelete(record.id)}>
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
          options={['DRAFT', 'SHIPPED', 'CANCELLED'].map((v) => ({ value: v, label: v }))}
        />
        <div style={{ flex: 1 }} />
        <Space>
          {can('sales.delivery.export') && (
            <Button icon={<Download size={14} />} loading={exportLoading} onClick={handleExport}>
              Export
            </Button>
          )}
          {can('sales.delivery.create') && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
              {'\u0E2A\u0E23\u0E49\u0E32\u0E07 DO'}
            </Button>
          )}
        </Space>
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
      <DOFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
