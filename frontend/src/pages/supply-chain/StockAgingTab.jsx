/**
 * StockAgingTab — Stock Aging Report (Phase 11.11)
 * FIFO-based inventory age analysis: 0-30, 31-60, 61-90, 90+ days
 */
import { useState, useEffect, useCallback } from 'react';
import { Table, Row, Col, Select, Space, Button, App } from 'antd';
import { Clock, Download, RefreshCw, AlertTriangle, Package, DollarSign, Calendar } from 'lucide-react';
import StatCard from '../../components/StatCard';
import BarChartCard from '../../components/BarChartCard';
import { COLORS } from '../../utils/constants';
import { usePermission } from '../../hooks/usePermission';
import { downloadExcel } from '../../utils/download';
import api from '../../services/api';

const BRACKET_COLORS = {
  '0-30 days': COLORS.success,
  '31-60 days': COLORS.accent,
  '61-90 days': COLORS.warning,
  '90+ days': COLORS.danger,
};

const BRACKET_LABELS = {
  '0-30 days': '0-30 วัน',
  '31-60 days': '31-60 วัน',
  '61-90 days': '61-90 วัน',
  '90+ days': '90+ วัน',
};

const formatCurrency = (v) =>
  typeof v === 'number' ? v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

const formatQty = (v) =>
  typeof v === 'number' ? v.toLocaleString('th-TH') : '0';

export default function StockAgingTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [filters, setFilters] = useState({ product_type: null, warehouse_id: null });
  const [warehouses, setWarehouses] = useState([]);

  // Fetch warehouses for filter dropdown
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await api.get('/api/warehouse/warehouses', { params: { limit: 100 } });
        setWarehouses(res.data?.items || []);
      } catch {
        /* ignore */
      }
    };
    if (can('warehouse.warehouse.read')) fetchWarehouses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.product_type) params.product_type = filters.product_type;
      if (filters.warehouse_id) params.warehouse_id = filters.warehouse_id;
      const res = await api.get('/api/inventory/stock-aging', { params });
      setReport(res.data);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดรายงานได้');
    } finally {
      setLoading(false);
    }
  }, [filters, message]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const params = {};
      if (filters.product_type) params.product_type = filters.product_type;
      if (filters.warehouse_id) params.warehouse_id = filters.warehouse_id;
      await downloadExcel('/api/inventory/stock-aging/export', 'stock_aging_report', params);
      message.success('Export สำเร็จ');
    } catch {
      message.error('ไม่สามารถ Export ได้');
    } finally {
      setExportLoading(false);
    }
  };

  // Stat cards data
  const totalProducts = report?.total_products || 0;
  const totalValue = parseFloat(report?.total_value || '0');
  const avgAge = report?.average_age_days || 0;
  const over90 = report?.brackets?.find((b) => b.bracket === '90+ days');
  const over90Count = over90?.product_count || 0;

  // Chart data
  const chartData = (report?.brackets || []).map((b) => ({
    label: BRACKET_LABELS[b.bracket] || b.bracket,
    qty: b.total_qty,
    value: parseFloat(b.total_value || '0'),
  }));

  // Table columns
  const columns = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      sorter: (a, b) => a.sku.localeCompare(b.sku),
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.accent }}>{v}</span>
      ),
    },
    {
      title: 'ชื่อสินค้า',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          {r.model && (
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Model: {r.model}</div>
          )}
        </div>
      ),
    },
    {
      title: 'คงเหลือ',
      dataIndex: 'on_hand',
      key: 'on_hand',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.on_hand - b.on_hand,
      render: (v) => formatQty(v),
    },
    {
      title: 'มูลค่ารวม',
      dataIndex: 'total_value',
      key: 'total_value',
      width: 120,
      align: 'right',
      sorter: (a, b) => parseFloat(a.total_value) - parseFloat(b.total_value),
      render: (v) => <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{formatCurrency(parseFloat(v))}</span>,
    },
    {
      title: <span style={{ color: COLORS.success }}>0-30 วัน</span>,
      dataIndex: 'qty_0_30',
      key: 'qty_0_30',
      width: 85,
      align: 'right',
      sorter: (a, b) => a.qty_0_30 - b.qty_0_30,
      render: (v) => v > 0 ? <span style={{ color: COLORS.success }}>{formatQty(v)}</span> : <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: <span style={{ color: COLORS.accent }}>31-60 วัน</span>,
      dataIndex: 'qty_31_60',
      key: 'qty_31_60',
      width: 85,
      align: 'right',
      sorter: (a, b) => a.qty_31_60 - b.qty_31_60,
      render: (v) => v > 0 ? <span style={{ color: COLORS.accent }}>{formatQty(v)}</span> : <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: <span style={{ color: COLORS.warning }}>61-90 วัน</span>,
      dataIndex: 'qty_61_90',
      key: 'qty_61_90',
      width: 85,
      align: 'right',
      sorter: (a, b) => a.qty_61_90 - b.qty_61_90,
      render: (v) => v > 0 ? <span style={{ color: COLORS.warning }}>{formatQty(v)}</span> : <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: <span style={{ color: COLORS.danger }}>90+ วัน</span>,
      dataIndex: 'qty_90_plus',
      key: 'qty_90_plus',
      width: 85,
      align: 'right',
      sorter: (a, b) => a.qty_90_plus - b.qty_90_plus,
      render: (v) => v > 0 ? <span style={{ color: COLORS.danger, fontWeight: 600 }}>{formatQty(v)}</span> : <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'อายุเก่าสุด',
      dataIndex: 'days_oldest',
      key: 'days_oldest',
      width: 100,
      align: 'right',
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.days_oldest - b.days_oldest,
      render: (v) => {
        let color = COLORS.success;
        if (v > 90) color = COLORS.danger;
        else if (v > 60) color = COLORS.warning;
        else if (v > 30) color = COLORS.accent;
        return <span style={{ fontWeight: 600, color }}>{v} วัน</span>;
      },
    },
  ];

  // Table summary row
  const summaryRow = () => {
    if (!report?.products?.length) return null;
    const products = report.products;
    const sumOnHand = products.reduce((s, p) => s + p.on_hand, 0);
    const sumValue = products.reduce((s, p) => s + parseFloat(p.total_value), 0);
    const sum030 = products.reduce((s, p) => s + p.qty_0_30, 0);
    const sum3160 = products.reduce((s, p) => s + p.qty_31_60, 0);
    const sum6190 = products.reduce((s, p) => s + p.qty_61_90, 0);
    const sum90p = products.reduce((s, p) => s + p.qty_90_plus, 0);
    const cellStyle = { fontWeight: 600 };
    return (
      <Table.Summary fixed>
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={2}>
            <span style={cellStyle}>รวมทั้งหมด</span>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={2} align="right"><span style={cellStyle}>{formatQty(sumOnHand)}</span></Table.Summary.Cell>
          <Table.Summary.Cell index={3} align="right"><span style={cellStyle}>{formatCurrency(sumValue)}</span></Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right"><span style={{ ...cellStyle, color: COLORS.success }}>{formatQty(sum030)}</span></Table.Summary.Cell>
          <Table.Summary.Cell index={5} align="right"><span style={{ ...cellStyle, color: COLORS.accent }}>{formatQty(sum3160)}</span></Table.Summary.Cell>
          <Table.Summary.Cell index={6} align="right"><span style={{ ...cellStyle, color: COLORS.warning }}>{formatQty(sum6190)}</span></Table.Summary.Cell>
          <Table.Summary.Cell index={7} align="right"><span style={{ ...cellStyle, color: COLORS.danger }}>{formatQty(sum90p)}</span></Table.Summary.Cell>
          <Table.Summary.Cell index={8} />
        </Table.Summary.Row>
      </Table.Summary>
    );
  };

  return (
    <div>
      {/* Filter Bar */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="ประเภทสินค้า"
            style={{ width: 160 }}
            value={filters.product_type}
            onChange={(v) => setFilters((f) => ({ ...f, product_type: v || null }))}
            options={[
              { label: 'MATERIAL', value: 'MATERIAL' },
              { label: 'CONSUMABLE', value: 'CONSUMABLE' },
              { label: 'SPAREPART', value: 'SPAREPART' },
              { label: 'FINISHED_GOODS', value: 'FINISHED_GOODS' },
            ]}
          />
          {warehouses.length > 0 && (
            <Select
              allowClear
              placeholder="คลังสินค้า"
              style={{ width: 200 }}
              value={filters.warehouse_id}
              onChange={(v) => setFilters((f) => ({ ...f, warehouse_id: v || null }))}
              options={warehouses.map((w) => ({ label: w.name, value: w.id }))}
            />
          )}
          <Button icon={<RefreshCw size={14} />} onClick={fetchReport} loading={loading}>
            รีเฟรช
          </Button>
        </Space>
        <Space>
          {can('inventory.product.export') && (
            <Button icon={<Download size={14} />} onClick={handleExport} loading={exportLoading}>
              Export
            </Button>
          )}
        </Space>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard
            title="Products"
            value={totalProducts}
            subtitle="สินค้ามีสต็อก"
            icon={<Package size={20} />}
            color={COLORS.accent}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Total Value"
            value={formatCurrency(totalValue)}
            subtitle="มูลค่ารวม (฿)"
            icon={<DollarSign size={20} />}
            color={COLORS.success}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Avg Age"
            value={`${avgAge}`}
            subtitle="อายุเฉลี่ย (วัน)"
            icon={<Calendar size={20} />}
            color={COLORS.warning}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="90+ Days"
            value={over90Count}
            subtitle="สินค้าค้างนาน"
            icon={<AlertTriangle size={20} />}
            color={COLORS.danger}
          />
        </Col>
      </Row>

      {/* Bar Chart */}
      <div style={{
        background: COLORS.card,
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
        border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: COLORS.text }}>
          <Clock size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          การกระจายอายุสินค้า
        </div>
        <BarChartCard
          data={chartData}
          bars={[
            { dataKey: 'qty', name: 'จำนวน (ชิ้น)', color: COLORS.accent },
            { dataKey: 'value', name: 'มูลค่า (฿)', color: COLORS.warning },
          ]}
          xKey="label"
          height={220}
          isCurrency={false}
        />
      </div>

      {/* Detailed Table */}
      <div style={{
        background: COLORS.card,
        borderRadius: 8,
        padding: 20,
        border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: COLORS.text }}>
          <Package size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          รายละเอียดอายุสินค้า
        </div>
        <Table
          dataSource={report?.products || []}
          columns={columns}
          rowKey="product_id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
          scroll={{ x: 900 }}
          summary={summaryRow}
          locale={{
            emptyText: (
              <div style={{ padding: 40, color: COLORS.textMuted }}>
                <Package size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                <div>ไม่มีสินค้าที่มีสต็อก</div>
              </div>
            ),
          }}
        />
      </div>
    </div>
  );
}
