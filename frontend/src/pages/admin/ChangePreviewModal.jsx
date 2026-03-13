/**
 * ChangePreviewModal — Review permission changes before saving
 *
 * Shows added/removed permissions per role, grouped by module.
 * Prevents accidental saves by requiring explicit confirmation.
 */

import { useMemo } from 'react';
import { Modal, Button, Tag, Empty, Collapse } from 'antd';
import { Save, Plus, Minus } from 'lucide-react';
import { COLORS } from '../../utils/constants';
import {
  MODULE_META, MODULE_ORDER, ACTION_META, RESOURCE_META,
} from '../../utils/permissionMeta';

const ROLE_LABELS = {
  manager: 'Manager', supervisor: 'Supervisor', staff: 'Staff', viewer: 'Viewer',
};
const ROLE_COLORS = {
  manager: COLORS.accent,
  supervisor: COLORS.purple,
  staff: COLORS.warning,
  viewer: COLORS.textMuted,
};

export default function ChangePreviewModal({
  open,
  onClose,
  onConfirm,
  pendingChanges,
  rolesData,
  descriptions,
  saving,
}) {
  // Build diff per role, grouped by module
  const changesByRole = useMemo(() => {
    const result = [];

    for (const role of Object.keys(pendingChanges)) {
      const original = new Set(rolesData[role] || []);
      const current = pendingChanges[role];

      const added = [];
      const removed = [];

      for (const perm of current) {
        if (!original.has(perm)) added.push(perm);
      }
      for (const perm of original) {
        if (!current.has(perm)) removed.push(perm);
      }

      if (added.length === 0 && removed.length === 0) continue;

      // Group by module
      const groupByModule = (perms) => {
        const groups = {};
        for (const perm of perms) {
          const [mod] = perm.split('.');
          if (!groups[mod]) groups[mod] = [];
          groups[mod].push(perm);
        }
        return groups;
      };

      result.push({
        role,
        added: groupByModule(added),
        removed: groupByModule(removed),
        addedCount: added.length,
        removedCount: removed.length,
      });
    }

    return result;
  }, [pendingChanges, rolesData]);

  const totalChanges = changesByRole.reduce(
    (sum, r) => sum + r.addedCount + r.removedCount,
    0,
  );

  const renderPermItem = (perm, type) => {
    const parts = perm.split('.');
    const action = parts[2];
    const resource = parts[1];
    const actMeta = ACTION_META[action];
    const resLabel = RESOURCE_META[resource] || resource;
    const desc = descriptions[perm];
    const isAdd = type === 'add';

    return (
      <div
        key={perm}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderLeft: `3px solid ${isAdd ? '#22c55e' : '#ef4444'}`,
          borderRadius: '0 4px 4px 0',
          background: isAdd ? '#22c55e0a' : '#ef44440a',
          marginBottom: 4,
        }}
      >
        {isAdd
          ? <Plus size={12} color="#22c55e" />
          : <Minus size={12} color="#ef4444" />
        }
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
          {actMeta?.label || action}
        </Tag>
        <span style={{ fontSize: 12, color: COLORS.text }}>{resLabel}</span>
        {desc && (
          <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 4 }}>
            — {desc}
          </span>
        )}
      </div>
    );
  };

  const renderModuleGroup = (perms, type) => {
    const sortedModules = MODULE_ORDER.filter((m) => perms[m]);
    return sortedModules.map((mod) => {
      const meta = MODULE_META[mod] || { label: mod };
      return (
        <div key={mod} style={{ marginBottom: 8 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: COLORS.textSecondary,
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {meta.label}
          </div>
          {perms[mod].map((p) => renderPermItem(p, type))}
        </div>
      );
    });
  };

  const collapseItems = changesByRole.map((item) => ({
    key: item.role,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600, color: ROLE_COLORS[item.role] || COLORS.text }}>
          {ROLE_LABELS[item.role] || item.role}
        </span>
        {item.addedCount > 0 && (
          <Tag color="success" style={{ fontSize: 11, border: 'none' }}>
            +{item.addedCount}
          </Tag>
        )}
        {item.removedCount > 0 && (
          <Tag color="error" style={{ fontSize: 11, border: 'none' }}>
            -{item.removedCount}
          </Tag>
        )}
      </div>
    ),
    children: (
      <div>
        {item.addedCount > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#22c55e',
              marginBottom: 6,
            }}>
              เพิ่มสิทธิ์ ({item.addedCount})
            </div>
            {renderModuleGroup(item.added, 'add')}
          </div>
        )}
        {item.removedCount > 0 && (
          <div>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#ef4444',
              marginBottom: 6,
            }}>
              ลบสิทธิ์ ({item.removedCount})
            </div>
            {renderModuleGroup(item.removed, 'remove')}
          </div>
        )}
      </div>
    ),
  }));

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="ตรวจสอบการเปลี่ยนแปลงก่อนบันทึก"
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose}>
          ยกเลิก
        </Button>,
        <Button
          key="confirm"
          type="primary"
          icon={<Save size={14} />}
          loading={saving}
          onClick={onConfirm}
        >
          ยืนยันบันทึก ({changesByRole.length} roles)
        </Button>,
      ]}
    >
      {changesByRole.length === 0 ? (
        <Empty description="ไม่มีการเปลี่ยนแปลง" />
      ) : (
        <>
          <div style={{
            padding: '8px 12px',
            marginBottom: 12,
            background: COLORS.surface,
            borderRadius: 6,
            border: `1px solid ${COLORS.borderLight}`,
            fontSize: 12,
            color: COLORS.textSecondary,
          }}>
            ทั้งหมด {totalChanges} การเปลี่ยนแปลง ใน {changesByRole.length} role{changesByRole.length > 1 ? 's' : ''}
          </div>
          <Collapse
            items={collapseItems}
            defaultActiveKey={changesByRole.map((r) => r.role)}
            style={{ background: 'transparent' }}
            bordered={false}
          />
        </>
      )}
    </Modal>
  );
}
