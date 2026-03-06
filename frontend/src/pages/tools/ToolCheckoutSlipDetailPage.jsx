import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Descriptions, Button, App, Space, Popconfirm, Spin, Modal, Tag } from 'antd';
import { ArrowLeft, Pencil, Send, CheckCircle, RotateCcw, X, Printer } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import PageHeader from '../../components/PageHeader';
import ToolCheckoutSlipFormModal from './ToolCheckoutSlipFormModal';
import ToolCheckoutSlipIssueModal from './ToolCheckoutSlipIssueModal';
import ToolCheckoutSlipReturnModal from './ToolCheckoutSlipReturnModal';
import ToolCheckoutSlipPrintView from './ToolCheckoutSlipPrintView';
import { formatDate, formatDateTime, formatCurrency, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function ToolCheckoutSlipDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const orgName = useAuthStore((s) => s.orgName);
  const { message } = App.useApp();
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/tools/checkout-slips/${id}`);
      setSlip(data);
    } catch {
      message.error('ไม่พบข้อมูลใบเบิกเครื่องมือ');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/tools/checkout-slips/${id}/submit`);
      message.success('ส่งใบเบิกเครื่องมือสำเร็จ');
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
      await api.post(`/api/tools/checkout-slips/${id}/cancel`);
      message.success('ยกเลิกใบเบิกเครื่องมือสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถยกเลิกได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    setPrintModalOpen(true);
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!slip) return null;

  const isDraft = slip.status === 'DRAFT';
  const isPending = slip.status === 'PENDING';
  const isCheckedOut = slip.status === 'CHECKED_OUT';
  const isPartialReturn = slip.status === 'PARTIAL_RETURN';
  const isReturned = slip.status === 'RETURNED';

  const lines = slip.lines || [];
  const returnedCount = lines.filter((l) => l.is_returned).length;
  const totalCharge = lines.reduce((sum, l) => sum + Number(l.charge_amount || 0), 0);

  const lineColumns = [
    {
      title: '#', dataIndex: 'line_number', key: 'line_number', width: 50, align: 'center',
      render: (v, _, idx) => v ?? idx + 1,
    },
    {
      title: 'เครื่องมือ', key: 'tool', ellipsis: true,
      render: (_, record) => (
        <div>
          <span style={{ fontFamily: 'monospace', color: COLORS.accent, fontSize: 12 }}>
            {record.tool_code || '-'}
          </span>
          {record.tool_name && (
            <span style={{ color: COLORS.text, marginLeft: 8 }}>{record.tool_name}</span>
          )}
        </div>
      ),
    },
    {
      title: 'ผู้ใช้', key: 'employee', width: 150,
      render: (_, record) => record.employee_name || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'อัตรา/ชม.', key: 'rate', width: 120, align: 'right',
      render: (_, record) => (
        <span style={{ fontFamily: 'monospace' }}>
          {record.rate_per_hour ? `${formatCurrency(record.rate_per_hour)}/ชม.` : '-'}
        </span>
      ),
    },
    {
      title: 'สถานะ', key: 'returned', width: 100, align: 'center',
      render: (_, record) => (
        record.is_returned ? (
          <Tag color="green" style={{ fontSize: 11 }}>คืนแล้ว</Tag>
        ) : record.checkout_id ? (
          <Tag color="orange" style={{ fontSize: 11 }}>กำลังใช้</Tag>
        ) : (
          <Tag style={{ fontSize: 11 }}>รอจ่าย</Tag>
        )
      ),
    },
    {
      title: 'คืนเมื่อ', key: 'returned_at', width: 140,
      render: (_, record) => (
        record.returned_at ? (
          <span style={{ fontSize: 12, color: COLORS.success }}>{formatDateTime(record.returned_at)}</span>
        ) : (
          <span style={{ color: COLORS.textMuted }}>-</span>
        )
      ),
    },
    {
      title: 'ค่าใช้จ่าย', dataIndex: 'charge_amount', key: 'charge', width: 120, align: 'right',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', color: Number(v) > 0 ? COLORS.accent : COLORS.textMuted }}>
          {Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </span>
      ),
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
        subtitle="รายละเอียดใบเบิกเครื่องมือ"
        actions={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(-1)}>
              กลับ
            </Button>

            {/* DRAFT actions */}
            {isDraft && can('tools.tool.update') && (
              <Button
                icon={<Pencil size={14} />}
                onClick={() => setEditModalOpen(true)}
              >
                แก้ไข
              </Button>
            )}
            {isDraft && can('tools.tool.create') && (
              <Popconfirm title="ส่งใบเบิกเครื่องมือเพื่อขอจ่าย?" onConfirm={handleSubmit}>
                <Button
                  type="primary"
                  icon={<Send size={14} />}
                  loading={actionLoading}
                >
                  ส่งใบเบิก
                </Button>
              </Popconfirm>
            )}
            {isDraft && can('tools.tool.update') && (
              <Popconfirm title="ยกเลิกใบเบิกเครื่องมือ?" onConfirm={handleCancel}>
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
            {isPending && can('tools.tool.execute') && (
              <Button
                type="primary"
                icon={<CheckCircle size={14} />}
                onClick={() => setIssueModalOpen(true)}
                style={{ background: COLORS.success }}
              >
                จ่ายเครื่องมือ
              </Button>
            )}
            {isPending && can('tools.tool.update') && (
              <Popconfirm title="ยกเลิกใบเบิกเครื่องมือ?" onConfirm={handleCancel}>
                <Button danger icon={<X size={14} />} loading={actionLoading}>
                  ยกเลิก
                </Button>
              </Popconfirm>
            )}

            {/* CHECKED_OUT / PARTIAL_RETURN actions */}
            {(isCheckedOut || isPartialReturn) && (
              <Button icon={<Printer size={14} />} onClick={handlePrint}>
                พิมพ์
              </Button>
            )}
            {(isCheckedOut || isPartialReturn) && can('tools.tool.execute') && (
              <Button
                type="primary"
                icon={<RotateCcw size={14} />}
                onClick={() => setReturnModalOpen(true)}
                style={{ background: COLORS.accent }}
              >
                คืนเครื่องมือ
              </Button>
            )}

            {/* RETURNED actions */}
            {isReturned && (
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

          <Descriptions.Item label="ผู้เบิก">
            {slip.requester_name || <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>
          <Descriptions.Item label="วันที่สร้าง">
            {formatDate(slip.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label="คืนแล้ว">
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
              {returnedCount}/{lines.length}
            </span>
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

      {/* Total Charge Summary (if any charges) */}
      {totalCharge > 0 && (
        <Card
          size="small"
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            marginBottom: 24,
            textAlign: 'right',
          }}
        >
          <span style={{ color: COLORS.textSecondary, marginRight: 12 }}>
            รวมค่าใช้จ่ายเครื่องมือ
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: COLORS.accent }}>
            {totalCharge.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
          </span>
        </Card>
      )}

      {/* Lines Table */}
      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>รายการเครื่องมือ</h3>
      <Table
        dataSource={lines}
        columns={lineColumns}
        rowKey="id"
        pagination={false}
        size="small"
      />

      {/* Edit Modal */}
      <ToolCheckoutSlipFormModal
        open={editModalOpen}
        editRecord={slip}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => { setEditModalOpen(false); fetchData(); }}
      />

      {/* Issue Modal */}
      <ToolCheckoutSlipIssueModal
        open={issueModalOpen}
        slip={slip}
        onClose={() => setIssueModalOpen(false)}
        onSuccess={() => { setIssueModalOpen(false); fetchData(); }}
      />

      {/* Return Modal */}
      <ToolCheckoutSlipReturnModal
        open={returnModalOpen}
        slip={slip}
        onClose={() => setReturnModalOpen(false)}
        onSuccess={() => { setReturnModalOpen(false); fetchData(); }}
      />

      {/* Print Modal */}
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
        title="ใบเบิกเครื่องมือ / Tool Checkout Slip"
        width={700}
        destroyOnHidden
      >
        <ToolCheckoutSlipPrintView slip={slip} orgName={orgName} />
      </Modal>
    </div>
  );
}
