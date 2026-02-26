import { Button, Card, Form, Input, Typography, App } from 'antd';
import { Lock, Mail } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import { COLORS } from '../utils/constants';

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
        background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.surface} 100%)`,
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 16,
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0, color: COLORS.text }}>
            SSS Corp ERP
          </Title>
          <Text style={{ color: COLORS.textSecondary }}>{'\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A'}</Text>
        </div>

        <Form form={form} onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E2D\u0E35\u0E40\u0E21\u0E25' },
              { type: 'email', message: '\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07' },
            ]}
          >
            <Input
              prefix={<Mail size={16} style={{ color: COLORS.textMuted }} />}
              placeholder={'\u0E2D\u0E35\u0E40\u0E21\u0E25'}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19' }]}
          >
            <Input.Password
              prefix={<Lock size={16} style={{ color: COLORS.textMuted }} />}
              placeholder={'\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19'}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={isLoading}>
              {'\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A'}
            </Button>
          </Form.Item>
        </Form>

        <div
          style={{
            background: COLORS.bg,
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            color: COLORS.textMuted,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: COLORS.textSecondary }}>
            Test Accounts:
          </div>
          <div>owner@sss-corp.com / owner123</div>
          <div>staff@sss-corp.com / staff123</div>
        </div>
      </Card>
    </div>
  );
}
