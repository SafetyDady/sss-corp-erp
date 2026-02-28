import { useEffect, useState } from 'react';
import { Modal, Form, Input, Switch, Select, App, Typography } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function DepartmentFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [costCenters, setCostCenters] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (open) {
      Promise.all([
        api.get('/api/master/cost-centers', { params: { limit: 500, offset: 0 } }),
        api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } }),
      ]).then(([ccRes, empRes]) => {
        setCostCenters((ccRes.data.items || []).filter((c) => c.is_active));
        setEmployees((empRes.data.items || []).filter((e) => e.is_active));
      }).catch(() => {});

      if (editItem) {
        form.setFieldsValue({
          code: editItem.code,
          name: editItem.name,
          cost_center_id: editItem.cost_center_id,
          head_id: editItem.head_id || undefined,
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
        await api.put(`/api/master/departments/${editItem.id}`, payload);
        message.success(`แก้ไขแผนก "${values.name}" สำเร็จ`);
      } else {
        await api.post('/api/master/departments', values);
        message.success(`เพิ่มแผนก "${values.name}" สำเร็จ`);
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.includes('1:1')) {
          message.error('Cost Center นี้ถูกกำหนดให้แผนกอื่นแล้ว (กฎ 1:1)');
        } else if (typeof detail === 'string' && detail.includes('already exists')) {
          message.error('รหัสแผนกนี้ถูกใช้แล้ว กรุณาใช้รหัสอื่น');
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
      title={editItem ? `แก้ไขแผนก — ${editItem.code}` : 'เพิ่มแผนกใหม่'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'บันทึก' : 'เพิ่มแผนก'}
      cancelText="ยกเลิก"
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical"
        requiredMark={(label, { required }) => (
          <>{label}{required && <span style={{ color: COLORS.danger, marginLeft: 4 }}>*</span>}</>
        )}
      >
        <Form.Item name="code" label="รหัสแผนก"
          rules={[{ required: true, message: 'กรุณากรอกรหัสแผนก' }]}
          extra={!editItem && <Text type="secondary" style={{ fontSize: 12 }}>รหัสจะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ</Text>}
        >
          <Input disabled={!!editItem} placeholder="เช่น PROD, HR, QC" style={{ fontFamily: 'monospace' }} />
        </Form.Item>

        <Form.Item name="name" label="ชื่อแผนก"
          rules={[{ required: true, message: 'กรุณากรอกชื่อแผนก' }]}>
          <Input placeholder="เช่น แผนกผลิต, แผนกบุคคล" />
        </Form.Item>

        <Form.Item name="cost_center_id" label="Cost Center"
          rules={[{ required: true, message: 'กรุณาเลือก Cost Center' }]}
          extra={<Text type="secondary" style={{ fontSize: 12 }}>1 แผนก : 1 Cost Center เท่านั้น</Text>}
        >
          <Select placeholder="เลือก Cost Center" showSearch optionFilterProp="label"
            options={costCenters.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          />
        </Form.Item>

        <Form.Item name="head_id" label="หัวหน้าแผนก"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>ใช้เป็นผู้อนุมัติ Fallback สำหรับ Timesheet/OT</Text>}
        >
          <Select allowClear placeholder="เลือกหัวหน้าแผนก" showSearch optionFilterProp="label"
            options={employees.map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.full_name}` }))}
          />
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
