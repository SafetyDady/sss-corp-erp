import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, App, Space, Descriptions, Spin, Popconfirm, Modal, Input, Alert } from 'antd';
import { ArrowLeft, Check, X, Send, Pencil, Ban } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import SOFormModal from './SOFormModal';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function SODetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { message } = App.useApp();
  const [so, setSo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/sales/orders/${id}/submit`);
      message.success('ส่งอนุมัติสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถส่งอนุมัติได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/sales/orders/${id}/approve`, { action: 'approve' });
      message.success('อนุมัติสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถอนุมัติได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/sales/orders/${id}/approve`, {
        action: 'reject',
        reason: rejectReason || undefined,
      });
      message.success('ปฏิเสธ SO สำเร็จ');
      setRejectModalOpen(false);
      setRejectReason('');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/sales/orders/${id}/cancel`);
      message.success('ยกเลิก SO สำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถยกเลิกได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/sales/orders/${id}`);
      message.success('ลบ SO สำเร็จ');
      navigate('/sales');
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถลบได้');
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!so) return null;

  const canEdit = ['DRAFT', 'SUBMITTED'].includes(so.status) && can('sales.order.update');
  const canSubmit = so.status === 'DRAFT' && can('sales.order.create');
  const canApprove = so.status === 'SUBMITTED' && can('sales.order.approve');
  const canReject = so.status === 'SUBMITTED' && can('sales.order.approve');
  const canCancel = ['DRAFT', 'SUBMITTED'].includes(so.status) && can('sales.order.update');
  const canDelete = so.status === 'DRAFT' && can('sales.order.delete');

  const lineColumns = [
    { title: 'สินค้า', dataIndex: 'product_id', render: (v) => products[v]?.name || v },
    { title: 'จำนวน', dataIndex: 'quantity', width: 100, align: 'right' },
    { title: 'ราคา/หน่วย', dataIndex: 'unit_price', width: 120, align: 'right', render: (v) => formatCurrency(v) },
    {
      title: 'รวม', width: 130, align: 'right',
      render: (_, record) => formatCurrency((record.quantity || 0) * Number(record.unit_price || 0)),
    },
  ];

  return (
    <div>
      <PageHeader
        title={so.so_number}
        subtitle={'รายละเอียดใบสั่งขาย'}
        actions={
          <Space wrap>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/sales')}>{'กลับ'}</Button>
            {canEdit && (
              <Button icon={<Pencil size={14} />} onClick={() => setEditModalOpen(true)}>{'แก้ไข'}</Button>
            )}
            {canSubmit && (
              <Popconfirm title={'ส่งอนุมัติ SO?'} onConfirm={handleSubmit}>
                <Button type="primary" icon={<Send size={14} />} loading={actionLoading}>{'ส่งอนุมัติ'}</Button>
              </Popconfirm>
            )}
            {canApprove && (
              <Popconfirm title={'อนุมัติ SO?'} onConfirm={handleApprove}>
                <Button type="primary" icon={<Check size={14} />} loading={actionLoading} style={{ background: '#10b981' }}>{'อนุมัติ'}</Button>
              </Popconfirm>
            )}
            {canReject && (
              <Button danger icon={<X size={14} />} onClick={() => setRejectModalOpen(true)}>{'ปฏิเสธ'}</Button>
            )}
            {canCancel && (
              <Popconfirm title={'ยกเลิก SO?'} onConfirm={handleCancel}>
                <Button icon={<Ban size={14} />} loading={actionLoading}>{'ยกเลิก'}</Button>
              </Popconfirm>
            )}
            {canDelete && (
              <Popconfirm title={'ลบ SO นี้?'} onConfirm={handleDelete} okButtonProps={{ danger: true }}>
                <Button danger>{'ลบ'}</Button>
              </Popconfirm>
            )}
          </Space>
        }
      />

      {/* Rejected reason alert */}
      {so.rejected_reason && (
        <Alert
          type="warning"
          showIcon
          message="SO ถูกปฏิเสธ"
          description={so.rejected_reason}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="SO Number">{so.so_number}</Descriptions.Item>
          <Descriptions.Item label="Status"><StatusBadge status={so.status} /></Descriptions.Item>
          <Descriptions.Item label={'ลูกค้า'}>{so.customer_name || '-'}</Descriptions.Item>
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
          {so.note && <Descriptions.Item label={'หมายเหตุ'}>{so.note}</Descriptions.Item>}
          <Descriptions.Item label={'ผู้สร้าง'}>{so.creator_name || '-'}</Descriptions.Item>
          {so.approved_by && (
            <>
              <Descriptions.Item label={'ผู้อนุมัติ'}>{so.approver_name || '-'}</Descriptions.Item>
              <Descriptions.Item label={'อนุมัติเมื่อ'}>{so.approved_at ? formatDateTime(so.approved_at) : '-'}</Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>{'รายการสินค้า'}</h3>
      <Table dataSource={so.lines || []} columns={lineColumns} rowKey="id" pagination={false} size="small" />

      {/* Edit Modal */}
      <SOFormModal
        open={editModalOpen}
        editRecord={so}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => { setEditModalOpen(false); fetchData(); }}
      />

      {/* Reject Modal */}
      <Modal
        title="ปฏิเสธใบสั่งขาย"
        open={rejectModalOpen}
        onCancel={() => { setRejectModalOpen(false); setRejectReason(''); }}
        onOk={handleReject}
        confirmLoading={actionLoading}
        okText="ปฏิเสธ"
        okButtonProps={{ danger: true }}
      >
        <p style={{ color: COLORS.textMuted, marginBottom: 12 }}>
          SO จะถูกส่งกลับเป็น DRAFT เพื่อให้แก้ไขและส่งอนุมัติใหม่ได้
        </p>
        <Input.TextArea
          rows={3}
          placeholder="ระบุเหตุผล (ถ้ามี)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
