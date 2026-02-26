import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Switch, App, Typography } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function OTTypeFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editItem) {
        form.setFieldsValue({
          name: editItem.name,
          factor: parseFloat(editItem.factor) || 1.5,
          max_ceiling: parseFloat(editItem.max_ceiling) || 3.0,
          description: editItem.description,
          is_active: editItem.is_active,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editItem]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // BR#24 — client-side check
      if (values.max_ceiling < values.factor) {
        message.error('เพดานสูงสุด (Max Ceiling) ต้อง >= ตัวคูณ OT (Factor) — BR#24');
        return;
      }
      setLoading(true);
      if (editItem) {
        await api.put(`/api/master/ot-types/${editItem.id}`, values);
        message.success(`แก้ไขประเภท OT "${values.name}" สำเร็จ`);
      } else {
        await api.post('/api/master/ot-types', values);
        message.success(`เพิ่มประเภท OT "${values.name}" สำเร็จ`);
      }
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
      title={editItem ? `แก้ไขประเภท OT — ${editItem.name}` : 'เพิ่มประเภท OT ใหม่'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'บันทึก' : 'เพิ่ม'}
      cancelText="ยกเลิก"
      width={480}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ factor: 1.5, max_ceiling: 3.0 }}>
        <Form.Item name="name" label="ชื่อประเภท OT"
          rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}>
          <Input placeholder="เช่น วันธรรมดา, วันหยุด, นักขัตฤกษ์" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="factor" label="ตัวคูณ OT (Factor)"
            rules={[{ required: true, message: 'กรุณากรอกตัวคูณ' }]}
            extra={<Text type="secondary" style={{ fontSize: 12 }}>เช่น 1.50 = OT 1.5 เท่า</Text>}
          >
            <InputNumber min={0.01} step={0.25} style={{ width: '100%' }} prefix="x" />
          </Form.Item>

          <Form.Item name="max_ceiling" label="เพดานสูงสุด (Max Ceiling)"
            rules={[{ required: true, message: 'กรุณากรอกเพดานสูงสุด' }]}
            extra={<Text type="secondary" style={{ fontSize: 12 }}>BR#24 — ต้อง >= Factor</Text>}
          >
            <InputNumber min={0.01} step={0.25} style={{ width: '100%' }} prefix="x" />
          </Form.Item>
        </div>

        <Form.Item name="description" label="รายละเอียด">
          <Input.TextArea rows={2} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" maxLength={500} showCount />
        </Form.Item>

        {editItem && (
          <Form.Item name="is_active" label="สถานะใช้งาน" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
