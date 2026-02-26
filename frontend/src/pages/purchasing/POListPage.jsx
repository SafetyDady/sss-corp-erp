import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Select } from 'antd';
import { Plus, Eye, Trash2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import POFormModal from './POFormModal';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function POListPage() {
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/purchasing/po', {
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
      await api.post(`/api/purchasing/po/${id}/approve`);
      message.success('\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E44\u0E14\u0E49');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/purchasing/po/${id}`);
      message.success('\u0E25\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E25\u0E1A\u0E44\u0E14\u0E49');
    }
  };

  const columns = [
    { title: 'PO Number', dataIndex: 'po_number', key: 'po_number', width: 150 },
    { title: '\u0E0B\u0E31\u0E1E\u0E1E\u0E25\u0E32\u0E22\u0E40\u0E2D\u0E2D\u0E23\u0E4C', dataIndex: 'supplier_name', key: 'supplier_name' },
    {
      title: '\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E48\u0E07', dataIndex: 'order_date', key: 'order_date', width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: '\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21', dataIndex: 'total_amount', key: 'total_amount', width: 130, align: 'right',
      render: (v) => formatCurrency(v),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '', key: 'actions', width: 120, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<Eye size={14} />}
            onClick={() => navigate(`/purchasing/${record.id}`)} />
          {record.status === 'SUBMITTED' && can('purchasing.po.approve') && (
            <Popconfirm title={'\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34 PO?'} onConfirm={() => handleApprove(record.id)}>
              <Button type="text" size="small" icon={<Check size={14} />} style={{ color: '#10b981' }} />
            </Popconfirm>
          )}
          {record.status === 'DRAFT' && can('purchasing.po.delete') && (
            <Popconfirm title={'\u0E25\u0E1A PO?'} onConfirm={() => handleDelete(record.id)}>
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
        title="Purchasing"
        subtitle={'\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D'}
        actions={
          can('purchasing.po.create') && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
              {'\u0E2A\u0E23\u0E49\u0E32\u0E07 PO'}
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
          options={['DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED', 'CANCELLED'].map((v) => ({ value: v, label: v }))}
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
      <POFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
