import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Select, Tag, Popconfirm } from 'antd';
import { Plus, Eye, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import PRFormModal from './PRFormModal';
import { formatCurrency, formatDate, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const PRIORITY_COLORS = { NORMAL: 'default', URGENT: 'red' };
const TYPE_COLORS = { STANDARD: 'blue', BLANKET: 'purple' };

export default function PRTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/purchasing/pr', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
          pr_type: typeFilter || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, statusFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/purchasing/pr/${id}`);
      message.success('ลบสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถลบได้'));
    }
  };

  const handleEdit = (record) => {
    setEditRecord(record);
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'PR Number', dataIndex: 'pr_number', key: 'pr_number', width: 160,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'ประเภท', dataIndex: 'pr_type', key: 'pr_type', width: 100,
      render: (v) => <Tag color={TYPE_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'วันที่ต้องการ', dataIndex: 'required_date', key: 'required_date', width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: 'Priority', dataIndex: 'priority', key: 'priority', width: 90,
      render: (v) => <Tag color={PRIORITY_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'ยอดประมาณ', dataIndex: 'total_estimated', key: 'total_estimated', width: 130, align: 'right',
      render: (v) => v > 0 ? formatCurrency(v) : <span style={{ color: COLORS.textMuted }}>ไม่ระบุ</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<Eye size={14} />}
            onClick={() => navigate(`/purchasing/pr/${record.id}`)} />
          {record.status === 'DRAFT' && can('purchasing.pr.delete') && (
            <Popconfirm title="ลบ PR?" onConfirm={() => handleDelete(record.id)}>
              <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <SearchInput onSearch={setSearch} />
          <Select
            allowClear placeholder="Status" style={{ width: 140 }}
            value={statusFilter} onChange={setStatusFilter}
            options={['DRAFT', 'SUBMITTED', 'APPROVED', 'PO_CREATED', 'REJECTED', 'CANCELLED'].map((v) => ({ value: v, label: v }))}
          />
          <Select
            allowClear placeholder="ประเภท" style={{ width: 130 }}
            value={typeFilter} onChange={setTypeFilter}
            options={[{ value: 'STANDARD', label: 'STANDARD' }, { value: 'BLANKET', label: 'BLANKET' }]}
          />
        </div>
        {can('purchasing.pr.create') && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditRecord(null); setModalOpen(true); }}>
            สร้าง PR
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ไม่มีใบขอซื้อ" /> }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
      />
      <PRFormModal
        open={modalOpen}
        editRecord={editRecord}
        onClose={() => { setModalOpen(false); setEditRecord(null); }}
        onSuccess={() => { setModalOpen(false); setEditRecord(null); fetchData(); }}
      />
    </div>
  );
}
