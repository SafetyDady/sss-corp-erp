import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Form, Input, Steps, Typography, Result } from 'antd';
import { Building2, UserPlus, CheckCircle } from 'lucide-react';
import axios from 'axios';
import useAuthStore from '../../stores/authStore';
import { COLORS } from '../../utils/constants';

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [orgForm] = Form.useForm();
  const [userForm] = Form.useForm();
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    try {
      const orgValues = orgForm.getFieldsValue();
      const userValues = userForm.getFieldsValue();
      setLoading(true);

      const { data } = await axios.post(`${API_URL}/api/setup`, {
        org_name: orgValues.org_name,
        org_code: orgValues.org_code,
        admin_email: userValues.admin_email,
        admin_password: userValues.admin_password,
        admin_full_name: userValues.admin_full_name,
      });

      setResult(data);
      setTokens(data.access_token, data.refresh_token);
      setCurrent(2);
      message.success('ตั้งค่าระบบสำเร็จ');
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการตั้งค่า');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (current === 0) {
      await orgForm.validateFields();
      setCurrent(1);
    } else if (current === 1) {
      await userForm.validateFields();
      handleSubmit();
    }
  };

  const steps = [
    { title: 'องค์กร', icon: <Building2 size={16} /> },
    { title: 'ผู้ดูแลระบบ', icon: <UserPlus size={16} /> },
    { title: 'เสร็จสิ้น', icon: <CheckCircle size={16} /> },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: 520,
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ color: COLORS.accent, margin: 0 }}>
            SSS Corp ERP
          </Title>
          <Text style={{ color: COLORS.textMuted }}>ตั้งค่าระบบครั้งแรก</Text>
        </div>

        <Steps
          current={current}
          size="small"
          items={steps}
          style={{ marginBottom: 32 }}
        />

        {current === 0 && (
          <Form form={orgForm} layout="vertical" requiredMark={false}>
            <Form.Item
              name="org_name"
              label="ชื่อองค์กร"
              rules={[{ required: true, message: 'กรุณากรอกชื่อองค์กร' }]}
            >
              <Input placeholder="บริษัท SSS คอร์ปอเรชั่น จำกัด" />
            </Form.Item>
            <Form.Item
              name="org_code"
              label="รหัสองค์กร"
              rules={[{ required: true, message: 'กรุณากรอกรหัสองค์กร' }]}
            >
              <Input placeholder="SSS" style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Form>
        )}

        {current === 1 && (
          <Form form={userForm} layout="vertical" requiredMark={false}>
            <Form.Item
              name="admin_full_name"
              label="ชื่อ-สกุล ผู้ดูแลระบบ"
              rules={[{ required: true, message: 'กรุณากรอกชื่อ-สกุล' }]}
            >
              <Input placeholder="สมชาย ใจดี" />
            </Form.Item>
            <Form.Item
              name="admin_email"
              label="อีเมล"
              rules={[
                { required: true, message: 'กรุณากรอกอีเมล' },
                { type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง' },
              ]}
            >
              <Input placeholder="admin@company.com" />
            </Form.Item>
            <Form.Item
              name="admin_password"
              label="รหัสผ่าน"
              rules={[
                { required: true, message: 'กรุณากรอกรหัสผ่าน' },
                { min: 6, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
              ]}
            >
              <Input.Password placeholder="อย่างน้อย 6 ตัวอักษร" />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="ยืนยันรหัสผ่าน"
              dependencies={['admin_password']}
              rules={[
                { required: true, message: 'กรุณายืนยันรหัสผ่าน' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('admin_password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('รหัสผ่านไม่ตรงกัน'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="กรอกรหัสผ่านอีกครั้ง" />
            </Form.Item>
          </Form>
        )}

        {current === 2 && (
          <Result
            status="success"
            title="ตั้งค่าระบบเรียบร้อยแล้ว"
            subTitle={
              <span style={{ color: COLORS.textSecondary }}>
                องค์กร <strong>{result?.org_name}</strong> ถูกสร้างเรียบร้อย
                <br />
                คุณสามารถเข้าสู่ระบบได้ทันที
              </span>
            }
            extra={
              <Button type="primary" onClick={() => navigate('/')}>
                เข้าสู่ระบบ
              </Button>
            }
          />
        )}

        {current < 2 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button
              disabled={current === 0}
              onClick={() => setCurrent(current - 1)}
            >
              ย้อนกลับ
            </Button>
            <Button type="primary" loading={loading} onClick={handleNext}>
              {current === 1 ? 'เริ่มต้นใช้งาน' : 'ถัดไป'}
            </Button>
          </div>
        )}

        {current < 2 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
              มีบัญชีอยู่แล้ว?{' '}
              <a
                onClick={() => navigate('/login')}
                style={{ color: COLORS.accent, cursor: 'pointer' }}
              >
                เข้าสู่ระบบ
              </a>
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
}
