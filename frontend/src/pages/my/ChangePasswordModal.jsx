import { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, App, Alert, Typography, List } from 'antd';
import { Lock, Check, X } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function ChangePasswordModal({ open, onClose, onSuccess, forceChange = false }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [policy, setPolicy] = useState(null);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (open) {
      form.resetFields();
      // Fetch security config to show policy hints
      api.get('/api/admin/config/security').then(({ data }) => {
        setPolicy(data);
      }).catch(() => {
        // Non-admin users may not access this — ignore
        setPolicy(null);
      });
    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (values.new_password !== values.confirm_password) {
        message.error('รหัสผ่านใหม่ไม่ตรงกัน');
        return;
      }
      setLoading(true);
      await api.post('/api/auth/change-password', {
        current_password: values.current_password,
        new_password: values.new_password,
      });
      message.success('เปลี่ยนรหัสผ่านสำเร็จ — กรุณาเข้าสู่ระบบใหม่');
      onSuccess?.();
      // Logout after password change (all tokens revoked)
      setTimeout(() => logout(), 1500);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        message.error(detail);
      } else if (Array.isArray(detail)) {
        message.error(detail.join(', '));
      } else {
        message.error('เกิดข้อผิดพลาด');
      }
    } finally {
      setLoading(false);
    }
  };

  const policyHints = policy ? [
    { label: `ความยาวขั้นต่ำ ${policy.min_password_length} ตัวอักษร`, key: 'len' },
    policy.require_uppercase && { label: 'ต้องมีตัวพิมพ์ใหญ่ (A-Z)', key: 'upper' },
    policy.require_lowercase && { label: 'ต้องมีตัวพิมพ์เล็ก (a-z)', key: 'lower' },
    policy.require_digits && { label: 'ต้องมีตัวเลข (0-9)', key: 'digits' },
    policy.require_special_chars && { label: 'ต้องมีอักขระพิเศษ (!@#$%...)', key: 'special' },
  ].filter(Boolean) : [];

  return (
    <Modal
      open={open}
      onCancel={forceChange ? undefined : onClose}
      closable={!forceChange}
      maskClosable={!forceChange}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={18} color={COLORS.warning} />
          {forceChange ? 'รหัสผ่านหมดอายุ — กรุณาเปลี่ยนรหัสผ่าน' : 'เปลี่ยนรหัสผ่าน'}
        </span>
      }
      width={440}
      footer={null}
      destroyOnClose
    >
      {forceChange && (
        <Alert
          type="warning"
          showIcon
          message="รหัสผ่านของคุณหมดอายุแล้ว กรุณาตั้งรหัสผ่านใหม่เพื่อดำเนินการต่อ"
          style={{ marginBottom: 16 }}
        />
      )}

      {policyHints.length > 0 && (
        <div style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          fontSize: 12,
        }}>
          <Text style={{ fontWeight: 600, color: COLORS.textSecondary, display: 'block', marginBottom: 6 }}>
            ข้อกำหนดรหัสผ่าน:
          </Text>
          {policyHints.map((h) => (
            <div key={h.key} style={{ color: COLORS.textMuted, padding: '2px 0' }}>
              &bull; {h.label}
            </div>
          ))}
        </div>
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="current_password"
          label="รหัสผ่านปัจจุบัน"
          rules={[{ required: true, message: 'กรุณากรอกรหัสผ่านปัจจุบัน' }]}
        >
          <Input.Password placeholder="กรอกรหัสผ่านปัจจุบัน" />
        </Form.Item>

        <Form.Item
          name="new_password"
          label="รหัสผ่านใหม่"
          rules={[
            { required: true, message: 'กรุณากรอกรหัสผ่านใหม่' },
            { min: 6, message: 'ต้องมีอย่างน้อย 6 ตัวอักษร' },
          ]}
        >
          <Input.Password placeholder="กรอกรหัสผ่านใหม่" />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label="ยืนยันรหัสผ่านใหม่"
          dependencies={['new_password']}
          rules={[
            { required: true, message: 'กรุณายืนยันรหัสผ่านใหม่' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('รหัสผ่านไม่ตรงกัน'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="กรอกรหัสผ่านใหม่อีกครั้ง" />
        </Form.Item>

        <Button type="primary" htmlType="submit" block loading={loading}>
          เปลี่ยนรหัสผ่าน
        </Button>
      </Form>
    </Modal>
  );
}
