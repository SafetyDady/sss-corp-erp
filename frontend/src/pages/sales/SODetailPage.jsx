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
      message.error('ไม่พบข้อมูล');
      navigate('/sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleApprove = async () => {
    try {
      await api.post(`/api/sales/orders/${id}/approve`);
      message.success('อนุมัติสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถอนุมัติได้');
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!so) return null;

  const lineColumns = [
    { title: 'สินค้า', dataIndex: 'product_id', render: (v) => products[v]?.name || v },
    { title: 'จำนวน', dataIndex: 'quantity', width: 100, align: 'right' },
    { title: 'ราคา/หน่วย', dataIndex: 'unit_price', width: 120, align: 'right', render: (v) => formatCurrency(v) },
  ];

  return (
    <div>
      <PageHeader
        title={so.so_number}
        subtitle={'รายละเอียดใบสั่งขาย'}
        actions={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/sales')}>{'กลับ'}</Button>
            {so.status === 'SUBMITTED' && can('sales.order.approve') && (
              <Popconfirm title={'อนุมัติ SO?'} onConfirm={handleApprove}>
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
          <Descriptions.Item label={'วันที่สั่ง'}>{formatDate(so.order_date)}</Descriptions.Item>
          {Number(so.vat_rate) > 0 ? (
            <>
              <Descriptions.Item label={'ยอดรวมก่อน VAT'}>{formatCurrency(so.subtotal_amount)}</Descriptions.Item>
              <Descriptions.Item label={`VAT ${so.vat_rate}%`}>{formatCurrency(so.vat_amount)}</Descriptions.Item>
              <Descriptions.Item label={'ยอดรวมทั้งสิ้น'}>
                <span style={{ color: COLORS.accent, fontWeight: 600 }}>{formatCurrency(so.total_amount)}</span>
              </Descriptions.Item>
            </>
          ) : (
            <Descriptions.Item label={'ยอดรวม'}>{formatCurrency(so.total_amount)}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>
      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>{'รายการสินค้า'}</h3>
      <Table dataSource={so.lines || []} columns={lineColumns} rowKey="id" pagination={false} size="small" />
    </div>
  );
}
