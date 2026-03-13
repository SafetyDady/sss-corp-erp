import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Select, Popconfirm } from 'antd';
import { Plus, Eye, Trash2, ArrowLeftRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import TransferRequestFormModal from './TransferRequestFormModal';
import { formatDate, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const STATUS_OPTIONS = ['DRAFT', 'PENDING', 'TRANSFERRED', 'CANCELLED'].map((v) => ({
  value: v,
  label: v,
}));

export default function TransferRequestTab() {
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
      const { data } = await api.get('/api/inventory/transfer-requests', {
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
  }, [pagination, search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/inventory/transfer-requests/${id}`);
      message.success('ลบใบขอโอนย้ายสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถลบได้'));
    }
  };

  const columns = [
    {
      title: 'เลขที่', dataIndex: 'transfer_number', key: 'transfer_number', width: 180,
      render: (v) => <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{v}</span>,
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 130,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'ต้นทาง', key: 'source', ellipsis: true,
      render: (_, r) => (
        <span style={{ color: COLORS.text }}>
          {r.source_warehouse_name || '-'}
          {r.source_location_name && (
            <span style={{ color: COLORS.textMuted, marginLeft: 4 }}>
              ({r.source_location_name})
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'ปลายทาง', key: 'dest', ellipsis: true,
      render: (_, r) => (
        <span style={{ color: COLORS.text }}>
          {r.dest_warehouse_name || '-'}
          {r.dest_location_name && (
            <span style={{ color: COLORS.textMuted, marginLeft: 4 }}>
              ({r.dest_location_name})
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'รายการ', dataIndex: 'line_count', key: 'line_count', width: 80, align: 'center',
      render: (v) => <span style={{ fontWeight: 600 }}>{v || 0}</span>,
    },
    {
      title: 'วันที่', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: (v) => formatDate(v),
      responsive: ['md'],
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<Eye size={14} />}
            onClick={(e) => { e.stopPropagation(); navigate(`/transfer-requests/${record.id}`); }}
          />
          {record.status === 'DRAFT' && can('inventory.movement.delete') && (
            <Popconfirm
              title="ลบใบขอโอนย้าย?"
              onConfirm={(e) => { e?.stopPropagation(); handleDelete(record.id); }}
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="ค้นหาเลขที่ / อ้างอิง"
          />
          <Select
            allowClear
            placeholder="สถานะ"
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPagination((p) => ({ ...p, current: 1 })); }}
            options={STATUS_OPTIONS}
            style={{ width: 150 }}
          />
        </Space>

        {can('inventory.movement.create') && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => { setEditRecord(null); setModalOpen(true); }}
          >
            สร้างใบโอนย้าย
          </Button>
        )}
      </div>

      {/* Table */}
      <Table
        dataSource={items}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        locale={{ emptyText: <EmptyState icon={<ArrowLeftRight size={40} />} message="ไม่มีใบขอโอนย้าย" /> }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/transfer-requests/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />

      {/* Form Modal */}
      <TransferRequestFormModal
        open={modalOpen}
        editRecord={editRecord}
        onClose={() => { setModalOpen(false); setEditRecord(null); }}
        onSuccess={() => { setModalOpen(false); setEditRecord(null); fetchData(); }}
      />
    </div>
  );
}
