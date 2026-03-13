/**
 * RoleCompareModal — Compare permissions between 2 roles
 *
 * 3 sections: Only in Role A, Only in Role B, Shared (collapsed by default).
 * Read-only — for comparison purposes only.
 */

import { useState, useMemo } from 'react';
import { Modal, Select, Collapse, Tag, Empty } from 'antd';
import { GitCompareArrows } from 'lucide-react';
import { COLORS } from '../../utils/constants';
import {
  MODULE_META, MODULE_ORDER, ACTION_META, RESOURCE_META,
} from '../../utils/permissionMeta';

const ROLES = ['manager', 'supervisor', 'staff', 'viewer'];
const ROLE_LABELS = {
  manager: 'Manager', supervisor: 'Supervisor', staff: 'Staff', viewer: 'Viewer',
};
const ROLE_COLORS = {
  manager: COLORS.accent,
  supervisor: COLORS.purple,
  staff: COLORS.warning,
  viewer: COLORS.textMuted,
};

// Group a list of permission strings by module
function groupByModule(perms) {
  const groups = {};
  for (const perm of perms) {
    const [mod] = perm.split('.');
    if (!groups[mod]) groups[mod] = [];
    groups[mod].push(perm);
  }
  return groups;
}

export default function RoleCompareModal({
  open,
  onClose,
  getRolePermSet,
  descriptions,
  permTree,
}) {
  const [roleA, setRoleA] = useState('manager');
  const [roleB, setRoleB] = useState('supervisor');

  const comparison = useMemo(() => {
    const setA = getRolePermSet(roleA);
    const setB = getRolePermSet(roleB);

    const onlyA = [];
    const onlyB = [];
    const shared = [];

    for (const perm of setA) {
      if (setB.has(perm)) {
        shared.push(perm);
      } else {
        onlyA.push(perm);
      }
    }
    for (const perm of setB) {
      if (!setA.has(perm)) {
        onlyB.push(perm);
      }
    }

    // Sort each list by module order
    const sortPerms = (arr) => arr.sort((a, b) => {
      const modA = MODULE_ORDER.indexOf(a.split('.')[0]);
      const modB = MODULE_ORDER.indexOf(b.split('.')[0]);
      if (modA !== modB) return modA - modB;
      return a.localeCompare(b);
    });

    return {
      onlyA: sortPerms(onlyA),
      onlyB: sortPerms(onlyB),
      shared: sortPerms(shared),
      countA: setA.size,
      countB: setB.size,
      diffCount: onlyA.length + onlyB.length,
    };
  }, [roleA, roleB, getRolePermSet]);

  const renderPermList = (perms, borderColor) => {
    const byModule = groupByModule(perms);
    const sortedModules = MODULE_ORDER.filter((m) => byModule[m]);

    if (sortedModules.length === 0) {
      return <Empty description="ไม่มีรายการ" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return sortedModules.map((mod) => {
      const meta = MODULE_META[mod] || { label: mod };
      return (
        <div key={mod} style={{ marginBottom: 10 }}>
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
          {byModule[mod].map((perm) => {
            const parts = perm.split('.');
            const action = parts[2];
            const resource = parts[1];
            const actMeta = ACTION_META[action];
            const resLabel = RESOURCE_META[resource] || resource;
            const desc = descriptions[perm];

            return (
              <div
                key={perm}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 8px',
                  borderLeft: `3px solid ${borderColor}`,
                  borderRadius: '0 4px 4px 0',
                  marginBottom: 3,
                  background: `${borderColor}08`,
                }}
              >
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
          })}
        </div>
      );
    });
  };

  const roleOptions = ROLES.map((r) => ({
    value: r,
    label: ROLE_LABELS[r],
  }));

  const collapseItems = [
    {
      key: 'onlyA',
      label: (
        <span style={{ color: ROLE_COLORS[roleA] || COLORS.text }}>
          เฉพาะ {ROLE_LABELS[roleA]} ({comparison.onlyA.length})
        </span>
      ),
      children: renderPermList(comparison.onlyA, ROLE_COLORS[roleA] || '#22c55e'),
    },
    {
      key: 'onlyB',
      label: (
        <span style={{ color: ROLE_COLORS[roleB] || COLORS.text }}>
          เฉพาะ {ROLE_LABELS[roleB]} ({comparison.onlyB.length})
        </span>
      ),
      children: renderPermList(comparison.onlyB, ROLE_COLORS[roleB] || '#ef4444'),
    },
    {
      key: 'shared',
      label: (
        <span style={{ color: COLORS.textSecondary }}>
          สิทธิ์ร่วมกัน ({comparison.shared.length})
        </span>
      ),
      children: renderPermList(comparison.shared, COLORS.border),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitCompareArrows size={16} color={COLORS.accent} />
          เปรียบเทียบสิทธิ์
        </span>
      }
      footer={null}
      width={680}
    >
      {/* Role selectors */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 16,
        alignItems: 'center',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>
            Role A
          </div>
          <Select
            value={roleA}
            onChange={setRoleA}
            options={roleOptions}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{
          fontSize: 12,
          color: COLORS.textMuted,
          paddingTop: 18,
        }}>
          vs
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>
            Role B
          </div>
          <Select
            value={roleB}
            onChange={setRoleB}
            options={roleOptions}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: '8px 12px',
        marginBottom: 12,
        background: COLORS.surface,
        borderRadius: 6,
        border: `1px solid ${COLORS.borderLight}`,
        fontSize: 12,
        color: COLORS.textSecondary,
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <span>
          <span style={{ color: ROLE_COLORS[roleA], fontWeight: 600 }}>{ROLE_LABELS[roleA]}</span>: {comparison.countA} สิทธิ์
        </span>
        <span>
          <span style={{ color: ROLE_COLORS[roleB], fontWeight: 600 }}>{ROLE_LABELS[roleB]}</span>: {comparison.countB} สิทธิ์
        </span>
        <span>
          ต่างกัน: <strong style={{ color: COLORS.warning }}>{comparison.diffCount}</strong> รายการ
        </span>
      </div>

      {/* Diff sections */}
      {roleA === roleB ? (
        <Empty description="กรุณาเลือก role ที่ต่างกัน" />
      ) : (
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <Collapse
            items={collapseItems}
            defaultActiveKey={['onlyA', 'onlyB']}
            style={{ background: 'transparent' }}
            bordered={false}
          />
        </div>
      )}
    </Modal>
  );
}
