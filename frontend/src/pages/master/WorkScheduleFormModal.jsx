import { useEffect, useState } from 'react';
import { Modal, Form, Input, Radio, Checkbox, Select, DatePicker, Button, Space, Switch, App, Typography, Tag } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../services/api';


const { Text } = Typography;

const WEEKDAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 },
];

export default function WorkScheduleFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [scheduleType, setScheduleType] = useState('FIXED');
  const [rotationPattern, setRotationPattern] = useState([]);

  useEffect(() => {
    if (open) {
      loadShiftTypes();
      if (editItem) {
        setScheduleType(editItem.schedule_type || 'FIXED');
        setRotationPattern(editItem.rotation_pattern || []);
        form.setFieldsValue({
          code: editItem.code,
          name: editItem.name,
          schedule_type: editItem.schedule_type || 'FIXED',
          working_days: editItem.working_days || [],
          default_shift_type_id: editItem.default_shift_type_id,
          cycle_start_date: editItem.cycle_start_date ? dayjs(editItem.cycle_start_date) : null,
          description: editItem.description,
          is_active: editItem.is_active,
        });
      } else {
        setScheduleType('FIXED');
        setRotationPattern([]);
        form.resetFields();
      }
    }
  }, [open, editItem]);

  const loadShiftTypes = async () => {
    try {
      const { data } = await api.get('/api/master/shift-types', { params: { limit: 100 } });
      setShiftTypes(data.items || []);
    } catch {
      // ignore — shift types might not exist yet
    }
  };

  const shiftOptions = [
    ...shiftTypes.map(s => ({ label: `${s.code} — ${s.name}`, value: s.code })),
    { label: 'OFF (Day off)', value: 'OFF' },
  ];

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        code: values.code,
        name: values.name,
        schedule_type: scheduleType,
        description: values.description,
      };

      if (scheduleType === 'FIXED') {
        payload.working_days = values.working_days;
        payload.default_shift_type_id = values.default_shift_type_id;
      } else {
        payload.rotation_pattern = rotationPattern;
        payload.cycle_start_date = values.cycle_start_date?.format('YYYY-MM-DD');
      }

      if (editItem) {
        payload.is_active = values.is_active;
      }

      setLoading(true);
      if (editItem) {
        const updatePayload = { ...payload };
        delete updatePayload.code;
        await api.put(`/api/master/work-schedules/${editItem.id}`, updatePayload);
        message.success(`Updated work schedule "${values.name}"`);
      } else {
        await api.post('/api/master/work-schedules', payload);
        message.success(`Created work schedule "${values.name}"`);
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

  const addPatternEntry = () => {
    setRotationPattern([...rotationPattern, 'OFF']);
  };

  const removePatternEntry = (index) => {
    setRotationPattern(rotationPattern.filter((_, i) => i !== index));
  };

  const updatePatternEntry = (index, value) => {
    const newPattern = [...rotationPattern];
    newPattern[index] = value;
    setRotationPattern(newPattern);
  };

  return (
    <Modal
      title={editItem ? `Edit Work Schedule — ${editItem.code}` : 'Add Work Schedule'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'Save' : 'Create'}
      cancelText="Cancel"
      width={600}
      destroyOnHidden
    >
      <Form form={form} layout="vertical"
        initialValues={{ schedule_type: 'FIXED', working_days: [1, 2, 3, 4, 5] }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <Form.Item name="code" label="Code"
            rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. REGULAR-MF" disabled={!!editItem} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="name" label="Name"
            rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Regular Mon-Fri" />
          </Form.Item>
        </div>

        <Form.Item label="Schedule Type">
          <Radio.Group value={scheduleType} onChange={(e) => setScheduleType(e.target.value)}>
            <Radio.Button value="FIXED">FIXED (specific days)</Radio.Button>
            <Radio.Button value="ROTATING">ROTATING (cyclic pattern)</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {scheduleType === 'FIXED' && (
          <>
            <Form.Item name="working_days" label="Working Days"
              rules={[{ required: true, message: 'Select at least one day' }]}>
              <Checkbox.Group options={WEEKDAYS} />
            </Form.Item>
            <Form.Item name="default_shift_type_id" label="Default Shift"
              rules={[{ required: true, message: 'Select default shift' }]}>
              <Select
                placeholder="Select shift type"
                options={shiftTypes.filter(s => s.is_active).map(s => ({
                  label: `${s.code} — ${s.name} (${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)})`,
                  value: s.id,
                }))}
                allowClear
              />
            </Form.Item>
          </>
        )}

        {scheduleType === 'ROTATING' && (
          <>
            <Form.Item label={`Rotation Pattern (${rotationPattern.length}-day cycle)`}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Define shift for each day in the cycle. Use OFF for rest days.</Text>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rotationPattern.map((entry, i) => (
                  <Space key={i} size={8}>
                    <Tag style={{ minWidth: 32, textAlign: 'center' }}>D{i + 1}</Tag>
                    <Select
                      value={entry}
                      onChange={(val) => updatePatternEntry(i, val)}
                      options={shiftOptions}
                      style={{ width: 240 }}
                      size="small"
                    />
                    <Button type="text" size="small" danger icon={<Trash2 size={12} />}
                      onClick={() => removePatternEntry(i)} />
                  </Space>
                ))}
                <Button type="dashed" size="small" icon={<Plus size={12} />}
                  onClick={addPatternEntry} style={{ width: 200 }}>
                  Add Day
                </Button>
              </div>
            </Form.Item>
            <Form.Item name="cycle_start_date" label="Cycle Start Date"
              rules={[{ required: true, message: 'Required for rotating schedule' }]}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Anchor date for calculating which day in the cycle</Text>}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}

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
