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
};

// Module display order (matches sidebar)
export const MODULE_ORDER = [
  'inventory', 'warehouse', 'workorder', 'purchasing', 'sales',
  'finance', 'master', 'admin', 'customer', 'tools', 'hr',
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
