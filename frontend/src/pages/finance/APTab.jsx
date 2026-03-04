import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Space, Input, Select, Row, Col, App, Tag } from 'antd';
import { Plus, RefreshCw, FileText, AlertTriangle, CheckCircle, DollarSign, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import InvoiceFormModal from './InvoiceFormModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function APTab() {
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
      const res = await api.get('/api/finance/invoices', { params });
      setInvoices(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      message.error('ไม่สามารถโหลดข้อมูลใบวางบิลได้');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/api/finance/invoices/summary');
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
      title: 'เลขใบวางบิล',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (v, r) => (
        <a onClick={() => navigate(`/finance/invoices/${r.id}`)} style={{ color: COLORS.accent, fontWeight: 500 }}>
          {v}
        </a>
      ),
    },
    {
      title: 'PO',
      dataIndex: 'po_number',
      key: 'po_number',
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '-'}</span>,
    },
    {
      title: 'Supplier',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
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
      title: 'ยอดสุทธิ',
      dataIndex: 'net_payment',
      key: 'net_payment',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'จ่ายแล้ว',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
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
              title="ยอดค้างจ่าย"
              value={formatCurrency(summary.total_payable)}
              icon={<DollarSign size={20} />}
              color={COLORS.accent}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="จ่ายแล้ว"
              value={formatCurrency(summary.total_paid)}
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
            placeholder="ค้นหาเลขใบวางบิล..."
            allowClear
            style={{ width: 250 }}
            onSearch={(v) => setFilters((f) => ({ ...f, search: v, offset: 0 }))}
          />
          <Button icon={<RefreshCw size={14} />} onClick={() => { fetchInvoices(); fetchSummary(); }}>
            รีเฟรช
          </Button>
        </Space>
        {can('finance.invoice.create') && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
            สร้างใบวางบิล
          </Button>
        )}
      </div>

      {/* Invoice Table */}
      <Table
        dataSource={invoices}
        columns={columns}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: <EmptyState message="ยังไม่มีใบวางบิล" hint="กดปุ่ม 'สร้างใบวางบิล' เพื่อเริ่มบันทึกใบแจ้งหนี้จาก Supplier" /> }}
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
      <InvoiceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCreated}
      />
    </div>
  );
}
