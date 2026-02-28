import { useEffect, useState } from 'react';
import { Modal, Form, Input, Switch, App, Typography } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function CostElementFormModal({ open, editItem, onClose, onSuccess }) {
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
        await api.put(`/api/master/cost-elements/${editItem.id}`, payload);
        message.success(`แก้ไข Cost Element "${values.name}" สำเร็จ`);
      } else {
        await api.post('/api/master/cost-elements', values);
        message.success(`เพิ่ม Cost Element "${values.name}" สำเร็จ`);
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.toLowerCase().includes('unique')) {
          message.error('รหัสนี้ถูกใช้แล้ว');
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
      title={editItem ? `แก้ไข Cost Element — ${editItem.code}` : 'เพิ่ม Cost Element ใหม่'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'บันทึก' : 'เพิ่ม'}
      cancelText="ยกเลิก"
      width={480}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="code" label="รหัส"
          rules={[{ required: true, message: 'กรุณากรอกรหัส' }]}
          extra={!editItem && <Text type="secondary" style={{ fontSize: 12 }}>จะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ</Text>}
        >
          <Input disabled={!!editItem} placeholder="เช่น CE-LABOR" style={{ fontFamily: 'monospace' }} />
        </Form.Item>

        <Form.Item name="name" label="ชื่อ"
          rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}>
          <Input placeholder="เช่น ค่าแรงงานทางตรง" />
        </Form.Item>

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
