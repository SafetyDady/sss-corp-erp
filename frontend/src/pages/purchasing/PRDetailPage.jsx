import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, App, Space, Descriptions, Spin, Popconfirm, Tag, Input, Modal } from 'antd';
import { ArrowLeft, Pencil, SendHorizontal, Check, X, ArrowRightLeft, Ban } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency, formatDate, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import PRFormModal from './PRFormModal';
import ConvertToPOModal from './ConvertToPOModal';

const PRIORITY_COLORS = { NORMAL: 'default', URGENT: 'red' };
const TYPE_COLORS = { STANDARD: 'blue', BLANKET: 'purple' };

export default function PRDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { message } = App.useApp();
  const [pr, setPr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [products, setProducts] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prRes, prodRes] = await Promise.all([
        api.get(`/api/purchasing/pr/${id}`),
        api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } }),
      ]);
      setPr(prRes.data);
      setProducts(Object.fromEntries(prodRes.data.items.map((p) => [p.id, p])));
    } catch {
      message.error('ไม่พบข้อมูล');
      navigate('/purchasing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/purchasing/pr/${id}/submit`);
      message.success('ส่งอนุมัติสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/purchasing/pr/${id}/approve`, { action: 'approve' });
      message.success('อนุมัติสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      message.error('กรุณาระบุเหตุผล');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/api/purchasing/pr/${id}/approve`, { action: 'reject', reason: rejectReason });
      message.success('ปฏิเสธสำเร็จ');
      setRejectModalOpen(false);
      setRejectReason('');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/purchasing/pr/${id}/cancel`);
      message.success('ยกเลิกสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!pr) return null;

  // Check if delivery is overdue
  const isOverdue = pr.delivery_date && pr.status !== 'RECEIVED' && pr.status !== 'CANCELLED' && new Date(pr.delivery_date) < new Date();

  const lineColumns = [
    { title: '#', dataIndex: 'line_number', key: 'line_number', width: 50 },
    {
      title: 'ประเภท', dataIndex: 'item_type', key: 'item_type', width: 90,
      render: (v) => <Tag color={v === 'GOODS' ? 'blue' : 'green'}>{v}</Tag>,
    },
    {
      title: 'สินค้า/บริการ', key: 'product', ellipsis: true,
      render: (_, record) => {
        if (record.product_id && products[record.product_id]) {
          const p = products[record.product_id];
          return `${p.sku} - ${p.name}`;
        }
        return record.description || '-';
      },
    },
    { title: 'จำนวน', dataIndex: 'quantity', key: 'quantity', width: 80, align: 'right' },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 70 },
    {
      title: 'ราคาประมาณ', dataIndex: 'estimated_unit_cost', key: 'estimated_unit_cost', width: 130, align: 'right',
      render: (v) => v > 0 ? formatCurrency(v) : <span style={{ color: COLORS.textMuted }}>ไม่ระบุ</span>,
    },
    {
      title: 'รวม', key: 'line_total', width: 130, align: 'right',
      render: (_, record) => {
        const total = (record.estimated_unit_cost || 0) * record.quantity;
        return total > 0 ? formatCurrency(total) : <span style={{ color: COLORS.textMuted }}>-</span>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={pr.pr_number}
        subtitle="รายละเอียดใบขอซื้อ"
        actions={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/purchasing')}>กลับ</Button>

            {/* Edit — DRAFT only */}
            {pr.status === 'DRAFT' && can('purchasing.pr.update') && (
              <Button icon={<Pencil size={14} />} onClick={() => setEditModalOpen(true)}>แก้ไข</Button>
            )}

            {/* Submit — DRAFT only */}
            {pr.status === 'DRAFT' && can('purchasing.pr.create') && (
              <Popconfirm title="ส่งอนุมัติ PR?" onConfirm={handleSubmit}>
                <Button type="primary" icon={<SendHorizontal size={14} />} loading={actionLoading}>ส่งอนุมัติ</Button>
              </Popconfirm>
            )}

            {/* Approve — SUBMITTED + has permission */}
            {pr.status === 'SUBMITTED' && can('purchasing.pr.approve') && (
              <Button type="primary" icon={<Check size={14} />} loading={actionLoading} onClick={handleApprove}
                style={{ background: COLORS.success }}>
                อนุมัติ
              </Button>
            )}

            {/* Reject — SUBMITTED + has permission */}
            {pr.status === 'SUBMITTED' && can('purchasing.pr.approve') && (
              <Button danger icon={<X size={14} />} onClick={() => setRejectModalOpen(true)}>ปฏิเสธ</Button>
            )}

            {/* Convert to PO — APPROVED + has permission */}
            {pr.status === 'APPROVED' && can('purchasing.pr.approve') && (
              <Button type="primary" icon={<ArrowRightLeft size={14} />} onClick={() => setConvertModalOpen(true)}>
                Convert to PO
              </Button>
            )}

            {/* Cancel — DRAFT/SUBMITTED */}
            {(pr.status === 'DRAFT' || pr.status === 'SUBMITTED') && can('purchasing.pr.update') && (
              <Popconfirm title="ยกเลิก PR?" onConfirm={handleCancel}>
                <Button danger icon={<Ban size={14} />} loading={actionLoading}>ยกเลิก</Button>
              </Popconfirm>
            )}
          </Space>
        }
      />

      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="PR Number">
            <span style={{ fontFamily: 'monospace' }}>{pr.pr_number}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Status"><StatusBadge status={pr.status} /></Descriptions.Item>
          <Descriptions.Item label="ประเภท PR">
            <Tag color={TYPE_COLORS[pr.pr_type] || 'default'}>{pr.pr_type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Priority">
            <Tag color={PRIORITY_COLORS[pr.priority] || 'default'}>{pr.priority}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="วันที่ต้องการ">{formatDate(pr.required_date)}</Descriptions.Item>
          <Descriptions.Item label="วันที่คาดว่าจะได้รับ">
            {pr.delivery_date ? (
              <span style={{ color: isOverdue ? COLORS.danger : COLORS.text }}>
                {formatDate(pr.delivery_date)}
                {isOverdue && ' (เกินกำหนด)'}
              </span>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="ยอดประมาณรวม">
            {pr.total_estimated > 0 ? formatCurrency(pr.total_estimated) : <span style={{ color: COLORS.textMuted }}>ไม่ระบุ</span>}
          </Descriptions.Item>
          <Descriptions.Item label="วันที่สร้าง">{formatDate(pr.created_at)}</Descriptions.Item>
          {pr.pr_type === 'BLANKET' && (
            <Descriptions.Item label="ช่วงสัญญา">
              {formatDate(pr.validity_start_date)} — {formatDate(pr.validity_end_date)}
            </Descriptions.Item>
          )}
          {pr.rejected_reason && (
            <Descriptions.Item label="เหตุผลที่ปฏิเสธ" span={3}>
              <span style={{ color: COLORS.danger }}>{pr.rejected_reason}</span>
            </Descriptions.Item>
          )}
          {pr.note && (
            <Descriptions.Item label="หมายเหตุ" span={3}>{pr.note}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>รายการสินค้า/บริการ</h3>
      <Table
        dataSource={pr.lines || []}
        columns={lineColumns}
        rowKey="id"
        pagination={false}
        size="small"
      />

      {/* Edit Modal */}
      <PRFormModal
        open={editModalOpen}
        editRecord={pr}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => { setEditModalOpen(false); fetchData(); }}
      />

      {/* Convert to PO Modal */}
      <ConvertToPOModal
        open={convertModalOpen}
        pr={pr}
        products={products}
        onClose={() => setConvertModalOpen(false)}
        onSuccess={(poId) => {
          setConvertModalOpen(false);
          navigate(`/purchasing/po/${poId}`);
        }}
      />

      {/* Reject Modal */}
      <Modal
        title="ปฏิเสธ PR"
        open={rejectModalOpen}
        onCancel={() => { setRejectModalOpen(false); setRejectReason(''); }}
        onOk={handleReject}
        confirmLoading={actionLoading}
        okText="ปฏิเสธ"
        okButtonProps={{ danger: true }}
      >
        <p style={{ marginBottom: 8 }}>กรุณาระบุเหตุผลในการปฏิเสธ:</p>
        <Input.TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="เหตุผลที่ปฏิเสธ..."
        />
      </Modal>
    </div>
  );
}
