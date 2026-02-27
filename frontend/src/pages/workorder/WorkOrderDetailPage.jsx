import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Button, App, Space, Descriptions, Spin, Popconfirm, Progress, Table } from 'antd';
import { ArrowLeft, Play, Square, Users } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function WorkOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { message } = App.useApp();
  const [wo, setWo] = useState(null);
  const [cost, setCost] = useState(null);
  const [manhour, setManhour] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [woRes, costRes, mhRes] = await Promise.all([
        api.get(`/api/work-orders/${id}`),
        api.get(`/api/work-orders/${id}/cost-summary`).catch(() => ({ data: null })),
        api.get(`/api/work-orders/${id}/manhour-summary`).catch(() => ({ data: null })),
      ]);
      setWo(woRes.data);
      setCost(costRes.data);
      setManhour(mhRes.data);
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25');
      navigate('/work-orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleOpen = async () => {
    try {
      await api.post(`/api/work-orders/${id}/open`);
      message.success('\u0E40\u0E1B\u0E34\u0E14 Work Order \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E1B\u0E34\u0E14\u0E44\u0E14\u0E49');
    }
  };

  const handleClose = async () => {
    try {
      await api.post(`/api/work-orders/${id}/close`);
      message.success('\u0E1B\u0E34\u0E14 Work Order \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1B\u0E34\u0E14\u0E44\u0E14\u0E49');
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!wo) return null;

  const costCards = cost ? [
    { label: 'Material Cost', value: cost.material_cost, color: '#3b82f6' },
    { label: 'ManHour Cost', value: cost.manhour_cost, color: COLORS.success },
    { label: 'Tools Recharge', value: cost.tools_recharge, color: COLORS.warning },
    { label: 'Admin Overhead', value: cost.admin_overhead, color: COLORS.purple },
  ] : [];

  return (
    <div>
      <PageHeader
        title={wo.wo_number}
        subtitle={'\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 Work Order'}
        actions={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/work-orders')}>
              {'\u0E01\u0E25\u0E31\u0E1A'}
            </Button>
            {wo.status === 'DRAFT' && can('workorder.order.update') && (
              <Popconfirm title={'\u0E40\u0E1B\u0E34\u0E14 Work Order?'} onConfirm={handleOpen}>
                <Button type="primary" icon={<Play size={14} />}>Open</Button>
              </Popconfirm>
            )}
            {wo.status === 'OPEN' && can('workorder.order.approve') && (
              <Popconfirm title={'\u0E1B\u0E34\u0E14 Work Order?'} onConfirm={handleClose}>
                <Button icon={<Square size={14} />}>Close</Button>
              </Popconfirm>
            )}
          </Space>
        }
      />

      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="WO Number">{wo.wo_number}</Descriptions.Item>
          <Descriptions.Item label="Status"><StatusBadge status={wo.status} /></Descriptions.Item>
          <Descriptions.Item label={'\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32'}>{wo.customer_name}</Descriptions.Item>
          <Descriptions.Item label="Cost Center">{wo.cost_center_code || '-'}</Descriptions.Item>
          <Descriptions.Item label={'\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14'} span={2}>{wo.description}</Descriptions.Item>
          <Descriptions.Item label={'\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D'}>{formatDateTime(wo.opened_at)}</Descriptions.Item>
          <Descriptions.Item label={'\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D'}>{formatDateTime(wo.closed_at)}</Descriptions.Item>
        </Descriptions>
      </Card>

      {cost && (
        <>
          <h3 style={{ color: COLORS.text, marginBottom: 16 }}>Job Costing Summary</h3>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {costCards.map((c, i) => (
              <Col xs={24} sm={12} lg={6} key={i}>
                <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 }}>{c.label}</div>
                  <div style={{ color: c.color, fontSize: 20, fontWeight: 600 }}>{formatCurrency(c.value)}</div>
                </Card>
              </Col>
            ))}
          </Row>
          <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: COLORS.text, fontSize: 16, fontWeight: 600 }}>Total Cost</span>
              <span style={{ color: COLORS.accent, fontSize: 24, fontWeight: 700 }}>{formatCurrency(cost.total_cost)}</span>
            </div>
          </Card>
        </>
      )}

      {manhour && (
        <>
          <h3 style={{ color: COLORS.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} /> ManHour Summary
          </h3>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 }}>Planned Hours</div>
                <div style={{ color: '#3b82f6', fontSize: 20, fontWeight: 600 }}>
                  {Number(manhour.planned_manhours || 0).toFixed(1)} hrs
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 }}>Actual Hours</div>
                <div style={{ color: COLORS.success, fontSize: 20, fontWeight: 600 }}>
                  {Number(manhour.actual_manhours || 0).toFixed(1)} hrs
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 }}>Remaining</div>
                <div style={{ color: Number(manhour.remaining_manhours) < 0 ? COLORS.error : COLORS.warning, fontSize: 20, fontWeight: 600 }}>
                  {Number(manhour.remaining_manhours || 0).toFixed(1)} hrs
                </div>
              </Card>
            </Col>
          </Row>

          {manhour.planned_manhours > 0 && (
            <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
              <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>Progress</div>
              <Progress
                percent={Math.min(Number(manhour.progress_pct || 0), 100)}
                strokeColor={Number(manhour.progress_pct) > 100 ? COLORS.error : COLORS.accent}
                trailColor={COLORS.border}
                format={(pct) => `${Number(manhour.progress_pct || 0).toFixed(1)}%`}
              />
            </Card>
          )}

          {manhour.workers && manhour.workers.length > 0 && (
            <Card
              title={<span style={{ color: COLORS.text }}>Workers Detail</span>}
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
              styles={{ header: { background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` } }}
            >
              <Table
                dataSource={manhour.workers}
                rowKey="employee_id"
                pagination={false}
                size="small"
                columns={[
                  { title: 'Employee', dataIndex: 'employee_name', key: 'name' },
                  {
                    title: 'Regular (hrs)',
                    dataIndex: 'regular_hours',
                    key: 'regular',
                    align: 'right',
                    render: (v) => Number(v || 0).toFixed(1),
                  },
                  {
                    title: 'OT (hrs)',
                    dataIndex: 'ot_hours',
                    key: 'ot',
                    align: 'right',
                    render: (v) => Number(v || 0).toFixed(1),
                  },
                  {
                    title: 'Total (hrs)',
                    dataIndex: 'total_hours',
                    key: 'total',
                    align: 'right',
                    render: (v) => <strong>{Number(v || 0).toFixed(1)}</strong>,
                  },
                ]}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
