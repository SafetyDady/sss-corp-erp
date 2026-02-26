import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Select, Tooltip, Tag } from 'antd';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LeaveFormModal from './LeaveFormModal';
import { formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const LEAVE_TYPE_COLORS = {
  ANNUAL: { color: '#06b6d4', label: 'ลาพักร้อน' },
  SICK: { color: '#ef4444', label: 'ลาป่วย' },
  PERSONAL: { color: '#8b5cf6', label: 'ลากิจ' },
};

function calcDays(start, end) {
  if (!start || !end) return '-';
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? `${diff} วัน` : '-';
}

export default function LeaveTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/hr/leave', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          status: statusFilter || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลลาหยุดได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id, action) => {
    setActionLoading(id);
    try {
      await api.post(`/api/hr/leave/${id}/approve`, { action });
      message.success(action === 'approve' ? 'อนุมัติลาหยุดสำเร็จ' : 'ปฏิเสธลาหยุดสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      title: 'Employee ID', dataIndex: 'employee_id', key: 'employee_id', width: 130,
      ellipsis: true,
      render: (v) => <span style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.textSecondary }}>{v?.slice(0, 8)}...</span>,
    },
    {
      title: 'ประเภทลา', dataIndex: 'leave_type', key: 'leave_type', width: 120,
      render: (v) => {
        const cfg = LEAVE_TYPE_COLORS[v] || { color: COLORS.textMuted, label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'วันเริ่ม', dataIndex: 'start_date', key: 'start_date', width: 110,
      render: (v) => formatDate(v),
    },
    {
      title: 'วันสิ้นสุด', dataIndex: 'end_date', key: 'end_date', width: 110,
      render: (v) => formatDate(v),
    },
    {
      title: 'จำนวนวัน', key: 'days', width: 90, align: 'center',
      render: (_, r) => <span style={{ fontWeight: 500 }}>{calcDays(r.start_date, r.end_date)}</span>,
    },
    {
      title: 'เหตุผล', dataIndex: 'reason', key: 'reason', ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 110,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'PENDING' && can('hr.leave.approve') && (
            <>
              <Popconfirm title="อนุมัติลาหยุด?" onConfirm={() => handleApprove(record.id, 'approve')}
                okText="อนุมัติ" cancelText="ยกเลิก">
                <Tooltip title="อนุมัติ">
                  <Button type="text" size="small" loading={actionLoading === record.id}
                    icon={<CheckCircle size={14} />} style={{ color: '#10b981' }} />
                </Tooltip>
              </Popconfirm>
              <Popconfirm title="ปฏิเสธลาหยุด?" onConfirm={() => handleApprove(record.id, 'reject')}
                okText="ปฏิเสธ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
                <Tooltip title="ปฏิเสธ">
                  <Button type="text" size="small" loading={actionLoading === record.id}
                    icon={<XCircle size={14} />} style={{ color: '#ef4444' }} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Select
          allowClear placeholder="กรองสถานะ" style={{ width: 160 }}
          value={statusFilter} onChange={setStatusFilter}
          options={[
            { value: 'PENDING', label: 'รออนุมัติ' },
            { value: 'APPROVED', label: 'อนุมัติแล้ว' },
            { value: 'REJECTED', label: 'ปฏิเสธ' },
          ]}
        />
        {can('hr.leave.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => setModalOpen(true)}>
            ขอลาหยุด
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ยังไม่มีรายการลาหยุด" hint="กดปุ่ม 'ขอลาหยุด' เพื่อยื่นคำขอ" /> }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
        size="middle"
      />
      <LeaveFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
