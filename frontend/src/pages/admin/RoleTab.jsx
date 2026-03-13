/**
 * RoleTab — Permission Matrix UI (Redesigned)
 *
 * 3 Module Groups (Segmented) → Sub-tabs per module → Permission Matrix Table
 * Rows = permissions, Columns = roles, Cells = Checkbox
 * Batch save, change tracking, bulk actions
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, App, Tabs, Tag, Space, Tooltip, Spin, Input, Badge, Segmented, Progress } from 'antd';
import {
  Save, RefreshCw, Search, RotateCcw, X, ShieldCheck, Info,
  Package, Warehouse, FileText, ShoppingCart, DollarSign,
  BarChart3, Database, Settings, UserCheck, Wrench, Users,
  Boxes, HardHat, Server, Copy, GitCompareArrows,
} from 'lucide-react';
import api from '../../services/api';
import { usePermission } from '../../hooks/usePermission';
import { COLORS } from '../../utils/constants';
import {
  MODULE_META, RESOURCE_META, ACTION_META,
  buildPermissionTree, getModulePermissions,
} from '../../utils/permissionMeta';
import PermissionMatrixTable from './PermissionMatrixTable';
import RolePermissionView from './RolePermissionView';
import ChangePreviewModal from './ChangePreviewModal';
import CopyRoleModal from './CopyRoleModal';
import RoleCompareModal from './RoleCompareModal';

const ROLE_ORDER = ['owner', 'manager', 'supervisor', 'staff', 'viewer'];
const ROLE_LABELS = {
  owner: 'Owner', manager: 'Manager', supervisor: 'Supervisor', staff: 'Staff', viewer: 'Viewer',
};

// Lucide icon components map
const ICON_MAP = {
  Package, Warehouse, FileText, ShoppingCart, DollarSign, BarChart3,
  Database, Settings, UserCheck, Wrench, Users,
};

// ── Module Groups ────────────────────────────────────────────
const MODULE_GROUPS = [
  {
    key: 'operations',
    label: 'ปฏิบัติการ',
    icon: Boxes,
    modules: ['inventory', 'warehouse', 'workorder', 'purchasing', 'sales'],
  },
  {
    key: 'hr',
    label: 'บุคคล',
    icon: HardHat,
    modules: ['hr', 'tools', 'customer'],
  },
  {
    key: 'system',
    label: 'ข้อมูลหลัก & ระบบ',
    icon: Server,
    modules: ['master', 'finance', 'admin'],
  },
];

// Quick lookup: moduleKey → groupKey
const MODULE_TO_GROUP = {};
for (const g of MODULE_GROUPS) {
  for (const m of g.modules) MODULE_TO_GROUP[m] = g.key;
}

export default function RoleTab() {
  const { can } = usePermission();
  const { message, modal } = App.useApp();
  const [rolesData, setRolesData] = useState({});
  const [allPerms, setAllPerms] = useState([]);
  const [descriptions, setDescriptions] = useState({});
  const [pendingChanges, setPendingChanges] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeGroup, setActiveGroup] = useState(MODULE_GROUPS[0].key);
  const [activeModule, setActiveModule] = useState(MODULE_GROUPS[0].modules[0]);
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState('module'); // 'module' | 'role'
  const [selectedRole, setSelectedRole] = useState('manager');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const [defaults, setDefaults] = useState({});
  const canEdit = can('admin.role.update');

  // ── Fetch ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/roles');
      setRolesData(res.data.roles || {});
      setAllPerms(res.data.all_permissions || []);
      setDescriptions(res.data.descriptions || {});
      setDefaults(res.data.defaults || {});
      setPendingChanges({});
    } catch {
      message.error('ไม่สามารถโหลดข้อมูลสิทธิ์ได้');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Permission tree ────────────────────────────────────────
  const permTree = useMemo(() => buildPermissionTree(allPerms), [allPerms]);

  // Filtered tree (for search)
  const filteredTree = useMemo(() => {
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

  // ── Change tracking helpers ────────────────────────────────

  const getRolePermSet = useCallback((role) => {
    if (pendingChanges[role]) return pendingChanges[role];
    return new Set(rolesData[role] || []);
  }, [pendingChanges, rolesData]);

  const hasAnyChanges = Object.keys(pendingChanges).length > 0;
  const modifiedRolesCount = Object.keys(pendingChanges).length;

  const moduleHasChanges = useCallback((moduleKey) => {
    const modPerms = getModulePermissions(permTree, moduleKey);
    for (const role of ROLE_ORDER) {
      if (role === 'owner') continue;
      if (!pendingChanges[role]) continue;
      const original = new Set(rolesData[role] || []);
      const current = pendingChanges[role];
      for (const p of modPerms) {
        if (original.has(p.permission) !== current.has(p.permission)) return true;
      }
    }
    return false;
  }, [permTree, pendingChanges, rolesData]);

  // Check if a group has pending changes (any module in that group)
  const groupHasChanges = useCallback((groupKey) => {
    const group = MODULE_GROUPS.find((g) => g.key === groupKey);
    if (!group) return false;
    return group.modules.some((mod) => moduleHasChanges(mod));
  }, [moduleHasChanges]);

  // ── Handlers ───────────────────────────────────────────────

  const handleToggle = useCallback((role, perm, checked) => {
    if (role === 'owner') return;
    setPendingChanges((prev) => {
      const current = prev[role]
        ? new Set(prev[role])
        : new Set(rolesData[role] || []);

      if (checked) {
        current.add(perm);
      } else {
        current.delete(perm);
      }

      const original = new Set(rolesData[role] || []);
      const isIdentical =
        current.size === original.size &&
        [...current].every((p) => original.has(p));

      if (isIdentical) {
        const next = { ...prev };
        delete next[role];
        return next;
      }

      return { ...prev, [role]: current };
    });
  }, [rolesData]);

  const handleBulkAction = useCallback((role, moduleKey, actionType) => {
    if (role === 'owner') return;
    const modPerms = getModulePermissions(permTree, moduleKey);

    setPendingChanges((prev) => {
      const current = prev[role]
        ? new Set(prev[role])
        : new Set(rolesData[role] || []);

      if (actionType === 'grant_all') {
        for (const p of modPerms) current.add(p.permission);
      } else if (actionType === 'revoke_all') {
        for (const p of modPerms) current.delete(p.permission);
      } else if (actionType === 'grant_read') {
        for (const p of modPerms) {
          if (p.action === 'read') current.add(p.permission);
        }
      }

      const original = new Set(rolesData[role] || []);
      const isIdentical =
        current.size === original.size &&
        [...current].every((p) => original.has(p));

      if (isIdentical) {
        const next = { ...prev };
        delete next[role];
        return next;
      }

      return { ...prev, [role]: current };
    });
  }, [permTree, rolesData]);

  const handleSaveAll = () => {
    const changedRoles = Object.keys(pendingChanges);
    if (changedRoles.length === 0) return;
    setPreviewOpen(true);
  };

  const executeSave = async () => {
    const changedRoles = Object.keys(pendingChanges);
    if (changedRoles.length === 0) return;

    setSaving(true);
    try {
      await Promise.all(
        changedRoles.map((role) =>
          api.put(`/api/admin/roles/${role}/permissions`, {
            permissions: [...pendingChanges[role]],
          }),
        ),
      );
      message.success(`บันทึกสิทธิ์สำเร็จ (${changedRoles.length} roles)`);
      setPreviewOpen(false);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถบันทึกได้');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyRole = useCallback((sourceRole, targetRole) => {
    const sourceSet = getRolePermSet(sourceRole);
    setPendingChanges((prev) => {
      const newTarget = new Set(sourceSet);
      const original = new Set(rolesData[targetRole] || []);
      const isIdentical =
        newTarget.size === original.size &&
        [...newTarget].every((p) => original.has(p));

      if (isIdentical) {
        const next = { ...prev };
        delete next[targetRole];
        return next;
      }
      return { ...prev, [targetRole]: newTarget };
    });
    message.success(`คัดลอกสิทธิ์จาก ${ROLE_LABELS[sourceRole]} ไปยัง ${ROLE_LABELS[targetRole]} สำเร็จ`);
  }, [getRolePermSet, rolesData, message]);

  const handleDiscard = () => {
    if (!hasAnyChanges) return;
    modal.confirm({
      title: 'ยกเลิกการเปลี่ยนแปลง?',
      content: `คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึกใน ${modifiedRolesCount} role — ต้องการยกเลิกทั้งหมด?`,
      okText: 'ยกเลิกการเปลี่ยนแปลง',
      cancelText: 'ทำต่อ',
      okButtonProps: { danger: true },
      onOk: () => setPendingChanges({}),
    });
  };

  const handleReset = async () => {
    modal.confirm({
      title: 'คืนค่าเริ่มต้น?',
      content: 'คืนค่าสิทธิ์ทุก role เป็นค่าเริ่มต้นของระบบ? การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะถูกยกเลิก',
      okText: 'คืนค่าเริ่มต้น',
      cancelText: 'ยกเลิก',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.post('/api/admin/seed-permissions');
          message.success('คืนค่าสิทธิ์เริ่มต้นเรียบร้อย');
          fetchData();
        } catch {
          message.error('ไม่สามารถคืนค่าเริ่มต้นได้');
        }
      },
    });
  };

  // When switching group, auto-select first module in that group
  const handleGroupChange = useCallback((groupKey) => {
    setActiveGroup(groupKey);
    const group = MODULE_GROUPS.find((g) => g.key === groupKey);
    if (group) {
      // Pick first module that has results in filtered tree
      const first = group.modules.find((m) => filteredTree[m]) || group.modules[0];
      setActiveModule(first);
    }
  }, [filteredTree]);

  // ── Role summary (with diff vs defaults) ───────────────────
  const roleSummary = useMemo(() => {
    return ROLE_ORDER.map((role) => {
      const permSet = getRolePermSet(role);
      const count = permSet.size;
      let added = 0;
      let removed = 0;

      if (role !== 'owner' && defaults[role]) {
        const defaultSet = new Set(defaults[role]);
        for (const p of permSet) {
          if (!defaultSet.has(p)) added++;
        }
        for (const p of defaultSet) {
          if (!permSet.has(p)) removed++;
        }
      }

      return { role, count, added, removed };
    });
  }, [getRolePermSet, defaults]);

  // ── Current group's module sub-tabs ────────────────────────
  const currentGroup = MODULE_GROUPS.find((g) => g.key === activeGroup) || MODULE_GROUPS[0];

  const subTabItems = useMemo(() => {
    return currentGroup.modules
      .filter((mod) => filteredTree[mod])
      .map((mod) => {
        const meta = MODULE_META[mod] || { label: mod, icon: 'Package' };
        const ModIcon = ICON_MAP[meta.icon] || Package;
        const total = getModulePermissions(permTree, mod).length;
        const hasChanges = moduleHasChanges(mod);

        return {
          key: mod,
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ModIcon size={14} />
              <span>{meta.label}</span>
              <Tag
                style={{
                  fontSize: 10,
                  lineHeight: '16px',
                  padding: '0 4px',
                  marginInlineEnd: 0,
                  borderColor: 'transparent',
                }}
              >
                {total}
              </Tag>
              {hasChanges && (
                <Badge status="warning" style={{ marginLeft: -2 }} />
              )}
            </span>
          ),
        };
      });
  }, [currentGroup, filteredTree, permTree, moduleHasChanges]);

  // Segmented items for group selector
  const groupSegmentedOptions = useMemo(() => {
    return MODULE_GROUPS.map((g) => {
      const GIcon = g.icon;
      const hasChanges = groupHasChanges(g.key);
      const moduleCount = g.modules.filter((m) => filteredTree[m]).length;

      return {
        value: g.key,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px' }}>
            <GIcon size={14} />
            <span>{g.label}</span>
            {hasChanges && (
              <Badge status="warning" dot style={{ marginLeft: -2 }} />
            )}
          </span>
        ),
        disabled: moduleCount === 0,
      };
    });
  }, [filteredTree, groupHasChanges]);

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ position: 'relative', paddingBottom: hasAnyChanges ? 72 : 0 }}>
      {/* ── Toolbar ──────────────────────────────────── */}
      <div style={{
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Input
            placeholder="ค้นหาสิทธิ์... (ชื่อ, คำอธิบาย, โมดูล)"
            prefix={<Search size={14} color={COLORS.textMuted} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ maxWidth: 320, background: COLORS.surface, borderColor: COLORS.border }}
          />
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'module', label: 'ตามโมดูล' },
              { value: 'role',   label: 'ตามบทบาท' },
            ]}
            size="small"
            style={{ background: COLORS.surface }}
          />
        </div>
        <Space wrap>
          {canEdit && (
            <Tooltip title="คัดลอกสิทธิ์ระหว่าง role">
              <Button
                icon={<Copy size={14} />}
                onClick={() => setCopyModalOpen(true)}
                size="small"
              >
                คัดลอกสิทธิ์
              </Button>
            </Tooltip>
          )}
          <Tooltip title="เปรียบเทียบสิทธิ์ 2 roles">
            <Button
              icon={<GitCompareArrows size={14} />}
              onClick={() => setCompareModalOpen(true)}
              size="small"
            >
              เปรียบเทียบ
            </Button>
          </Tooltip>
          {canEdit && (
            <Tooltip title="คืนค่าสิทธิ์เริ่มต้น">
              <Button
                icon={<RotateCcw size={14} />}
                onClick={handleReset}
                size="small"
              >
                คืนค่าเริ่มต้น
              </Button>
            </Tooltip>
          )}
          <Tooltip title="รีเฟรชข้อมูล">
            <Button icon={<RefreshCw size={14} />} onClick={fetchData} size="small">
              รีเฟรช
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* ── Owner Info + Editable Hint ────────────────── */}
      <div style={{
        marginBottom: 12,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: COLORS.surface,
          borderRadius: 6,
          border: `1px solid ${COLORS.borderLight}`,
        }}>
          <ShieldCheck size={14} color={COLORS.primary} />
          <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
            Owner: {allPerms.length}/{allPerms.length} สิทธิ์
            <span style={{ color: COLORS.textMuted }}> (ทุกสิทธิ์เสมอ — ไม่สามารถแก้ไขได้)</span>
          </span>
        </div>
        {canEdit && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            color: COLORS.textMuted,
          }}>
            <Info size={12} />
            <span>คลิกที่ช่องเพื่อเปลี่ยนสิทธิ์ — กดบันทึกเมื่อเสร็จ</span>
          </div>
        )}
      </div>

      {/* ── View Content (Module View or Role View) ──── */}
      {viewMode === 'module' ? (
        <>
          {/* ── Group Selector (Segmented) ───────────────── */}
          <div style={{ marginBottom: 12 }}>
            <Segmented
              value={activeGroup}
              onChange={handleGroupChange}
              options={groupSegmentedOptions}
              size="middle"
              style={{ background: COLORS.surface }}
            />
          </div>

          {/* ── Module Sub-tabs + Matrix Table ────────────── */}
          <Tabs
            activeKey={activeModule}
            onChange={setActiveModule}
            items={subTabItems}
            type="card"
            size="small"
            style={{ marginBottom: 0 }}
            tabBarStyle={{
              marginBottom: 0,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          />

          <div style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
          }}>
            <PermissionMatrixTable
              moduleKey={activeModule}
              permTree={filteredTree}
              rolesData={rolesData}
              pendingChanges={pendingChanges}
              descriptions={descriptions}
              canEdit={canEdit}
              onToggle={handleToggle}
              onBulkAction={handleBulkAction}
            />
          </div>
        </>
      ) : (
        <>
          {/* ── Role Selector ────────────────────────────── */}
          <div style={{ marginBottom: 12 }}>
            <Segmented
              value={selectedRole}
              onChange={setSelectedRole}
              options={[
                { value: 'manager',    label: 'Manager' },
                { value: 'supervisor', label: 'Supervisor' },
                { value: 'staff',      label: 'Staff' },
                { value: 'viewer',     label: 'Viewer' },
              ]}
              size="middle"
              style={{ background: COLORS.surface }}
            />
          </div>

          {/* ── Role Permission View (Collapse panels) ──── */}
          <RolePermissionView
            role={selectedRole}
            permTree={filteredTree}
            rolesData={rolesData}
            pendingChanges={pendingChanges}
            descriptions={descriptions}
            canEdit={canEdit}
            onToggle={handleToggle}
            onBulkAction={handleBulkAction}
          />
        </>
      )}

      {/* ── Role Summary Cards ────────────────────────── */}
      <div style={{
        marginTop: 16,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        {roleSummary.filter(({ role }) => role !== 'owner').map(({ role, count, added, removed }) => {
          const roleColor = {
            manager: COLORS.accent,
            supervisor: COLORS.purple,
            staff: COLORS.warning,
            viewer: COLORS.textMuted,
          }[role] || COLORS.text;
          const pct = Math.round((count / allPerms.length) * 100);
          const hasChanges = !!pendingChanges[role];

          return (
            <div
              key={role}
              style={{
                flex: '1 1 140px',
                background: COLORS.surface,
                borderRadius: 8,
                padding: '12px 14px',
                border: `1px solid ${hasChanges ? COLORS.warning : COLORS.borderLight}`,
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: roleColor }}>
                  {ROLE_LABELS[role]}
                </span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: hasChanges ? COLORS.warning : COLORS.text }}>
                  {count}/{allPerms.length}
                </span>
              </div>
              <Progress
                percent={pct}
                size="small"
                showInfo={false}
                strokeColor={roleColor}
                trailColor={COLORS.border}
                style={{ marginBottom: (added > 0 || removed > 0) ? 4 : 0 }}
              />
              {(added > 0 || removed > 0) && (
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  {added > 0 && <span style={{ color: '#22c55e', marginRight: 6 }}>+{added} เพิ่ม</span>}
                  {removed > 0 && <span style={{ color: '#ef4444' }}>-{removed} ลบ</span>}
                  <span style={{ color: COLORS.textMuted, marginLeft: 4 }}>(vs ค่าเริ่มต้น)</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Sticky Save Bar ──────────────────────────── */}
      {hasAnyChanges && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '12px 24px',
          background: COLORS.card,
          borderTop: `2px solid ${COLORS.warning}`,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
            {modifiedRolesCount} role{modifiedRolesCount > 1 ? 's' : ''} มีการเปลี่ยนแปลง
          </span>
          <Button
            icon={<X size={14} />}
            onClick={handleDiscard}
          >
            ยกเลิก
          </Button>
          <Button
            type="primary"
            icon={<Save size={14} />}
            loading={saving}
            onClick={handleSaveAll}
          >
            บันทึก ({modifiedRolesCount} roles)
          </Button>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────── */}
      <ChangePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={executeSave}
        pendingChanges={pendingChanges}
        rolesData={rolesData}
        descriptions={descriptions}
        saving={saving}
      />

      <CopyRoleModal
        open={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        onCopy={handleCopyRole}
      />

      <RoleCompareModal
        open={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        getRolePermSet={getRolePermSet}
        descriptions={descriptions}
        permTree={permTree}
      />
    </div>
  );
}
