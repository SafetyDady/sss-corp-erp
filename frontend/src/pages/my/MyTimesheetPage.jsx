import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Table, Typography, App, Select, Tag, Popconfirm } from 'antd';
import { ChevronLeft, ChevronRight, CalendarClock, RefreshCw } from 'lucide-react';
import { Button } from 'antd';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const SHIFT_COLORS = {
  REGULAR: 'blue',
  MORNING: 'green',
  AFTERNOON: 'orange',
  NIGHT: 'purple',
};

/**
 * MyTimesheetPage — Timesheet ของฉัน
 * Staff เลือกประเภท Timesheet (WorkSchedule) ของเดือน → สร้าง Roster → แสดงปฏิทิน
 * Route: /my/timesheet
 */
export default function MyTimesheetPage({ embedded = false }) {
  const { message } = App.useApp();
  const { can } = usePermission();
  const employeeId = useAuthStore((s) => s.employeeId);
  const workScheduleId = useAuthStore((s) => s.workScheduleId);
  const orgWorkingDays = useAuthStore((s) => s.workingDays); // OrgWorkConfig: ISO [1-7]

  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [stdTimesheets, setStdTimesheets] = useState([]);
  const [woEntries, setWoEntries] = useState([]);
  const [rosterData, setRosterData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Schedule selector state
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [generateLoading, setGenerateLoading] = useState(false);

  const periodStart = currentMonth.format('YYYY-MM-DD');
  const periodEnd = currentMonth.endOf('month').format('YYYY-MM-DD');

  // Load available WorkSchedules on mount
  useEffect(() => {
    if (!can('master.schedule.read')) return;
    api
      .get('/api/master/work-schedules', { params: { limit: 100, offset: 0 } })
      .then((res) => {
        const items = res.data.items || res.data || [];
        setSchedules(items.filter((w) => w.is_active !== false));
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const promises = [
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
      ];

      // Also load roster data
      if (can('hr.roster.read')) {
        promises.push(
          api
            .get('/api/hr/roster', {
              params: { employee_id: employeeId, start_date: periodStart, end_date: periodEnd, limit: 50, offset: 0 },
            })
            .catch(() => ({ data: { items: [] } }))
        );
      }

      const results = await Promise.all(promises);
      setStdTimesheets(results[0].data.items || results[0].data || []);
      setWoEntries(results[1].data.items || results[1].data || []);
      if (results[2]) {
        setRosterData(results[2].data.items || results[2].data || []);
      }
    } catch {
      message.error('โหลดข้อมูล Timesheet ผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [employeeId, periodStart, periodEnd, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate roster for current month with selected schedule
  const handleGenerateRoster = async () => {
    if (!employeeId || !selectedScheduleId) return;
    setGenerateLoading(true);
    try {
      const { data } = await api.post('/api/hr/roster/generate', {
        employee_ids: [employeeId],
        start_date: periodStart,
        end_date: periodEnd,
        overwrite_existing: true,
        work_schedule_id: selectedScheduleId,
      });
      message.success(`สร้างตารางกะสำเร็จ — ${data.created_count} รายการ`);
      loadData(); // Reload all data including roster
    } catch (err) {
      message.error(err.response?.data?.detail || 'สร้างตารางกะผิดพลาด');
    } finally {
      setGenerateLoading(false);
    }
  };

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

    // Map roster by date
    const rosterMap = {};
    rosterData.forEach((r) => {
      const key = dayjs(r.roster_date).format('YYYY-MM-DD');
      rosterMap[key] = r;
    });

    for (let d = 1; d <= daysInMonth; d++) {
      const date = currentMonth.date(d);
      const dateStr = date.format('YYYY-MM-DD');
      const std = stdMap[dateStr];
      const wos = woMap[dateStr] || [];
      const roster = rosterMap[dateStr] || null;

      const dayOfWeek = date.day();
      // Convert JS day (0=Sun…6=Sat) to ISO weekday (1=Mon…7=Sun)
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;

      // Use roster data for weekend/off determination if available,
      // otherwise fall back to OrgWorkConfig working days
      const isWeekend = roster
        ? !roster.is_working_day
        : !(orgWorkingDays || [1, 2, 3, 4, 5]).includes(isoDay);

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
        // Roster-derived fields
        shiftCode: roster?.shift_type_code || null,
        shiftName: roster?.shift_type_name || null,
        shiftTime:
          roster?.start_time && roster?.end_time
            ? `${roster.start_time}-${roster.end_time}`
            : null,
        rosterIsWorking: roster?.is_working_day ?? null,
      });
    }
    return rows;
  }, [currentMonth, stdTimesheets, woEntries, rosterData, orgWorkingDays]);

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

  const hasRoster = rosterData.length > 0;

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
    // Show shift column only when roster data exists
    ...(hasRoster
      ? [
          {
            title: 'กะ',
            key: 'shift',
            width: 130,
            render: (_, r) => {
              if (!r.shiftCode) {
                if (r.rosterIsWorking === false) return <Tag color="default">OFF</Tag>;
                return <span style={{ color: COLORS.textMuted }}>—</span>;
              }
              if (!r.rosterIsWorking) return <Tag color="default">OFF</Tag>;
              const color = SHIFT_COLORS[r.shiftCode] || 'cyan';
              return (
                <Tag color={color}>
                  {r.shiftCode}
                  {r.shiftTime && (
                    <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.85 }}>
                      {r.shiftTime}
                    </span>
                  )}
                </Tag>
              );
            },
          },
        ]
      : []),
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
      {!embedded && <PageHeader title="Timesheet ของฉัน" subtitle="My Timesheet" />}

      {/* Schedule Selector */}
      {can('master.schedule.read') && schedules.length > 0 && (
        <Card
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            marginBottom: 16,
          }}
          styles={{ body: { padding: '16px 20px' } }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CalendarClock size={16} style={{ color: COLORS.accent, flexShrink: 0 }} />
              <Text style={{ color: COLORS.textSecondary, whiteSpace: 'nowrap' }}>
                ประเภท Timesheet:
              </Text>
              <Select
                style={{ minWidth: 260 }}
                placeholder="Standard (ค่าเริ่มต้น)"
                allowClear
                value={selectedScheduleId}
                onChange={setSelectedScheduleId}
                options={schedules.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.schedule_type === 'ROTATING' ? 'หมุนเวียน' : 'คงที่'})`,
                }))}
              />
            </div>
            {can('hr.roster.create') && selectedScheduleId && (
              <Popconfirm
                title="สร้างตารางกะเดือนนี้"
                description="ระบบจะสร้างตารางกะทั้งเดือน (ทับรายการเดิมที่ไม่ใช่ manual override)"
                onConfirm={handleGenerateRoster}
                okText="ยืนยัน"
                cancelText="ยกเลิก"
              >
                <Button
                  type="primary"
                  icon={<RefreshCw size={14} />}
                  loading={generateLoading}
                >
                  สร้างตารางกะ
                </Button>
              </Popconfirm>
            )}
          </div>
          {workScheduleId && !selectedScheduleId && (
            <Text
              style={{
                color: COLORS.textMuted,
                fontSize: 12,
                marginTop: 8,
                display: 'block',
              }}
            >
              ใช้ตารางกะที่ HR กำหนดให้ — เปลี่ยนได้โดยเลือกจากรายการด้านบน
            </Text>
          )}
          {!workScheduleId && !selectedScheduleId && (
            <Text
              style={{
                color: COLORS.textMuted,
                fontSize: 12,
                marginTop: 8,
                display: 'block',
              }}
            >
              ยังไม่ได้กำหนดตารางกะ — เลือกประเภทด้านบนเพื่อสร้างตารางกะของเดือนนี้
            </Text>
          )}
        </Card>
      )}

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
