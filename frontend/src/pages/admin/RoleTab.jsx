import { useState, useEffect } from 'react';
import { Card, Checkbox, Button, App, Collapse, Tag, Space, Tooltip, Spin, Badge } from 'antd';
import { Save, Lock, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { usePermission } from '../../hooks/usePermission';
import { COLORS } from '../../utils/constants';

const ROLE_ORDER = ['owner', 'manager', 'supervisor', 'staff', 'viewer'];
const ROLE_LABELS = {
  owner: 'Owner', manager: 'Manager', supervisor: 'Supervisor', staff: 'Staff', viewer: 'Viewer',
};
const ROLE_COLORS = {
  owner: 'cyan', manager: 'blue', supervisor: 'green', staff: 'default', viewer: 'default',
};

function groupPermissions(perms) {
  const groups = {};
  perms.forEach((p) => {
    const parts = p.split('.');
    const module = parts[0];
    if (!groups[module]) groups[module] = [];
    groups[module].push(p);
  });
  return groups;
}

export default function RoleTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rolesData, setRolesData] = useState({});
  const [allPerms, setAllPerms] = useState([]);
  const [editedPerms, setEditedPerms] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, seedRes] = await Promise.all([
        api.get('/api/admin/roles'),
        api.get('/api/admin/seed-permissions'),
      ]);
      setRolesData(rolesRes.data);
      setAllPerms(seedRes.data.all_permissions || []);
      setEditedPerms({});
    } catch (err) {
      message.error('ไม่สามารถโหลดข้อมูลสิทธิ์ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggle = (role, perm, checked) => {
    setEditedPerms((prev) => {
      const current = prev[role] || [...(rolesData[role] || [])];
      const updated = checked
        ? [...new Set([...current, perm])]
        : current.filter((p) => p !== perm);
      return { ...prev, [role]: updated };
    });
  };

  const handleSave = async (role) => {
    const perms = editedPerms[role];
    if (!perms) return;
    setSaving(role);
    try {
      await api.put(`/api/admin/roles/${role}/permissions`, { permissions: perms });
      message.success(`บันทึกสิทธิ์ของ ${ROLE_LABELS[role]} สำเร็จ`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถบันทึกได้');
    } finally {
      setSaving(null);
    }
  };

  const hasChanges = (role) => !!editedPerms[role];

  const grouped = groupPermissions(allPerms);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip title="รีเฟรชข้อมูล">
          <Button icon={<RefreshCw size={14} />} onClick={fetchData}>รีเฟรช</Button>
        </Tooltip>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ROLE_ORDER.map((role) => {
          const perms = editedPerms[role] || rolesData[role] || [];
          const isOwner = role === 'owner';
          const permSet = new Set(perms);

          return (
            <Card
              key={role}
              size="small"
              style={{ background: COLORS.card, borderColor: COLORS.border }}
              title={
                <Space>
                  <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
                  <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                    {perms.length} สิทธิ์
                  </span>
                  {isOwner && (
                    <Tooltip title="Owner มีสิทธิ์ทั้งหมดเสมอ — ไม่สามารถแก้ไขได้">
                      <Lock size={12} style={{ color: COLORS.textMuted }} />
                    </Tooltip>
                  )}
                  {hasChanges(role) && <Badge status="warning" text="มีการเปลี่ยนแปลง" />}
                </Space>
              }
              extra={
                !isOwner && can('admin.role.update') && (
                  <Button
                    type="primary" size="small"
                    icon={<Save size={12} />}
                    loading={saving === role}
                    disabled={!hasChanges(role)}
                    onClick={() => handleSave(role)}
                  >
                    บันทึก
                  </Button>
                )
              }
            >
              <Collapse
                ghost
                items={Object.entries(grouped).map(([module, modulePerms]) => ({
                  key: module,
                  label: (
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                      {module}
                      <span style={{ color: COLORS.textMuted, fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                        ({modulePerms.filter((p) => permSet.has(p)).length}/{modulePerms.length})
                      </span>
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 4 }}>
                      {modulePerms.sort().map((perm) => (
                        <Checkbox
                          key={perm}
                          checked={permSet.has(perm)}
                          disabled={isOwner || !can('admin.role.update')}
                          onChange={(e) => handleToggle(role, perm, e.target.checked)}
                          style={{ fontSize: 12 }}
                        >
                          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{perm}</span>
                        </Checkbox>
                      ))}
                    </div>
                  ),
                }))}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
