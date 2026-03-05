import { useState, useEffect, useCallback } from 'react';
import { Card, Select, Switch, Button, App, Typography, Space, Spin, Empty } from 'antd';
import { Save, LayoutGrid } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Title, Text } = Typography;

// Menu key → Thai label mapping (matches VALID_MENU_KEYS in backend)
const MENU_KEY_LABELS = {
  dashboard: 'Dashboard',
  'supply-chain': 'Supply Chain (คลังสินค้า)',
  'work-orders': 'Work Orders (ใบสั่งงาน)',
  purchasing: 'Purchasing (จัดซื้อ)',
  sales: 'Sales (ขาย)',
  hr: 'HR (ทรัพยากรบุคคล)',
  customers: 'Customers (ลูกค้า)',
  planning: 'Planning (วางแผน)',
  master: 'Master Data (ข้อมูลหลัก)',
  finance: 'Finance (การเงิน)',
  admin: 'Admin (ผู้ดูแลระบบ)',
};

export default function DeptMenuConfigTab() {
  const { can } = usePermission();
  const { message } = App.useApp();

  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState(null); // null = org-wide default
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deptName, setDeptName] = useState(null);

  const canEdit = can('admin.config.update');

  // Fetch department list
  useEffect(() => {
    api.get('/api/master/departments', { params: { limit: 100 } })
      .then(({ data }) => setDepartments(data.items || []))
      .catch((err) => console.warn('[DeptMenuConfig] load:', err?.response?.status));
  }, []);

  // Fetch menu config for selected department
  const fetchMenuConfig = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedDeptId) params.department_id = selectedDeptId;
      const { data } = await api.get('/api/admin/dept-menu', { params });
      setMenuItems(data.items || []);
      setDeptName(data.department_name || null);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลเมนูได้');
    } finally {
      setLoading(false);
    }
  }, [selectedDeptId]);

  useEffect(() => { fetchMenuConfig(); }, [fetchMenuConfig]);

  const handleToggle = (menuKey, newValue) => {
    setMenuItems((prev) =>
      prev.map((item) =>
        item.menu_key === menuKey ? { ...item, is_visible: newValue } : item
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/admin/dept-menu', {
        department_id: selectedDeptId,
        items: menuItems.map((item) => ({
          menu_key: item.menu_key,
          is_visible: item.is_visible,
        })),
      });
      message.success('บันทึกเมนูสำเร็จ');
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const deptOptions = [
    { value: '__org_default__', label: 'ค่าเริ่มต้นองค์กร (Org Default)' },
    ...departments.map((d) => ({
      value: d.id,
      label: `${d.code} — ${d.name}`,
    })),
  ];

  return (
    <div style={{ maxWidth: 800 }}>
      <Card size="small" style={{ marginBottom: 24 }}>
        <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
          <LayoutGrid size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          เมนูตามแผนก
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          กำหนดเมนูที่แต่ละแผนกเห็นใน Sidebar — สิทธิ์ (Permission) ยังคงควบคุมสิ่งที่ทำได้
        </Text>

        <div style={{ marginBottom: 20 }}>
          <Text style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>เลือกแผนก</Text>
          <Select
            style={{ width: 360 }}
            value={selectedDeptId || '__org_default__'}
            onChange={(val) => setSelectedDeptId(val === '__org_default__' ? null : val)}
            options={deptOptions}
            placeholder="เลือกแผนก"
          />
          {deptName && (
            <Text style={{ display: 'block', marginTop: 4, fontSize: 12, color: COLORS.textMuted }}>
              แผนก: {deptName}
            </Text>
          )}
          {!selectedDeptId && (
            <Text style={{ display: 'block', marginTop: 4, fontSize: 12, color: COLORS.accent }}>
              ค่าเริ่มต้นจะมีผลกับแผนกที่ยังไม่มีการตั้งค่าเฉพาะ
            </Text>
          )}
        </div>
      </Card>

      <Card size="small">
        <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
          การมองเห็นเมนู
        </Title>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : menuItems.length === 0 ? (
          <Empty description="ไม่พบข้อมูลเมนู" />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {menuItems.map((item) => (
                <div
                  key={item.menu_key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 16px',
                    borderRadius: 8,
                    background: item.is_visible ? 'transparent' : `${COLORS.error}10`,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      {MENU_KEY_LABELS[item.menu_key] || item.menu_key}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                      {item.is_visible ? 'แสดงใน Sidebar' : 'ซ่อนจาก Sidebar'}
                    </div>
                  </div>
                  <Switch
                    checked={item.is_visible}
                    onChange={(v) => handleToggle(item.menu_key, v)}
                    checkedChildren="แสดง"
                    unCheckedChildren="ซ่อน"
                    disabled={!canEdit}
                  />
                </div>
              ))}
            </div>

            {canEdit && (
              <div style={{ marginTop: 20 }}>
                <Button
                  type="primary"
                  icon={<Save size={14} />}
                  onClick={handleSave}
                  loading={saving}
                >
                  บันทึก
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
