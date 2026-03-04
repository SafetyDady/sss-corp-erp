import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Switch, App, Typography } from 'antd';
import api from '../../services/api';

const { Text } = Typography;

export default function WHTTypeFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editItem) {
        form.setFieldsValue({
          code: editItem.code,
          name: editItem.name,
          section: editItem.section || '',
          rate: parseFloat(editItem.rate) || 0,
          description: editItem.description || '',
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
      const payload = { ...values };
      if (payload.section === '') payload.section = null;
      if (payload.description === '') payload.description = null;
      setLoading(true);
      if (editItem) {
        delete payload.code; // code is immutable on update
        await api.put(`/api/master/wht-types/${editItem.id}`, payload);
        message.success(`Updated WHT type "${values.name}"`);
      } else {
        await api.post('/api/master/wht-types', payload);
        message.success(`Created WHT type "${values.name}"`);
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.toLowerCase().includes('duplicate')) {
          message.error('รหัสนี้ถูกใช้แล้ว');
        } else {
          message.error(detail || 'เกิดข้อผิดพลาด');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editItem ? `แก้ไขประเภทหัก ณ ที่จ่าย — ${editItem.code}` : 'เพิ่มประเภทหัก ณ ที่จ่าย'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'บันทึก' : 'เพิ่ม'}
      cancelText="ยกเลิก"
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical"
        initialValues={{ rate: 3.0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <Form.Item name="code" label="รหัส"
            rules={[{ required: true, message: 'กรุณากรอกรหัส' }]}>
            <Input placeholder="เช่น WHT3" disabled={!!editItem} style={{ textTransform: 'uppercase', fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item name="name" label="ชื่อ"
            rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}>
            <Input placeholder="เช่น ค่าบริการ 3%" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <Form.Item name="section" label="มาตรา (กฎหมาย)">
            <Input placeholder="เช่น มาตรา 3 เตรส (3)" />
          </Form.Item>
          <Form.Item name="rate" label="อัตรา (%)"
            rules={[{ required: true, message: 'กรุณากรอกอัตรา' }]}
            extra={<Text type="secondary" style={{ fontSize: 12 }}>0-100%</Text>}>
            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
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
