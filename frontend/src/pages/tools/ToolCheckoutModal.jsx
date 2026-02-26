import { useEffect, useState } from 'react';
import { Modal, Form, Select, App, Alert, Typography } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function ToolCheckoutModal({ open, tool, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);

  useEffect(() => {
    if (open && tool) {
      form.resetFields();
      Promise.all([
        api.get('/api/hr/employees', { params: { limit: 200, offset: 0 } }),
        api.get('/api/work-orders', { params: { limit: 200, offset: 0 } }),
      ]).then(([empRes, woRes]) => {
        setEmployees((empRes.data.items || []).filter((e) => e.is_active));
        setWorkOrders((woRes.data.items || []).filter((w) => w.status === 'OPEN'));
      }).catch(() => {});
    }
  }, [open, tool]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await api.post(`/api/tools/${tool.id}/checkout`, {
        employee_id: values.employee_id,
        work_order_id: values.work_order_id,
      });
      message.success(`เบิกเครื่องมือ "${tool.name}" สำเร็จ — ผูกกับ Work Order แล้ว`);
      onSuccess();
    } catch (err) {
      if (err.response) {
        const detail = err.response?.data?.detail || '';
        if (detail.includes('not available') || detail.includes('AVAILABLE')) {
          message.error('เครื่องมือนี้ถูกเบิกไปแล้ว — กรุณารีเฟรชหน้า');
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
      title={`เบิกเครื่องมือ — ${tool?.name || ''}`}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="เบิก"
      cancelText="ยกเลิก"
      width={500}
      destroyOnClose
    >
      {tool && (
        <Alert
          type="info" showIcon
          message={
            <span>
              <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{tool.code}</span>
              {' — '}อัตรา{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {parseFloat(tool.rate_per_hour).toLocaleString()} บาท/ชม.
              </span>
            </span>
          }
          description="ค่าใช้จ่ายจะถูกคำนวณอัตโนมัติเมื่อคืนเครื่องมือ (BR#28)"
          style={{ marginBottom: 16, background: COLORS.accentMuted, border: 'none' }}
        />
      )}
      <Form form={form} layout="vertical">
        <Form.Item name="employee_id" label="พนักงานผู้เบิก"
          rules={[{ required: true, message: 'กรุณาเลือกพนักงาน' }]}>
          <Select placeholder="เลือกพนักงาน" showSearch optionFilterProp="label"
            options={employees.map((e) => ({
              value: e.id,
              label: `${e.employee_code} — ${e.full_name}`,
            }))} />
        </Form.Item>

        <Form.Item name="work_order_id" label="Work Order"
          rules={[{ required: true, message: 'กรุณาเลือก Work Order' }]}
          extra={<Text type="secondary" style={{ fontSize: 12 }}>แสดงเฉพาะ WO ที่สถานะ IN_PROGRESS</Text>}
        >
          <Select placeholder="เลือก Work Order" showSearch optionFilterProp="label"
            options={workOrders.map((w) => ({
              value: w.id,
              label: `${w.wo_number} — ${w.description || 'ไม่มีรายละเอียด'}`,
            }))} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
