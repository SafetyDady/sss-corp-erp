import { useState, useEffect, useCallback } from 'react';
import { Card, Statistic, Row, Col, Table, Button, App, DatePicker, Space, Tooltip, Spin, Divider, Alert } from 'antd';
import { Download, RefreshCw, DollarSign, TrendingUp, Layers, Banknote } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
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
      if (dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD');

      const [summaryRes, costRes] = await Promise.all([
        api.get('/api/finance/summary', { params }),
        api.get('/api/finance/cost-breakdown', { params }),
      ]);
      setSummary(summaryRes.data);
      setCostBreakdown(costRes.data.items || []);
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
      if (dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD');

      const response = await api.get('/api/finance/export', { params, responseType: 'blob' });
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
      title: 'ศูนย์ต้นทุน', dataIndex: 'cost_center_name', key: 'cost_center_name',
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
              <Card size="small" style={{ background: COLORS.card, borderColor: COLORS.border }}>
                <Statistic
                  title={<span style={{ color: COLORS.textSecondary }}>ต้นทุนรวม</span>}
                  value={grandTotal}
                  formatter={(v) => formatCurrency(v)}
                  prefix={<DollarSign size={16} style={{ color: COLORS.accent }} />}
                  valueStyle={{ color: COLORS.accent, fontFamily: 'monospace', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small" style={{ background: COLORS.card, borderColor: COLORS.border }}>
                <Statistic
                  title={<span style={{ color: COLORS.textSecondary }}>ค่าแรง (Labor)</span>}
                  value={totalLabor}
                  formatter={(v) => formatCurrency(v)}
                  prefix={<Banknote size={16} style={{ color: COLORS.success }} />}
                  valueStyle={{ color: COLORS.success, fontFamily: 'monospace', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small" style={{ background: COLORS.card, borderColor: COLORS.border }}>
                <Statistic
                  title={<span style={{ color: COLORS.textSecondary }}>ค่าวัสดุ (Material)</span>}
                  value={totalMaterial}
                  formatter={(v) => formatCurrency(v)}
                  prefix={<Layers size={16} style={{ color: COLORS.purple }} />}
                  valueStyle={{ color: COLORS.purple, fontFamily: 'monospace', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small" style={{ background: COLORS.card, borderColor: COLORS.border }}>
                <Statistic
                  title={<span style={{ color: COLORS.textSecondary }}>ค่าเครื่องมือ (Tool)</span>}
                  value={totalTool}
                  formatter={(v) => formatCurrency(v)}
                  prefix={<TrendingUp size={16} style={{ color: COLORS.warning }} />}
                  valueStyle={{ color: COLORS.warning, fontFamily: 'monospace', fontSize: 20 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Cost Breakdown Table */}
          <Divider orientation="left" style={{ color: COLORS.textSecondary, fontSize: 14 }}>
            ต้นทุนแยกตามศูนย์ต้นทุน
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

          {/* Info about Job Costing */}
          <Alert
            type="info" showIcon
            message="Job Costing Summary"
            description="ข้อมูลต้นทุนรวบรวมจาก: Timesheet (ค่าแรง), Material Consumption (ค่าวัสดุ), Tool Checkout (ค่าเครื่องมือ), Overhead Rate (ค่าโสหุ้ย) — ดูรายละเอียดเพิ่มเติมได้ที่หน้า Work Order Detail"
            style={{ marginTop: 20, background: COLORS.accentMuted, border: 'none' }}
          />
        </>
      )}
    </div>
  );
}
