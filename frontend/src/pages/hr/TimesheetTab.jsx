import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Select, Tooltip, Typography } from 'antd';
import { Plus, CheckCircle, ShieldCheck, Unlock, Info } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import TimesheetFormModal from './TimesheetFormModal';
import { formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import EmployeeContextSelector from '../../components/EmployeeContextSelector';

const { Text } = Typography;

const STATUS_FLOW_HINT = 'DRAFT → SUBMITTED → Supervisor Approve → HR Final Approve';

export default function TimesheetTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/hr/timesheet', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
          employee_id: selectedEmployee || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูล Timesheet ได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, statusFilter, selectedEmployee]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id, action, successMsg) => {
    setActionLoading(id);
    try {
      await api.post(`/api/hr/timesheet/${id}/${action}`);
      message.success(successMsg);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      title: 'วันที่', dataIndex: 'work_date', key: 'work_date', width: 110,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatDate(v)}</span>,
    },
    {
      title: 'Employee ID', dataIndex: 'employee_id', key: 'employee_id', width: 130,
      ellipsis: true,
      render: (v) => <Text copyable={{ text: v }} style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.textSecondary }}>{v?.slice(0, 8)}...</Text>,
    },
    {
      title: 'Work Order', dataIndex: 'work_order_id', key: 'work_order_id', width: 130,
      ellipsis: true,
      render: (v) => <Text copyable={{ text: v }} style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.accent }}>{v?.slice(0, 8)}...</Text>,
    },
    {
      title: 'ชม.ปกติ', dataIndex: 'regular_hours', key: 'regular_hours', width: 90,
      align: 'center',
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'ชม.OT', dataIndex: 'ot_hours', key: 'ot_hours', width: 80,
      align: 'center',
      render: (v) => v > 0
        ? <span style={{ fontFamily: 'monospace', fontWeight: 500, color: COLORS.warning }}>{v}</span>
        : <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          สถานะ
          <Tooltip title={STATUS_FLOW_HINT}><Info size={12} style={{ color: COLORS.textMuted }} /></Tooltip>
        </span>
      ),
      dataIndex: 'status', key: 'status', width: 110,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'หมายเหตุ', dataIndex: 'note', key: 'note', ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: '', key: 'actions', width: 140, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'SUBMITTED' && can('hr.timesheet.approve') && (
            <Popconfirm title="อนุมัติ Timesheet นี้?" description="Supervisor Approve" onConfirm={() => handleAction(record.id, 'approve', 'อนุมัติ Timesheet สำเร็จ')}
              okText="อนุมัติ" cancelText="ยกเลิก">
              <Tooltip title="Supervisor Approve">
                <Button type="text" size="small" loading={actionLoading === record.id}
                  icon={<CheckCircle size={14} />} style={{ color: '#10b981' }} />
              </Tooltip>
            </Popconfirm>
          )}
          {record.status === 'APPROVED' && can('hr.timesheet.execute') && (
            <Popconfirm title="Final Approve?" description="HR Final — ข้อมูลจะเข้า Payroll" onConfirm={() => handleAction(record.id, 'final', 'Final Approve สำเร็จ')}
              okText="ยืนยัน" cancelText="ยกเลิก">
              <Tooltip title="HR Final Approve">
                <Button type="text" size="small" loading={actionLoading === record.id}
                  icon={<ShieldCheck size={14} />} style={{ color: '#8b5cf6' }} />
              </Tooltip>
            </Popconfirm>
          )}
          {record.is_locked && can('hr.timesheet.execute') && (
            <Popconfirm title="Unlock Timesheet?" description="อนุญาตให้แก้ไขหลัง Lock Period 7 วัน" onConfirm={() => handleAction(record.id, 'unlock', 'Unlock สำเร็จ')}
              okText="Unlock" cancelText="ยกเลิก">
              <Tooltip title="Unlock (HR Only)">
                <Button type="text" size="small" loading={actionLoading === record.id}
                  icon={<Unlock size={14} />} style={{ color: '#f59e0b' }} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <EmployeeContextSelector
          value={selectedEmployee}
          onChange={(val) => { setSelectedEmployee(val); setPagination((p) => ({ ...p, current: 1 })); }}
        />
      </div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <SearchInput onSearch={setSearch} placeholder="ค้นหา..." />
          <Select
            allowClear placeholder="กรองสถานะ" style={{ width: 160 }}
            value={statusFilter} onChange={setStatusFilter}
            options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SUBMITTED', label: 'Submitted' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'FINAL', label: 'Final' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
          />
        </div>
        {can('hr.timesheet.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => setModalOpen(true)}>
            บันทึก Timesheet
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ยังไม่มีข้อมูล Timesheet" hint="กดปุ่ม 'บันทึก Timesheet' เพื่อเริ่มบันทึกชั่วโมงทำงาน" /> }}
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
      <TimesheetFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
