import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Switch, App, Typography } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function CostCenterFormModal({ open, editItem, onClose, onSuccess }) {
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
          overhead_rate: parseFloat(editItem.overhead_rate) || 0,
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
        await api.put(`/api/master/cost-centers/${editItem.id}`, payload);
        message.success(`แก้ไขศูนย์ต้นทุน "${values.name}" สำเร็จ`);
      } else {
        await api.post('/api/master/cost-centers', values);
        message.success(`เพิ่มศูนย์ต้นทุน "${values.name}" สำเร็จ`);
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.toLowerCase().includes('unique')) {
          message.error('รหัสศูนย์ต้นทุนนี้ถูกใช้แล้ว');
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
      title={editItem ? `แก้ไขศูนย์ต้นทุน — ${editItem.code}` : 'เพิ่มศูนย์ต้นทุนใหม่'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'บันทึก' : 'เพิ่ม'}
      cancelText="ยกเลิก"
      width={480}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ overhead_rate: 0 }}>
        <Form.Item name="code" label="รหัส"
          rules={[{ required: true, message: 'กรุณากรอกรหัส' }]}
          extra={!editItem && <Text type="secondary" style={{ fontSize: 12 }}>จะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ</Text>}
        >
          <Input disabled={!!editItem} placeholder="เช่น CC-PROD" style={{ fontFamily: 'monospace' }} />
        </Form.Item>

        <Form.Item name="name" label="ชื่อ"
          rules={[{ required: true, message: 'กรุณากรอกชื่อศูนย์ต้นทุน' }]}>
          <Input placeholder="เช่น แผนกผลิต" />
        </Form.Item>

        <Form.Item name="description" label="รายละเอียด">
          <Input.TextArea rows={2} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" maxLength={500} showCount />
        </Form.Item>

        <Form.Item name="overhead_rate" label="Overhead Rate (%)"
          rules={[{ required: true, message: 'กรุณากรอก Overhead Rate' }]}
          extra={<Text type="secondary" style={{ fontSize: 12 }}>BR#30 — แต่ละศูนย์ต้นทุนมี Overhead Rate เป็นของตัวเอง</Text>}
        >
          <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} addonAfter="%" />
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
