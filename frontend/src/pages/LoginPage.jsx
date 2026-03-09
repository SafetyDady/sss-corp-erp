import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Typography, App, Alert } from 'antd';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import ChangePasswordModal from './my/ChangePasswordModal';
import { COLORS } from '../utils/constants';
import AppFooter from '../components/AppFooter';
import axios from 'axios';

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function LoginPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { message } = App.useApp();

  const [submitting, setSubmitting] = useState(false);

  // 2FA state
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  // Lockout state
  const [lockMessage, setLockMessage] = useState(null);

  // Password expiry state
  const [passwordExpired, setPasswordExpired] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const onFinish = async (values) => {
    setLockMessage(null);
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/login`, {
        email: values.email,
        password: values.password,
      });

      // Check for 2FA required
      if (data.requires_2fa) {
        setTempToken(data.temp_token);
        setTwoFAStep(true);
        return;
      }

      // Check for password expired
      if (data.password_expired) {
        setPasswordExpired(true);
        if (data.access_token) {
          setTokens(data.access_token, data.refresh_token);
        }
        return;
      }

      // Normal login success
      setTokens(data.access_token, data.refresh_token);
      await fetchMe();
      navigate('/', { replace: true });
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail || 'เข้าสู่ระบบไม่สำเร็จ';

      if (status === 423) {
        setLockMessage(detail);
      } else {
        message.error(detail);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify2FA = async () => {
    const code = otpCode.trim();
    if (!code) {
      message.warning('กรุณากรอกรหัส OTP');
      return;
    }

    setOtpLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/2fa/login`, {
        temp_token: tempToken,
        code,
      });

      // Check password expired after 2FA
      if (data.password_expired) {
        setPasswordExpired(true);
        if (data.access_token) {
          setTokens(data.access_token, data.refresh_token);
        }
        setTwoFAStep(false);
        return;
      }

      setTokens(data.access_token, data.refresh_token);
      await fetchMe();
      navigate('/', { replace: true });
    } catch (err) {
      message.error(err.response?.data?.detail || 'รหัส OTP ไม่ถูกต้อง');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleBack = () => {
    setTwoFAStep(false);
    setTempToken(null);
    setOtpCode('');
    setUseBackupCode(false);
  };

  const handlePasswordChanged = () => {
    setPasswordExpired(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.surface} 100%)`,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 16,
          background: COLORS.card,
          backgroundColor: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
        }}
        styles={{ body: { background: COLORS.card } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0, color: COLORS.text }}>
            SSS Corp ERP
          </Title>
          <Text style={{ color: COLORS.textSecondary }}>
            {twoFAStep ? 'ยืนยันตัวตน 2 ชั้น' : 'เข้าสู่ระบบ'}
          </Text>
        </div>

        {/* Lockout Alert */}
        {lockMessage && (
          <Alert
            type="warning"
            showIcon
            message={lockMessage}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Normal Login Form */}
        {!twoFAStep && (
          <Form form={form} onFinish={onFinish} layout="vertical" size="large">
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'กรุณากรอกอีเมล' },
                { type: 'email', message: 'อีเมลไม่ถูกต้อง' },
              ]}
            >
              <Input
                prefix={<Mail size={16} style={{ color: COLORS.textMuted }} />}
                placeholder="อีเมล"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'กรุณากรอกรหัสผ่าน' }]}
            >
              <Input.Password
                prefix={<Lock size={16} style={{ color: COLORS.textMuted }} />}
                placeholder="รหัสผ่าน"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={submitting}>
                เข้าสู่ระบบ
              </Button>
            </Form.Item>
          </Form>
        )}

        {/* 2FA OTP Step */}
        {twoFAStep && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <ShieldCheck size={40} color={COLORS.success} style={{ marginBottom: 12 }} />
              <Text style={{ display: 'block', color: COLORS.textSecondary, marginBottom: 4 }}>
                {useBackupCode
                  ? 'กรอก Backup Code (8 ตัวอักษร)'
                  : 'กรอกรหัส OTP 6 หลักจากแอป Authenticator'
                }
              </Text>
            </div>

            <Input
              value={otpCode}
              onChange={(e) => {
                const max = useBackupCode ? 8 : 6;
                const val = useBackupCode
                  ? e.target.value.slice(0, max).toUpperCase()
                  : e.target.value.replace(/\D/g, '').slice(0, max);
                setOtpCode(val);
              }}
              placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
              maxLength={useBackupCode ? 8 : 6}
              style={{
                textAlign: 'center',
                fontSize: 24,
                letterSpacing: useBackupCode ? 4 : 8,
                fontFamily: 'monospace',
                marginBottom: 16,
              }}
              size="large"
              onPressEnter={handleVerify2FA}
            />

            <Button
              type="primary"
              block
              size="large"
              onClick={handleVerify2FA}
              loading={otpLoading}
              disabled={!otpCode}
            >
              ยืนยัน
            </Button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button
                type="link"
                size="small"
                onClick={() => { setUseBackupCode(!useBackupCode); setOtpCode(''); }}
                style={{ color: COLORS.textSecondary }}
              >
                {useBackupCode ? 'ใช้ OTP จากแอป' : 'ใช้ Backup Code'}
              </Button>
              <span style={{ color: COLORS.border, margin: '0 8px' }}>|</span>
              <Button
                type="link"
                size="small"
                onClick={handleBack}
                style={{ color: COLORS.textMuted }}
              >
                กลับ
              </Button>
            </div>
          </div>
        )}

        {!twoFAStep && (
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
        )}
      </Card>
      <AppFooter compact />

      {/* Force Change Password Modal */}
      <ChangePasswordModal
        open={passwordExpired}
        onClose={() => {}}
        onSuccess={handlePasswordChanged}
        forceChange
      />
    </div>
  );
}
