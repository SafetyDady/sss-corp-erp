import { useCallback, useEffect, useState } from 'react';
import { Card, Col, Row, Table, Select, Progress, App, Typography } from 'antd';
import { Calendar } from 'lucide-react';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';

const { Text } = Typography;

/**
 * LeaveBalanceReadOnly — โควต้าลา + ประวัติ (read-only, ไม่มีปุ่มขอลา)
 * ใช้ใน MePage tab "โควต้าลา"
 */
export default function LeaveBalanceReadOnly() {
  const { message } = App.useApp();
  const employeeId = useAuthStore((s) => s.employeeId);

  const [balances, setBalances] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(dayjs().year());
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // Color map for leave types
  const typeColors = {
    ANNUAL: COLORS.accent,
    SICK: COLORS.danger,
    PERSONAL: COLORS.purple,
    MATERNITY: COLORS.warning,
  };

  const loadBalances = useCallback(async () => {
    if (!employeeId) return;
    try {
      const res = await api.get('/api/hr/leave-balance', {
        params: { employee_id: employeeId, year, limit: 100, offset: 0 },
      });
      setBalances(res.data.items || res.data || []);
    } catch {
      // silently fail
    }
  }, [employeeId, year]);

  const loadLeaves = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const res = await api.get('/api/hr/leave', {
        params: {
          employee_id: employeeId,
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
        },
      });
      setLeaves(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      message.error('โหลดข้อมูลใบลาผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [employeeId, pagination, message]);

  useEffect(() => { loadBalances(); }, [loadBalances]);
  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  if (!employeeId) {
    return <EmptyState message="ไม่พบข้อมูลพนักงาน" hint="กรุณาติดต่อ HR เพื่อเชื่อมบัญชี" />;
  }

  const columns = [
    {
      title: 'วันที่',
      key: 'dates',
      render: (_, r) => {
        const start = formatDate(r.start_date);
        const end = formatDate(r.end_date);
        return start === end ? start : `${start} — ${end}`;
      },
    },
    {
      title: 'ประเภท',
      dataIndex: 'leave_type_name',
      key: 'leave_type_name',
      render: (v) => v || '-',
    },
    {
      title: 'จำนวน',
      dataIndex: 'days_count',
      key: 'days_count',
      render: (v) => `${v ?? '-'} วัน`,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <StatusBadge status={v} />,
    },
  ];

  return (
    <div>
      {/* Quota Cards */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: COLORS.textSecondary }}>โควต้าลาปี {year}</Text>
        <Select
          value={year}
          onChange={setYear}
          style={{ width: 100 }}
          options={[
            { value: dayjs().year() - 1, label: `${dayjs().year() - 1}` },
            { value: dayjs().year(), label: `${dayjs().year()}` },
          ]}
        />
      </div>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {balances.map((b) => {
          const used = Number(b.used || 0);
          const quota = Number(b.quota || 0);
          const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
          const color = typeColors[b.leave_type_code] || COLORS.accent;
          return (
            <Col xs={12} sm={8} md={6} key={b.id || b.leave_type_id}>
              <Card
                size="small"
                style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, textAlign: 'center' }}
              >
                <div style={{ color, fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  {b.leave_type_name || b.leave_type_code || 'Leave'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>
                  {used}/{quota} <span style={{ fontSize: 12, color: COLORS.textMuted }}>วัน</span>
                </div>
                <Progress percent={pct} size="small" strokeColor={color} showInfo={false} />
              </Card>
            </Col>
          );
        })}
        {balances.length === 0 && (
          <Col span={24}>
            <Text style={{ color: COLORS.textMuted }}>ยังไม่มีโควต้าลา — กรุณาติดต่อ HR</Text>
          </Col>
        )}
      </Row>

      {/* Leave History (read-only) */}
      <Card
        title={<span><Calendar size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />ประวัติการลา</span>}
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
      >
        <Table
          dataSource={leaves}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: false,
            onChange: (page) => setPagination((p) => ({ ...p, current: page })),
          }}
          locale={{ emptyText: <EmptyState message="ยังไม่มีประวัติการลา" /> }}
          size="small"
        />
      </Card>
    </div>
  );
}
