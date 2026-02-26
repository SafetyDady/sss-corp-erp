import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, App, Space, Descriptions, Spin, Popconfirm } from 'antd';
import { ArrowLeft, Check } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function SODetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { message } = App.useApp();
  const [so, setSo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [soRes, prodRes] = await Promise.all([
        api.get(`/api/sales/orders/${id}`),
        api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } }),
      ]);
      setSo(soRes.data);
      setProducts(Object.fromEntries(prodRes.data.items.map((p) => [p.id, p])));
    } catch (err) {
      message.error('\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25');
      navigate('/sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleApprove = async () => {
    try {
      await api.post(`/api/sales/orders/${id}/approve`);
      message.success('\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E44\u0E14\u0E49');
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!so) return null;

  const lineColumns = [
    { title: '\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', dataIndex: 'product_id', render: (v) => products[v]?.name || v },
    { title: '\u0E08\u0E33\u0E19\u0E27\u0E19', dataIndex: 'quantity', width: 100, align: 'right' },
    { title: '\u0E23\u0E32\u0E04\u0E32/\u0E2B\u0E19\u0E48\u0E27\u0E22', dataIndex: 'unit_price', width: 120, align: 'right', render: (v) => formatCurrency(v) },
  ];

  return (
    <div>
      <PageHeader
        title={so.so_number}
        subtitle={'\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E02\u0E32\u0E22'}
        actions={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/sales')}>{'\u0E01\u0E25\u0E31\u0E1A'}</Button>
            {so.status === 'SUBMITTED' && can('sales.order.approve') && (
              <Popconfirm title={'\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34 SO?'} onConfirm={handleApprove}>
                <Button type="primary" icon={<Check size={14} />}>Approve</Button>
              </Popconfirm>
            )}
          </Space>
        }
      />
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="SO Number">{so.so_number}</Descriptions.Item>
          <Descriptions.Item label="Status"><StatusBadge status={so.status} /></Descriptions.Item>
          <Descriptions.Item label={'\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E48\u0E07'}>{formatDate(so.order_date)}</Descriptions.Item>
          <Descriptions.Item label={'\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21'}>{formatCurrency(so.total_amount)}</Descriptions.Item>
        </Descriptions>
      </Card>
      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>{'\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}</h3>
      <Table dataSource={so.lines || []} columns={lineColumns} rowKey="id" pagination={false} size="small" />
    </div>
  );
}
