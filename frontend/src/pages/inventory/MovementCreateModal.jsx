import { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, App } from 'antd';
import api from '../../services/api';

export default function MovementCreateModal({ open, products, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await api.post('/api/stock/movements', values);
      message.success('\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      form.resetFields();
      onSuccess();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={'\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="product_id" label={'\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
            placeholder={'\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}
          />
        </Form.Item>
        <Form.Item name="movement_type" label={'\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17' }]}>
          <Select options={[
            { value: 'RECEIVE', label: 'RECEIVE - \u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32' },
            { value: 'ISSUE', label: 'ISSUE - \u0E40\u0E1A\u0E34\u0E01\u0E08\u0E48\u0E32\u0E22' },
            { value: 'TRANSFER', label: 'TRANSFER - \u0E22\u0E49\u0E32\u0E22' },
            { value: 'ADJUST', label: 'ADJUST - \u0E1B\u0E23\u0E31\u0E1A\u0E22\u0E2D\u0E14' },
            { value: 'CONSUME', label: 'CONSUME - \u0E40\u0E1A\u0E34\u0E01\u0E43\u0E0A\u0E49' },
          ]} />
        </Form.Item>
        <Form.Item name="quantity" label={'\u0E08\u0E33\u0E19\u0E27\u0E19'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E08\u0E33\u0E19\u0E27\u0E19' }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="unit_cost" label={'\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19/\u0E2B\u0E19\u0E48\u0E27\u0E22 (\u0E1A\u0E32\u0E17)'}>
          <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="reference" label={'\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07'}>
          <Input placeholder="PO-001, WO-001, etc." />
        </Form.Item>
        <Form.Item name="note" label={'\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38'}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
