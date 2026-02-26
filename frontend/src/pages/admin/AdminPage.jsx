import { Tabs } from 'antd';
import { Users, Shield, FileText } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { usePermission } from '../../hooks/usePermission';
import UserTab from './UserTab';
import RoleTab from './RoleTab';
import AuditLogTab from './AuditLogTab';
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
        subtitle="จัดการผู้ใช้งาน, บทบาท, สิทธิ์, และ Audit Log"
      />
      {items.length > 0 ? (
        <Tabs defaultActiveKey={items[0]?.key} items={items} />
      ) : (
        <div style={{ textAlign: 'center', padding: 48, color: COLORS.textMuted }}>
          คุณไม่มีสิทธิ์เข้าถึงหน้า Admin
        </div>
      )}
    </div>
  );
}
