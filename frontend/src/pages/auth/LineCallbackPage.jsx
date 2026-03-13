import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Input, Typography, App, Spin, Result, Space } from 'antd';
import { ShieldCheck, Link2 } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { COLORS } from '../../utils/constants';
import AppFooter from '../../components/AppFooter';
import axios from 'axios';

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function LineCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setTokens = useAuthStore((s) => s.setTokens);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const { message } = App.useApp();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Link step
  const [linkStep, setLinkStep] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [lineDisplayName, setLineDisplayName] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  // 2FA step
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [twoFATempToken, setTwoFATempToken] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  // Handle LINE callback on mount
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      setError('ไม่พบ code หรือ state จาก LINE');
      setLoading(false);
      return;
    }

    handleCallback(code, state);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCallback = async (code, state) => {
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/line/callback`, { code, state });
      handleResponse(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'LINE Login ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (data) => {
    if (data.action === 'link_required') {
      setTempToken(data.temp_token);
      setLineDisplayName(data.line_display_name || '');
      setLinkStep(true);
      return;
    }

    if (data.action === '2fa_required') {
      setTwoFATempToken(data.temp_token);
      setTwoFAStep(true);
      return;
    }

    // Direct login success
    if (data.access_token) {
      setTokens(data.access_token, data.refresh_token);
      await fetchMe();
      navigate('/', { replace: true });
    }
  };

  const handleLink = async () => {
    const code = linkCode.trim().toUpperCase();
    if (code.length !== 6) {
      message.warning('กรุณากรอกรหัสเชื่อมต่อ 6 ตัว');
      return;
    }

    setLinkLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/line/link`, {
        temp_token: tempToken,
        link_code: code,
      });
      handleResponse(data);
    } catch (err) {
      message.error(err.response?.data?.detail || 'รหัสเชื่อมต่อไม่ถูกต้อง');
    } finally {
      setLinkLoading(false);
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
      const { data } = await axios.post(`${API_URL}/api/auth/line/2fa-verify`, {
        temp_token: twoFATempToken,
        code,
      });

      if (data.access_token) {
        setTokens(data.access_token, data.refresh_token);
        await fetchMe();
        navigate('/', { replace: true });
      }
    } catch (err) {
      message.error(err.response?.data?.detail || 'รหัส OTP ไม่ถูกต้อง');
    } finally {
      setOtpLoading(false);
    }
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
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: COLORS.text }}>
            SSS Corp ERP
          </Title>
          <Text style={{ color: COLORS.textSecondary }}>
            {twoFAStep ? 'ยืนยันตัวตน 2 ชั้น' : linkStep ? 'เชื่อมต่อบัญชี LINE' : 'LINE Login'}
          </Text>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: COLORS.textSecondary }}>
              กำลังเข้าสู่ระบบผ่าน LINE...
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Result
            status="error"
            title="เข้าสู่ระบบไม่สำเร็จ"
            subTitle={error}
            extra={
              <Button type="primary" onClick={() => navigate('/login', { replace: true })}>
                กลับหน้า Login
              </Button>
            }
          />
        )}

        {/* Link Code Step */}
        {linkStep && !twoFAStep && !loading && !error && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Link2 size={40} color="#06C755" style={{ marginBottom: 12 }} />
              {lineDisplayName && (
                <Text
                  style={{
                    display: 'block',
                    color: COLORS.text,
                    fontSize: 16,
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  {lineDisplayName}
                </Text>
              )}
              <Text style={{ display: 'block', color: COLORS.textSecondary, fontSize: 13 }}>
                กรอกรหัสเชื่อมต่อ 6 ตัว ที่ได้รับจาก Admin
              </Text>
            </div>

            <Input
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="XXXXXX"
              maxLength={6}
              style={{
                textAlign: 'center',
                fontSize: 24,
                letterSpacing: 8,
                fontFamily: 'monospace',
                marginBottom: 16,
              }}
              size="large"
              onPressEnter={handleLink}
            />

            <Button
              type="primary"
              block
              size="large"
              onClick={handleLink}
              loading={linkLoading}
              disabled={linkCode.length !== 6}
            >
              เชื่อมต่อ
            </Button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/login', { replace: true })}
                style={{ color: COLORS.textMuted }}
              >
                กลับหน้า Login
              </Button>
            </div>
          </div>
        )}

        {/* 2FA Step */}
        {twoFAStep && !loading && !error && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <ShieldCheck size={40} color={COLORS.success} style={{ marginBottom: 12 }} />
              <Text style={{ display: 'block', color: COLORS.textSecondary, marginBottom: 4 }}>
                {useBackupCode
                  ? 'กรอก Backup Code (8 ตัวอักษร)'
                  : 'กรอกรหัส OTP 6 หลักจากแอป Authenticator'}
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
              <Space split={<span style={{ color: COLORS.border }}>|</span>}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => { setUseBackupCode(!useBackupCode); setOtpCode(''); }}
                  style={{ color: COLORS.textSecondary }}
                >
                  {useBackupCode ? 'ใช้ OTP จากแอป' : 'ใช้ Backup Code'}
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate('/login', { replace: true })}
                  style={{ color: COLORS.textMuted }}
                >
                  กลับ
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Card>
      <AppFooter compact />
    </div>
  );
}
