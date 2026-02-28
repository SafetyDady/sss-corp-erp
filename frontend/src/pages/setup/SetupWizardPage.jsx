import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Form, Input, InputNumber, Steps, Typography, Result, Spin, Space } from 'antd';
import { Building2, Layers, UserPlus, CheckCircle, Plus, Trash2 } from 'lucide-react';
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
  const [checking, setChecking] = useState(true);
  const [orgForm] = Form.useForm();
  const [userForm] = Form.useForm();
  const [departments, setDepartments] = useState([]);
  const [result, setResult] = useState(null);

  // Guard: redirect if org already exists
  useEffect(() => {
    axios.get(`${API_URL}/api/health`)
      .then(() => {
        return axios.get(`${API_URL}/api/admin/organization`).catch(() => null);
      })
      .then((res) => {
        if (res?.data?.id) {
          message.info('ระบบถูกตั้งค่าแล้ว');
          navigate('/login', { replace: true });
        }
      })
      .catch(() => { /* No org yet — show wizard */ })
      .finally(() => setChecking(false));
  }, []);

  const addDepartment = () => {
    setDepartments((prev) => [
      ...prev,
      { code: '', name: '', overhead_rate: 15.0, key: Date.now() },
    ]);
  };

  const removeDepartment = (key) => {
    setDepartments((prev) => prev.filter((d) => d.key !== key));
  };

  const updateDepartment = (key, field, value) => {
    setDepartments((prev) =>
      prev.map((d) => (d.key === key ? { ...d, [field]: value } : d))
    );
  };

  const validateDepartments = () => {
    // Departments are optional — empty list is valid
    if (departments.length === 0) return true;

    for (const dept of departments) {
      if (!dept.code || !dept.code.trim()) {
        message.error('กรุณากรอกรหัสแผนกให้ครบ');
        return false;
      }
      if (!dept.name || !dept.name.trim()) {
        message.error('กรุณากรอกชื่อแผนกให้ครบ');
        return false;
      }
      if (dept.overhead_rate < 0 || dept.overhead_rate > 100) {
        message.error('Overhead Rate ต้องอยู่ระหว่าง 0-100%');
        return false;
      }
    }

    // Check for duplicate codes
    const codes = departments.map((d) => d.code.trim().toUpperCase());
    const uniqueCodes = new Set(codes);
    if (codes.length !== uniqueCodes.size) {
      message.error('รหัสแผนกต้องไม่ซ้ำกัน');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    try {
      const orgValues = orgForm.getFieldsValue();
      const userValues = userForm.getFieldsValue();
      setLoading(true);

      const deptPayload = departments
        .filter((d) => d.code && d.name)
        .map((d) => ({
          code: d.code.trim().toUpperCase(),
          name: d.name.trim(),
          overhead_rate: d.overhead_rate ?? 15.0,
        }));

      const { data } = await axios.post(`${API_URL}/api/setup`, {
        org_name: orgValues.org_name,
        org_code: orgValues.org_code,
        admin_email: userValues.admin_email,
        admin_password: userValues.admin_password,
        admin_full_name: userValues.admin_full_name,
        departments: deptPayload,
      });

      setResult(data);
      setTokens(data.access_token, data.refresh_token);
      setCurrent(3);
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
      if (!validateDepartments()) return;
      setCurrent(2);
    } else if (current === 2) {
      await userForm.validateFields();
      handleSubmit();
    }
  };

  const steps = [
    { title: 'องค์กร', icon: <Building2 size={16} /> },
    { title: 'แผนก', icon: <Layers size={16} /> },
    { title: 'ผู้ดูแลระบบ', icon: <UserPlus size={16} /> },
    { title: 'เสร็จสิ้น', icon: <CheckCircle size={16} /> },
  ];

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="กำลังตรวจสอบระบบ..." />
      </div>
    );
  }

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
          width: 640,
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

        {/* Step 0: Organization */}
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

        {/* Step 1: Departments (optional) */}
        {current === 1 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.text, fontWeight: 600 }}>
                กำหนดแผนก
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 12, display: 'block', marginTop: 4 }}>
                ระบบจะสร้าง Cost Center ให้อัตโนมัติ (ข้ามได้ถ้ายังไม่พร้อม)
              </Text>
            </div>

            {departments.map((dept) => (
              <div
                key={dept.key}
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 8,
                  alignItems: 'center',
                }}
              >
                <Input
                  placeholder="รหัส (PROD)"
                  value={dept.code}
                  onChange={(e) => updateDepartment(dept.key, 'code', e.target.value)}
                  style={{ width: 120, textTransform: 'uppercase' }}
                />
                <Input
                  placeholder="ชื่อแผนก"
                  value={dept.name}
                  onChange={(e) => updateDepartment(dept.key, 'name', e.target.value)}
                  style={{ flex: 1 }}
                />
                <InputNumber
                  placeholder="OH %"
                  value={dept.overhead_rate}
                  onChange={(val) => updateDepartment(dept.key, 'overhead_rate', val ?? 0)}
                  min={0}
                  max={100}
                  style={{ width: 100 }}
                  addonAfter="%"
                />
                <Button
                  type="text"
                  danger
                  icon={<Trash2 size={14} />}
                  onClick={() => removeDepartment(dept.key)}
                  style={{ flexShrink: 0 }}
                />
              </div>
            ))}

            <Button
              type="dashed"
              icon={<Plus size={14} />}
              onClick={addDepartment}
              style={{ width: '100%', marginTop: 8 }}
            >
              เพิ่มแผนก
            </Button>

            {departments.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 0',
                  color: COLORS.textMuted,
                  fontSize: 13,
                }}
              >
                ยังไม่มีแผนก — สามารถเพิ่มภายหลังได้ที่เมนู Master Data
              </div>
            )}
          </div>
        )}

        {/* Step 2: Admin User */}
        {current === 2 && (
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

        {/* Step 3: Success */}
        {current === 3 && (
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

        {current < 3 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button
              disabled={current === 0}
              onClick={() => setCurrent(current - 1)}
            >
              ย้อนกลับ
            </Button>
            <Button type="primary" loading={loading} onClick={handleNext}>
              {current === 2 ? 'เริ่มต้นใช้งาน' : 'ถัดไป'}
            </Button>
          </div>
        )}

        {current < 3 && (
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
