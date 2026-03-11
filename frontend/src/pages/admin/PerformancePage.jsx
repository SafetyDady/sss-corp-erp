import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Card, Table, Radio, Statistic, Row, Col, Tag, Button, App, Spin, FloatButton, Typography } from 'antd';
import { Activity, Zap, AlertTriangle, Bot, TrendingUp, Clock, Server, XCircle } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const BarChartCard = lazy(() => import('../../components/BarChartCard'));
const PerformanceAIChat = lazy(() => import('../../components/PerformanceAIChat'));

const { Text } = Typography;

const PERIOD_OPTIONS = [
  { label: '24 ชม.', value: '24h' },
  { label: '7 วัน', value: '7d' },
  { label: '30 วัน', value: '30d' },
];

const severityColor = {
  HEALTHY: '#52c41a',
  WARNING: '#faad14',
  CRITICAL: '#ff4d4f',
};

const severityLabel = {
  HEALTHY: 'ระบบปกติ',
  WARNING: 'ต้องเฝ้าระวัง',
  CRITICAL: 'ต้องแก้ไขด่วน',
};

export default function PerformancePage() {
  const { message } = App.useApp();
  const [period, setPeriod] = useState('24h');
  const [summary, setSummary] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [endpointTotal, setEndpointTotal] = useState(0);
  const [slowRequests, setSlowRequests] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, epRes, slowRes, analysisRes] = await Promise.all([
        api.get('/api/admin/performance/summary', { params: { period } }),
        api.get('/api/admin/performance/endpoints', { params: { period, limit: 10 } }),
        api.get('/api/admin/performance/slow-requests', { params: { limit: 20 } }),
        api.get('/api/admin/performance/analysis/latest'),
      ]);
      setSummary(sumRes.data);
      setEndpoints(epRes.data.items || []);
      setEndpointTotal(epRes.data.total || 0);
      setSlowRequests(slowRes.data.items || []);
      setAnalysis(analysisRes.data.analysis !== undefined ? analysisRes.data : analysisRes.data);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data } = await api.post('/api/admin/performance/analyze', { period, focus: 'general' });
      setAnalysis(data);
      message.success('วิเคราะห์เสร็จแล้ว');
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถวิเคราะห์ได้');
    } finally {
      setAnalyzing(false);
    }
  };

  const fmt = (v, unit = '') => (v != null ? `${Number(v).toLocaleString()}${unit}` : '-');

  // Prepare chart data from endpoints
  const chartData = endpoints.slice(0, 8).map(ep => ({
    name: ep.path.replace('/api/', '').split('/').slice(0, 2).join('/'),
    value: Math.round(ep.avg_response_time_ms),
  }));

  // Endpoint table columns
  const epColumns = [
    { title: 'Method', dataIndex: 'method', key: 'method', width: 80,
      render: v => <Tag color={v === 'GET' ? 'blue' : v === 'POST' ? 'green' : v === 'PUT' ? 'orange' : 'red'}>{v}</Tag> },
    { title: 'Endpoint', dataIndex: 'path', key: 'path', ellipsis: true },
    { title: 'Requests', dataIndex: 'request_count', key: 'count', width: 90, align: 'right',
      render: v => v?.toLocaleString() },
    { title: 'Avg (ms)', dataIndex: 'avg_response_time_ms', key: 'avg', width: 90, align: 'right',
      render: v => <span style={{ color: v > 500 ? COLORS.danger : v > 200 ? COLORS.warning : COLORS.success }}>{v?.toFixed(1)}</span> },
    { title: 'P95 (ms)', dataIndex: 'p95_response_time_ms', key: 'p95', width: 90, align: 'right',
      render: v => v?.toFixed(1) },
    { title: 'Errors', dataIndex: 'error_count', key: 'errors', width: 80, align: 'right',
      render: v => v > 0 ? <Text type="danger">{v}</Text> : 0 },
    { title: 'Error %', dataIndex: 'error_rate', key: 'err_rate', width: 80, align: 'right',
      render: v => v > 0 ? <Text type="danger">{v}%</Text> : '0%' },
  ];

  // Slow request columns
  const slowColumns = [
    { title: 'เวลา', dataIndex: 'recorded_at', key: 'time', width: 160,
      render: v => v ? new Date(v).toLocaleString('th-TH') : '-' },
    { title: 'Method', dataIndex: 'method', key: 'method', width: 70,
      render: v => <Tag>{v}</Tag> },
    { title: 'Endpoint', dataIndex: 'path', key: 'path', ellipsis: true },
    { title: 'เวลาตอบ (ms)', dataIndex: 'response_time_ms', key: 'ms', width: 120, align: 'right',
      render: v => <span style={{ color: COLORS.danger, fontWeight: 600 }}>{v?.toFixed(0)}</span> },
    { title: 'Queries', dataIndex: 'query_count', key: 'qc', width: 80, align: 'right' },
    { title: 'Status', dataIndex: 'status_code', key: 'status', width: 80,
      render: v => <Tag color={v >= 500 ? 'red' : v >= 400 ? 'orange' : 'green'}>{v}</Tag> },
  ];

  const analysisData = analysis?.summary ? analysis : null;

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Period selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Radio.Group
          options={PERIOD_OPTIONS}
          optionType="button"
          buttonStyle="solid"
          value={period}
          onChange={e => setPeriod(e.target.value)}
        />
        <Button onClick={fetchData} loading={loading} icon={<Activity size={14} />}>
          รีเฟรช
        </Button>
      </div>

      {/* Stat cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ background: COLORS.cardBg, borderColor: COLORS.border }}>
            <Statistic title={<span style={{ color: COLORS.textMuted }}><Server size={13} /> Total Requests</span>}
              value={summary?.total_requests || 0} valueStyle={{ color: COLORS.accent, fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ background: COLORS.cardBg, borderColor: COLORS.border }}>
            <Statistic title={<span style={{ color: COLORS.textMuted }}><Clock size={13} /> Avg Response</span>}
              value={summary?.avg_response_time_ms || 0} suffix="ms" precision={1}
              valueStyle={{ color: (summary?.avg_response_time_ms || 0) > 500 ? COLORS.danger : COLORS.success, fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ background: COLORS.cardBg, borderColor: COLORS.border }}>
            <Statistic title={<span style={{ color: COLORS.textMuted }}><Zap size={13} /> P95</span>}
              value={summary?.p95_response_time_ms || 0} suffix="ms" precision={1}
              valueStyle={{ color: COLORS.text, fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ background: COLORS.cardBg, borderColor: COLORS.border }}>
            <Statistic title={<span style={{ color: COLORS.textMuted }}><TrendingUp size={13} /> P99</span>}
              value={summary?.p99_response_time_ms || 0} suffix="ms" precision={1}
              valueStyle={{ color: COLORS.text, fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ background: COLORS.cardBg, borderColor: COLORS.border }}>
            <Statistic title={<span style={{ color: COLORS.textMuted }}><XCircle size={13} /> Error Rate</span>}
              value={summary?.error_rate || 0} suffix="%" precision={2}
              valueStyle={{ color: (summary?.error_rate || 0) > 5 ? COLORS.danger : COLORS.success, fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ background: COLORS.cardBg, borderColor: COLORS.border }}>
            <Statistic title={<span style={{ color: COLORS.textMuted }}><AlertTriangle size={13} /> Slow Requests</span>}
              value={summary?.slow_request_count || 0}
              valueStyle={{ color: (summary?.slow_request_count || 0) > 10 ? COLORS.danger : COLORS.text, fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      {/* AI Analysis card + Chart */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={<span style={{ color: COLORS.text }}><Bot size={15} style={{ marginRight: 8 }} />AI Analysis</span>}
            size="small"
            style={{ background: COLORS.cardBg, borderColor: COLORS.border, minHeight: 200 }}
            extra={
              <Button size="small" type="primary" onClick={handleAnalyze} loading={analyzing}>
                วิเคราะห์ใหม่
              </Button>
            }
          >
            {analysisData ? (
              <div>
                <Tag color={severityColor[analysisData.severity] || '#999'} style={{ marginBottom: 12 }}>
                  {severityLabel[analysisData.severity] || analysisData.severity}
                </Tag>
                <div style={{ color: COLORS.text, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>
                  {analysisData.summary?.substring(0, 500)}
                  {(analysisData.summary?.length || 0) > 500 && '...'}
                </div>
                {analysisData.model_used && analysisData.model_used !== 'none' && (
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
                    Model: {analysisData.model_used} | Tokens: {analysisData.tokens_used || 0}
                  </Text>
                )}
              </div>
            ) : (
              <div style={{ color: COLORS.textMuted, textAlign: 'center', padding: 24 }}>
                กด "วิเคราะห์ใหม่" เพื่อเริ่ม AI Analysis
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Suspense fallback={<Card size="small" style={{ minHeight: 200, background: COLORS.cardBg, borderColor: COLORS.border }}><Spin /></Card>}>
            <BarChartCard
              title="Avg Response Time (Top 8 Endpoints)"
              data={chartData}
              dataKey="value"
              nameKey="name"
              unit=" ms"
              color={COLORS.accent}
              height={200}
            />
          </Suspense>
        </Col>
      </Row>

      {/* Endpoint Breakdown */}
      <Card
        title={<span style={{ color: COLORS.text }}><Server size={15} style={{ marginRight: 8 }} />Endpoint Breakdown ({endpointTotal})</span>}
        size="small"
        style={{ background: COLORS.cardBg, borderColor: COLORS.border, marginBottom: 24 }}
      >
        <Table
          columns={epColumns}
          dataSource={endpoints}
          loading={loading}
          rowKey={(r) => `${r.method}-${r.path}`}
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
        />
      </Card>

      {/* Slow Requests */}
      <Card
        title={<span style={{ color: COLORS.text }}><AlertTriangle size={15} style={{ marginRight: 8 }} />Slow Requests (ล่าสุด)</span>}
        size="small"
        style={{ background: COLORS.cardBg, borderColor: COLORS.border }}
      >
        <Table
          columns={slowColumns}
          dataSource={slowRequests}
          loading={loading}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
        />
      </Card>

      {/* AI Chat FloatButton */}
      <FloatButton
        icon={<Bot size={20} />}
        type="primary"
        tooltip="AI Performance Chat"
        onClick={() => setChatOpen(true)}
        style={{ right: 24, bottom: 24 }}
      />

      {/* AI Chat Drawer */}
      <Suspense fallback={null}>
        {chatOpen && (
          <PerformanceAIChat open={chatOpen} onClose={() => setChatOpen(false)} />
        )}
      </Suspense>
    </div>
  );
}
