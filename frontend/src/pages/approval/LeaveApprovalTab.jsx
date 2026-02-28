import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip, Tag } from 'antd';
import { Check, XCircle } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import EmployeeContextSelector from '../../components/EmployeeContextSelector';
import { formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const LEAVE_TYPE_COLORS = {
  ANNUAL: { color: '#06b6d4', label: 'ลาพักร้อน' },
  SICK: { color: '#ef4444', label: 'ลาป่วย' },
  PERSONAL: { color: '#f97316', label: 'ลากิจ' },
  MATERNITY: { color: '#ec4899', label: 'ลาคลอด' },
  UNPAID: { color: '#6b7280', label: 'ลาไม่ได้เงิน' },
};

function calcDays(start, end) {
  if (!start || !end) return '-';
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : '-';
}

export default function LeaveApprovalTab({ onAction }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
        status: 'PENDING',
      };
      if (selectedEmployee) params.employee_id = selectedEmployee;
      const { data } = await api.get('/api/hr/leave', { params });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [pagination, selectedEmployee]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (id, action) => {
    setActionLoading(id);
    try {
      await api.post(`/api/hr/leave/${id}/approve`, { action });
      message.success(action === 'approve' ? 'อนุมัติลาหยุดสำเร็จ' : 'ปฏิเสธลาหยุดสำเร็จ');
      fetchData();
      onAction?.();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      title: 'พนักงาน',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 160,
      render: (v, r) =>
        v || (
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.textSecondary }}>
            {r.employee_id?.slice(0, 8)}...
          </span>
        ),
    },
    {
      title: 'ประเภทลา',
      key: 'leave_type',
      width: 140,
      render: (_, r) => {
        const code = r.leave_type_code || r.leave_type;
        const cfg = LEAVE_TYPE_COLORS[code] || {
          color: COLORS.textMuted,
          label: r.leave_type_name || r.leave_type,
        };
        const label = r.leave_type_name || cfg.label || r.leave_type;
        return <Tag color={cfg.color}>{label}</Tag>;
      },
    },
    {
      title: 'วันเริ่ม',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 110,
      render: (v) => formatDate(v),
    },
    {
      title: 'วันสิ้นสุด',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 110,
      render: (v) => formatDate(v),
    },
    {
      title: 'จำนวนวัน',
      key: 'days',
      width: 90,
      align: 'right',
      render: (_, r) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {r.days_count || calcDays(r.start_date, r.end_date)}
        </span>
      ),
    },
    {
      title: 'เหตุผล',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_, record) =>
        record.status === 'PENDING' && can('hr.leave.approve') ? (
          <Space size={4}>
            <Tooltip title="อนุมัติ">
              <Button
                type="text"
                size="small"
                icon={<Check size={14} />}
                loading={actionLoading === record.id}
                onClick={() => handleAction(record.id, 'approve')}
                style={{ color: COLORS.success }}
              />
            </Tooltip>
            <Popconfirm
              title="ยืนยันการปฏิเสธ"
              description="คุณแน่ใจหรือไม่ที่จะปฏิเสธคำขอลานี้?"
              onConfirm={() => handleAction(record.id, 'reject')}
              okText="ปฏิเสธ"
              cancelText="ยกเลิก"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="ปฏิเสธ">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<XCircle size={14} />}
                  loading={actionLoading === record.id}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <EmployeeContextSelector
          value={selectedEmployee}
          onChange={(v) => {
            setSelectedEmployee(v);
            setPagination((p) => ({ ...p, current: 1 }));
          }}
          showBadge={false}
        />
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{
          emptyText: (
            <EmptyState
              message="ไม่มีคำขอลาหยุดรออนุมัติ"
              hint="คำขอลาสถานะ PENDING จะแสดงที่นี่"
            />
          ),
        }}
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
    </div>
  );
}
