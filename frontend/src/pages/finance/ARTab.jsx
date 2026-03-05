import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Space, Input, Select, Row, Col, App } from 'antd';
import { Plus, RefreshCw, AlertTriangle, CheckCircle, DollarSign, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import ARFormModal from './ARFormModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function ARTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ status: null, search: '', limit: 20, offset: 0 });
  const [modalOpen, setModalOpen] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: filters.limit, offset: filters.offset };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      const res = await api.get('/api/finance/ar', { params });
      setInvoices(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      message.error('ไม่สามารถโหลดข้อมูลใบแจ้งหนี้ลูกค้าได้');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/api/finance/ar/summary');
      setSummary(res.data);
    } catch {
      // silent — summary is non-critical
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handleCreated = () => {
    setModalOpen(false);
    fetchInvoices();
    fetchSummary();
  };

  const columns = [
    {
      title: 'เลขใบแจ้งหนี้',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (v, r) => (
        <a onClick={() => navigate(`/finance/ar/${r.id}`)} style={{ color: COLORS.accent, fontWeight: 500 }}>
          {v}
        </a>
      ),
    },
    {
      title: 'SO',
      dataIndex: 'so_number',
      key: 'so_number',
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '-'}</span>,
    },
    {
      title: 'ลูกค้า',
      dataIndex: 'customer_name',
      key: 'customer_name',
      ellipsis: true,
    },
    {
      title: 'วันที่',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      width: 110,
      render: (v) => formatDate(v),
    },
    {
      title: 'ครบกำหนด',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110,
      render: (v, r) => (
        <span style={{ color: r.is_overdue ? COLORS.danger : undefined, fontWeight: r.is_overdue ? 600 : 400 }}>
          {formatDate(v)}
          {r.is_overdue && <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />}
        </span>
      ),
    },
    {
      title: 'ยอดรวม',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'รับแล้ว',
      dataIndex: 'received_amount',
      key: 'received_amount',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace', color: Number(v) > 0 ? COLORS.success : undefined }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v, r) => (
        <Space size={4}>
          <StatusBadge status={v} />
          {r.is_overdue && <StatusBadge status="OVERDUE" />}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Summary Cards */}
      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="ยอดค้างรับ"
              value={formatCurrency(summary.total_receivable)}
              icon={<DollarSign size={20} />}
              color={COLORS.accent}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="รับแล้ว"
              value={formatCurrency(summary.total_received)}
              icon={<CheckCircle size={20} />}
              color={COLORS.success}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="เกินกำหนด"
              value={summary.total_overdue}
              icon={<AlertTriangle size={20} />}
              color={COLORS.danger}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="รออนุมัติ"
              value={summary.total_pending_approval}
              icon={<Clock size={20} />}
              color={COLORS.warning}
            />
          </Col>
        </Row>
      )}

      {/* Filter Bar */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="สถานะ"
            style={{ width: 160 }}
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v, offset: 0 }))}
            options={[
              { label: 'DRAFT', value: 'DRAFT' },
              { label: 'PENDING', value: 'PENDING' },
              { label: 'APPROVED', value: 'APPROVED' },
              { label: 'PAID', value: 'PAID' },
              { label: 'CANCELLED', value: 'CANCELLED' },
            ]}
          />
          <Input.Search
            placeholder="ค้นหาเลขใบแจ้งหนี้..."
            allowClear
            style={{ width: 250 }}
            onSearch={(v) => setFilters((f) => ({ ...f, search: v, offset: 0 }))}
          />
          <Button icon={<RefreshCw size={14} />} onClick={() => { fetchInvoices(); fetchSummary(); }}>
            รีเฟรช
          </Button>
        </Space>
        {can('finance.ar.create') && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
            สร้างใบแจ้งหนี้
          </Button>
        )}
      </div>

      {/* Invoice Table */}
      <Table
        dataSource={invoices}
        columns={columns}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: <EmptyState message="ยังไม่มีใบแจ้งหนี้ลูกค้า" hint="กดปุ่ม 'สร้างใบแจ้งหนี้' เพื่อออกใบแจ้งหนี้จาก SO ที่อนุมัติแล้ว" /> }}
        pagination={{
          current: Math.floor(filters.offset / filters.limit) + 1,
          pageSize: filters.limit,
          total,
          onChange: (page, pageSize) => setFilters((f) => ({ ...f, offset: (page - 1) * pageSize, limit: pageSize })),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
        size="middle"
        onRow={(r) => ({
          style: r.is_overdue ? { background: '#ef444412' } : undefined,
        })}
      />

      {/* Create Modal */}
      <ARFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCreated}
      />
    </div>
  );
}
