import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Tooltip, Tag, Modal, Input } from 'antd';
import { Check, X, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { formatCurrency, formatDate, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const PRIORITY_COLORS = { NORMAL: 'default', URGENT: 'red' };

export default function PRApprovalTab({ onAction }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  // Reject modal state
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
      const { data } = await api.get('/api/purchasing/pr', { params });
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
      await api.post(`/api/purchasing/pr/${id}/approve`, { action: 'approve' });
      message.success('อนุมัติใบขอซื้อสำเร็จ');
      fetchData();
      onAction?.();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
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
    if (!rejectReason.trim()) {
      message.error('กรุณาระบุเหตุผลในการปฏิเสธ');
      return;
    }
    setActionLoading(rejectTargetId);
    try {
      await api.post(`/api/purchasing/pr/${rejectTargetId}/approve`, {
        action: 'reject',
        reason: rejectReason,
      });
      message.success('ปฏิเสธใบขอซื้อสำเร็จ');
      setRejectModalOpen(false);
      setRejectReason('');
      setRejectTargetId(null);
      fetchData();
      onAction?.();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      title: 'เลขที่ PR',
      dataIndex: 'pr_number',
      key: 'pr_number',
      width: 160,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'ประเภท',
      dataIndex: 'pr_type',
      key: 'pr_type',
      width: 100,
      render: (v) => <Tag color={v === 'BLANKET' ? 'purple' : 'blue'}>{v}</Tag>,
    },
    {
      title: 'วันที่ต้องการ',
      dataIndex: 'required_date',
      key: 'required_date',
      width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (v) => <Tag color={PRIORITY_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'ยอดประมาณ',
      dataIndex: 'total_estimated',
      key: 'total_estimated',
      width: 130,
      align: 'right',
      render: (v) => v > 0 ? (
        <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>
      ) : <span style={{ color: COLORS.textMuted }}>ไม่ระบุ</span>,
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
      width: 120,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'SUBMITTED' && can('purchasing.pr.approve') && (
            <>
              <Tooltip title="อนุมัติ">
                <Button
                  type="text" size="small"
                  icon={<Check size={14} />}
                  loading={actionLoading === record.id}
                  onClick={() => handleApprove(record.id)}
                  style={{ color: COLORS.success }}
                />
              </Tooltip>
              <Tooltip title="ปฏิเสธ">
                <Button
                  type="text" size="small" danger
                  icon={<X size={14} />}
                  loading={actionLoading === record.id}
                  onClick={() => openRejectModal(record.id)}
                />
              </Tooltip>
            </>
          )}
          <Tooltip title="ดูรายละเอียด">
            <Button
              type="text" size="small"
              icon={<Eye size={14} />}
              onClick={() => navigate(`/purchasing/pr/${record.id}`)}
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
              message="ไม่มีใบขอซื้อรออนุมัติ"
              hint="PR สถานะ SUBMITTED จะแสดงที่นี่"
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

      {/* Reject Reason Modal */}
      <Modal
        title="ปฏิเสธใบขอซื้อ"
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => {
          setRejectModalOpen(false);
          setRejectReason('');
          setRejectTargetId(null);
        }}
        confirmLoading={!!actionLoading}
        okText="ยืนยันปฏิเสธ"
        cancelText="ยกเลิก"
        okButtonProps={{ danger: true }}
      >
        <p style={{ marginBottom: 8, color: COLORS.textSecondary }}>
          กรุณาระบุเหตุผลในการปฏิเสธ:
        </p>
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
