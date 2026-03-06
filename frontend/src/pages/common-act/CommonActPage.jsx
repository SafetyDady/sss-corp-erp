import { useState, useEffect } from 'react';
import { Tabs, Row, Col } from 'antd';
import {
  ClipboardList, ShoppingCart, Wrench, FileText, CalendarOff, CalendarCheck,
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { COLORS } from '../../utils/constants';
import { usePermission } from '../../hooks/usePermission';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import dayjs from 'dayjs';

import WithdrawalSlipTab from '../supply-chain/WithdrawalSlipTab';
import PRTab from '../purchasing/PRTab';
import ToolListPage from '../tools/ToolListPage';
import MyDailyReportPage from '../my/MyDailyReportPage';
import MyLeavePage from '../my/MyLeavePage';
import MyTasksPage from '../my/MyTasksPage';

/**
 * CommonActPage — ศูนย์ดำเนินการ (Staff Actions Hub)
 * ใช้สำหรับสร้าง request ต่างๆ: เบิกของ, PR, เครื่องมือ, รายงาน, ลา, งาน
 * ไม่ต้องไปยุ่ง Store หรือ Supply Chain page
 */
export default function CommonActPage() {
  const { can } = usePermission();
  const employeeId = useAuthStore((s) => s.employeeId);
  const [stats, setStats] = useState({ mySlips: 0, myPrs: 0, checkedOutTools: 0, todayReport: 0 });

  useEffect(() => {
    if (!employeeId) return;
    const fetchStats = async () => {
      try {
        const today = dayjs().format('YYYY-MM-DD');
        const requests = [];
        const keys = [];

        // My withdrawal slips count
        if (can('inventory.withdrawal.read')) {
          requests.push(api.get('/api/inventory/withdrawal-slips', { params: { limit: 1, offset: 0 } }));
          keys.push('mySlips');
        }
        // My PRs count
        if (can('purchasing.pr.read')) {
          requests.push(api.get('/api/purchasing/pr', { params: { limit: 1, offset: 0 } }));
          keys.push('myPrs');
        }
        // Checked out tools
        if (can('tools.tool.read')) {
          requests.push(api.get('/api/tools', { params: { limit: 1, offset: 0 } }));
          keys.push('checkedOutTools');
        }
        // Today's daily report
        if (can('hr.dailyreport.read')) {
          requests.push(api.get('/api/daily-report', {
            params: { date_from: today, date_to: today, limit: 1, employee_id: employeeId },
          }));
          keys.push('todayReport');
        }

        const results = await Promise.allSettled(requests);
        const newStats = { ...stats };
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            newStats[keys[i]] = r.value.data?.total || 0;
          }
        });
        setStats(newStats);
      } catch {
        /* ignore */
      }
    };
    fetchStats();
  }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabItems = [];

  if (can('inventory.withdrawal.read') || can('inventory.withdrawal.create')) {
    tabItems.push({
      key: 'withdrawal',
      label: (
        <span><ClipboardList size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />ใบเบิกของ</span>
      ),
      children: <WithdrawalSlipTab staffMode />,
    });
  }

  if (can('purchasing.pr.read') || can('purchasing.pr.create')) {
    tabItems.push({
      key: 'pr',
      label: (
        <span><ShoppingCart size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />ใบขอซื้อ (PR)</span>
      ),
      children: <PRTab />,
    });
  }

  if (can('tools.tool.read') || can('tools.tool.execute')) {
    tabItems.push({
      key: 'tools',
      label: (
        <span><Wrench size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />เครื่องมือ</span>
      ),
      children: <ToolListPage embedded myCheckoutsMode />,
    });
  }

  if (can('hr.dailyreport.read') || can('hr.dailyreport.create')) {
    tabItems.push({
      key: 'daily-report',
      label: (
        <span><FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />รายงานประจำวัน</span>
      ),
      children: <MyDailyReportPage embedded />,
    });
  }

  if (can('hr.leave.read') || can('hr.leave.create')) {
    tabItems.push({
      key: 'leave',
      label: (
        <span><CalendarOff size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />ขอลา</span>
      ),
      children: <MyLeavePage embedded />,
    });
  }

  if (can('workorder.plan.read')) {
    tabItems.push({
      key: 'tasks',
      label: (
        <span><CalendarCheck size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />งานของฉัน</span>
      ),
      children: <MyTasksPage embedded />,
    });
  }

  return (
    <div>
      <PageHeader title="ดำเนินการ" subtitle="Requests & Actions" />

      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {can('inventory.withdrawal.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="ใบเบิกของฉัน"
              value={stats.mySlips}
              subtitle="Withdrawal Slips"
              icon={<ClipboardList size={20} />}
              color={COLORS.accent}
            />
          </Col>
        )}
        {can('purchasing.pr.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="PR ของฉัน"
              value={stats.myPrs}
              subtitle="Purchase Requisitions"
              icon={<ShoppingCart size={20} />}
              color={COLORS.success}
            />
          </Col>
        )}
        {can('tools.tool.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="เครื่องมือ"
              value={stats.checkedOutTools}
              subtitle="Tools"
              icon={<Wrench size={20} />}
              color={COLORS.warning}
            />
          </Col>
        )}
        {can('hr.dailyreport.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="รายงานวันนี้"
              value={stats.todayReport > 0 ? 'กรอกแล้ว' : 'ยังไม่กรอก'}
              icon={<FileText size={20} />}
              color={stats.todayReport > 0 ? COLORS.success : COLORS.warning}
            />
          </Col>
        )}
      </Row>

      <Tabs defaultActiveKey={tabItems[0]?.key} type="card" items={tabItems} destroyOnHidden />
    </div>
  );
}
