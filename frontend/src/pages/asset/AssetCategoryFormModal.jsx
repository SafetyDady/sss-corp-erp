import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, App } from 'antd';
import api from '../../services/api';

export default function AssetCategoryFormModal({ open, onClose, onSuccess, category = null }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (category) {
      form.setFieldsValue(category);
    } else {
      form.resetFields();
    }
  }, [category, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (category) {
        await api.put(`/api/asset/categories/${category.id}`, {
          name: values.name,
          useful_life_years: values.useful_life_years,
          depreciation_rate: values.depreciation_rate,
        });
        message.success('อัปเดตหมวดสำเร็จ');
      } else {
        await api.post('/api/asset/categories', values);
        message.success('สร้างหมวดสำเร็จ');
      }
      onSuccess();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={category ? 'แก้ไขหมวดสินทรัพย์' : 'เพิ่มหมวดสินทรัพย์'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={category ? 'บันทึก' : 'สร้าง'}
    >
      <Form form={form} layout="vertical" size="small">
        <Form.Item name="code" label="รหัสหมวด" rules={[{ required: true, message: 'กรุณาระบุรหัส' }]}>
          <Input placeholder="e.g. MACH, VEH, COMP" disabled={!!category} style={{ textTransform: 'uppercase' }} />
        </Form.Item>
        <Form.Item name="name" label="ชื่อหมวด" rules={[{ required: true, message: 'กรุณาระบุชื่อ' }]}>
          <Input placeholder="e.g. เครื่องจักร, ยานพาหนะ" />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="useful_life_years" label="อายุใช้งาน (ปี)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="depreciation_rate" label="อัตราเสื่อม (%/ปี)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} max={100} precision={2} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
