/**
 * FinanceDashboardTab — Financial Overview Dashboard (Phase 8.5)
 * Comprehensive financial KPIs, cash flow, AP/AR aging, top customers/suppliers
 */
import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Table, Skeleton, App } from 'antd';
import {
  ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp,
  AlertTriangle, Users, Truck, Building2,
} from 'lucide-react';
import StatCard from '../../components/StatCard';
import { COLORS } from '../../utils/constants';
import api from '../../services/api';

const LineChartCard = lazy(() => import('../../components/LineChartCard'));
const BarChartCard = lazy(() => import('../../components/BarChartCard'));

const fmtCurrency = (v) =>
  typeof v === 'number'
    ? v.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '0';

const fmtCurrencyFull = (v) =>
  typeof v === 'number'
    ? v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

const AGING_LABELS = {
  current: 'ยังไม่ครบกำหนด',
  '1-30': '1-30 วัน',
  '31-60': '31-60 วัน',
  '61-90': '61-90 วัน',
  '90+': '90+ วัน',
};

const AGING_COLORS = {
  current: COLORS.success,
  '1-30': COLORS.accent,
  '31-60': COLORS.warning,
  '61-90': '#f97316',
  '90+': COLORS.danger,
};

export default function FinanceDashboardTab() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/api/finance/reports/finance-dashboard', { params: { months: 6 } });
      setData(res.data);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูล Dashboard ได้');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData();
    }, 300_000); // 5 min auto-refresh
    return () => clearInterval(id);
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Col xs={24} sm={12} lg={4} xl={4} key={i}>
              <Skeleton.Button active style={{ width: '100%', height: 90, borderRadius: 8 }} block />
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}><Skeleton active /></Col>
          <Col xs={24} lg={10}><Skeleton active /></Col>
        </Row>
      </div>
    );
  }

  if (!data) return null;

  const { revenue, expenses, net_position } = data;

  // ── Stat Cards ──────────────────────────────────────
  const statCards = [
    {
      title: 'รายรับ (AR)',
      value: `${fmtCurrency(revenue.total_invoiced)} ฿`,
      subtitle: `เก็บแล้ว ${fmtCurrency(revenue.total_collected)} ฿`,
      icon: <ArrowUpRight size={20} />,
      color: COLORS.success,
      onClick: () => navigate('/finance?tab=ar'),
    },
    {
      title: 'ค้างรับ',
      value: `${fmtCurrency(revenue.outstanding)} ฿`,
      subtitle: revenue.overdue_count > 0
        ? `${revenue.overdue_count} เกินกำหนด`
        : 'ไม่มีค้างรับ',
      icon: <AlertTriangle size={20} />,
      color: revenue.overdue_count > 0 ? COLORS.warning : COLORS.success,
    },
    {
      title: 'รายจ่าย (AP)',
      value: `${fmtCurrency(expenses.total_invoiced)} ฿`,
      subtitle: `จ่ายแล้ว ${fmtCurrency(expenses.total_paid)} ฿`,
      icon: <ArrowDownLeft size={20} />,
      color: COLORS.danger,
      onClick: () => navigate('/finance?tab=ap'),
    },
    {
      title: 'ค้างจ่าย',
      value: `${fmtCurrency(expenses.outstanding)} ฿`,
      subtitle: expenses.overdue_count > 0
        ? `${expenses.overdue_count} เกินกำหนด`
        : 'ไม่มีค้างจ่าย',
      icon: <AlertTriangle size={20} />,
      color: expenses.overdue_count > 0 ? COLORS.danger : COLORS.success,
    },
    {
      title: 'สถานะสุทธิ',
      value: `${fmtCurrency(Math.abs(net_position))} ฿`,
      subtitle: net_position >= 0 ? 'เก็บเงินมากกว่าจ่าย' : 'จ่ายเงินมากกว่าเก็บ',
      icon: <Wallet size={20} />,
      color: net_position >= 0 ? COLORS.accent : COLORS.danger,
    },
  ];

  // ── Cash Flow Chart Data ────────────────────────────
  const cashflowData = data.monthly_cashflow || [];

  // ── Aging Chart Data (combined AP + AR) ─────────────
  const agingData = (data.ar_aging || []).map((ar, i) => {
    const ap = (data.ap_aging || [])[i] || { amount: 0 };
    return {
      label: AGING_LABELS[ar.bracket] || ar.bracket,
      ar: ar.amount,
      ap: ap.amount,
    };
  });

  // ── Top Customers Table ─────────────────────────────
  const customerColumns = [
    {
      title: 'ลูกค้า',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'ออก Invoice',
      dataIndex: 'total_invoiced',
      key: 'total_invoiced',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{fmtCurrencyFull(v)}</span>,
    },
    {
      title: 'ค้างชำระ',
      dataIndex: 'outstanding',
      key: 'outstanding',
      width: 130,
      align: 'right',
      render: (v) => (
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: COLORS.warning }}>
          {fmtCurrencyFull(v)}
        </span>
      ),
    },
  ];

  // ── Top Suppliers Table ─────────────────────────────
  const supplierColumns = [
    {
      title: 'Supplier',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'ออก Invoice',
      dataIndex: 'total_invoiced',
      key: 'total_invoiced',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{fmtCurrencyFull(v)}</span>,
    },
    {
      title: 'ค้างจ่าย',
      dataIndex: 'outstanding',
      key: 'outstanding',
      width: 130,
      align: 'right',
      render: (v) => (
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: COLORS.danger }}>
          {fmtCurrencyFull(v)}
        </span>
      ),
    },
  ];

  // ── Cost Center Table ───────────────────────────────
  const ccColumns = [
    {
      title: 'Cost Center',
      key: 'cc',
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 500 }}>{r.cost_center_name}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: COLORS.textMuted, marginLeft: 8 }}>
            {r.cost_center_code}
          </span>
        </div>
      ),
    },
    {
      title: 'ต้นทุนจริง',
      dataIndex: 'actual_total',
      key: 'actual_total',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{fmtCurrencyFull(v)}</span>,
    },
    {
      title: 'Recharge',
      dataIndex: 'fixed_recharge',
      key: 'fixed_recharge',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.accent }}>{fmtCurrencyFull(v)}</span>,
    },
    {
      title: 'รวม',
      dataIndex: 'grand_total',
      key: 'grand_total',
      width: 130,
      align: 'right',
      render: (v) => (
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: COLORS.accent }}>
          {fmtCurrencyFull(v)}
        </span>
      ),
    },
  ];

  const cardStyle = {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
  };

  return (
    <div>
      {/* Row 1 — Summary Stat Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {statCards.map((card, i) => (
          <Col xs={12} sm={12} md={8} lg={4} xl={4} key={i}>
            <StatCard
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              icon={card.icon}
              color={card.color}
              onClick={card.onClick}
            />
          </Col>
        ))}
      </Row>

      {/* Row 2 — Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <span style={{ fontSize: 14 }}>
                <TrendingUp size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Cash Flow (6 เดือน)
              </span>
            }
            size="small"
            style={cardStyle}
          >
            <Suspense fallback={<Skeleton active />}>
              <LineChartCard
                data={cashflowData}
                lines={[
                  { dataKey: 'cash_in', name: 'เงินเข้า (AR)', color: COLORS.success },
                  { dataKey: 'cash_out', name: 'เงินออก (AP)', color: COLORS.danger },
                ]}
                xKey="label"
                height={240}
              />
            </Suspense>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <span style={{ fontSize: 14 }}>
                <AlertTriangle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                AP/AR Aging
              </span>
            }
            size="small"
            style={cardStyle}
          >
            <Suspense fallback={<Skeleton active />}>
              <BarChartCard
                data={agingData}
                bars={[
                  { dataKey: 'ar', name: 'ลูกหนี้ (AR)', color: COLORS.warning },
                  { dataKey: 'ap', name: 'เจ้าหนี้ (AP)', color: COLORS.danger },
                ]}
                xKey="label"
                height={240}
                isCurrency
              />
            </Suspense>
          </Card>
        </Col>
      </Row>

      {/* Row 3 — Top Customers & Suppliers */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ fontSize: 14 }}>
                <Users size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                ลูกค้าค้างชำระสูงสุด
              </span>
            }
            size="small"
            style={cardStyle}
          >
            <Table
              dataSource={data.top_customers || []}
              columns={customerColumns}
              rowKey="name"
              pagination={false}
              size="small"
              locale={{ emptyText: <span style={{ color: COLORS.textMuted }}>ไม่มีลูกหนี้ค้างชำระ</span> }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ fontSize: 14 }}>
                <Truck size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Supplier ค้างจ่ายสูงสุด
              </span>
            }
            size="small"
            style={cardStyle}
          >
            <Table
              dataSource={data.top_suppliers || []}
              columns={supplierColumns}
              rowKey="name"
              pagination={false}
              size="small"
              locale={{ emptyText: <span style={{ color: COLORS.textMuted }}>ไม่มีเจ้าหนี้ค้างจ่าย</span> }}
            />
          </Card>
        </Col>
      </Row>

      {/* Row 4 — Cost Center Summary */}
      {(data.cost_centers || []).length > 0 && (
        <Card
          title={
            <span style={{ fontSize: 14 }}>
              <Building2 size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              ต้นทุนตาม Cost Center
            </span>
          }
          size="small"
          style={cardStyle}
        >
          <Table
            dataSource={data.cost_centers}
            columns={ccColumns}
            rowKey="cost_center_code"
            pagination={false}
            size="small"
            summary={() => {
              if (!data.cost_centers.length) return null;
              const totalActual = data.cost_centers.reduce((s, r) => s + (r.actual_total || 0), 0);
              const totalRecharge = data.cost_centers.reduce((s, r) => s + (r.fixed_recharge || 0), 0);
              const grandTotal = data.cost_centers.reduce((s, r) => s + (r.grand_total || 0), 0);
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <span style={{ fontWeight: 600 }}>รวมทั้งหมด</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 12 }}>
                        {fmtCurrencyFull(totalActual)}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 12, color: COLORS.accent }}>
                        {fmtCurrencyFull(totalRecharge)}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13, color: COLORS.accent }}>
                        {fmtCurrencyFull(grandTotal)}
                      </span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
}
