/**
 * PermissionMatrixTable — Permission Matrix for 1 module
 *
 * Flat table: rows = permissions (grouped by resource),
 * columns = roles, cells = Checkbox
 */

import { useMemo } from 'react';
import { Table, Checkbox, Tag, Tooltip, Dropdown } from 'antd';
import { ChevronDown } from 'lucide-react';
import { COLORS } from '../../utils/constants';
import {
  ACTION_META, RESOURCE_META, ACTION_ORDER,
  getModulePermissions, getPermissionLabel,
} from '../../utils/permissionMeta';

// Owner excluded — always has all permissions, shown as info badge instead
const ROLE_ORDER = ['manager', 'supervisor', 'staff', 'viewer'];
const ROLE_LABELS = {
  manager: 'Manager', supervisor: 'Supervisor', staff: 'Staff', viewer: 'Viewer',
};

/**
 * Build bulk action dropdown items for a role column header.
 */
function buildBulkItems(role, moduleKey, onBulkAction) {
  return [
    { key: 'read',  label: 'เปิด Read ทั้งหมด',  onClick: () => onBulkAction(role, moduleKey, 'grant_read') },
    { key: 'all',   label: 'เปิดทั้งหมด',         onClick: () => onBulkAction(role, moduleKey, 'grant_all') },
    { type: 'divider' },
    { key: 'none',  label: 'ปิดทั้งหมด', danger: true, onClick: () => onBulkAction(role, moduleKey, 'revoke_all') },
  ];
}

export default function PermissionMatrixTable({
  moduleKey,
  permTree,
  rolesData,
  pendingChanges,
  descriptions,
  canEdit,
  onToggle,
  onBulkAction,
}) {
  // Flat list of permissions for this module
  const permissions = useMemo(
    () => getModulePermissions(permTree, moduleKey),
    [permTree, moduleKey],
  );

  // Track which resources have been seen for "first row" grouping
  const firstResourceRow = useMemo(() => {
    const seen = new Set();
    const result = {};
    for (const p of permissions) {
      if (!seen.has(p.resource)) {
        seen.add(p.resource);
        result[p.permission] = true;
      }
    }
    return result;
  }, [permissions]);

  // Helper: get the current perm set for a role (pending takes precedence)
  const getPermSet = (role) => {
    if (pendingChanges[role]) return pendingChanges[role];
    return new Set(rolesData[role] || []);
  };

  // Helper: did this specific perm change from original?
  const isChanged = (role, perm) => {
    if (!pendingChanges[role]) return false;
    const original = new Set(rolesData[role] || []);
    const current = pendingChanges[role];
    return original.has(perm) !== current.has(perm);
  };

  // ── Build columns ──────────────────────────────────────────
  const columns = useMemo(() => {
    const cols = [
      {
        title: 'Permission',
        key: 'permission',
        width: 340,
        fixed: 'left',
        render: (_, record) => {
          const { resource, action, permission } = record;
          const { resourceLabel, actionLabel, actionColor } = getPermissionLabel(resource, action);
          const isFirst = firstResourceRow[permission];
          const desc = descriptions[permission];

          return (
            <div style={{ paddingLeft: isFirst ? 0 : 24 }}>
              {isFirst && (
                <div style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: COLORS.text,
                  marginBottom: 2,
                }}>
                  {resourceLabel}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag
                  color={actionColor}
                  style={{
                    fontSize: 11,
                    lineHeight: '18px',
                    padding: '0 6px',
                    border: 'none',
                    minWidth: 52,
                    textAlign: 'center',
                  }}
                >
                  {actionLabel}
                </Tag>
                {desc && (
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                    {desc}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
    ];

    // Role columns (owner excluded — always has all permissions)
    for (const role of ROLE_ORDER) {
      cols.push({
        key: role,
        width: 100,
        align: 'center',
        title: () => {
          if (!canEdit) {
            return <span style={{ fontSize: 12 }}>{ROLE_LABELS[role]}</span>;
          }

          return (
            <Dropdown
              menu={{ items: buildBulkItems(role, moduleKey, onBulkAction) }}
              trigger={['click']}
            >
              <div style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                userSelect: 'none',
              }}>
                <span style={{ fontSize: 12 }}>{ROLE_LABELS[role]}</span>
                <ChevronDown size={10} color={COLORS.textMuted} />
              </div>
            </Dropdown>
          );
        },
        render: (_, record) => {
          const permSet = getPermSet(role);
          const checked = permSet.has(record.permission);
          const changed = isChanged(role, record.permission);

          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                borderRadius: 4,
                background: changed ? '#f59e0b18' : 'transparent',
                transition: 'background 0.2s',
              }}
            >
              <Checkbox
                checked={checked}
                disabled={!canEdit}
                onChange={(e) => onToggle(role, record.permission, e.target.checked)}
              />
            </div>
          );
        },
        onCell: (record) => {
          const changed = isChanged(role, record.permission);
          return {
            style: changed
              ? { background: '#f59e0b12' }
              : { cursor: canEdit ? 'pointer' : 'default' },
          };
        },
      });
    }

    return cols;
  }, [permTree, moduleKey, rolesData, pendingChanges, descriptions, canEdit, firstResourceRow, onToggle, onBulkAction]);

  return (
    <Table
      dataSource={permissions}
      columns={columns}
      rowKey="permission"
      size="small"
      pagination={false}
      scroll={{ x: 340 + 100 * 4 }}
      style={{ background: COLORS.card }}
      rowClassName={(record) => {
        return firstResourceRow[record.permission]
          ? 'perm-matrix-first-resource'
          : '';
      }}
    />
  );
}
