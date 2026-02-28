import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Select, DatePicker, App, Tag, Space, Card, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import EmployeeContextSelector from '../../components/EmployeeContextSelector';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLOR_MAP = {
  WORK: { color: COLORS.success, label: 'ทำงาน' },
  LEAVE_PAID: { color: '#3b82f6', label: 'ลา (ได้เงิน)' },
  LEAVE_UNPAID: { color: COLORS.warning, label: 'ลา (ไม่ได้เงิน)' },
  ABSENT: { color: COLORS.danger, label: 'ขาดงาน' },
  HOLIDAY: { color: COLORS.textMuted, label: 'วันหยุด' },
};

export default function StandardTimesheetView() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => {
    // EmployeeContextSelector handles employee loading via onEmployeesLoaded
  }, []);

  const fetchData = useCallback(async () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return;
    setLoading(true);
    try {
      const { data } = await api.get('/api/hr/standard-timesheet', {
        params: {
          employee_id: selectedEmployee || undefined,
          period_start: dateRange[0].format('YYYY-MM-DD'),
          period_end: dateRange[1].format('YYYY-MM-DD'),
        },
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      message.error('กรุณาเลือกช่วงวันที่');
      return;
    }
    setGenerateLoading(true);
    try {
      const { data } = await api.post('/api/hr/standard-timesheet/generate', {
        employee_id: selectedEmployee || undefined,
        period_start: dateRange[0].format('YYYY-MM-DD'),
        period_end: dateRange[1].format('YYYY-MM-DD'),
      });
      message.success(`สร้าง Standard Timesheet สำเร็จ ${data.generated} รายการ`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setGenerateLoading(false);
    }
  };

  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e; });

  const columns = [
    {
      title: 'วันที่', dataIndex: 'work_date', key: 'work_date', width: 110,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatDate(v)}</span>,
    },
    {
      title: 'พนักงาน', dataIndex: 'employee_id', key: 'employee_id', width: 200,
      render: (v) => {
        const emp = empMap[v];
        return emp
          ? <span>{emp.employee_code} — {emp.full_name}</span>
          : <Text type="secondary" style={{ fontSize: 12 }}>{v?.slice(0, 8)}...</Text>;
      },
    },
    {
      title: 'ชั่วโมง', dataIndex: 'scheduled_hours', key: 'scheduled_hours', width: 100,
      align: 'center',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {Number(v).toFixed(1)}
        </span>
      ),
    },
    {
      title: 'สถานะวัน', dataIndex: 'actual_status', key: 'actual_status', width: 140,
      render: (v) => {
        const info = STATUS_COLOR_MAP[v] || { color: COLORS.textMuted, label: v };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: 'วันที่สร้าง', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: (v) => <span style={{ fontSize: 12, color: COLORS.textMuted }}>{formatDate(v)}</span>,
    },
  ];

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <EmployeeContextSelector
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            showBadge={false}
            onEmployeesLoaded={setEmployees}
          />
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>ช่วงวันที่</Text>
            <RangePicker value={dateRange} onChange={setDateRange} format="DD/MM/YYYY" />
          </div>
          {can('hr.timesheet.execute') && (
            <Button
              icon={<RefreshCw size={14} />}
              loading={generateLoading}
              onClick={handleGenerate}
              disabled={!dateRange}
            >
              สร้าง Standard Timesheet
            </Button>
          )}
        </div>
      </Card>

      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{
          emptyText: (
            <EmptyState
              message="ยังไม่มีข้อมูล Standard Timesheet"
              hint="เลือกช่วงวันที่แล้วกดปุ่ม 'สร้าง Standard Timesheet'"
            />
          ),
        }}
        pagination={false}
        size="middle"
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell colSpan={2}>
              <Text strong>รวม {total} รายการ</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell align="center">
              <Text strong style={{ fontFamily: 'monospace' }}>
                {items.reduce((s, i) => s + Number(i.scheduled_hours || 0), 0).toFixed(1)}
              </Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell colSpan={2} />
          </Table.Summary.Row>
        )}
      />
    </div>
  );
}
