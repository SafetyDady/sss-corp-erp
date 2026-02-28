import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Select, Popconfirm } from 'antd';
import { Eye, Trash2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { formatCurrency, formatDate, getApiErrorMsg } from '../../utils/formatters';

export default function POTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

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
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/api/purchasing/po/${id}/approve`);
      message.success('อนุมัติสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถอนุมัติได้'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/purchasing/po/${id}`);
      message.success('ลบสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถลบได้'));
    }
  };

  const columns = [
    {
      title: 'PO Number', dataIndex: 'po_number', key: 'po_number', width: 150,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'PR Number', dataIndex: 'pr_number', key: 'pr_number', width: 150,
      render: (v) => v ? <span style={{ fontFamily: 'monospace', color: '#06b6d4' }}>{v}</span> : '-',
    },
    { title: 'ซัพพลายเออร์', dataIndex: 'supplier_name', key: 'supplier_name', ellipsis: true },
    {
      title: 'วันที่สั่ง', dataIndex: 'order_date', key: 'order_date', width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: 'ยอดรวม', dataIndex: 'total_amount', key: 'total_amount', width: 130, align: 'right',
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
            onClick={() => navigate(`/purchasing/po/${record.id}`)} />
          {record.status === 'SUBMITTED' && can('purchasing.po.approve') && (
            <Popconfirm title="อนุมัติ PO?" onConfirm={() => handleApprove(record.id)}>
              <Button type="text" size="small" icon={<Check size={14} />} style={{ color: '#10b981' }} />
            </Popconfirm>
          )}
          {record.status === 'DRAFT' && can('purchasing.po.delete') && (
            <Popconfirm title="ลบ PO?" onConfirm={() => handleDelete(record.id)}>
              <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <SearchInput onSearch={setSearch} />
        <Select
          allowClear placeholder="Status" style={{ width: 140 }}
          value={statusFilter} onChange={setStatusFilter}
          options={['DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED', 'CANCELLED'].map((v) => ({ value: v, label: v }))}
        />
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ไม่มีใบสั่งซื้อ" hint="PO สร้างจากการ Convert PR" /> }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
      />
    </div>
  );
}
