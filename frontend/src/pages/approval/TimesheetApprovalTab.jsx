import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Select, Tooltip, Typography } from 'antd';
import { Check, ShieldCheck } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import EmployeeContextSelector from '../../components/EmployeeContextSelector';
import { formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function TimesheetApprovalTab({ onAction }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [selectedEmployee, setSelectedEmployee] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
        status: statusFilter,
      };
      if (selectedEmployee) params.employee_id = selectedEmployee;
      const { data } = await api.get('/api/hr/timesheet', { params });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [pagination, statusFilter, selectedEmployee]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await api.post(`/api/hr/timesheet/${id}/approve`);
      message.success('อนุมัติ Timesheet สำเร็จ');
      fetchData();
      onAction?.();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinal = async (id) => {
    setActionLoading(id);
    try {
      await api.post(`/api/hr/timesheet/${id}/final`);
      message.success('Final Approve สำเร็จ');
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
      title: 'วันที่',
      dataIndex: 'work_date',
      key: 'work_date',
      width: 110,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatDate(v)}</span>,
    },
    {
      title: 'พนักงาน',
      dataIndex: 'employee_id',
      key: 'employee_id',
      width: 150,
      ellipsis: true,
      render: (v) => (
        <Text style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.textSecondary }}>
          {v?.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: 'Work Order',
      dataIndex: 'work_order_id',
      key: 'work_order_id',
      width: 150,
      ellipsis: true,
      render: (v) =>
        v ? (
          <Text style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.accent }}>
            {v?.slice(0, 8)}...
          </Text>
        ) : (
          <span style={{ color: COLORS.textMuted }}>-</span>
        ),
    },
    {
      title: 'ชม.ปกติ',
      dataIndex: 'regular_hours',
      key: 'regular_hours',
      width: 90,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'ชม.OT',
      dataIndex: 'ot_hours',
      key: 'ot_hours',
      width: 80,
      align: 'right',
      render: (v) =>
        v > 0 ? (
          <span style={{ fontFamily: 'monospace', fontWeight: 500, color: COLORS.warning }}>{v}</span>
        ) : (
          <span style={{ color: COLORS.textMuted }}>-</span>
        ),
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
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'SUBMITTED' && can('hr.timesheet.approve') && (
            <Tooltip title="อนุมัติ">
              <Button
                type="text"
                size="small"
                icon={<Check size={14} />}
                loading={actionLoading === record.id}
                onClick={() => handleApprove(record.id)}
                style={{ color: COLORS.success }}
              />
            </Tooltip>
          )}
          {record.status === 'APPROVED' && can('hr.timesheet.execute') && (
            <Tooltip title="Final Approve">
              <Button
                type="text"
                size="small"
                icon={<ShieldCheck size={14} />}
                loading={actionLoading === record.id}
                onClick={() => handleFinal(record.id)}
                style={{ color: COLORS.purple }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPagination((p) => ({ ...p, current: 1 }));
          }}
          style={{ width: 200 }}
          options={[
            { value: 'SUBMITTED', label: 'รอ Supervisor อนุมัติ' },
            ...(can('hr.timesheet.execute')
              ? [{ value: 'APPROVED', label: 'รอ HR Final' }]
              : []),
          ]}
        />
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
              message="ไม่มี Timesheet รออนุมัติ"
              hint="รายการที่ถูก Submit จะแสดงที่นี่"
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
