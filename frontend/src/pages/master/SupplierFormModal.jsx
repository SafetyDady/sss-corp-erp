import { useEffect, useState } from 'react';
import { Modal, Form, Input, Switch, App, Typography } from 'antd';
import api from '../../services/api';

const { Text } = Typography;

export default function SupplierFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editItem) {
        form.setFieldsValue({
          code: editItem.code,
          name: editItem.name,
          contact_name: editItem.contact_name || '',
          email: editItem.email || '',
          phone: editItem.phone || '',
          address: editItem.address || '',
          tax_id: editItem.tax_id || '',
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
        // Clean empty strings to null
        ['contact_name', 'email', 'phone', 'address', 'tax_id'].forEach((k) => {
          if (payload[k] === '') payload[k] = null;
        });
        await api.put(`/api/master/suppliers/${editItem.id}`, payload);
        message.success(`แก้ไขซัพพลายเออร์ "${values.name}" สำเร็จ`);
      } else {
        const payload = { ...values };
        ['contact_name', 'email', 'phone', 'address', 'tax_id'].forEach((k) => {
          if (payload[k] === '') delete payload[k];
        });
        await api.post('/api/master/suppliers', payload);
        message.success(`เพิ่มซัพพลายเออร์ "${values.name}" สำเร็จ`);
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.toLowerCase().includes('duplicate')) {
          message.error('รหัสซัพพลายเออร์นี้ถูกใช้แล้ว');
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
      title={editItem ? `แก้ไขซัพพลายเออร์ — ${editItem.code}` : 'เพิ่มซัพพลายเออร์ใหม่'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'บันทึก' : 'เพิ่ม'}
      cancelText="ยกเลิก"
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="code" label="รหัส"
          rules={[{ required: true, message: 'กรุณากรอกรหัส' }]}
          extra={!editItem && <Text type="secondary" style={{ fontSize: 12 }}>จะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ</Text>}
        >
          <Input disabled={!!editItem} placeholder="เช่น SUP-001" style={{ fontFamily: 'monospace' }} />
        </Form.Item>

        <Form.Item name="name" label="ชื่อบริษัท"
          rules={[{ required: true, message: 'กรุณากรอกชื่อซัพพลายเออร์' }]}>
          <Input placeholder="เช่น Thai Steel Supply Co., Ltd." />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="contact_name" label="ชื่อผู้ติดต่อ" style={{ flex: 1 }}>
            <Input placeholder="ชื่อผู้ประสานงาน" />
          </Form.Item>
          <Form.Item name="phone" label="โทรศัพท์" style={{ flex: 1 }}>
            <Input placeholder="เช่น 02-123-4567" />
          </Form.Item>
        </div>

        <Form.Item name="email" label="อีเมล"
          rules={[{ type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง' }]}>
          <Input placeholder="เช่น contact@supplier.com" />
        </Form.Item>

        <Form.Item name="address" label="ที่อยู่">
          <Input.TextArea rows={2} placeholder="ที่อยู่ (ถ้ามี)" maxLength={500} showCount />
        </Form.Item>

        <Form.Item name="tax_id" label="เลขประจำตัวผู้เสียภาษี">
          <Input placeholder="เช่น 0105536123456" maxLength={20} style={{ fontFamily: 'monospace' }} />
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
