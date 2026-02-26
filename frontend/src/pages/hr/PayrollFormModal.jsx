import { useEffect, useState } from 'react';
import { Modal, Form, DatePicker, Input, App, Alert } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

export default function PayrollFormModal({ open, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) form.resetFields();
  }, [open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const payload = {
        period_start: values.period_start.format('YYYY-MM-DD'),
        period_end: values.period_end.format('YYYY-MM-DD'),
        note: values.note || undefined,
      };
      await api.post('/api/hr/payroll/run', payload);
      message.success('สร้าง Payroll Run สำเร็จ — กดปุ่ม ▶ เพื่อประมวลผล');
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
      title="สร้าง Payroll Run"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="สร้าง"
      cancelText="ยกเลิก"
      width={480}
      destroyOnClose
    >
      <Alert
        type="info" showIcon
        message="ระบบจะรวบรวม Timesheet ที่ Final Approve แล้วในช่วงเวลาที่กำหนด"
        style={{ marginBottom: 16, background: COLORS.accentMuted, border: 'none' }}
      />
      <Form form={form} layout="vertical">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="period_start" label="วันเริ่มงวด"
            rules={[{ required: true, message: 'กรุณาเลือกวันเริ่มงวด' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="period_end" label="วันสิ้นสุดงวด"
            rules={[
              { required: true, message: 'กรุณาเลือกวันสิ้นสุดงวด' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || !getFieldValue('period_start')) return Promise.resolve();
                  if (value.isBefore(getFieldValue('period_start'))) {
                    return Promise.reject(new Error('วันสิ้นสุดต้องไม่ก่อนวันเริ่มงวด'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Form.Item name="note" label="หมายเหตุ">
          <Input.TextArea rows={2} placeholder="เช่น งวดเดือน ก.พ. 2569" maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
