/**
 * RolePermissionView — Role-centric permission viewer
 *
 * Shows all permissions for ONE role, organized by module (Collapse panels).
 * Each panel: module icon + Thai label + granted/total badge + change indicator.
 * Within panel: permissions grouped by resource, each with checkbox + action tag.
 */

import { useMemo } from 'react';
import { Checkbox, Collapse, Tag, Badge, Tooltip, Dropdown } from 'antd';
import { ChevronDown } from 'lucide-react';
import { COLORS } from '../../utils/constants';
import {
  MODULE_META, MODULE_ORDER, ACTION_META, RESOURCE_META, ACTION_ORDER,
  getAllPermissionsGrouped, getModulePermCount,
} from '../../utils/permissionMeta';

// ── Bulk items per module panel ────────────────────────────────
function buildBulkItems(role, moduleKey, onBulkAction) {
  return [
    { key: 'read',  label: 'เปิด Read ทั้งหมด',  onClick: () => onBulkAction(role, moduleKey, 'grant_read') },
    { key: 'all',   label: 'เปิดทั้งหมด',         onClick: () => onBulkAction(role, moduleKey, 'grant_all') },
    { type: 'divider' },
    { key: 'none',  label: 'ปิดทั้งหมด', danger: true, onClick: () => onBulkAction(role, moduleKey, 'revoke_all') },
  ];
}

export default function RolePermissionView({
  role,
  permTree,
  rolesData,
  pendingChanges,
  descriptions,
  canEdit,
  onToggle,
  onBulkAction,
}) {
  // All permissions grouped by module (respects filteredTree for search)
  const grouped = useMemo(() => getAllPermissionsGrouped(permTree), [permTree]);

  // Current permission set for this role
  const getPermSet = () => {
    if (pendingChanges[role]) return pendingChanges[role];
    return new Set(rolesData[role] || []);
  };

  const isChanged = (perm) => {
    if (!pendingChanges[role]) return false;
    const original = new Set(rolesData[role] || []);
    return original.has(perm) !== pendingChanges[role].has(perm);
  };

  // Check if any perm in a module has changed
  const moduleHasChanges = (moduleKey) => {
    if (!pendingChanges[role]) return false;
    const perms = grouped[moduleKey];
    if (!perms) return false;
    const original = new Set(rolesData[role] || []);
    return perms.some((p) => original.has(p.permission) !== pendingChanges[role].has(p.permission));
  };

  const permSet = getPermSet();

  // ── Build Collapse items ──────────────────────────────────────
  const collapseItems = useMemo(() => {
    const modules = MODULE_ORDER.filter((m) => grouped[m]);

    return modules.map((mod) => {
      const meta = MODULE_META[mod] || { label: mod, icon: 'Package' };
      const perms = grouped[mod];
      const { granted, total } = getModulePermCount(permTree, mod, permSet);
      const hasChanges = moduleHasChanges(mod);

      // Group permissions by resource
      const byResource = {};
      for (const p of perms) {
        if (!byResource[p.resource]) byResource[p.resource] = [];
        byResource[p.resource].push(p);
      }

      return {
        key: mod,
        label: (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingRight: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>
                {meta.label}
              </span>
              <Tag
                style={{
                  fontSize: 11,
                  lineHeight: '18px',
                  padding: '0 6px',
                  border: 'none',
                  fontFamily: 'monospace',
                }}
                color={granted === total ? 'cyan' : granted > 0 ? 'default' : undefined}
              >
                {granted}/{total}
              </Tag>
              {hasChanges && (
                <Badge status="warning" />
              )}
            </div>
            {canEdit && (
              <Dropdown
                menu={{ items: buildBulkItems(role, mod, onBulkAction) }}
                trigger={['click']}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    fontSize: 11,
                    color: COLORS.textMuted,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: COLORS.surface,
                  }}
                >
                  <span>Bulk</span>
                  <ChevronDown size={10} />
                </div>
              </Dropdown>
            )}
          </div>
        ),
        children: (
          <div style={{ padding: '4px 0' }}>
            {Object.keys(byResource).map((resource) => {
              const resLabel = RESOURCE_META[resource] || resource;
              const resPerms = byResource[resource];

              return (
                <div key={resource} style={{ marginBottom: 12 }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: 12,
                    color: COLORS.textSecondary,
                    marginBottom: 4,
                    paddingLeft: 4,
                  }}>
                    {resLabel}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {resPerms.map((p) => {
                      const checked = permSet.has(p.permission);
                      const changed = isChanged(p.permission);
                      const actMeta = ACTION_META[p.action];
                      const desc = descriptions[p.permission];

                      return (
                        <div
                          key={p.permission}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: changed ? '#f59e0b18' : COLORS.surface,
                            border: `1px solid ${changed ? '#f59e0b40' : COLORS.borderLight}`,
                            minWidth: 160,
                            flex: '1 1 220px',
                            maxWidth: 360,
                            transition: 'background 0.2s, border-color 0.2s',
                          }}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={!canEdit}
                            onChange={(e) => onToggle(role, p.permission, e.target.checked)}
                          />
                          <Tag
                            color={actMeta?.color}
                            style={{
                              fontSize: 10,
                              lineHeight: '16px',
                              padding: '0 5px',
                              border: 'none',
                              minWidth: 44,
                              textAlign: 'center',
                            }}
                          >
                            {actMeta?.label || p.action}
                          </Tag>
                          {desc ? (
                            <Tooltip title={p.permission} placement="topLeft">
                              <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                                {desc}
                              </span>
                            </Tooltip>
                          ) : (
                            <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                              {p.permission}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ),
      };
    });
  }, [grouped, permTree, permSet, pendingChanges, role, rolesData, descriptions, canEdit, onToggle, onBulkAction]);

  // Default expand first 3 modules
  const defaultActiveKeys = useMemo(() => {
    return MODULE_ORDER.filter((m) => grouped[m]).slice(0, 3);
  }, [grouped]);

  return (
    <div style={{
      background: COLORS.card,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <Collapse
        items={collapseItems}
        defaultActiveKey={defaultActiveKeys}
        style={{ background: 'transparent' }}
        bordered={false}
      />
    </div>
  );
}
