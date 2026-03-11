import { useState } from 'react';
import { Modal, Steps, Button, Input, App, Typography, Space, Alert, Divider } from 'antd';
import { QrCode, ShieldCheck, Copy, Check } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Title, Text, Paragraph } = Typography;

export default function Setup2FAModal({ open, onClose, onSuccess }) {
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState(null); // { secret, qr_uri, backup_codes }
  const [otpCode, setOtpCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/2fa/setup');
      setSetupData(data);
      setStep(1);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถตั้งค่า 2FA ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length !== 6) {
      message.warning('กรุณากรอก OTP 6 หลัก');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/2fa/verify', { code: otpCode });
      message.success('เปิดใช้ 2FA สำเร็จ');
      setVerified(true);
      setStep(2);
    } catch (err) {
      message.error(err.response?.data?.detail || 'OTP ไม่ถูกต้อง กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBackupCodes = () => {
    if (setupData?.backup_codes) {
      navigator.clipboard.writeText(setupData.backup_codes.join('\n'));
      setCopied(true);
      message.success('คัดลอก Backup Codes แล้ว');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClose = () => {
    if (verified) {
      onSuccess?.();
    }
    setStep(0);
    setSetupData(null);
    setOtpCode('');
    setVerified(false);
    setCopied(false);
    onClose();
  };

  const steps = [
    { title: 'เตรียมพร้อม', icon: <QrCode size={16} /> },
    { title: 'ยืนยัน OTP', icon: <ShieldCheck size={16} /> },
    { title: 'Backup Codes', icon: <Copy size={16} /> },
  ];

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={18} color={COLORS.success} />
          ตั้งค่าการยืนยันตัวตน 2 ชั้น (2FA)
        </span>
      }
      width={520}
      footer={null}
      destroyOnHidden
    >
      <Steps current={step} items={steps} size="small" style={{ marginBottom: 24 }} />

      {/* Step 0: Setup */}
      {step === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <QrCode size={48} color={COLORS.accent} style={{ marginBottom: 16 }} />
          <Title level={5}>ขั้นตอนที่ 1: เปิดแอป Authenticator</Title>
          <Paragraph style={{ color: COLORS.textSecondary, maxWidth: 360, margin: '0 auto 24px' }}>
            ดาวน์โหลดและเปิดแอป Google Authenticator หรือ Authy บนมือถือ
            จากนั้นกดปุ่มด้านล่างเพื่อรับ QR Code สำหรับสแกน
          </Paragraph>
          <Button type="primary" size="large" onClick={handleSetup} loading={loading}>
            เริ่มตั้งค่า 2FA
          </Button>
        </div>
      )}

      {/* Step 1: Scan QR + Verify OTP */}
      {step === 1 && setupData && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Title level={5} style={{ marginBottom: 8 }}>สแกน QR Code ด้วยแอป Authenticator</Title>
            <div style={{
              display: 'inline-block',
              padding: 16,
              background: '#fff',
              borderRadius: 12,
              marginBottom: 12,
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qr_uri)}`}
                alt="QR Code"
                style={{ width: 200, height: 200 }}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>หรือกรอก secret key ด้านล่างในแอป:</Text>
              <div style={{
                fontFamily: 'monospace',
                background: COLORS.surface,
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                marginTop: 8,
                fontSize: 14,
                letterSpacing: 2,
                wordBreak: 'break-all',
                color: COLORS.accent,
              }}>
                {setupData.secret}
              </div>
            </div>
          </div>

          <Divider>ใส่ OTP จากแอป</Divider>

          <div style={{ textAlign: 'center' }}>
            <Input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              style={{
                width: 200,
                textAlign: 'center',
                fontSize: 24,
                letterSpacing: 8,
                fontFamily: 'monospace',
              }}
              onPressEnter={handleVerify}
            />
            <div style={{ marginTop: 16 }}>
              <Button type="primary" onClick={handleVerify} loading={loading}
                disabled={otpCode.length !== 6}
              >
                ยืนยัน OTP
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Backup Codes */}
      {step === 2 && setupData && (
        <div>
          <Alert
            type="warning"
            showIcon
            message="บันทึก Backup Codes ไว้ในที่ปลอดภัย"
            description="Backup Codes ใช้เข้าระบบแทน OTP เมื่อไม่มีมือถือ แต่ละ code ใช้ได้ครั้งเดียว"
            style={{ marginBottom: 20 }}
          />

          <div style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px 32px',
            }}>
              {setupData.backup_codes.map((code, i) => (
                <div key={i} style={{
                  fontFamily: 'monospace',
                  fontSize: 15,
                  padding: '4px 0',
                  color: COLORS.text,
                }}>
                  {i + 1}. {code}
                </div>
              ))}
            </div>
          </div>

          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Button
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyBackupCodes}
            >
              {copied ? 'คัดลอกแล้ว' : 'คัดลอก Backup Codes'}
            </Button>
            <Button type="primary" onClick={handleClose}>
              เสร็จสิ้น
            </Button>
          </Space>
        </div>
      )}
    </Modal>
  );
}
