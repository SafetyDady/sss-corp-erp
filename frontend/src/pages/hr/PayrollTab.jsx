import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip, Card, Statistic, Row, Col } from 'antd';
import { Plus, Play, Download, Banknote, Users, CalendarCheck } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import PayrollFormModal from './PayrollFormModal';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function PayrollTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/hr/payroll', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูล Payroll ได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExecute = async (id) => {
    setActionLoading(id);
    try {
      await api.post(`/api/hr/payroll/${id}/execute`);
      message.success('ประมวลผล Payroll สำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถประมวลผลได้');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/api/hr/payroll/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'payroll_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Export สำเร็จ');
    } catch (err) {
      message.error('ไม่สามารถ Export ได้');
    }
  };

  // Summary stats
  const totalAmount = items.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
  const totalEmployees = items.reduce((sum, r) => sum + (r.employee_count || 0), 0);
  const executedCount = items.filter((r) => r.status === 'EXECUTED' || r.status === 'EXPORTED').length;

  const columns = [
    {
      title: 'งวด', key: 'period', width: 200,
      render: (_, r) => (
        <span style={{ fontFamily: 'monospace' }}>
          {formatDate(r.period_start)} — {formatDate(r.period_end)}
        </span>
      ),
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 110,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'จำนวนพนักงาน', dataIndex: 'employee_count', key: 'employee_count', width: 130,
      align: 'center',
      render: (v) => <span style={{ fontWeight: 500 }}>{v ?? '-'} คน</span>,
    },
    {
      title: 'ยอดรวม', dataIndex: 'total_amount', key: 'total_amount', width: 150,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.accent }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'วันที่ประมวลผล', dataIndex: 'executed_at', key: 'executed_at', width: 160,
      render: (v) => v ? formatDateTime(v) : <span style={{ color: COLORS.textMuted }}>ยังไม่ประมวลผล</span>,
    },
    {
      title: 'หมายเหตุ', dataIndex: 'note', key: 'note', ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'DRAFT' && can('hr.payroll.execute') && (
            <Popconfirm
              title="ประมวลผล Payroll?"
              description="คำนวณเงินเดือนจาก Timesheet ที่ Final Approve แล้ว"
              onConfirm={() => handleExecute(record.id)}
              okText="ประมวลผล" cancelText="ยกเลิก"
            >
              <Tooltip title="ประมวลผล Payroll">
                <Button type="text" size="small" loading={actionLoading === record.id}
                  icon={<Play size={14} />} style={{ color: COLORS.success }} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: COLORS.card, borderColor: COLORS.border }}>
            <Statistic title={<span style={{ color: COLORS.textSecondary }}>ยอดรวมทั้งหมด</span>}
              value={totalAmount} formatter={(v) => formatCurrency(v)}
              prefix={<Banknote size={16} style={{ color: COLORS.accent }} />}
              valueStyle={{ color: COLORS.accent, fontFamily: 'monospace' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: COLORS.card, borderColor: COLORS.border }}>
            <Statistic title={<span style={{ color: COLORS.textSecondary }}>พนักงานทั้งหมด</span>}
              value={totalEmployees} suffix="คน"
              prefix={<Users size={16} style={{ color: COLORS.purple }} />}
              valueStyle={{ color: COLORS.text }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: COLORS.card, borderColor: COLORS.border }}>
            <Statistic title={<span style={{ color: COLORS.textSecondary }}>ประมวลผลแล้ว</span>}
              value={executedCount} suffix={`/ ${items.length} งวด`}
              prefix={<CalendarCheck size={16} style={{ color: COLORS.success }} />}
              valueStyle={{ color: COLORS.success }} />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        {can('hr.payroll.export') && (
          <Tooltip title="Export Payroll เป็น CSV">
            <Button icon={<Download size={14} />} onClick={handleExport}>Export CSV</Button>
          </Tooltip>
        )}
        {can('hr.payroll.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => setModalOpen(true)}>
            สร้าง Payroll Run
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ยังไม่มีรายการ Payroll" hint="กดปุ่ม 'สร้าง Payroll Run' เพื่อเริ่มต้นคำนวณเงินเดือน" /> }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
        size="middle"
      />
      <PayrollFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
