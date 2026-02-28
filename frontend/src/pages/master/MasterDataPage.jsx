import { Tabs } from 'antd';
import { Building2, Layers, Clock, Network, CalendarOff } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { usePermission } from '../../hooks/usePermission';
import CostCenterTab from './CostCenterTab';
import CostElementTab from './CostElementTab';
import OTTypeTab from './OTTypeTab';
import DepartmentTab from './DepartmentTab';
import LeaveTypeTab from './LeaveTypeTab';
import { COLORS } from '../../utils/constants';

const tabLabel = (Icon, text) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
    <Icon size={15} /> {text}
  </span>
);

export default function MasterDataPage() {
  const { can } = usePermission();

  const items = [
    can('master.department.read') && {
      key: 'departments',
      label: tabLabel(Network, 'แผนก'),
      children: <DepartmentTab />,
    },
    can('master.costcenter.read') && {
      key: 'cost-centers',
      label: tabLabel(Building2, 'ศูนย์ต้นทุน'),
      children: <CostCenterTab />,
    },
    can('master.costelement.read') && {
      key: 'cost-elements',
      label: tabLabel(Layers, 'องค์ประกอบต้นทุน'),
      children: <CostElementTab />,
    },
    can('master.ottype.read') && {
      key: 'ot-types',
      label: tabLabel(Clock, 'ประเภท OT'),
      children: <OTTypeTab />,
    },
    can('master.leavetype.read') && {
      key: 'leave-types',
      label: tabLabel(CalendarOff, 'ประเภทลา'),
      children: <LeaveTypeTab />,
    },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="Master Data"
        subtitle="ข้อมูลหลัก — แผนก, ศูนย์ต้นทุน, องค์ประกอบต้นทุน, ประเภท OT, ประเภทลา"
      />
      {items.length > 0 ? (
        <Tabs defaultActiveKey={items[0]?.key} items={items} destroyOnHidden />
      ) : (
        <div style={{ textAlign: 'center', padding: 48, color: COLORS.textMuted }}>
          คุณไม่มีสิทธิ์เข้าถึงข้อมูลหลัก
        </div>
      )}
    </div>
  );
}
