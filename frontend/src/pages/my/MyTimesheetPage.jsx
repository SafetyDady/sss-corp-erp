import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Table, Typography, App, Select } from 'antd';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from 'antd';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

/**
 * MyTimesheetPage — Timesheet ของฉัน (read-only)
 * Route: /my/timesheet
 */
export default function MyTimesheetPage({ embedded = false }) {
  const { message } = App.useApp();
  const employeeId = useAuthStore((s) => s.employeeId);

  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [stdTimesheets, setStdTimesheets] = useState([]);
  const [woEntries, setWoEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const periodStart = currentMonth.format('YYYY-MM-DD');
  const periodEnd = currentMonth.endOf('month').format('YYYY-MM-DD');

  const loadData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const [stdRes, woRes] = await Promise.all([
        api
          .get('/api/hr/standard-timesheet', {
            params: { employee_id: employeeId, period_start: periodStart, period_end: periodEnd, limit: 50, offset: 0 },
          })
          .catch(() => ({ data: { items: [] } })),
        api
          .get('/api/hr/timesheet', {
            params: { employee_id: employeeId, date_from: periodStart, date_to: periodEnd, limit: 500, offset: 0 },
          })
          .catch(() => ({ data: { items: [] } })),
      ]);
      setStdTimesheets(stdRes.data.items || stdRes.data || []);
      setWoEntries(woRes.data.items || woRes.data || []);
    } catch {
      message.error('โหลดข้อมูล Timesheet ผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [employeeId, periodStart, periodEnd, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build day-by-day table data
  const tableData = useMemo(() => {
    const daysInMonth = currentMonth.daysInMonth();
    const rows = [];

    // Map standard timesheets by date
    const stdMap = {};
    stdTimesheets.forEach((s) => {
      const key = dayjs(s.work_date || s.date).format('YYYY-MM-DD');
      stdMap[key] = s;
    });

    // Map WO entries by date
    const woMap = {};
    woEntries.forEach((e) => {
      const key = dayjs(e.work_date || e.date).format('YYYY-MM-DD');
      if (!woMap[key]) woMap[key] = [];
      woMap[key].push(e);
    });

    for (let d = 1; d <= daysInMonth; d++) {
      const date = currentMonth.date(d);
      const dateStr = date.format('YYYY-MM-DD');
      const std = stdMap[dateStr];
      const wos = woMap[dateStr] || [];

      const dayOfWeek = date.day();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      let status = isWeekend ? 'หยุด' : 'ยังไม่มีข้อมูล';
      let regularHours = 0;
      let otHours = 0;

      if (std) {
        const actualStatus = std.actual_status || '';
        if (actualStatus === 'LEAVE_PAID' || actualStatus === 'LEAVE_UNPAID') {
          status = std.leave_type_name || 'ลา';
        } else if (actualStatus === 'WORKED' || actualStatus === 'PRESENT') {
          status = 'ทำงาน';
          regularHours = Number(std.scheduled_hours || std.actual_hours || 0);
          otHours = Number(std.ot_hours || 0);
        } else if (actualStatus === 'ABSENT') {
          status = 'ขาดงาน';
        } else if (actualStatus) {
          status = actualStatus;
        }
      }

      // WO detail string
      const woDetail = wos
        .map((w) => {
          const woNum = w.wo_number || w.work_order_id?.substring(0, 8) || '?';
          const hrs = Number(w.regular_hours || w.hours || 0);
          const ot = Number(w.ot_hours || 0);
          let detail = `${woNum}(${hrs})`;
          if (ot > 0) detail += `+${ot}OT`;
          return detail;
        })
        .join(' ');

      rows.push({
        key: dateStr,
        date: date.format('DD/MM'),
        dayName: DAY_NAMES[dayOfWeek],
        status,
        regularHours,
        otHours,
        woDetail: woDetail || '—',
        isWeekend,
      });
    }
    return rows;
  }, [currentMonth, stdTimesheets, woEntries]);

  // Summary
  const summary = useMemo(() => {
    let workDays = 0;
    let leaveDays = 0;
    let totalRegular = 0;
    let totalOT = 0;
    tableData.forEach((r) => {
      if (r.status === 'ทำงาน') {
        workDays++;
        totalRegular += r.regularHours;
        totalOT += r.otHours;
      } else if (r.status.includes('ลา')) {
        leaveDays++;
      }
    });
    return { workDays, leaveDays, totalRegular, totalOT };
  }, [tableData]);

  if (!employeeId) {
    return (
      <div>
        {!embedded && <PageHeader title="Timesheet ของฉัน" subtitle="My Timesheet" />}
        <EmptyState
          message="ไม่พบข้อมูลพนักงาน"
          hint="กรุณาติดต่อ HR เพื่อเชื่อมบัญชีกับข้อมูลพนักงาน"
        />
      </div>
    );
  }

  const columns = [
    {
      title: 'วันที่',
      dataIndex: 'date',
      key: 'date',
      width: 70,
    },
    {
      title: 'วัน',
      dataIndex: 'dayName',
      key: 'dayName',
      width: 40,
      render: (v, r) => (
        <span style={{ color: r.isWeekend ? COLORS.danger : COLORS.text }}>{v}</span>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v, r) => {
        if (r.isWeekend && v === 'หยุด') {
          return <Text style={{ color: COLORS.textMuted }}>หยุด</Text>;
        }
        if (v === 'ทำงาน') {
          return <span style={{ color: COLORS.success }}>ทำงาน</span>;
        }
        if (v.includes('ลา')) {
          return <span style={{ color: COLORS.warning }}>{v}</span>;
        }
        if (v === 'ขาดงาน') {
          return <span style={{ color: COLORS.danger }}>ขาดงาน</span>;
        }
        return <Text style={{ color: COLORS.textMuted }}>{v}</Text>;
      },
    },
    {
      title: 'ปกติ',
      dataIndex: 'regularHours',
      key: 'regularHours',
      width: 70,
      align: 'right',
      render: (v) => (v > 0 ? `${v} ชม.` : '—'),
    },
    {
      title: 'OT',
      dataIndex: 'otHours',
      key: 'otHours',
      width: 70,
      align: 'right',
      render: (v) => (v > 0 ? <span style={{ color: COLORS.warning }}>{v} ชม.</span> : '—'),
    },
    {
      title: 'WO Detail',
      dataIndex: 'woDetail',
      key: 'woDetail',
      ellipsis: true,
    },
  ];

  return (
    <div>
      {!embedded && <PageHeader title="Timesheet ของฉัน" subtitle="My Timesheet (read-only)" />}

      {/* Month Navigation */}
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Button
            type="text"
            icon={<ChevronLeft size={16} />}
            onClick={() => setCurrentMonth((m) => m.subtract(1, 'month'))}
          />
          <Text strong style={{ color: COLORS.text, fontSize: 16 }}>
            {currentMonth.format('MMMM YYYY')}
          </Text>
          <Button
            type="text"
            icon={<ChevronRight size={16} />}
            onClick={() => setCurrentMonth((m) => m.add(1, 'month'))}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8 }}>
          <Text style={{ color: COLORS.textSecondary }}>
            ทำงาน <b style={{ color: COLORS.success }}>{summary.workDays}</b> วัน
          </Text>
          <Text style={{ color: COLORS.textSecondary }}>
            ลา <b style={{ color: COLORS.warning }}>{summary.leaveDays}</b> วัน
          </Text>
          <Text style={{ color: COLORS.textSecondary }}>
            OT <b style={{ color: COLORS.warning }}>{summary.totalOT}</b> ชม.
          </Text>
        </div>
      </Card>

      {/* Day-by-day Table */}
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
        <Table
          dataSource={tableData}
          columns={columns}
          loading={loading}
          pagination={false}
          size="small"
          locale={{ emptyText: <EmptyState message="ไม่มีข้อมูล" hint="" /> }}
          rowClassName={(record) => (record.isWeekend ? 'weekend-row' : '')}
        />
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            background: COLORS.surface,
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          <div>
            <Text style={{ color: COLORS.textSecondary }}>ชั่วโมงปกติ: </Text>
            <Text strong style={{ color: COLORS.accent }}>{summary.totalRegular} ชม.</Text>
          </div>
          <div>
            <Text style={{ color: COLORS.textSecondary }}>OT: </Text>
            <Text strong style={{ color: COLORS.warning }}>{summary.totalOT} ชม.</Text>
          </div>
          <div>
            <Text style={{ color: COLORS.textSecondary }}>ลา: </Text>
            <Text strong style={{ color: COLORS.purple }}>{summary.leaveDays} วัน</Text>
          </div>
        </div>
      </Card>
    </div>
  );
}
