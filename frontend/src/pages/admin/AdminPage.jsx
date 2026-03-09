import { Tabs } from 'antd';
import { Users, Shield, FileText, Settings, LayoutGrid, Clock, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { usePermission } from '../../hooks/usePermission';
import UserTab from './UserTab';
import RoleTab from './RoleTab';
import AuditLogTab from './AuditLogTab';
import OrgSettingsTab from './OrgSettingsTab';
import DeptMenuConfigTab from './DeptMenuConfigTab';
import SecurityPolicyTab from './SecurityPolicyTab';
import LoginHistoryTab from './LoginHistoryTab';
import { COLORS } from '../../utils/constants';

const tabLabel = (Icon, text) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
    <Icon size={15} /> {text}
  </span>
);

export default function AdminPage() {
  const { can } = usePermission();

  const items = [
    can('admin.user.read') && {
      key: 'users',
      label: tabLabel(Users, 'ผู้ใช้งาน'),
      children: <UserTab />,
    },
    can('admin.role.read') && {
      key: 'roles',
      label: tabLabel(Shield, 'บทบาท & สิทธิ์'),
      children: <RoleTab />,
    },
    can('admin.config.read') && {
      key: 'org-settings',
      label: tabLabel(Settings, 'ตั้งค่าองค์กร'),
      children: <OrgSettingsTab />,
    },
    can('admin.config.read') && {
      key: 'dept-menu',
      label: tabLabel(LayoutGrid, 'เมนูแผนก'),
      children: <DeptMenuConfigTab />,
    },
    can('admin.config.read') && {
      key: 'security',
      label: tabLabel(ShieldCheck, 'นโยบายความปลอดภัย'),
      children: <SecurityPolicyTab />,
    },
    can('admin.user.read') && {
      key: 'login-history',
      label: tabLabel(Clock, 'ประวัติเข้าระบบ'),
      children: <LoginHistoryTab />,
    },
    can('admin.role.read') && {
      key: 'audit',
      label: tabLabel(FileText, 'Audit Log'),
      children: <AuditLogTab />,
    },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="จัดการผู้ใช้งาน, บทบาท, สิทธิ์, ตั้งค่าองค์กร, และ Audit Log"
      />
      {items.length > 0 ? (
        <Tabs defaultActiveKey={items[0]?.key} items={items} destroyOnHidden />
      ) : (
        <div style={{ textAlign: 'center', padding: 48, color: COLORS.textMuted }}>
          คุณไม่มีสิทธิ์เข้าถึงหน้า Admin
        </div>
      )}
    </div>
  );
}
