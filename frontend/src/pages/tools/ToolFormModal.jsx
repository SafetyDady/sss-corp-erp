import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Switch, App, Typography } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function ToolFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editItem) {
        form.setFieldsValue({
          code: editItem.code,
          name: editItem.name,
          description: editItem.description,
          rate_per_hour: parseFloat(editItem.rate_per_hour) || 0,
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
      setLoading(true);
      if (editItem) {
        const payload = { ...values };
        delete payload.code;
        await api.put(`/api/tools/${editItem.id}`, payload);
        message.success(`แก้ไขเครื่องมือ "${values.name}" สำเร็จ`);
      } else {
        await api.post('/api/tools', values);
        message.success(`เพิ่มเครื่องมือ "${values.name}" สำเร็จ`);
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.toLowerCase().includes('unique')) {
          message.error('รหัสเครื่องมือนี้ถูกใช้แล้ว');
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
      title={editItem ? `แก้ไขเครื่องมือ — ${editItem.code}` : 'เพิ่มเครื่องมือใหม่'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'บันทึก' : 'เพิ่ม'}
      cancelText="ยกเลิก"
      width={500}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ rate_per_hour: 0, is_active: true }}>
        <Form.Item name="code" label="รหัสเครื่องมือ"
          rules={[{ required: true, message: 'กรุณากรอกรหัส' }]}
          extra={!editItem && <Text type="secondary" style={{ fontSize: 12 }}>จะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ เช่น TL-001</Text>}
        >
          <Input disabled={!!editItem} placeholder="เช่น TL-001" style={{ fontFamily: 'monospace' }} />
        </Form.Item>

        <Form.Item name="name" label="ชื่อเครื่องมือ"
          rules={[{ required: true, message: 'กรุณากรอกชื่อเครื่องมือ' }]}>
          <Input placeholder="เช่น สว่านไฟฟ้า Bosch GSB 13" />
        </Form.Item>

        <Form.Item name="description" label="รายละเอียด">
          <Input.TextArea rows={2} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" maxLength={500} showCount />
        </Form.Item>

        <Form.Item name="rate_per_hour" label="อัตราค่าใช้จ่าย (บาท/ชั่วโมง)"
          rules={[{ required: true, message: 'กรุณากรอกอัตราค่าใช้จ่าย' }]}
          extra={<Text type="secondary" style={{ fontSize: 12 }}>BR#28 — ค่าเครื่องมือคำนวณจาก rate_per_hour x ชั่วโมงที่เบิก</Text>}
        >
          <InputNumber min={0} step={10} style={{ width: '100%' }} addonAfter="บาท/ชม." />
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
