import { useState, useEffect, useMemo } from 'react';
import { Card, Button, App, Collapse, Tag, Space, Tooltip, Spin, Badge, Switch, Input } from 'antd';
import {
  Save, Lock, RefreshCw, Search, Package, Warehouse, FileText,
  ShoppingCart, DollarSign, BarChart3, Database, Settings, UserCheck,
  Wrench, Users, Plus, Eye, Pencil, Trash2, Check, Download, Play,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import api from '../../services/api';
import { usePermission } from '../../hooks/usePermission';
import { COLORS } from '../../utils/constants';
import {
  MODULE_META, MODULE_ORDER, RESOURCE_META, ACTION_META, ACTION_ORDER,
  buildPermissionTree,
} from '../../utils/permissionMeta';

const ROLE_ORDER = ['owner', 'manager', 'supervisor', 'staff', 'viewer'];
const ROLE_LABELS = {
  owner: 'Owner', manager: 'Manager', supervisor: 'Supervisor', staff: 'Staff', viewer: 'Viewer',
};
const ROLE_COLORS = {
  owner: 'cyan', manager: 'blue', supervisor: 'green', staff: 'default', viewer: 'default',
};

// Lucide icon components map
const ICON_MAP = {
  Package, Warehouse, FileText, ShoppingCart, DollarSign, BarChart3,
  Database, Settings, UserCheck, Wrench, Users,
  Plus, Eye, Pencil, Trash2, Check, Download, Play,
};

function ActionToggle({ perm, action, checked, disabled, description, onToggle }) {
  const meta = ACTION_META[action];
  if (!meta) return null;
  const IconComp = ICON_MAP[meta.icon];

  return (
    <Tooltip title={description || perm} placement="top">
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 6,
          background: checked ? `${meta.color}18` : 'transparent',
          border: `1px solid ${checked ? `${meta.color}40` : COLORS.border}`,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 0.2s',
          minWidth: 80,
        }}
        onClick={() => !disabled && onToggle(perm, !checked)}
      >
        {IconComp && <IconComp size={12} color={checked ? meta.color : COLORS.textMuted} />}
        <span style={{
          fontSize: 11,
          color: checked ? meta.color : COLORS.textMuted,
          fontWeight: checked ? 500 : 400,
          whiteSpace: 'nowrap',
        }}>
          {meta.label}
        </span>
        <Switch
          size="small"
          checked={checked}
          disabled={disabled}
          onChange={(val) => onToggle(perm, val)}
          onClick={(e) => e.stopPropagation()}
          style={{ marginLeft: 'auto' }}
        />
      </div>
    </Tooltip>
  );
}

export default function RoleTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [rolesData, setRolesData] = useState({});
  const [allPerms, setAllPerms] = useState([]);
  const [descriptions, setDescriptions] = useState({});
  const [editedPerms, setEditedPerms] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [searchText, setSearchText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, seedRes] = await Promise.all([
        api.get('/api/admin/roles'),
        api.post('/api/admin/seed-permissions'),
      ]);
      setRolesData(rolesRes.data);
      setAllPerms(seedRes.data.all_permissions || []);
      setDescriptions(seedRes.data.descriptions || {});
      setEditedPerms({});
    } catch {
      message.error('ไม่สามารถโหลดข้อมูลสิทธิ์ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const permTree = useMemo(() => buildPermissionTree(allPerms), [allPerms]);

  // Filter tree by search text (matches module/resource/action Thai labels + description + English key)
  const getFilteredTree = useMemo(() => {
    if (!searchText.trim()) return permTree;
    const q = searchText.trim().toLowerCase();
    const filtered = {};

    for (const mod of Object.keys(permTree)) {
      const modMeta = MODULE_META[mod];
      const modLabel = modMeta?.label?.toLowerCase() || '';

      for (const resource of Object.keys(permTree[mod])) {
        const resLabel = (RESOURCE_META[resource] || resource).toLowerCase();

        for (const action of Object.keys(permTree[mod][resource])) {
          const actLabel = (ACTION_META[action]?.label || action).toLowerCase();
          const fullPerm = permTree[mod][resource][action];
          const desc = (descriptions[fullPerm] || '').toLowerCase();

          if (
            mod.includes(q) || modLabel.includes(q) ||
            resource.includes(q) || resLabel.includes(q) ||
            action.includes(q) || actLabel.includes(q) ||
            fullPerm.includes(q) || desc.includes(q)
          ) {
            if (!filtered[mod]) filtered[mod] = {};
            if (!filtered[mod][resource]) filtered[mod][resource] = {};
            filtered[mod][resource][action] = fullPerm;
          }
        }
      }
    }
    return filtered;
  }, [permTree, searchText, descriptions]);

  const handleToggle = (role, perm, checked) => {
    setEditedPerms((prev) => {
      const current = prev[role] || [...(rolesData[role] || [])];
      const updated = checked
        ? [...new Set([...current, perm])]
        : current.filter((p) => p !== perm);
      return { ...prev, [role]: updated };
    });
  };

  const handleGrantAllModule = (role, mod) => {
    const modulePerms = [];
    for (const resource of Object.keys(permTree[mod] || {})) {
      for (const action of Object.keys(permTree[mod][resource] || {})) {
        modulePerms.push(permTree[mod][resource][action]);
      }
    }
    setEditedPerms((prev) => {
      const current = prev[role] || [...(rolesData[role] || [])];
      const updated = [...new Set([...current, ...modulePerms])];
      return { ...prev, [role]: updated };
    });
  };

  const handleRevokeAllModule = (role, mod) => {
    const modulePerms = new Set();
    for (const resource of Object.keys(permTree[mod] || {})) {
      for (const action of Object.keys(permTree[mod][resource] || {})) {
        modulePerms.add(permTree[mod][resource][action]);
      }
    }
    setEditedPerms((prev) => {
      const current = prev[role] || [...(rolesData[role] || [])];
      const updated = current.filter((p) => !modulePerms.has(p));
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

  const getModulePermCount = (mod, permSet) => {
    let granted = 0;
    let total = 0;
    for (const resource of Object.keys(permTree[mod] || {})) {
      for (const action of Object.keys(permTree[mod][resource] || {})) {
        total++;
        if (permSet.has(permTree[mod][resource][action])) granted++;
      }
    }
    return { granted, total };
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Input
          placeholder="ค้นหาสิทธิ์... (ชื่อ, คำอธิบาย, โมดูล)"
          prefix={<Search size={14} color={COLORS.textMuted} />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ maxWidth: 400, background: COLORS.surface, borderColor: COLORS.border }}
        />
        <Tooltip title="รีเฟรชข้อมูล">
          <Button icon={<RefreshCw size={14} />} onClick={fetchData}>รีเฟรช</Button>
        </Tooltip>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ROLE_ORDER.map((role) => {
          const perms = editedPerms[role] || rolesData[role] || [];
          const isOwner = role === 'owner';
          const permSet = new Set(perms);
          const canEdit = !isOwner && can('admin.role.update');
          const tree = getFilteredTree;

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
                canEdit && (
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
                defaultActiveKey={[]}
                items={MODULE_ORDER
                  .filter((mod) => tree[mod])
                  .map((mod) => {
                    const modMeta = MODULE_META[mod] || { label: mod, icon: 'Package' };
                    const ModIcon = ICON_MAP[modMeta.icon] || Package;
                    const { granted, total } = getModulePermCount(mod, permSet);
                    const resources = tree[mod];

                    return {
                      key: mod,
                      label: (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <Space>
                            <ModIcon size={16} color={COLORS.accent} />
                            <span style={{ fontWeight: 500, color: COLORS.text }}>
                              {modMeta.label}
                            </span>
                            <span style={{ color: COLORS.textMuted, fontSize: 12 }}>
                              ({granted}/{total})
                            </span>
                          </Space>
                          {canEdit && (
                            <Space size={4} onClick={(e) => e.stopPropagation()}>
                              <Tooltip title="เปิดทั้งหมด">
                                <Button
                                  type="text" size="small"
                                  icon={<ToggleRight size={14} color={COLORS.success} />}
                                  onClick={() => handleGrantAllModule(role, mod)}
                                  style={{ fontSize: 11, color: COLORS.success }}
                                >
                                  เปิดทั้งหมด
                                </Button>
                              </Tooltip>
                              <Tooltip title="ปิดทั้งหมด">
                                <Button
                                  type="text" size="small"
                                  icon={<ToggleLeft size={14} color={COLORS.danger} />}
                                  onClick={() => handleRevokeAllModule(role, mod)}
                                  style={{ fontSize: 11, color: COLORS.danger }}
                                >
                                  ปิดทั้งหมด
                                </Button>
                              </Tooltip>
                            </Space>
                          )}
                        </div>
                      ),
                      children: (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {Object.keys(resources).map((resource) => {
                            const actions = resources[resource];
                            const resLabel = RESOURCE_META[resource] || resource;

                            return (
                              <div
                                key={resource}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 12,
                                  padding: '6px 12px',
                                  background: COLORS.surface,
                                  borderRadius: 6,
                                  border: `1px solid ${COLORS.borderLight}`,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span style={{
                                  minWidth: 140,
                                  fontSize: 13,
                                  fontWeight: 500,
                                  color: COLORS.text,
                                }}>
                                  {resLabel}
                                </span>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                                  {ACTION_ORDER
                                    .filter((act) => actions[act])
                                    .map((act) => {
                                      const fullPerm = actions[act];
                                      return (
                                        <ActionToggle
                                          key={fullPerm}
                                          perm={fullPerm}
                                          action={act}
                                          checked={permSet.has(fullPerm)}
                                          disabled={!canEdit}
                                          description={descriptions[fullPerm]}
                                          onToggle={(p, v) => handleToggle(role, p, v)}
                                        />
                                      );
                                    })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ),
                    };
                  })}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
