import { useState, useEffect } from 'react';
import { Modal, Form, DatePicker, Select, Checkbox, App, Typography } from 'antd';
import dayjs from 'dayjs';
import api from '../../services/api';

const { Text } = Typography;
const { RangePicker } = DatePicker;

export default function RosterGenerateModal({ open, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    if (open) {
      form.resetFields();
      Promise.all([
        api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } }),
        api.get('/api/master/work-schedules', { params: { limit: 100, offset: 0 } }),
      ]).then(([empRes, wsRes]) => {
        const activeEmps = (empRes.data.items || []).filter(
          (e) => e.is_active && e.work_schedule_id
        );
        setEmployees(activeEmps);
        setSchedules((wsRes.data.items || []).filter((w) => w.is_active));
      }).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const [startDate, endDate] = values.date_range;
      const payload = {
        start_date: startDate.format('YYYY-MM-DD'),
        end_date: endDate.format('YYYY-MM-DD'),
        overwrite_existing: values.overwrite_existing || false,
      };
      if (values.employee_ids && values.employee_ids.length > 0) {
        payload.employee_ids = values.employee_ids;
      }
      setLoading(true);
      const { data } = await api.post('/api/hr/roster/generate', payload);
      message.success(`สร้างตารางกะสำเร็จ — ${data.created_count} รายการ (ข้าม ${data.skipped_count})`);
      onSuccess();
    } catch (err) {
      if (err.response) {
        message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
      }
    } finally {
      setLoading(false);
    }
  };

  // Build employee options grouped by schedule
  const buildEmployeeOptions = () => {
    const scheduleMap = new Map();
    schedules.forEach((s) => scheduleMap.set(s.id, s));

    const groups = new Map();
    const noSchedule = [];

    employees.forEach((e) => {
      const ws = scheduleMap.get(e.work_schedule_id);
      if (ws) {
        if (!groups.has(ws.id)) {
          groups.set(ws.id, { schedule: ws, emps: [] });
        }
        groups.get(ws.id).emps.push(e);
      } else {
        noSchedule.push(e);
      }
    });

    const options = [];
    for (const { schedule, emps } of groups.values()) {
      options.push({
        label: `${schedule.code} — ${schedule.name} (${schedule.schedule_type})`,
        options: emps.map((e) => ({
          value: e.id,
          label: `${e.employee_code} — ${e.full_name}`,
        })),
      });
    }
    return options;
  };

  return (
    <Modal
      title="Generate Roster — สร้างตารางกะอัตโนมัติ"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="Generate"
      cancelText="Cancel"
      width={560}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="date_range"
          label="ช่วงวันที่"
          rules={[{ required: true, message: 'กรุณาเลือกช่วงวันที่' }]}
        >
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="employee_ids"
          label="พนักงาน"
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              ถ้าไม่เลือก จะสร้างให้ทุกคนที่มีตารางกะ ({employees.length} คน)
            </Text>
          }
        >
          <Select
            mode="multiple"
            allowClear
            placeholder="ทุกคนที่มีตารางกะ"
            options={buildEmployeeOptions()}
            optionFilterProp="label"
            maxTagCount={3}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item name="overwrite_existing" valuePropName="checked">
          <Checkbox>
            เขียนทับรายการที่มีอยู่ (ยกเว้น manual override)
          </Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
