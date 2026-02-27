import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, Modal, Row, Table, Tag, Form, DatePicker, Select, Input,
  InputNumber, Progress, App, Typography, Space,
} from 'antd';
import { Plus, Calendar, FileText } from 'lucide-react';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';

const { Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

/**
 * MyLeavePage — ใบลาของฉัน + โควต้า
 * Route: /my/leave
 */
export default function MyLeavePage() {
  const { message } = App.useApp();
  const employeeId = useAuthStore((s) => s.employeeId);

  const [balances, setBalances] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [form] = Form.useForm();
  const [year, setYear] = useState(dayjs().year());

  // Pagination
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  // Load leave balances
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

  // Load leave history
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

  // Load leave types for form
  const loadLeaveTypes = useCallback(async () => {
    try {
      const res = await api.get('/api/master/leave-types', { params: { limit: 100, offset: 0 } });
      setLeaveTypes(res.data.items || []);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  useEffect(() => {
    loadLeaveTypes();
  }, [loadLeaveTypes]);

  // Submit leave request
  const handleSubmitLeave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const [startDate, endDate] = values.date_range;
      const days = endDate.diff(startDate, 'day') + 1;
      await api.post('/api/hr/leave', {
        employee_id: employeeId,
        leave_type_id: values.leave_type_id,
        start_date: startDate.format('YYYY-MM-DD'),
        end_date: endDate.format('YYYY-MM-DD'),
        days,
        reason: values.reason || '',
      });
      message.success('ส่งคำขอลาสำเร็จ');
      setModalOpen(false);
      form.resetFields();
      loadLeaves();
      loadBalances();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ส่งคำขอลาผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  // Color map for leave types
  const typeColors = {
    ANNUAL: COLORS.accent,
    SICK: COLORS.danger,
    PERSONAL: COLORS.purple,
    MATERNITY: COLORS.warning,
  };

  if (!employeeId) {
    return (
      <div>
        <PageHeader title="ใบลาของฉัน" subtitle="My Leave" />
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
      dataIndex: 'days',
      key: 'days',
      render: (v) => `${v} วัน`,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'เหตุผล',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <PageHeader
        title="ใบลาของฉัน"
        subtitle="My Leave"
        actions={
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
            ขอลาหยุด
          </Button>
        }
      />

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

      {/* Leave History */}
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
          locale={{ emptyText: <EmptyState message="ยังไม่มีประวัติการลา" hint="" /> }}
          size="small"
        />
      </Card>

      {/* Leave Request Modal */}
      <Modal
        title="ขอลาหยุด"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={handleSubmitLeave}
        confirmLoading={submitting}
        okText="ส่งคำขอ"
        cancelText="ยกเลิก"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="leave_type_id"
            label="ประเภทการลา"
            rules={[{ required: true, message: 'กรุณาเลือกประเภท' }]}
          >
            <Select
              placeholder="เลือกประเภทการลา"
              options={leaveTypes.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="date_range"
            label="วันที่ลา"
            rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}
          >
            <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="reason" label="เหตุผล">
            <TextArea rows={3} placeholder="ระบุเหตุผลการลา" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
