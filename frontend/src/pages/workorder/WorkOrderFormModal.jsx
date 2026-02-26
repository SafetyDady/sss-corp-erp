import { useEffect, useState } from 'react';
import { Modal, Form, Input, App } from 'antd';
import api from '../../services/api';

export default function WorkOrderFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editItem) form.setFieldsValue(editItem);
    }
  }, [open, editItem]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      if (editItem) {
        await api.put(`/api/work-orders/${editItem.id}`, values);
      } else {
        await api.post('/api/work-orders', values);
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
      title={editItem ? '\u0E41\u0E01\u0E49\u0E44\u0E02 Work Order' : '\u0E2A\u0E23\u0E49\u0E32\u0E07 Work Order'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="customer_name" label={'\u0E0A\u0E37\u0E48\u0E2D\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label={'\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14' }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="cost_center_code" label={'\u0E23\u0E2B\u0E31\u0E2A\u0E28\u0E39\u0E19\u0E22\u0E4C\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19'}>
          <Input placeholder="CC-001" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
