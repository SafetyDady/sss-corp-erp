/**
 * Permission Metadata — Module/Resource/Action hierarchy + Thai labels
 * Used by RoleTab.jsx for the improved permission management UI
 */

// ============================================================
// MODULE_META — Thai name + Lucide icon per module
// ============================================================

export const MODULE_META = {
  inventory:  { label: 'คลังสินค้า',      icon: 'Package' },
  warehouse:  { label: 'คลังเก็บของ',     icon: 'Warehouse' },
  workorder:  { label: 'ใบสั่งงาน',       icon: 'FileText' },
  purchasing: { label: 'จัดซื้อ',         icon: 'ShoppingCart' },
  sales:      { label: 'การขาย',          icon: 'DollarSign' },
  finance:    { label: 'การเงิน',         icon: 'BarChart3' },
  master:     { label: 'ข้อมูลหลัก',      icon: 'Database' },
  admin:      { label: 'ผู้ดูแลระบบ',     icon: 'Settings' },
  customer:   { label: 'ลูกค้า',          icon: 'UserCheck' },
  tools:      { label: 'เครื่องมือ',       icon: 'Wrench' },
  hr:         { label: 'ทรัพยากรบุคคล',   icon: 'Users' },
  asset:      { label: 'สินทรัพย์ถาวร',   icon: 'Landmark' },
};

// Module display order (matches sidebar)
export const MODULE_ORDER = [
  'inventory', 'warehouse', 'workorder', 'purchasing', 'sales',
  'finance', 'master', 'admin', 'customer', 'tools', 'hr', 'asset',
];

// ============================================================
// RESOURCE_META — Thai name per resource
// ============================================================

export const RESOURCE_META = {
  product:     'สินค้า/วัตถุดิบ',
  movement:    'รายการเคลื่อนไหว',
  warehouse:   'คลังสินค้า',
  zone:        'โซน',
  location:    'ตำแหน่งจัดเก็บ',
  order:       'ใบสั่ง',
  plan:        'แผนงาน',
  reservation: 'การจอง',
  pr:          'ใบขอซื้อ (PR)',
  po:          'ใบสั่งซื้อ (PO)',
  report:      'รายงาน',
  costcenter:  'Cost Center',
  costelement: 'Cost Element',
  ottype:      'ประเภท OT',
  department:  'แผนก',
  leavetype:   'ประเภทการลา',
  role:        'บทบาท',
  user:        'ผู้ใช้งาน',
  config:      'การตั้งค่า',
  customer:    'ลูกค้า',
  tool:        'เครื่องมือ',
  employee:    'พนักงาน',
  timesheet:   'Timesheet',
  payroll:     'Payroll',
  leave:       'การลา',
  dailyreport: 'รายงานประจำวัน',
  shifttype:   'ประเภทกะ',
  schedule:    'ตารางกะ',
  roster:      'ตารางเข้ากะ',
  supplier:    'ซัพพลายเออร์',
  whttype:     'ประเภทหัก ณ ที่จ่าย',
  withdrawal:  'ใบเบิกของ',
  recharge:    'Internal Recharge',
  invoice:     'ใบวางบิล (Invoice)',
  ar:          'ลูกหนี้ (AR)',
  delivery:    'ใบส่งของ (DO)',
  category:    'หมวดสินทรัพย์',
  asset:       'สินทรัพย์ถาวร',
  depreciation: 'ค่าเสื่อมราคา',
};

// ============================================================
// ACTION_META — icon + color + Thai label per action
// ============================================================

export const ACTION_META = {
  create:  { label: 'สร้าง',    icon: 'Plus',     color: '#10b981' },
  read:    { label: 'ดู',       icon: 'Eye',      color: '#06b6d4' },
  update:  { label: 'แก้ไข',    icon: 'Pencil',   color: '#f59e0b' },
  delete:  { label: 'ลบ',       icon: 'Trash2',   color: '#ef4444' },
  approve: { label: 'อนุมัติ',   icon: 'Check',    color: '#8b5cf6' },
  export:  { label: 'ส่งออก',   icon: 'Download', color: '#06b6d4' },
  execute: { label: 'ดำเนินการ', icon: 'Play',     color: '#f59e0b' },
};

export const ACTION_ORDER = ['create', 'read', 'update', 'delete', 'approve', 'export', 'execute'];

// ============================================================
// buildPermissionTree — flat list → module → resource → actions
// ============================================================

/**
 * Convert flat permission list to hierarchical tree
 * @param {string[]} allPerms - e.g. ["inventory.product.create", ...]
 * @returns {Object} tree[module][resource][action] = "full.perm.string"
 */
export function buildPermissionTree(allPerms) {
  const tree = {};
  allPerms.forEach((perm) => {
    const [mod, resource, action] = perm.split('.');
    if (!tree[mod]) tree[mod] = {};
    if (!tree[mod][resource]) tree[mod][resource] = {};
    tree[mod][resource][action] = perm;
  });
  return tree;
}

// ============================================================
// getModulePermissions — flat array of permissions for 1 module
// ============================================================

/**
 * Get a flat array of permission objects for a module, ordered by resource then ACTION_ORDER.
 * @param {Object} permTree - tree from buildPermissionTree()
 * @param {string} moduleKey - e.g. 'inventory'
 * @returns {Array<{permission: string, module: string, resource: string, action: string}>}
 */
export function getModulePermissions(permTree, moduleKey) {
  const modData = permTree[moduleKey];
  if (!modData) return [];

  const result = [];
  const resources = Object.keys(modData);
  // Sort resources alphabetically for consistency
  resources.sort();

  for (const resource of resources) {
    for (const action of ACTION_ORDER) {
      if (modData[resource][action]) {
        result.push({
          permission: modData[resource][action],
          module: moduleKey,
          resource,
          action,
        });
      }
    }
  }
  return result;
}

// ============================================================
// getPermissionLabel — Thai label + color for resource/action
// ============================================================

/**
 * Get display labels for a permission's resource and action.
 * @param {string} resource - e.g. 'product'
 * @param {string} action - e.g. 'create'
 * @returns {{resourceLabel: string, actionLabel: string, actionColor: string}}
 */
export function getPermissionLabel(resource, action) {
  const actMeta = ACTION_META[action];
  return {
    resourceLabel: RESOURCE_META[resource] || resource,
    actionLabel: actMeta?.label || action,
    actionColor: actMeta?.color || '#888',
  };
}

// ============================================================
// getModulePermCount — granted/total count for badge display
// ============================================================

/**
 * Count how many permissions in a module are granted from a Set.
 * @param {Object} permTree - tree from buildPermissionTree()
 * @param {string} moduleKey - e.g. 'inventory'
 * @param {Set<string>} permSet - set of granted permission strings
 * @returns {{granted: number, total: number}}
 */
export function getModulePermCount(permTree, moduleKey, permSet) {
  const modData = permTree[moduleKey];
  if (!modData) return { granted: 0, total: 0 };

  let granted = 0;
  let total = 0;
  for (const resource of Object.keys(modData)) {
    for (const action of Object.keys(modData[resource])) {
      total++;
      if (permSet.has(modData[resource][action])) granted++;
    }
  }
  return { granted, total };
}
