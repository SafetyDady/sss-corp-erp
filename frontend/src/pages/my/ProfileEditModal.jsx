import { useEffect, useState } from 'react';
import { Modal, Form, Input, App } from 'antd';
import api from '../../services/api';
import useAuthStore from '../../stores/authStore';

export default function ProfileEditModal({ open, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const employeeName = useAuthStore((s) => s.employeeName);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (open) {
      // Pre-fill from current employee/user data
      form.setFieldsValue({
        full_name: employeeName || user?.full_name || '',
        position: '', // Position will be fetched from employee record if available
      });
      // Fetch current employee data for position
      api.get('/api/auth/me').then(({ data }) => {
        form.setFieldsValue({
          full_name: data.employee_name || data.full_name || '',
        });
      }).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const payload = {};
      if (values.full_name?.trim()) payload.full_name = values.full_name.trim();
      if (values.position?.trim()) payload.position = values.position.trim();

      if (Object.keys(payload).length === 0) {
        message.warning('กรุณากรอกข้อมูลที่ต้องการแก้ไข');
        return;
      }

      await api.put('/api/hr/employees/me', payload);
      message.success('อัปเดตข้อมูลส่วนตัวสำเร็จ');
      // Refresh /me data to update authStore
      await useAuthStore.getState().fetchMe();
      onSuccess?.();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการอัปเดต');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="แก้ไขข้อมูลส่วนตัว"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="บันทึก"
      cancelText="ยกเลิก"
      width={440}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="full_name"
          label="ชื่อ-นามสกุล"
          rules={[{ required: true, message: 'กรุณากรอกชื่อ-นามสกุล' }]}
        >
          <Input placeholder="ชื่อ-นามสกุล" maxLength={255} />
        </Form.Item>

        <Form.Item
          name="position"
          label="ตำแหน่ง"
        >
          <Input placeholder="ตำแหน่งงาน (ไม่บังคับ)" maxLength={255} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
