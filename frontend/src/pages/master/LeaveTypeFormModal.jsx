import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Switch, App } from 'antd';
import api from '../../services/api';

export default function LeaveTypeFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editItem) {
        form.setFieldsValue({
          code: editItem.code,
          name: editItem.name,
          is_paid: editItem.is_paid,
          default_quota: editItem.default_quota,
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
        await api.put(`/api/master/leave-types/${editItem.id}`, values);
        message.success(`แก้ไขประเภทลา "${values.name}" สำเร็จ`);
      } else {
        await api.post('/api/master/leave-types', values);
        message.success(`เพิ่มประเภทลา "${values.name}" สำเร็จ`);
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
      title={editItem ? `แก้ไขประเภทลา — ${editItem.name}` : 'เพิ่มประเภทลาใหม่'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'บันทึก' : 'เพิ่ม'}
      cancelText="ยกเลิก"
      width={480}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" initialValues={{ is_paid: true }}>
        {!editItem && (
          <Form.Item name="code" label="รหัส"
            rules={[{ required: true, message: 'กรุณากรอกรหัส' }]}>
            <Input placeholder="เช่น ANNUAL, SICK, PERSONAL" />
          </Form.Item>
        )}

        <Form.Item name="name" label="ชื่อประเภทลา"
          rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}>
          <Input placeholder="เช่น ลาพักร้อน, ลาป่วย, ลากิจ" />
        </Form.Item>

        <Form.Item name="is_paid" label="ลาได้เงิน" valuePropName="checked">
          <Switch checkedChildren="ได้เงิน" unCheckedChildren="ไม่ได้เงิน" />
        </Form.Item>

        <Form.Item name="default_quota" label="โควต้า/ปี (วัน)"
          extra="เว้นว่างไว้หากไม่จำกัด">
          <InputNumber min={0} style={{ width: '100%' }} placeholder="ไม่จำกัด" />
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
