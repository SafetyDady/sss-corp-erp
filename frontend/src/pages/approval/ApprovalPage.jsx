import { useState, useEffect, useCallback } from 'react';
import { Tabs, Badge } from 'antd';
import { FileText, Clock, CalendarDays, ShoppingCart, DollarSign } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import ScopeBadge from '../../components/ScopeBadge';
import { usePermission } from '../../hooks/usePermission';
import { COLORS } from '../../utils/constants';
import api from '../../services/api';

// Reuse existing
import DailyReportApprovalTab from '../hr/DailyReportApprovalTab';

// New tabs
import TimesheetApprovalTab from './TimesheetApprovalTab';
import LeaveApprovalTab from './LeaveApprovalTab';
import POApprovalTab from './POApprovalTab';
import SOApprovalTab from './SOApprovalTab';

const tabLabel = (Icon, text, count) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
    <Icon size={15} />
    {text}
    {count > 0 && (
      <Badge
        count={count}
        size="small"
        style={{ backgroundColor: COLORS.accent }}
      />
    )}
  </span>
);

export default function ApprovalPage() {
  const { can } = usePermission();
  const [counts, setCounts] = useState({
    daily: 0,
    timesheet: 0,
    leave: 0,
    po: 0,
    so: 0,
  });

  const fetchCounts = useCallback(async () => {
    try {
      const [daily, ts, leave, po, so] = await Promise.all([
        can('hr.dailyreport.approve')
          ? api.get('/api/daily-report', { params: { status: 'SUBMITTED', limit: 1 } })
          : { data: { total: 0 } },
        can('hr.timesheet.approve')
          ? api.get('/api/hr/timesheet', { params: { status: 'SUBMITTED', limit: 1 } })
          : { data: { total: 0 } },
        can('hr.leave.approve')
          ? api.get('/api/hr/leave', { params: { status: 'PENDING', limit: 1 } })
          : { data: { total: 0 } },
        can('purchasing.po.approve')
          ? api.get('/api/purchasing/po', { params: { status: 'SUBMITTED', limit: 1 } })
          : { data: { total: 0 } },
        can('sales.order.approve')
          ? api.get('/api/sales/orders', { params: { status: 'SUBMITTED', limit: 1 } })
          : { data: { total: 0 } },
      ]);
      setCounts({
        daily: daily.data.total || 0,
        timesheet: ts.data.total || 0,
        leave: leave.data.total || 0,
        po: po.data.total || 0,
        so: so.data.total || 0,
      });
    } catch {
      /* ignore */
    }
  }, [can]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const items = [
    can('hr.dailyreport.approve') && {
      key: 'daily-report',
      label: tabLabel(FileText, 'รายงานประจำวัน', counts.daily),
      children: <DailyReportApprovalTab />,
    },
    can('hr.timesheet.approve') && {
      key: 'timesheet',
      label: tabLabel(Clock, 'Timesheet', counts.timesheet),
      children: <TimesheetApprovalTab onAction={fetchCounts} />,
    },
    can('hr.leave.approve') && {
      key: 'leave',
      label: tabLabel(CalendarDays, 'ลาหยุด', counts.leave),
      children: <LeaveApprovalTab onAction={fetchCounts} />,
    },
    can('purchasing.po.approve') && {
      key: 'po',
      label: tabLabel(ShoppingCart, 'ใบสั่งซื้อ', counts.po),
      children: <POApprovalTab onAction={fetchCounts} />,
    },
    can('sales.order.approve') && {
      key: 'so',
      label: tabLabel(DollarSign, 'ใบสั่งขาย', counts.so),
      children: <SOApprovalTab onAction={fetchCounts} />,
    },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="My Approval"
        subtitle={<span>ศูนย์อนุมัติรวม <ScopeBadge /></span>}
      />
      {items.length > 0 ? (
        <Tabs defaultActiveKey={items[0]?.key} items={items} destroyInactiveTabPane />
      ) : (
        <div style={{ textAlign: 'center', padding: 48, color: COLORS.textMuted }}>
          ไม่มีรายการที่ต้องอนุมัติ
        </div>
      )}
    </div>
  );
}
