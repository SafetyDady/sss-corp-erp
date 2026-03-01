import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Select, Popconfirm } from 'antd';
import { Plus, Eye, Trash2, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import WithdrawalSlipFormModal from './WithdrawalSlipFormModal';
import { formatDate, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const STATUS_OPTIONS = ['DRAFT', 'PENDING', 'ISSUED', 'CANCELLED'].map((v) => ({ value: v, label: v }));
const TYPE_OPTIONS = [
  { value: 'WO_CONSUME', label: 'WO_CONSUME' },
  { value: 'CC_ISSUE', label: 'CC_ISSUE' },
];

export default function WithdrawalSlipTab() {
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
      const { data } = await api.get('/api/inventory/withdrawal-slips', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
          withdrawal_type: typeFilter || undefined,
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
      await api.delete(`/api/inventory/withdrawal-slips/${id}`);
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
      title: 'เลขที่ใบเบิก', dataIndex: 'slip_number', key: 'slip_number', width: 160,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'ประเภท', dataIndex: 'withdrawal_type', key: 'withdrawal_type', width: 130,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 110,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'WO / Cost Center', key: 'wo_cc', width: 200,
      render: (_, record) => {
        if (record.withdrawal_type === 'WO_CONSUME') {
          return (
            <span style={{ color: COLORS.text }}>
              {record.work_order_number || '-'}
            </span>
          );
        }
        return (
          <span style={{ color: COLORS.text }}>
            {record.cost_center_name || '-'}
          </span>
        );
      },
    },
    {
      title: 'ผู้เบิก', dataIndex: 'requester_name', key: 'requester_name', width: 150,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'วันที่', dataIndex: 'created_at', key: 'created_at', width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: 'จำนวนรายการ', dataIndex: 'line_count', key: 'line_count', width: 110, align: 'center',
      render: (v) => (
        <span style={{ color: COLORS.accent, fontWeight: 600 }}>
          {v ?? 0}
        </span>
      ),
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<Eye size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/withdrawal-slips/${record.id}`);
            }}
          />
          {record.status === 'DRAFT' && can('inventory.withdrawal.delete') && (
            <Popconfirm
              title="ลบใบเบิก?"
              description="ลบได้เฉพาะสถานะ DRAFT เท่านั้น"
              onConfirm={(e) => {
                e?.stopPropagation();
                handleDelete(record.id);
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 size={14} />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <SearchInput onSearch={setSearch} placeholder="ค้นหาเลขที่ใบเบิก..." />
          <Select
            allowClear
            placeholder="สถานะ"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
            options={STATUS_OPTIONS}
          />
          <Select
            allowClear
            placeholder="ประเภทการเบิก"
            style={{ width: 160 }}
            value={typeFilter}
            onChange={(val) => {
              setTypeFilter(val);
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
            options={TYPE_OPTIONS}
          />
        </div>
        {can('inventory.withdrawal.create') && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => { setEditRecord(null); setModalOpen(true); }}
          >
            สร้างใบเบิก
          </Button>
        )}
      </div>

      {/* Table */}
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ไม่มีใบเบิกสินค้า" /> }}
        onRow={(record) => ({
          onClick: () => navigate(`/withdrawal-slips/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
      />

      {/* Create/Edit Modal */}
      <WithdrawalSlipFormModal
        open={modalOpen}
        editRecord={editRecord}
        onClose={() => { setModalOpen(false); setEditRecord(null); }}
        onSuccess={() => { setModalOpen(false); setEditRecord(null); fetchData(); }}
      />
    </div>
  );
}
