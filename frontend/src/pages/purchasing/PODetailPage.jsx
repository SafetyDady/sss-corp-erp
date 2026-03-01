import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Table, Button, App, Space, Descriptions, Spin, Popconfirm, Tag } from 'antd';
import { ArrowLeft, Check, PackageCheck, QrCode } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency, formatDate, formatDateTime, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import GoodsReceiptModal from './GoodsReceiptModal';
import POQRCodeModal from './POQRCodeModal';

export default function PODetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can } = usePermission();
  const { message } = App.useApp();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState({});
  const [grModalOpen, setGrModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [poRes, prodRes] = await Promise.all([
        api.get(`/api/purchasing/po/${id}`),
        api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } }),
      ]);
      setPo(poRes.data);
      setProducts(Object.fromEntries(prodRes.data.items.map((p) => [p.id, p])));
      // Auto-open GR modal when scanned via QR code
      if (searchParams.get('action') === 'receive' && poRes.data.status === 'APPROVED') {
        setGrModalOpen(true);
      }
    } catch (err) {
      message.error('ไม่พบข้อมูล');
      navigate('/purchasing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleApprove = async () => {
    try {
      await api.post(`/api/purchasing/po/${id}/approve`);
      message.success('อนุมัติสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถอนุมัติได้'));
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!po) return null;

  const lineColumns = [
    {
      title: 'ประเภท', dataIndex: 'item_type', key: 'item_type', width: 90,
      render: (v) => <Tag color={(v || 'GOODS') === 'GOODS' ? 'blue' : 'green'}>{v || 'GOODS'}</Tag>,
    },
    {
      title: 'สินค้า/บริการ', key: 'product',
      render: (_, record) => {
        if (record.product_id && products[record.product_id]) {
          const p = products[record.product_id];
          return `${p.sku} - ${p.name}`;
        }
        return record.description || record.product_id || '-';
      },
    },
    { title: 'จำนวนสั่ง', dataIndex: 'quantity', key: 'quantity', width: 90, align: 'right' },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 60 },
    {
      title: 'ราคา/หน่วย', dataIndex: 'unit_cost', key: 'unit_cost', width: 120, align: 'right',
      render: (v) => formatCurrency(v),
    },
    {
      title: 'รวม', key: 'line_total', width: 120, align: 'right',
      render: (_, record) => formatCurrency((record.unit_cost || 0) * record.quantity),
    },
    {
      title: 'รับแล้ว', dataIndex: 'received_qty', key: 'received_qty', width: 80, align: 'right',
      render: (v, record) => {
        const color = (v || 0) >= record.quantity ? COLORS.success : COLORS.warning;
        return <span style={{ color }}>{v || 0}</span>;
      },
    },
    {
      title: 'รับโดย', key: 'received_info', width: 130,
      render: (_, record) => record.received_at ? (
        <span style={{ fontSize: 11, color: COLORS.textMuted }}>{formatDateTime(record.received_at)}</span>
      ) : '-',
    },
  ];

  return (
    <div>
      <PageHeader
        title={po.po_number}
        subtitle="รายละเอียดใบสั่งซื้อ"
        actions={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/purchasing')}>กลับ</Button>
            {po.status === 'SUBMITTED' && can('purchasing.po.approve') && (
              <Popconfirm title="อนุมัติ PO?" onConfirm={handleApprove}>
                <Button type="primary" icon={<Check size={14} />}>Approve</Button>
              </Popconfirm>
            )}
            {po.status === 'APPROVED' && can('purchasing.po.update') && (
              <Button icon={<PackageCheck size={14} />} onClick={() => setGrModalOpen(true)}>
                Goods Receipt
              </Button>
            )}
            {(po.status === 'APPROVED' || po.status === 'RECEIVED') && can('purchasing.po.read') && (
              <Button icon={<QrCode size={14} />} onClick={() => setQrModalOpen(true)}>
                QR Code
              </Button>
            )}
          </Space>
        }
      />

      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="PO Number">
            <span style={{ fontFamily: 'monospace' }}>{po.po_number}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Status"><StatusBadge status={po.status} /></Descriptions.Item>
          <Descriptions.Item label="ซัพพลายเออร์">
            {po.supplier_code ? (
              <span>
                <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{po.supplier_code}</span>
                {' — '}{po.supplier_name}
              </span>
            ) : (
              po.supplier_name
            )}
          </Descriptions.Item>
          {po.supplier_contact && (
            <Descriptions.Item label="ผู้ติดต่อ">{po.supplier_contact}</Descriptions.Item>
          )}
          {po.supplier_phone && (
            <Descriptions.Item label="โทรศัพท์">{po.supplier_phone}</Descriptions.Item>
          )}
          <Descriptions.Item label="ยอดรวม">{formatCurrency(po.total_amount)}</Descriptions.Item>
          <Descriptions.Item label="วันที่สั่ง">{formatDate(po.order_date)}</Descriptions.Item>
          <Descriptions.Item label="วันที่คาดรับ">{formatDate(po.expected_date)}</Descriptions.Item>
          {po.pr_number && (
            <Descriptions.Item label="PR อ้างอิง">
              <Button type="link" size="small" style={{ padding: 0, fontFamily: 'monospace' }}
                onClick={() => navigate(`/purchasing/pr/${po.pr_id}`)}>
                {po.pr_number}
              </Button>
            </Descriptions.Item>
          )}
          {po.delivery_note_number && (
            <Descriptions.Item label="เลขใบวางของ">
              <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{po.delivery_note_number}</span>
            </Descriptions.Item>
          )}
          {po.note && (
            <Descriptions.Item label="หมายเหตุ" span={po.delivery_note_number ? 2 : 3}>{po.note}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>รายการสินค้า/บริการ</h3>
      <Table
        dataSource={po.lines || []}
        columns={lineColumns}
        rowKey="id"
        pagination={false}
        size="small"
      />

      <GoodsReceiptModal
        open={grModalOpen}
        po={po}
        products={products}
        onClose={() => setGrModalOpen(false)}
        onSuccess={() => { setGrModalOpen(false); fetchData(); }}
      />

      <POQRCodeModal
        open={qrModalOpen}
        po={po}
        products={products}
        onClose={() => setQrModalOpen(false)}
      />
    </div>
  );
}
