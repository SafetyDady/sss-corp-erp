import { useState } from 'react';
import { Modal, Form, Input, Select, App, Alert } from 'antd';
import { UserPlus } from 'lucide-react';
import api from '../../services/api';

const ROLE_OPTIONS = [
  { value: 'staff',      label: 'Staff' },
  { value: 'viewer',     label: 'Viewer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'manager',    label: 'Manager' },
  { value: 'owner',      label: 'Owner' },
];

export default function UserFormModal({ open, onClose, onSuccess }) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await api.post('/api/auth/register', values);
      form.resetFields();
      onSuccess?.();
      modal.success({
        title: `สร้างผู้ใช้ "${values.full_name}" สำเร็จ`,
        content: 'หากต้องการให้ผู้ใช้คนนี้เป็นพนักงาน (มีข้อมูล HR เงินเดือน แผนก) ให้ไปสร้าง Employee ที่หน้า HR → พนักงาน แล้วเชื่อมกับ User นี้',
        okText: 'รับทราบ',
      });
    } catch (err) {
      if (err?.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (detail.includes('already registered')) {
          message.error('อีเมลนี้ถูกใช้แล้ว');
        } else {
          message.error(detail);
        }
      } else if (err?.errorFields) {
        // Form validation error — do nothing, Ant shows inline
      } else {
        message.error('ไม่สามารถสร้างผู้ใช้ได้');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <UserPlus size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          เพิ่มผู้ใช้งาน
        </span>
      }
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="สร้างผู้ใช้"
      cancelText="ยกเลิก"
      destroyOnHidden
      width={480}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginTop: 12, marginBottom: 8 }}
        message="User = บัญชี Login เท่านั้น"
        description="หากต้องการข้อมูล HR (เงินเดือน, แผนก, Timesheet) ให้สร้าง Employee ที่หน้า HR → พนักงาน แล้วเชื่อมกับ User นี้ภายหลัง"
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={{ role: 'staff' }}
        style={{ marginTop: 8 }}
      >
        <Form.Item
          name="full_name"
          label="ชื่อ-สกุล"
          rules={[{ required: true, message: 'กรุณากรอกชื่อ-สกุล' }]}
        >
          <Input placeholder="เช่น สมชาย ใจดี" maxLength={255} />
        </Form.Item>

        <Form.Item
          name="email"
          label="อีเมล"
          rules={[
            { required: true, message: 'กรุณากรอกอีเมล' },
            { type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง' },
          ]}
        >
          <Input placeholder="example@company.com" />
        </Form.Item>

        <Form.Item
          name="password"
          label="รหัสผ่าน"
          rules={[
            { required: true, message: 'กรุณากรอกรหัสผ่าน' },
            { min: 6, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
          ]}
        >
          <Input.Password placeholder="อย่างน้อย 6 ตัวอักษร" maxLength={128} />
        </Form.Item>

        <Form.Item
          name="role"
          label="บทบาท"
          rules={[{ required: true, message: 'กรุณาเลือกบทบาท' }]}
        >
          <Select options={ROLE_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
