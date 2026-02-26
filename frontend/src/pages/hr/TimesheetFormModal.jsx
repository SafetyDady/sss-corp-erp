import { useEffect, useState } from 'react';
import { Modal, Form, Select, DatePicker, InputNumber, Input, App, Typography, Alert } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function TimesheetFormModal({ open, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [otTypes, setOtTypes] = useState([]);
  const otHours = Form.useWatch('ot_hours', form);

  useEffect(() => {
    if (open) {
      form.resetFields();
      Promise.all([
        api.get('/api/hr/employees', { params: { limit: 200, offset: 0 } }),
        api.get('/api/work-orders', { params: { limit: 200, offset: 0, status: 'OPEN' } }),
        api.get('/api/master/ot-types', { params: { limit: 50, offset: 0 } }),
      ]).then(([empRes, woRes, otRes]) => {
        setEmployees((empRes.data.items || []).filter((e) => e.is_active));
        setWorkOrders(woRes.data.items || []);
        setOtTypes((otRes.data.items || []).filter((t) => t.is_active));
      }).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const payload = {
        ...values,
        work_date: values.work_date.format('YYYY-MM-DD'),
        ot_hours: values.ot_hours || 0,
        ot_type_id: values.ot_hours > 0 ? values.ot_type_id : undefined,
      };
      await api.post('/api/hr/timesheet', payload);
      message.success('บันทึก Timesheet สำเร็จ');
      onSuccess();
    } catch (err) {
      if (err.response) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.toLowerCase().includes('overlap')) {
          message.error('ชั่วโมงทำงานซ้อนทับกับ Timesheet อื่น (1 ชม. = 1 WO เท่านั้น)');
        } else if (typeof detail === 'string' && detail.toLowerCase().includes('lock')) {
          message.error('เกินระยะเวลา Lock Period 7 วัน — ติดต่อ HR เพื่อ Unlock');
        } else {
          message.error(detail || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="บันทึก Timesheet"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="บันทึก"
      cancelText="ยกเลิก"
      width={560}
      destroyOnClose
    >
      <Alert
        type="info" showIcon
        message="กรอกย้อนหลังได้ไม่เกิน 7 วัน — ชั่วโมงเดียวกัน = 1 Work Order เท่านั้น"
        style={{ marginBottom: 16, background: COLORS.accentMuted, border: 'none' }}
      />
      <Form form={form} layout="vertical" initialValues={{ regular_hours: 8, ot_hours: 0 }}>
        <Form.Item name="employee_id" label="พนักงาน"
          rules={[{ required: true, message: 'กรุณาเลือกพนักงาน' }]}>
          <Select placeholder="เลือกพนักงาน" showSearch optionFilterProp="label"
            options={employees.map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.full_name}` }))} />
        </Form.Item>

        <Form.Item name="work_order_id" label="Work Order (เฉพาะ OPEN)"
          rules={[{ required: true, message: 'กรุณาเลือก Work Order' }]}>
          <Select placeholder="เลือก Work Order" showSearch optionFilterProp="label"
            options={workOrders.map((w) => ({ value: w.id, label: `${w.wo_number} — ${w.description || ''}` }))} />
        </Form.Item>

        <Form.Item name="work_date" label="วันที่ทำงาน"
          rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}>
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="regular_hours" label="ชั่วโมงปกติ"
            rules={[{ required: true, message: 'กรุณากรอกชั่วโมง' }]}>
            <InputNumber min={0} max={24} step={0.5} style={{ width: '100%' }} addonAfter="ชม." />
          </Form.Item>

          <Form.Item name="ot_hours" label="ชั่วโมง OT">
            <InputNumber min={0} max={24} step={0.5} style={{ width: '100%' }} addonAfter="ชม." />
          </Form.Item>
        </div>

        {otHours > 0 && (
          <Form.Item name="ot_type_id" label="ประเภท OT"
            rules={[{ required: true, message: 'กรุณาเลือกประเภท OT เมื่อมีชั่วโมง OT' }]}
            extra={<Text type="secondary" style={{ fontSize: 12 }}>วันธรรมดา 1.5x / วันหยุด 2.0x / นักขัตฤกษ์ 3.0x</Text>}
          >
            <Select placeholder="เลือกประเภท OT"
              options={otTypes.map((t) => ({ value: t.id, label: `${t.name} (x${t.factor})` }))} />
          </Form.Item>
        )}

        <Form.Item name="note" label="หมายเหตุ">
          <Input.TextArea rows={2} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
