import { useState, useEffect, useMemo } from 'react';
import { Card, Select, DatePicker, InputNumber, Button, Table, App, Alert, Typography, Space } from 'antd';
import { Plus, Trash2, Save } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';
import EmployeeContextSelector from '../../components/EmployeeContextSelector';

const { Text } = Typography;

export default function WOTimeEntryForm() {
  const { message } = App.useApp();
  const [employees, setEmployees] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [otTypes, setOtTypes] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approver, setApprover] = useState(null);
  const [leaveBlocked, setLeaveBlocked] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/api/work-orders', { params: { limit: 500, offset: 0, status: 'OPEN' } }),
      api.get('/api/master/ot-types', { params: { limit: 50, offset: 0 } }),
      api.get('/api/admin/approvers', { params: { module: 'hr.timesheet' } }),
    ]).then(([woRes, otRes, appRes]) => {
      setWorkOrders(woRes.data.items || []);
      setOtTypes((otRes.data.items || []).filter((t) => t.is_active));
      setApprovers(appRes.data);
    }).catch(() => {});
  }, []);

  // Check leave status when employee/date changes
  useEffect(() => {
    if (selectedEmployee && selectedDate) {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      api.get('/api/hr/standard-timesheet', {
        params: { employee_id: selectedEmployee, period_start: dateStr, period_end: dateStr },
      }).then((res) => {
        const items = res.data.items || [];
        const leaveDay = items.find((s) =>
          s.actual_status === 'LEAVE_PAID' || s.actual_status === 'LEAVE_UNPAID'
        );
        setLeaveBlocked(!!leaveDay);
      }).catch(() => setLeaveBlocked(false));
    } else {
      setLeaveBlocked(false);
    }
  }, [selectedEmployee, selectedDate]);

  const empInfo = useMemo(() => {
    if (!selectedEmployee) return null;
    return employees.find((e) => e.id === selectedEmployee);
  }, [selectedEmployee, employees]);

  const maxRegularHours = empInfo?.daily_working_hours || 8;

  const totalRegular = useMemo(
    () => lines.reduce((sum, l) => sum + (l.regular_hours || 0), 0),
    [lines]
  );
  const totalOT = useMemo(
    () => lines.reduce((sum, l) => sum + (l.ot_hours || 0), 0),
    [lines]
  );

  const addLine = () => {
    setLines([...lines, {
      key: Date.now(),
      work_order_id: undefined,
      regular_hours: 0,
      ot_hours: 0,
      ot_type_id: undefined,
      note: '',
    }]);
  };

  const removeLine = (key) => setLines(lines.filter((l) => l.key !== key));

  const updateLine = (key, field, value) => {
    setLines(lines.map((l) => l.key === key ? { ...l, [field]: value } : l));
  };

  const handleSave = async () => {
    if (!selectedEmployee || !selectedDate) {
      message.error('กรุณาเลือกพนักงานและวันที่');
      return;
    }
    if (lines.length === 0) {
      message.error('กรุณาเพิ่มรายการ WO อย่างน้อย 1 รายการ');
      return;
    }
    if (lines.some((l) => !l.work_order_id)) {
      message.error('กรุณาเลือก Work Order ทุกรายการ');
      return;
    }
    if (totalRegular > maxRegularHours) {
      message.error(`ชั่วโมงปกติรวม (${totalRegular}) เกินกำหนด ${maxRegularHours} ชม./วัน`);
      return;
    }
    // Validate OT type required when OT hours > 0
    const missingOtType = lines.find((l) => l.ot_hours > 0 && !l.ot_type_id);
    if (missingOtType) {
      message.error('กรุณาเลือกประเภท OT สำหรับรายการที่มีชั่วโมง OT');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        employee_id: selectedEmployee,
        work_date: selectedDate.format('YYYY-MM-DD'),
        requested_approver_id: approver || undefined,
        entries: lines.map(({ work_order_id, regular_hours, ot_hours, ot_type_id, note }) => ({
          work_order_id,
          regular_hours: regular_hours || 0,
          ot_hours: ot_hours || 0,
          ot_type_id: ot_hours > 0 ? ot_type_id : undefined,
          note: note || undefined,
        })),
      };
      await api.post('/api/hr/timesheet/batch', payload);
      message.success('บันทึก WO Time Entry สำเร็จ');
      setLines([]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string' && detail.includes('BR#39')) {
        message.error('วันนี้คุณลา ไม่สามารถกรอก WO Time Entry ได้');
      } else {
        message.error(detail || 'เกิดข้อผิดพลาด');
      }
    } finally {
      setLoading(false);
    }
  };

  const lineColumns = [
    {
      title: 'Work Order', dataIndex: 'work_order_id', width: 260,
      render: (v, record) => (
        <Select
          showSearch optionFilterProp="label" value={v} style={{ width: '100%' }}
          placeholder="เลือก WO"
          onChange={(val) => updateLine(record.key, 'work_order_id', val)}
          options={workOrders.map((w) => ({
            value: w.id,
            label: `${w.wo_number} — ${w.description || ''}`,
          }))}
        />
      ),
    },
    {
      title: 'ชม.ปกติ', dataIndex: 'regular_hours', width: 110, align: 'center',
      render: (v, record) => (
        <InputNumber
          min={0} max={24} step={0.5} value={v} style={{ width: '100%' }}
          onChange={(val) => updateLine(record.key, 'regular_hours', val || 0)}
        />
      ),
    },
    {
      title: 'OT ชม.', dataIndex: 'ot_hours', width: 110, align: 'center',
      render: (v, record) => (
        <InputNumber
          min={0} max={24} step={0.5} value={v} style={{ width: '100%' }}
          onChange={(val) => updateLine(record.key, 'ot_hours', val || 0)}
        />
      ),
    },
    {
      title: 'OT Type', dataIndex: 'ot_type_id', width: 170,
      render: (v, record) => (
        <Select
          allowClear value={v} style={{ width: '100%' }}
          placeholder="ประเภท OT"
          disabled={!record.ot_hours || record.ot_hours <= 0}
          onChange={(val) => updateLine(record.key, 'ot_type_id', val)}
          options={otTypes.map((t) => ({ value: t.id, label: `${t.name} (x${t.factor})` }))}
        />
      ),
    },
    {
      title: '', width: 50,
      render: (_, record) => (
        <Button
          type="text" size="small" danger
          icon={<Trash2 size={14} />}
          onClick={() => removeLine(record.key)}
        />
      ),
    },
  ];

  const regularColor = totalRegular > maxRegularHours ? COLORS.danger
    : totalRegular === maxRegularHours ? COLORS.success
    : COLORS.textSecondary;

  return (
    <div style={{ maxWidth: 900 }}>
      <Alert
        type="info" showIcon
        message="กรอกชั่วโมงทำงานรายวัน — เลือกวันที่ แล้วเพิ่ม WO ที่ทำงานในวันนั้น"
        style={{ marginBottom: 16, background: COLORS.accentMuted, border: 'none' }}
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <EmployeeContextSelector
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            showBadge={false}
            onEmployeesLoaded={setEmployees}
          />
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>วันที่</Text>
            <DatePicker
              value={selectedDate} onChange={setSelectedDate}
              format="DD/MM/YYYY" style={{ width: 180 }}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>ผู้อนุมัติ</Text>
            <Select
              showSearch optionFilterProp="label" allowClear
              value={approver} onChange={setApprover} style={{ width: 220 }}
              placeholder="เลือกผู้อนุมัติ"
              options={approvers.map((a) => ({ value: a.id, label: a.full_name }))}
            />
          </div>
        </div>
      </Card>

      {leaveBlocked && (
        <Alert
          type="warning" showIcon
          message="วันนี้พนักงานลาหยุด — ไม่สามารถกรอก WO Time Entry ได้ (BR#39)"
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>รายการ WO Time Entry</Text>
        <Button
          size="small" icon={<Plus size={12} />}
          onClick={addLine}
          disabled={leaveBlocked || !selectedEmployee || !selectedDate}
        >
          เพิ่ม WO
        </Button>
      </div>

      <Table
        dataSource={lines} columns={lineColumns} rowKey="key"
        pagination={false} size="small"
        footer={() => (
          <div style={{ display: 'flex', gap: 24, fontWeight: 600 }}>
            <span>
              รวมชม.ปกติ:{' '}
              <span style={{ color: regularColor, fontFamily: 'monospace' }}>
                {totalRegular}/{maxRegularHours}
              </span>
              {totalRegular === Number(maxRegularHours) && ' \u2713'}
            </span>
            <span>
              รวม OT:{' '}
              <span style={{ color: totalOT > 0 ? COLORS.warning : COLORS.textMuted, fontFamily: 'monospace' }}>
                {totalOT} ชม.
              </span>
            </span>
          </div>
        )}
      />

      <Space style={{ marginTop: 16 }}>
        <Button
          type="primary"
          icon={<Save size={14} />}
          onClick={handleSave}
          loading={loading}
          disabled={lines.length === 0 || leaveBlocked}
        >
          บันทึก
        </Button>
      </Space>
    </div>
  );
}
