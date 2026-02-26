import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, App, Space, Descriptions, Spin, Popconfirm } from 'antd';
import { ArrowLeft, Check, PackageCheck } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function PODetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { message } = App.useApp();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [poRes, prodRes] = await Promise.all([
        api.get(`/api/purchasing/po/${id}`),
        api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } }),
      ]);
      setPo(poRes.data);
      setProducts(Object.fromEntries(prodRes.data.items.map((p) => [p.id, p])));
    } catch (err) {
      message.error('\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25');
      navigate('/purchasing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleApprove = async () => {
    try {
      await api.post(`/api/purchasing/po/${id}/approve`);
      message.success('\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E44\u0E14\u0E49');
    }
  };

  const handleReceive = async () => {
    try {
      await api.post(`/api/purchasing/po/${id}/receive`);
      message.success('\u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E44\u0E14\u0E49');
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!po) return null;

  const lineColumns = [
    {
      title: '\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', dataIndex: 'product_id', key: 'product_id',
      render: (v) => products[v]?.name || v,
    },
    { title: '\u0E08\u0E33\u0E19\u0E27\u0E19\u0E2A\u0E31\u0E48\u0E07', dataIndex: 'quantity', key: 'quantity', width: 100, align: 'right' },
    {
      title: '\u0E23\u0E32\u0E04\u0E32/\u0E2B\u0E19\u0E48\u0E27\u0E22', dataIndex: 'unit_cost', key: 'unit_cost', width: 120, align: 'right',
      render: (v) => formatCurrency(v),
    },
    { title: '\u0E23\u0E31\u0E1A\u0E41\u0E25\u0E49\u0E27', dataIndex: 'received_qty', key: 'received_qty', width: 100, align: 'right' },
  ];

  return (
    <div>
      <PageHeader
        title={po.po_number}
        subtitle={'\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D'}
        actions={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/purchasing')}>{'\u0E01\u0E25\u0E31\u0E1A'}</Button>
            {po.status === 'SUBMITTED' && can('purchasing.po.approve') && (
              <Popconfirm title={'\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34 PO?'} onConfirm={handleApprove}>
                <Button type="primary" icon={<Check size={14} />}>Approve</Button>
              </Popconfirm>
            )}
            {po.status === 'APPROVED' && can('purchasing.po.update') && (
              <Popconfirm title={'\u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14?'} onConfirm={handleReceive}>
                <Button icon={<PackageCheck size={14} />}>Goods Receipt</Button>
              </Popconfirm>
            )}
          </Space>
        }
      />
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="PO Number">{po.po_number}</Descriptions.Item>
          <Descriptions.Item label="Status"><StatusBadge status={po.status} /></Descriptions.Item>
          <Descriptions.Item label={'\u0E0B\u0E31\u0E1E\u0E1E\u0E25\u0E32\u0E22\u0E40\u0E2D\u0E2D\u0E23\u0E4C'}>{po.supplier_name}</Descriptions.Item>
          <Descriptions.Item label={'\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21'}>{formatCurrency(po.total_amount)}</Descriptions.Item>
          <Descriptions.Item label={'\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E48\u0E07'}>{formatDate(po.order_date)}</Descriptions.Item>
          <Descriptions.Item label={'\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E04\u0E32\u0E14\u0E23\u0E31\u0E1A'}>{formatDate(po.expected_date)}</Descriptions.Item>
        </Descriptions>
      </Card>
      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>{'\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}</h3>
      <Table
        dataSource={po.lines || []}
        columns={lineColumns}
        rowKey="id"
        pagination={false}
        size="small"
      />
    </div>
  );
}
