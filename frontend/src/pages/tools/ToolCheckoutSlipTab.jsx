import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Select, Popconfirm, Tag } from 'antd';
import { Plus, Eye, Trash2, Wrench, FileEdit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import ToolCheckoutSlipFormModal from './ToolCheckoutSlipFormModal';
import { formatDate, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const STATUS_OPTIONS = [
  'DRAFT', 'PENDING', 'CHECKED_OUT', 'PARTIAL_RETURN', 'RETURNED', 'CANCELLED',
].map((v) => ({ value: v, label: v }));

/**
 * ToolCheckoutSlipTab — reusable in 3 contexts:
 * - default: full view, all slips
 * - staffMode (CommonActPage): filtered to own slips (client-side by employeeId)
 * - storeMode (StoreRoomPage): default PENDING filter, "บันทึก Manual" button
 */
export default function ToolCheckoutSlipTab({ staffMode = false, storeMode = false }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const employeeId = useAuthStore((s) => s.employeeId);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(storeMode ? 'PENDING' : undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/tools/checkout-slips', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
          requested_by: staffMode && employeeId ? employeeId : undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, statusFilter, staffMode, employeeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Server-side filter handles staffMode (requested_by param), so no client-side filter needed
  const displayItems = items;
  const displayTotal = total;

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/tools/checkout-slips/${id}`);
      message.success('ลบสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถลบได้'));
    }
  };

  const columns = [
    {
      title: 'เลขที่ใบเบิก', dataIndex: 'slip_number', key: 'slip_number', width: 160,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 140,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'Work Order', dataIndex: 'work_order_number', key: 'wo', width: 150,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'ผู้เบิก', dataIndex: 'requester_name', key: 'requester', width: 150,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'วันที่', dataIndex: 'created_at', key: 'date', width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: 'จำนวนเครื่องมือ', dataIndex: 'line_count', key: 'line_count', width: 130, align: 'center',
      render: (v) => (
        <span style={{ color: COLORS.accent, fontWeight: 600 }}>{v ?? 0}</span>
      ),
    },
    {
      title: 'คืนแล้ว', key: 'returned', width: 90, align: 'center',
      render: (_, record) => (
        <span style={{ fontFamily: 'monospace' }}>
          {record.returned_count}/{record.line_count}
        </span>
      ),
    },
    {
      title: 'ค่าใช้จ่าย', dataIndex: 'total_charge', key: 'charge', width: 120, align: 'right',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', color: v > 0 ? COLORS.accent : COLORS.textMuted }}>
          {Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: '', key: 'actions', width: 80, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<Eye size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/tool-checkout-slips/${record.id}`);
            }}
          />
          {record.status === 'DRAFT' && can('tools.tool.delete') && (
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
      {/* Staff mode indicator */}
      {staffMode && (
        <div style={{ marginBottom: 12 }}>
          <Tag color="cyan" style={{ fontSize: 12 }}>
            <Wrench size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            แสดงเฉพาะใบเบิกเครื่องมือของฉัน
          </Tag>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <SearchInput onSearch={setSearch} placeholder="ค้นหาเลขที่ใบเบิก..." />
          <Select
            allowClear
            placeholder="สถานะ"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
            options={STATUS_OPTIONS}
          />
        </div>
        {/* Create button — context-aware */}
        {staffMode && can('tools.tool.create') && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => { setEditRecord(null); setModalOpen(true); }}
          >
            สร้างใบเบิกเครื่องมือ
          </Button>
        )}
        {storeMode && can('tools.tool.create') && (
          <Button
            type="primary"
            icon={<FileEdit size={14} />}
            onClick={() => { setEditRecord(null); setModalOpen(true); }}
          >
            บันทึก Manual
          </Button>
        )}
        {!staffMode && !storeMode && can('tools.tool.create') && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => { setEditRecord(null); setModalOpen(true); }}
          >
            สร้างใบเบิกเครื่องมือ
          </Button>
        )}
      </div>

      {/* Table */}
      <Table
        loading={loading}
        dataSource={displayItems}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message={staffMode ? 'คุณยังไม่มีใบเบิกเครื่องมือ' : 'ไม่มีใบเบิกเครื่องมือ'} /> }}
        onRow={(record) => ({
          onClick: () => navigate(`/tool-checkout-slips/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={staffMode ? {
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        } : {
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
      />

      {/* Create/Edit Modal */}
      <ToolCheckoutSlipFormModal
        open={modalOpen}
        editRecord={editRecord}
        onClose={() => { setModalOpen(false); setEditRecord(null); }}
        onSuccess={() => { setModalOpen(false); setEditRecord(null); fetchData(); }}
      />
    </div>
  );
}
