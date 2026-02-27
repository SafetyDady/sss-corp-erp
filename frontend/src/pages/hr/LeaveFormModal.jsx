import { useEffect, useState } from 'react';
import { Modal, Form, Select, DatePicker, Input, App, Typography } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

const LEAVE_TYPES = [
  { value: 'ANNUAL', label: 'ลาพักร้อน (Annual)' },
  { value: 'SICK', label: 'ลาป่วย (Sick)' },
  { value: 'PERSONAL', label: 'ลากิจ (Personal)' },
];

export default function LeaveFormModal({ open, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (open) {
      form.resetFields();
      api.get('/api/hr/employees', { params: { limit: 200, offset: 0 } })
        .then(({ data }) => setEmployees((data.items || []).filter((e) => e.is_active)))
        .catch(() => {});
    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const payload = {
        ...values,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date.format('YYYY-MM-DD'),
      };
      await api.post('/api/hr/leave', payload);
      message.success('ยื่นคำขอลาหยุดสำเร็จ — รอการอนุมัติ');
      onSuccess();
    } catch (err) {
      if (err.response) {
        message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="ขอลาหยุด"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="ยื่นคำขอ"
      cancelText="ยกเลิก"
      width={500}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="employee_id" label="พนักงาน"
          rules={[{ required: true, message: 'กรุณาเลือกพนักงาน' }]}>
          <Select placeholder="เลือกพนักงาน" showSearch optionFilterProp="label"
            options={employees.map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.full_name}` }))} />
        </Form.Item>

        <Form.Item name="leave_type" label="ประเภทลา"
          rules={[{ required: true, message: 'กรุณาเลือกประเภทลา' }]}>
          <Select placeholder="เลือกประเภทลา" options={LEAVE_TYPES} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="start_date" label="วันเริ่มลา"
            rules={[{ required: true, message: 'กรุณาเลือกวันเริ่มลา' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="end_date" label="วันสิ้นสุด"
            rules={[
              { required: true, message: 'กรุณาเลือกวันสิ้นสุด' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || !getFieldValue('start_date')) return Promise.resolve();
                  if (value.isBefore(getFieldValue('start_date'))) {
                    return Promise.reject(new Error('วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Form.Item name="reason" label="เหตุผล"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>ลาป่วยเกิน 3 วัน ต้องแนบใบรับรองแพทย์</Text>}
        >
          <Input.TextArea rows={3} placeholder="ระบุเหตุผลการลา (ถ้ามี)" maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
