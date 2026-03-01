import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Descriptions, Button, App, Space, Popconfirm, Spin, Modal } from 'antd';
import { ArrowLeft, Pencil, Send, CheckCircle, X, Printer } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import PageHeader from '../../components/PageHeader';
import WithdrawalSlipFormModal from './WithdrawalSlipFormModal';
import WithdrawalSlipIssueModal from './WithdrawalSlipIssueModal';
import WithdrawalSlipPrintView from './WithdrawalSlipPrintView';
import { formatDate, formatCurrency, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const TYPE_LABELS = {
  WO_CONSUME: 'เบิกเข้า Work Order',
  CC_ISSUE: 'เบิกเข้า Cost Center',
};

export default function WithdrawalSlipDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { message } = App.useApp();
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/inventory/withdrawal-slips/${id}`);
      setSlip(data);
    } catch {
      message.error('ไม่พบข้อมูลใบเบิก');
      navigate('/supply-chain');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/inventory/withdrawal-slips/${id}/submit`);
      message.success('ส่งใบเบิกสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถส่งใบเบิกได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/inventory/withdrawal-slips/${id}/cancel`);
      message.success('ยกเลิกใบเบิกสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถยกเลิกได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    setPrintModalOpen(true);
    // Delay to let modal render before printing
    setTimeout(() => {
      window.print();
    }, 400);
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!slip) return null;

  const isDraft = slip.status === 'DRAFT';
  const isPending = slip.status === 'PENDING';
  const isIssued = slip.status === 'ISSUED';
  const isCancelled = slip.status === 'CANCELLED';

  const lineColumns = [
    {
      title: '#', dataIndex: 'line_number', key: 'line_number', width: 50, align: 'center',
      render: (v, _, idx) => v ?? idx + 1,
    },
    {
      title: 'สินค้า', key: 'product', ellipsis: true,
      render: (_, record) => (
        <div>
          <span style={{ fontFamily: 'monospace', color: COLORS.accent, fontSize: 12 }}>
            {record.product_sku || '-'}
          </span>
          {record.product_name && (
            <span style={{ color: COLORS.text, marginLeft: 8 }}>{record.product_name}</span>
          )}
        </div>
      ),
    },
    {
      title: 'หน่วย', key: 'unit', width: 80,
      render: (_, record) => record.product_unit || '-',
    },
    {
      title: 'จำนวนขอ', dataIndex: 'quantity', key: 'quantity', width: 100, align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'จำนวนจ่าย', dataIndex: 'issued_qty', key: 'issued_qty', width: 100, align: 'right',
      render: (v, record) => {
        if (v == null) return <span style={{ color: COLORS.textMuted }}>-</span>;
        const color = v >= record.quantity ? COLORS.success : COLORS.warning;
        return <span style={{ color, fontWeight: 600 }}>{v}</span>;
      },
    },
    {
      title: 'ตำแหน่ง', key: 'location', width: 150,
      render: (_, record) => record.location_name || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'Movement', key: 'movement', width: 100, align: 'center',
      render: (_, record) => {
        if (!record.movement_id) return <span style={{ color: COLORS.textMuted }}>-</span>;
        return (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, fontSize: 12 }}
            onClick={() => navigate('/supply-chain')}
          >
            ดู Movement
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {slip.slip_number}
            <StatusBadge status={slip.status} />
          </span>
        }
        subtitle="รายละเอียดใบเบิกของ"
        actions={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/supply-chain')}>
              กลับ
            </Button>

            {/* DRAFT actions */}
            {isDraft && can('inventory.withdrawal.update') && (
              <Button
                icon={<Pencil size={14} />}
                onClick={() => setEditModalOpen(true)}
              >
                แก้ไข
              </Button>
            )}
            {isDraft && can('inventory.withdrawal.create') && (
              <Popconfirm title="ส่งใบเบิกเพื่อขอจ่ายของ?" onConfirm={handleSubmit}>
                <Button
                  type="primary"
                  icon={<Send size={14} />}
                  loading={actionLoading}
                >
                  ส่งใบเบิก
                </Button>
              </Popconfirm>
            )}
            {isDraft && can('inventory.withdrawal.update') && (
              <Popconfirm title="ยกเลิกใบเบิก?" onConfirm={handleCancel}>
                <Button danger icon={<X size={14} />} loading={actionLoading}>
                  ยกเลิก
                </Button>
              </Popconfirm>
            )}

            {/* PENDING actions */}
            {isPending && (
              <Button icon={<Printer size={14} />} onClick={handlePrint}>
                พิมพ์
              </Button>
            )}
            {isPending && can('inventory.withdrawal.approve') && (
              <Button
                type="primary"
                icon={<CheckCircle size={14} />}
                onClick={() => setIssueModalOpen(true)}
                style={{ background: COLORS.success }}
              >
                จ่ายของ
              </Button>
            )}
            {isPending && can('inventory.withdrawal.update') && (
              <Popconfirm title="ยกเลิกใบเบิก?" onConfirm={handleCancel}>
                <Button danger icon={<X size={14} />} loading={actionLoading}>
                  ยกเลิก
                </Button>
              </Popconfirm>
            )}

            {/* ISSUED actions */}
            {isIssued && (
              <Button icon={<Printer size={14} />} onClick={handlePrint}>
                พิมพ์
              </Button>
            )}
          </Space>
        }
      />

      {/* Info Card */}
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="เลขที่ใบเบิก">
            <span style={{ fontFamily: 'monospace' }}>{slip.slip_number}</span>
          </Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            <StatusBadge status={slip.status} />
          </Descriptions.Item>
          <Descriptions.Item label="ประเภท">
            <span style={{ color: COLORS.accent }}>
              {TYPE_LABELS[slip.withdrawal_type] || slip.withdrawal_type}
            </span>
          </Descriptions.Item>

          {slip.withdrawal_type === 'WO_CONSUME' && (
            <Descriptions.Item label="Work Order">
              {slip.work_order_number ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, fontFamily: 'monospace' }}
                  onClick={() => slip.work_order_id && navigate(`/work-orders/${slip.work_order_id}`)}
                >
                  {slip.work_order_number}
                </Button>
              ) : (
                <span style={{ color: COLORS.textMuted }}>-</span>
              )}
            </Descriptions.Item>
          )}
          {slip.withdrawal_type === 'CC_ISSUE' && (
            <Descriptions.Item label="Cost Center">
              <span style={{ color: COLORS.text }}>
                {slip.cost_center_name || <span style={{ color: COLORS.textMuted }}>-</span>}
              </span>
            </Descriptions.Item>
          )}

          <Descriptions.Item label="ผู้เบิก">
            {slip.requester_name || <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>
          <Descriptions.Item label="วันที่สร้าง">
            {formatDate(slip.created_at)}
          </Descriptions.Item>

          {slip.issued_at && (
            <Descriptions.Item label="วันที่จ่าย">
              <span style={{ color: COLORS.success }}>{formatDate(slip.issued_at)}</span>
            </Descriptions.Item>
          )}
          {slip.issuer_name && (
            <Descriptions.Item label="ผู้จ่าย">
              {slip.issuer_name}
            </Descriptions.Item>
          )}

          {slip.reference && (
            <Descriptions.Item label="อ้างอิง">
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{slip.reference}</span>
            </Descriptions.Item>
          )}
          {slip.note && (
            <Descriptions.Item label="หมายเหตุ" span={3}>
              {slip.note}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Lines Table */}
      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>รายการสินค้า</h3>
      <Table
        dataSource={slip.lines || []}
        columns={lineColumns}
        rowKey="id"
        pagination={false}
        size="small"
      />

      {/* Edit Modal */}
      <WithdrawalSlipFormModal
        open={editModalOpen}
        editRecord={slip}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => { setEditModalOpen(false); fetchData(); }}
      />

      {/* Issue Modal */}
      <WithdrawalSlipIssueModal
        open={issueModalOpen}
        slip={slip}
        onClose={() => setIssueModalOpen(false)}
        onSuccess={() => { setIssueModalOpen(false); fetchData(); }}
      />

      {/* Print Modal (hidden, for print rendering) */}
      <Modal
        open={printModalOpen}
        onCancel={() => setPrintModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPrintModalOpen(false)}>ปิด</Button>,
          <Button
            key="print"
            type="primary"
            icon={<Printer size={14} />}
            onClick={() => window.print()}
          >
            พิมพ์
          </Button>,
        ]}
        title="ใบเบิกของ / Stock Withdrawal Slip"
        width={700}
        destroyOnHidden
      >
        <WithdrawalSlipPrintView slip={slip} />
      </Modal>
    </div>
  );
}
