import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Select, Tooltip } from 'antd';
import { Plus, Eye, Trash2, Check, Pencil, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import SOFormModal from './SOFormModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function SOListPage() {
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
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/api/sales/orders/${id}/approve`, { action: 'approve' });
      message.success('อนุมัติสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถอนุมัติได้');
    }
  };

  const handleSubmit = async (id) => {
    try {
      await api.post(`/api/sales/orders/${id}/submit`);
      message.success('ส่งอนุมัติสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถส่งอนุมัติได้');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/sales/orders/${id}`);
      message.success('ลบสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถลบได้');
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
      title: 'ลูกค้า', dataIndex: 'customer_name', key: 'customer_name', ellipsis: true,
      render: (v, r) => v || (
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.textSecondary }}>
          {r.customer_id?.slice(0, 8)}...
        </span>
      ),
    },
    {
      title: 'วันที่สั่ง', dataIndex: 'order_date', key: 'order_date', width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: 'ยอดรวม', dataIndex: 'total_amount', key: 'total_amount', width: 130, align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '', key: 'actions', width: 160, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="ดูรายละเอียด">
            <Button type="text" size="small" icon={<Eye size={14} />}
              onClick={() => navigate(`/sales/${record.id}`)} />
          </Tooltip>
          {['DRAFT', 'SUBMITTED'].includes(record.status) && can('sales.order.update') && (
            <Tooltip title="แก้ไข">
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => openEdit(record)} />
            </Tooltip>
          )}
          {record.status === 'DRAFT' && can('sales.order.create') && (
            <Tooltip title="ส่งอนุมัติ">
              <Popconfirm title={'ส่งอนุมัติ SO?'} onConfirm={() => handleSubmit(record.id)}>
                <Button type="text" size="small" icon={<Send size={14} />} style={{ color: COLORS.accent }} />
              </Popconfirm>
            </Tooltip>
          )}
          {record.status === 'SUBMITTED' && can('sales.order.approve') && (
            <Tooltip title="อนุมัติ">
              <Popconfirm title={'อนุมัติ SO?'} onConfirm={() => handleApprove(record.id)}>
                <Button type="text" size="small" icon={<Check size={14} />} style={{ color: '#10b981' }} />
              </Popconfirm>
            </Tooltip>
          )}
          {record.status === 'DRAFT' && can('sales.order.delete') && (
            <Tooltip title="ลบ">
              <Popconfirm title={'ลบ SO?'} onConfirm={() => handleDelete(record.id)}>
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
      <PageHeader
        title="Sales"
        subtitle={'จัดการใบสั่งขาย'}
        actions={
          can('sales.order.create') && (
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              {'สร้าง SO'}
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
          options={['DRAFT', 'SUBMITTED', 'APPROVED', 'INVOICED', 'CANCELLED'].map((v) => ({ value: v, label: v }))}
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
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
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
