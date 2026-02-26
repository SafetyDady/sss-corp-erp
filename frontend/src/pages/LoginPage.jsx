import { useState } from 'react';
import { Button, Card, Form, Input, Typography, App } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import useAuthStore from '../stores/authStore';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [form] = Form.useForm();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { message } = App.useApp();

  const onFinish = async (values) => {
    const result = await login(values.email, values.password);
    if (!result.success) {
      message.error(result.error);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0 }}>
            SSS Corp ERP
          </Title>
          <Text type="secondary">เข้าสู่ระบบ</Text>
        </div>

        <Form form={form} onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'กรุณากรอกอีเมล' },
              { type: 'email', message: 'อีเมลไม่ถูกต้อง' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="อีเมล" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'กรุณากรอกรหัสผ่าน' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="รหัสผ่าน" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={isLoading}>
              เข้าสู่ระบบ
            </Button>
          </Form.Item>
        </Form>

        <div
          style={{
            background: '#f8fafc',
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            color: '#64748b',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Test Accounts:</div>
          <div>owner@sss-corp.com / owner123</div>
          <div>staff@sss-corp.com / staff123</div>
        </div>
      </Card>
    </div>
  );
}
