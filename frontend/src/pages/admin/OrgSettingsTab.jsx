import { useState, useEffect, useCallback } from 'react';
import { Card, Form, InputNumber, Switch, Button, App, Select, Descriptions, Divider, Typography, Space, Spin } from 'antd';
import { Save } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Title, Text } = Typography;

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'จันทร์' },
  { value: 2, label: 'อังคาร' },
  { value: 3, label: 'พุธ' },
  { value: 4, label: 'พฤหัสบดี' },
  { value: 5, label: 'ศุกร์' },
  { value: 6, label: 'เสาร์' },
  { value: 7, label: 'อาทิตย์' },
];

const MODULE_LABELS = {
  'purchasing.po': 'ใบสั่งซื้อ (PO)',
  'sales.order': 'ใบสั่งขาย (SO)',
  'hr.timesheet': 'Timesheet / OT',
  'hr.leave': 'การลา',
  'workorder.order': 'ใบสั่งงาน (WO)',
};

export default function OrgSettingsTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [workForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approvalConfigs, setApprovalConfigs] = useState([]);
  const [org, setOrg] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orgRes, workRes, approvalRes] = await Promise.all([
        api.get('/api/admin/organization'),
        api.get('/api/admin/config/work'),
        api.get('/api/admin/config/approval'),
      ]);
      setOrg(orgRes.data);
      workForm.setFieldsValue({
        working_days: workRes.data.working_days,
        hours_per_day: parseFloat(workRes.data.hours_per_day),
      });
      setApprovalConfigs(approvalRes.data.items || []);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลการตั้งค่าได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveWork = async () => {
    try {
      const values = await workForm.validateFields();
      setSaving(true);
      await api.put('/api/admin/config/work', values);
      message.success('บันทึกการตั้งค่าวันทำงานสำเร็จ');
    } catch (err) {
      if (err.response) {
        message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleApproval = async (moduleKey, newValue) => {
    try {
      const updatedConfigs = approvalConfigs.map((c) =>
        c.module_key === moduleKey ? { ...c, require_approval: newValue } : c
      );
      setApprovalConfigs(updatedConfigs);
      await api.put('/api/admin/config/approval', {
        configs: updatedConfigs.map((c) => ({
          module_key: c.module_key,
          require_approval: c.require_approval,
        })),
      });
      message.success(`${MODULE_LABELS[moduleKey]}: ${newValue ? 'เปิด' : 'ปิด'}การอนุมัติ`);
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
      fetchData();
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;
  }

  const canEdit = can('admin.config.update');

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Organization Info */}
      {org && (
        <Card size="small" style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>ข้อมูลองค์กร</Title>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="รหัส">
              <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{org.code}</span>
            </Descriptions.Item>
            <Descriptions.Item label="ชื่อ">{org.name}</Descriptions.Item>
            <Descriptions.Item label="เลขประจำตัวผู้เสียภาษี">{org.tax_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="ที่อยู่">{org.address || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Work Config */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>วันและเวลาทำงาน</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          ใช้สำหรับ Timesheet อัตโนมัติ, การคำนวณ Payroll, และ Daily Plan
        </Text>
        <Form form={workForm} layout="vertical"
          initialValues={{ working_days: [1, 2, 3, 4, 5, 6], hours_per_day: 8 }}
        >
          <Form.Item name="working_days" label="วันทำงาน"
            rules={[{ required: true, message: 'กรุณาเลือกวันทำงาน' }]}
          >
            <Select mode="multiple" placeholder="เลือกวันทำงาน"
              options={WEEKDAY_OPTIONS}
              disabled={!canEdit}
            />
          </Form.Item>

          <Form.Item name="hours_per_day" label="ชั่วโมงทำงานต่อวัน"
            rules={[{ required: true, message: 'กรุณากรอกชั่วโมง' }]}
          >
            <InputNumber min={1} max={24} step={0.5} style={{ width: 200 }}
              addonAfter="ชม." disabled={!canEdit} />
          </Form.Item>

          {canEdit && (
            <Button type="primary" icon={<Save size={14} />} onClick={handleSaveWork} loading={saving}>
              บันทึก
            </Button>
          )}
        </Form>
      </Card>

      {/* Approval Config */}
      <Card size="small">
        <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>การตั้งค่าการอนุมัติ</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          ปิดการอนุมัติเพื่อให้เอกสารถูกอนุมัติอัตโนมัติเมื่อสร้าง (Bypass Approval)
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {approvalConfigs.map((config) => (
            <div key={config.module_key}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px', borderRadius: 8,
                background: config.require_approval ? 'transparent' : `${COLORS.warning}15`,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{MODULE_LABELS[config.module_key] || config.module_key}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                  {config.require_approval ? 'ต้องอนุมัติก่อนดำเนินการ' : 'อนุมัติอัตโนมัติ (Bypass)'}
                </div>
              </div>
              <Switch
                checked={config.require_approval}
                onChange={(v) => handleToggleApproval(config.module_key, v)}
                checkedChildren="อนุมัติ"
                unCheckedChildren="Bypass"
                disabled={!canEdit}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
