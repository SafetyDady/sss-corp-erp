import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Tooltip, Modal, Input } from 'antd';
import { Check, X, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function SOApprovalTab({ onAction }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
        status: 'SUBMITTED',
      };
      const { data } = await api.get('/api/sales/orders', { params });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await api.post(`/api/sales/orders/${id}/approve`, { action: 'approve' });
      message.success('อนุมัติใบสั่งขายสำเร็จ');
      fetchData();
      onAction?.();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (id) => {
    setRejectTargetId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!rejectTargetId) return;
    setActionLoading(rejectTargetId);
    try {
      await api.post(`/api/sales/orders/${rejectTargetId}/approve`, {
        action: 'reject',
        reason: rejectReason || undefined,
      });
      message.success('ปฏิเสธใบสั่งขายสำเร็จ');
      setRejectModalOpen(false);
      setRejectTargetId(null);
      setRejectReason('');
      fetchData();
      onAction?.();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      title: 'เลขที่ SO',
      dataIndex: 'so_number',
      key: 'so_number',
      width: 150,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'ลูกค้า',
      dataIndex: 'customer_name',
      key: 'customer_name',
      ellipsis: true,
      render: (v, r) =>
        v || (
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.textSecondary }}>
            {r.customer_id?.slice(0, 8)}...
          </span>
        ),
    },
    {
      title: 'วันที่สั่ง',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: 'มูลค่ารวม',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right',
      render: (v) => (
        <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'actions',
      width: 130,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'SUBMITTED' && can('sales.order.approve') && (
            <>
              <Tooltip title="อนุมัติ">
                <Button
                  type="text"
                  size="small"
                  icon={<Check size={14} />}
                  loading={actionLoading === record.id}
                  onClick={() => handleApprove(record.id)}
                  style={{ color: COLORS.success }}
                />
              </Tooltip>
              <Tooltip title="ปฏิเสธ">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<X size={14} />}
                  onClick={() => openRejectModal(record.id)}
                />
              </Tooltip>
            </>
          )}
          <Tooltip title="ดูรายละเอียด">
            <Button
              type="text"
              size="small"
              icon={<Eye size={14} />}
              onClick={() => navigate(`/sales/${record.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{
          emptyText: (
            <EmptyState
              message="ไม่มีใบสั่งขายรออนุมัติ"
              hint="SO สถานะ SUBMITTED จะแสดงที่นี่"
            />
          ),
        }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
        size="middle"
      />

      {/* Reject Modal */}
      <Modal
        title="ปฏิเสธใบสั่งขาย"
        open={rejectModalOpen}
        onCancel={() => { setRejectModalOpen(false); setRejectTargetId(null); setRejectReason(''); }}
        onOk={handleReject}
        confirmLoading={!!actionLoading}
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
