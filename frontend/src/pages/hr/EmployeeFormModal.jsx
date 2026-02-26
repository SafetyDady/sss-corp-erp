import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Select, App, Divider, Typography } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function EmployeeFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [costCenters, setCostCenters] = useState([]);

  useEffect(() => {
    if (open) {
      api.get('/api/master/cost-centers', { params: { limit: 200, offset: 0 } })
        .then(({ data }) => setCostCenters((data.items || []).filter((c) => c.is_active)))
        .catch(() => {});
      if (editItem) {
        form.setFieldsValue({
          employee_code: editItem.employee_code,
          full_name: editItem.full_name,
          position: editItem.position,
          hourly_rate: parseFloat(editItem.hourly_rate) || 0,
          daily_working_hours: parseFloat(editItem.daily_working_hours) || 8,
          cost_center_id: editItem.cost_center_id || undefined,
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
        delete payload.employee_code;
        await api.put(`/api/hr/employees/${editItem.id}`, payload);
        message.success(`แก้ไขข้อมูล "${values.full_name}" สำเร็จ`);
      } else {
        await api.post('/api/hr/employees', values);
        message.success(`เพิ่มพนักงาน "${values.full_name}" สำเร็จ`);
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.toLowerCase().includes('unique')) {
          message.error('รหัสพนักงานนี้ถูกใช้แล้ว กรุณาใช้รหัสอื่น');
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
      title={editItem ? `แก้ไขพนักงาน — ${editItem.employee_code}` : 'เพิ่มพนักงานใหม่'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'บันทึก' : 'เพิ่มพนักงาน'}
      cancelText="ยกเลิก"
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ hourly_rate: 0, daily_working_hours: 8 }}
        requiredMark={(label, { required }) => (
          <>{label}{required && <span style={{ color: COLORS.danger, marginLeft: 4 }}>*</span>}</>
        )}
      >
        <Form.Item name="employee_code" label="รหัสพนักงาน"
          rules={[{ required: true, message: 'กรุณากรอกรหัสพนักงาน' }]}
          extra={!editItem && <Text type="secondary" style={{ fontSize: 12 }}>รหัสจะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ</Text>}
        >
          <Input disabled={!!editItem} placeholder="เช่น EMP-001" style={{ fontFamily: 'monospace' }} />
        </Form.Item>

        <Form.Item name="full_name" label="ชื่อ-สกุล"
          rules={[{ required: true, message: 'กรุณากรอกชื่อ-สกุล' }]}>
          <Input placeholder="ชื่อ นามสกุล" />
        </Form.Item>

        <Form.Item name="position" label="ตำแหน่ง">
          <Input placeholder="เช่น ช่างเทคนิค, วิศวกร" />
        </Form.Item>

        <Divider style={{ margin: '12px 0', borderColor: COLORS.border }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="hourly_rate" label="อัตราค่าจ้าง (บาท/ชม.)"
            rules={[{ required: true, message: 'กรุณากรอกอัตราค่าจ้าง' }]}>
            <InputNumber min={0} step={10} style={{ width: '100%' }}
              formatter={(v) => `฿ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => v.replace(/฿\s?|(,*)/g, '')} />
          </Form.Item>

          <Form.Item name="daily_working_hours" label="ชม.ทำงาน/วัน"
            rules={[{ required: true, message: 'กรุณากรอกชั่วโมงทำงาน' }]}>
            <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} addonAfter="ชม." />
          </Form.Item>
        </div>

        <Form.Item name="cost_center_id" label="ศูนย์ต้นทุน"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>ใช้คำนวณ Admin Overhead ใน Job Costing</Text>}
        >
          <Select allowClear placeholder="เลือกศูนย์ต้นทุน" showSearch
            optionFilterProp="label"
            options={costCenters.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))} />
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
