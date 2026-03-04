import { useState, useEffect } from 'react';
import { Modal, Form, Select, InputNumber, App, Alert } from 'antd';
import api from '../../services/api';

const MONTHS = [
  { value: 1, label: 'มกราคม' }, { value: 2, label: 'กุมภาพันธ์' },
  { value: 3, label: 'มีนาคม' }, { value: 4, label: 'เมษายน' },
  { value: 5, label: 'พฤษภาคม' }, { value: 6, label: 'มิถุนายน' },
  { value: 7, label: 'กรกฎาคม' }, { value: 8, label: 'สิงหาคม' },
  { value: 9, label: 'กันยายน' }, { value: 10, label: 'ตุลาคม' },
  { value: 11, label: 'พฤศจิกายน' }, { value: 12, label: 'ธันวาคม' },
];

export default function GenerateRechargeModal({ open, onClose, onSuccess, budgets }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const activeBudgets = (budgets || []).filter((b) => b.status === 'ACTIVE');

  useEffect(() => {
    if (open) {
      const now = new Date();
      form.resetFields();
      form.setFieldsValue({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
      if (activeBudgets.length === 1) {
        form.setFieldsValue({ budget_id: activeBudgets[0].id });
      }
    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = await api.post('/api/finance/recharge/generate', values);
      const count = res.data?.length || 0;
      message.success(`สร้างรายการจัดสรรสำเร็จ (${count} แผนก)`);
      onSuccess?.();
      onClose();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail) {
        message.error(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      title="สร้างรายการจัดสรร Recharge รายเดือน"
      okText="สร้างรายการ"
      cancelText="ยกเลิก"
      width={480}
      destroyOnHidden
    >
      {activeBudgets.length === 0 ? (
        <Alert
          type="warning" showIcon
          message="ไม่มีงบประมาณที่ ACTIVE"
          description="ต้อง Activate งบประมาณก่อนจึงจะสร้างรายการจัดสรรได้"
          style={{ marginTop: 16 }}
        />
      ) : (
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="budget_id"
            label="เลือกงบประมาณ"
            rules={[{ required: true, message: 'กรุณาเลือกงบประมาณ' }]}
          >
            <Select
              placeholder="เลือกงบประมาณ"
              options={activeBudgets.map((b) => ({
                value: b.id,
                label: `${b.source_cost_center_code || 'CC'} — ${b.source_cost_center_name || ''} (${parseFloat(b.annual_budget).toLocaleString()} บ./ปี)`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="year"
            label="ปี"
            rules={[{ required: true, message: 'กรุณาระบุปี' }]}
          >
            <InputNumber min={2020} max={2100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="month"
            label="เดือน"
            rules={[{ required: true, message: 'กรุณาเลือกเดือน' }]}
          >
            <Select options={MONTHS} placeholder="เลือกเดือน" />
          </Form.Item>

          <Alert
            type="info" showIcon
            message="ระบบจะคำนวณจัดสรรงบประมาณรายเดือนตามจำนวนพนักงานในแต่ละแผนก (Headcount) ณ ปัจจุบัน"
            style={{ marginTop: 8 }}
          />
        </Form>
      )}
    </Modal>
  );
}
