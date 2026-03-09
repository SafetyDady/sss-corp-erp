import { useState, useEffect, useCallback } from 'react';
import { Card, Form, InputNumber, Switch, Button, App, Checkbox, Typography, Spin, Divider } from 'antd';
import { Save, Shield, Lock, KeyRound, Gauge } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Title, Text } = Typography;

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'staff', label: 'Staff' },
  { value: 'viewer', label: 'Viewer' },
];

export default function SecurityPolicyTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/config/security');
      form.setFieldsValue({
        min_password_length: data.min_password_length,
        require_uppercase: data.require_uppercase,
        require_lowercase: data.require_lowercase,
        require_digits: data.require_digits,
        require_special_chars: data.require_special_chars,
        password_expiry_days: data.password_expiry_days,
        max_failed_attempts: data.max_failed_attempts,
        lockout_duration_minutes: data.lockout_duration_minutes,
        require_2fa_roles: data.require_2fa_roles || [],
        api_rate_limit_per_minute: data.api_rate_limit_per_minute,
        api_rate_limit_login: data.api_rate_limit_login,
      });
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api.put('/api/admin/config/security', values);
      message.success('บันทึกนโยบายความปลอดภัยสำเร็จ');
    } catch (err) {
      if (err.response) {
        message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
      }
    } finally {
      setSaving(false);
    }
  };

  const canEdit = can('admin.config.update');

  return (
    <div style={{ maxWidth: 800 }}>
      <Spin spinning={loading}>
      <Form form={form} layout="vertical">
        {/* Password Rules */}
        <Card size="small" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Lock size={16} color={COLORS.accent} />
            <Title level={5} style={{ margin: 0 }}>นโยบายรหัสผ่าน</Title>
          </div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
            กำหนดความแข็งแรงของรหัสผ่านที่ต้องการ (ผลบังคับเมื่อสร้างหรือเปลี่ยนรหัสผ่าน)
          </Text>

          <Form.Item name="min_password_length" label="ความยาวขั้นต่ำ"
            rules={[{ required: true, message: 'กรุณากรอก' }]}
          >
            <InputNumber min={6} max={128} style={{ width: 200 }}
              suffix="ตัวอักษร" disabled={!canEdit} />
          </Form.Item>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Form.Item name="require_uppercase" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch disabled={!canEdit} checkedChildren="เปิด" unCheckedChildren="ปิด" />
              </Form.Item>
              <Text style={{ marginLeft: 12 }}>ต้องมีตัวพิมพ์ใหญ่ (A-Z)</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Form.Item name="require_lowercase" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch disabled={!canEdit} checkedChildren="เปิด" unCheckedChildren="ปิด" />
              </Form.Item>
              <Text style={{ marginLeft: 12 }}>ต้องมีตัวพิมพ์เล็ก (a-z)</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Form.Item name="require_digits" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch disabled={!canEdit} checkedChildren="เปิด" unCheckedChildren="ปิด" />
              </Form.Item>
              <Text style={{ marginLeft: 12 }}>ต้องมีตัวเลข (0-9)</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Form.Item name="require_special_chars" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch disabled={!canEdit} checkedChildren="เปิด" unCheckedChildren="ปิด" />
              </Form.Item>
              <Text style={{ marginLeft: 12 }}>ต้องมีอักขระพิเศษ (!@#$%...)</Text>
            </div>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <Form.Item name="password_expiry_days" label="อายุรหัสผ่าน"
            extra="0 = ไม่มีวันหมดอายุ"
          >
            <InputNumber min={0} max={3650} style={{ width: 200 }}
              suffix="วัน" disabled={!canEdit} />
          </Form.Item>
        </Card>

        {/* Account Lockout */}
        <Card size="small" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Shield size={16} color={COLORS.warning} />
            <Title level={5} style={{ margin: 0 }}>การล็อคบัญชี</Title>
          </div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
            ป้องกัน brute-force โดยล็อคบัญชีเมื่อกรอกรหัสผ่านผิดเกินจำนวนที่กำหนด
          </Text>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Form.Item name="max_failed_attempts" label="จำนวนครั้งที่อนุญาต"
              rules={[{ required: true, message: 'กรุณากรอก' }]}
            >
              <InputNumber min={1} max={100} style={{ width: 200 }}
                suffix="ครั้ง" disabled={!canEdit} />
            </Form.Item>
            <Form.Item name="lockout_duration_minutes" label="ระยะเวลาล็อค"
              rules={[{ required: true, message: 'กรุณากรอก' }]}
            >
              <InputNumber min={1} max={1440} style={{ width: 200 }}
                suffix="นาที" disabled={!canEdit} />
            </Form.Item>
          </div>
        </Card>

        {/* Rate Limiting */}
        <Card size="small" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Gauge size={16} color={COLORS.info} />
            <Title level={5} style={{ margin: 0 }}>Rate Limiting</Title>
          </div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
            จำกัดจำนวน request ต่อนาทีเพื่อป้องกันการใช้งาน API เกินขีดจำกัด (ต้องมี Redis)
          </Text>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Form.Item name="api_rate_limit_per_minute" label="API requests ต่อนาที"
              rules={[{ required: true, message: 'กรุณากรอก' }]}
            >
              <InputNumber min={10} max={600} style={{ width: 200 }}
                suffix="req/min" disabled={!canEdit} />
            </Form.Item>
            <Form.Item name="api_rate_limit_login" label="Login requests ต่อนาที"
              rules={[{ required: true, message: 'กรุณากรอก' }]}
            >
              <InputNumber min={1} max={60} style={{ width: 200 }}
                suffix="req/min" disabled={!canEdit} />
            </Form.Item>
          </div>
        </Card>

        {/* 2FA Enforcement */}
        <Card size="small" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <KeyRound size={16} color={COLORS.success} />
            <Title level={5} style={{ margin: 0 }}>การยืนยันตัวตน 2 ชั้น (2FA)</Title>
          </div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
            เลือก role ที่ต้องเปิดใช้ 2FA (Google Authenticator) — ผู้ใช้ที่อยู่ใน role เหล่านี้จะถูกบังคับให้ตั้งค่า 2FA ก่อนใช้งาน
          </Text>

          <Form.Item name="require_2fa_roles">
            <Checkbox.Group disabled={!canEdit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ROLE_OPTIONS.map((opt) => (
                  <Checkbox key={opt.value} value={opt.value}>
                    {opt.label}
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Card>

        {canEdit && (
          <Button type="primary" icon={<Save size={14} />}
            onClick={handleSave} loading={saving} size="large"
          >
            บันทึกนโยบายความปลอดภัย
          </Button>
        )}
      </Form>
      </Spin>
    </div>
  );
}
