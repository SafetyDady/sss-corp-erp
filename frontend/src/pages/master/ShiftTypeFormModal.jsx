import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Switch, TimePicker, App, Typography } from 'antd';
import dayjs from 'dayjs';
import api from '../../services/api';

const { Text } = Typography;

export default function ShiftTypeFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editItem) {
        form.setFieldsValue({
          code: editItem.code,
          name: editItem.name,
          start_time: editItem.start_time ? dayjs(editItem.start_time, 'HH:mm:ss') : null,
          end_time: editItem.end_time ? dayjs(editItem.end_time, 'HH:mm:ss') : null,
          break_minutes: editItem.break_minutes,
          working_hours: parseFloat(editItem.working_hours) || 8.0,
          is_overnight: editItem.is_overnight,
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
      const payload = {
        ...values,
        start_time: values.start_time?.format('HH:mm:ss'),
        end_time: values.end_time?.format('HH:mm:ss'),
      };
      setLoading(true);
      if (editItem) {
        const updatePayload = { ...payload };
        delete updatePayload.code; // code is immutable on update
        await api.put(`/api/master/shift-types/${editItem.id}`, updatePayload);
        message.success(`Updated shift type "${values.name}"`);
      } else {
        await api.post('/api/master/shift-types', payload);
        message.success(`Created shift type "${values.name}"`);
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        message.error(err.response?.data?.detail || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editItem ? `Edit Shift Type — ${editItem.code}` : 'Add Shift Type'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'Save' : 'Create'}
      cancelText="Cancel"
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical"
        initialValues={{ break_minutes: 60, working_hours: 8.0, is_overnight: false }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <Form.Item name="code" label="Code"
            rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. MORNING" disabled={!!editItem} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="name" label="Name"
            rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Morning Shift" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="start_time" label="Start Time"
            rules={[{ required: true, message: 'Required' }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_time" label="End Time"
            rules={[{ required: true, message: 'Required' }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Form.Item name="break_minutes" label="Break (min)"
            rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={0} max={480} step={15} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="working_hours" label="Working Hours"
            rules={[{ required: true, message: 'Required' }]}
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Net hours per shift</Text>}>
            <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_overnight" label="Overnight Shift" valuePropName="checked">
            <Switch checkedChildren="Yes" unCheckedChildren="No" />
          </Form.Item>
        </div>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} placeholder="Optional description" maxLength={500} showCount />
        </Form.Item>

        {editItem && (
          <Form.Item name="is_active" label="Active Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
