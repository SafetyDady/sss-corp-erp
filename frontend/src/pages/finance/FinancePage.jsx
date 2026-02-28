import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Table, Button, App, DatePicker, Space, Tooltip, Spin, Divider, Alert, Tabs } from 'antd';
import { Download, RefreshCw, DollarSign, TrendingUp, Layers, Banknote, BookOpen, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function FinancePage() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [summary, setSummary] = useState(null);
  const [costBreakdown, setCostBreakdown] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([null, null]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange[0]) params.period_start = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) params.period_end = dateRange[1].format('YYYY-MM-DD');

      const res = await api.get('/api/finance/reports', { params });
      const data = res.data;
      setSummary(data);
      setCostBreakdown(data.cost_centers || data.items || []);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลการเงินได้');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExportCSV = async () => {
    try {
      const params = {};
      if (dateRange[0]) params.period_start = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) params.period_end = dateRange[1].format('YYYY-MM-DD');

      const response = await api.get('/api/finance/reports/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `finance_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Export CSV สำเร็จ');
    } catch (err) {
      message.error('ไม่สามารถ Export ได้');
    }
  };

  const costColumns = [
    {
      title: 'Cost Center', dataIndex: 'cost_center_name', key: 'cost_center_name',
      render: (v, r) => (
        <div>
          <span style={{ fontWeight: 500 }}>{v}</span>
          <br />
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: COLORS.textMuted }}>{r.cost_center_code}</span>
        </div>
      ),
    },
    {
      title: 'ค่าแรง (Labor)', dataIndex: 'labor_cost', key: 'labor_cost', width: 150,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'ค่าวัสดุ (Material)', dataIndex: 'material_cost', key: 'material_cost', width: 150,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'ค่าเครื่องมือ (Tool)', dataIndex: 'tool_cost', key: 'tool_cost', width: 150,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'Overhead', dataIndex: 'overhead_cost', key: 'overhead_cost', width: 150,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace', color: COLORS.warning }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'รวม', dataIndex: 'total_cost', key: 'total_cost', width: 160,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.accent }}>{formatCurrency(v)}</span>,
    },
  ];

  // Calculate grand totals from breakdown
  const grandTotal = costBreakdown.reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0);
  const totalLabor = costBreakdown.reduce((sum, r) => sum + (parseFloat(r.labor_cost) || 0), 0);
  const totalMaterial = costBreakdown.reduce((sum, r) => sum + (parseFloat(r.material_cost) || 0), 0);
  const totalTool = costBreakdown.reduce((sum, r) => sum + (parseFloat(r.tool_cost) || 0), 0);

  return (
    <div>
      <PageHeader title="Finance" subtitle="สรุปต้นทุน, วิเคราะห์ค่าใช้จ่าย, Export รายงาน" />

      {/* Filter Bar */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates || [null, null])}
            format="DD/MM/YYYY"
            placeholder={['วันเริ่มต้น', 'วันสิ้นสุด']}
          />
          <Tooltip title="รีเฟรชข้อมูล">
            <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>
              รีเฟรช
            </Button>
          </Tooltip>
        </Space>
        {can('finance.report.export') && (
          <Tooltip title="Export รายงานเป็น CSV">
            <Button icon={<Download size={14} />} onClick={handleExportCSV}>
              Export CSV
            </Button>
          </Tooltip>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="ต้นทุนรวม"
                value={formatCurrency(grandTotal)}
                icon={<DollarSign size={20} />}
                color={COLORS.accent}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="ค่าแรง (Labor)"
                value={formatCurrency(totalLabor)}
                icon={<Banknote size={20} />}
                color={COLORS.success}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="ค่าวัสดุ (Material)"
                value={formatCurrency(totalMaterial)}
                icon={<Layers size={20} />}
                color={COLORS.purple}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="ค่าเครื่องมือ (Tool)"
                value={formatCurrency(totalTool)}
                icon={<TrendingUp size={20} />}
                color={COLORS.warning}
              />
            </Col>
          </Row>

          {/* Finance Tabs */}
          <Tabs
            defaultActiveKey="job-costing"
            type="card"
            items={[
              {
                key: 'job-costing',
                label: (
                  <span><DollarSign size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Job Costing</span>
                ),
                children: (
                  <>
                    <Divider orientation="left" style={{ color: COLORS.textSecondary, fontSize: 14 }}>
                      ต้นทุนแยกตาม Cost Center
                    </Divider>
                    <Table
                      dataSource={costBreakdown}
                      columns={costColumns}
                      rowKey="cost_center_code"
                      locale={{ emptyText: <EmptyState message="ยังไม่มีข้อมูลต้นทุน" hint="สร้าง Work Order และบันทึก Timesheet เพื่อเริ่มสะสมข้อมูลต้นทุน" /> }}
                      pagination={false}
                      size="middle"
                      summary={() => {
                        if (costBreakdown.length === 0) return null;
                        const overhead = costBreakdown.reduce((s, r) => s + (parseFloat(r.overhead_cost) || 0), 0);
                        return (
                          <Table.Summary fixed>
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0}>
                                <span style={{ fontWeight: 600 }}>รวมทั้งหมด</span>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={1} align="right">
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(totalLabor)}</span>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={2} align="right">
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(totalMaterial)}</span>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={3} align="right">
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(totalTool)}</span>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={4} align="right">
                                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.warning }}>{formatCurrency(overhead)}</span>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={5} align="right">
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: COLORS.accent, fontSize: 15 }}>{formatCurrency(grandTotal)}</span>
                              </Table.Summary.Cell>
                            </Table.Summary.Row>
                          </Table.Summary>
                        );
                      }}
                    />
                    <Alert
                      type="info" showIcon
                      message="Job Costing Summary"
                      description="ข้อมูลต้นทุนรวบรวมจาก: Timesheet (ค่าแรง), Material Consumption (ค่าวัสดุ), Tool Checkout (ค่าเครื่องมือ), Overhead Rate (ค่าโสหุ้ย) — ดูรายละเอียดเพิ่มเติมได้ที่หน้า Work Order Detail"
                      style={{ marginTop: 20, background: COLORS.accentMuted, border: 'none' }}
                    />
                  </>
                ),
              },
              {
                key: 'gl',
                label: (
                  <span><BookOpen size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />General Ledger</span>
                ),
                children: (
                  <EmptyState
                    message="General Ledger"
                    hint="GL module อยู่ระหว่างพัฒนา — ระบบจะรวม Journal Entry, Chart of Accounts"
                  />
                ),
              },
              {
                key: 'ap',
                label: (
                  <span><ArrowDownLeft size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />AP</span>
                ),
                children: (
                  <EmptyState
                    message="Accounts Payable"
                    hint="AP module อยู่ระหว่างพัฒนา — ติดตามยอดค้างจ่ายจาก PO"
                  />
                ),
              },
              {
                key: 'ar',
                label: (
                  <span><ArrowUpRight size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />AR</span>
                ),
                children: (
                  <EmptyState
                    message="Accounts Receivable"
                    hint="AR module อยู่ระหว่างพัฒนา — ติดตามยอดค้างรับจาก SO"
                  />
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
