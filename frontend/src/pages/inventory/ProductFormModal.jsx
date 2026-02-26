import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, App } from 'antd';
import api from '../../services/api';

export default function ProductFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editItem) {
        form.setFieldsValue({
          ...editItem,
          cost: editItem.cost ? parseFloat(editItem.cost) : undefined,
        });
      }
    }
  }, [open, editItem]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      if (editItem) {
        await api.put(`/api/inventory/products/${editItem.id}`, values);
      } else {
        await api.post('/api/inventory/products', values);
      }
      message.success('\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      onSuccess();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editItem ? '\u0E41\u0E01\u0E49\u0E44\u0E02\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32' : '\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="sku" label={'\u0E23\u0E2B\u0E31\u0E2A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 (SKU)'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32' }]}>
          <Input disabled={!!editItem} />
        </Form.Item>
        <Form.Item name="name" label={'\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label={'\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14'}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="product_type" label={'\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17' }]}>
          <Select options={[
            { value: 'MATERIAL', label: 'Material' },
            { value: 'CONSUMABLE', label: 'Consumable' },
          ]} />
        </Form.Item>
        <Form.Item name="unit" label={'\u0E2B\u0E19\u0E48\u0E27\u0E22\u0E19\u0E31\u0E1A'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E2B\u0E19\u0E48\u0E27\u0E22\u0E19\u0E31\u0E1A' }]}>
          <Input placeholder="PCS, KG, M, etc." />
        </Form.Item>
        <Form.Item name="cost" label={'\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19 (\u0E1A\u0E32\u0E17)'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19' }]}>
          <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="min_stock" label={'\u0E2A\u0E15\u0E47\u0E2D\u0E01\u0E02\u0E31\u0E49\u0E19\u0E15\u0E48\u0E33'}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
