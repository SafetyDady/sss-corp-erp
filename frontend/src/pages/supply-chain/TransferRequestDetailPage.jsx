import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Descriptions, Button, App, Space, Popconfirm, Spin, Modal } from 'antd';
import { ArrowLeft, Pencil, Send, CheckCircle, X, Printer, ArrowLeftRight } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import PageHeader from '../../components/PageHeader';
import TransferRequestFormModal from './TransferRequestFormModal';
import TransferRequestExecuteModal from './TransferRequestExecuteModal';
import TransferRequestPrintView from './TransferRequestPrintView';
import { formatDate, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function TransferRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const orgName = useAuthStore((s) => s.orgName);
  const orgAddress = useAuthStore((s) => s.orgAddress);
  const orgTaxId = useAuthStore((s) => s.orgTaxId);
  const { message } = App.useApp();
  const [tf, setTf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/inventory/transfer-requests/${id}`);
      setTf(data);
    } catch {
      message.error('ไม่พบข้อมูลใบขอโอนย้าย');
      navigate('/supply-chain');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/inventory/transfer-requests/${id}/submit`);
      message.success('ส่งใบขอโอนย้ายสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถส่งใบขอได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/inventory/transfer-requests/${id}/cancel`);
      message.success('ยกเลิกใบขอโอนย้ายสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถยกเลิกได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    setPrintModalOpen(true);
    setTimeout(() => { window.print(); }, 400);
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!tf) return null;

  const isDraft = tf.status === 'DRAFT';
  const isPending = tf.status === 'PENDING';
  const isTransferred = tf.status === 'TRANSFERRED';

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
      title: 'จำนวนโอน', dataIndex: 'transferred_qty', key: 'transferred_qty', width: 100, align: 'right',
      render: (v, record) => {
        if (v == null || v === 0 && !isTransferred) return <span style={{ color: COLORS.textMuted }}>-</span>;
        const color = v >= record.quantity ? COLORS.success : COLORS.warning;
        return <span style={{ color, fontWeight: 600 }}>{v}</span>;
      },
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
            {tf.transfer_number}
            <StatusBadge status={tf.status} />
          </span>
        }
        subtitle="รายละเอียดใบขอโอนย้ายสินค้า"
        actions={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/supply-chain')}>
              กลับ
            </Button>

            {/* DRAFT actions */}
            {isDraft && can('inventory.movement.create') && (
              <Button icon={<Pencil size={14} />} onClick={() => setEditModalOpen(true)}>
                แก้ไข
              </Button>
            )}
            {isDraft && can('inventory.movement.create') && (
              <Popconfirm title="ส่งใบขอโอนย้ายเพื่อขออนุมัติ?" onConfirm={handleSubmit}>
                <Button type="primary" icon={<Send size={14} />} loading={actionLoading}>
                  ส่งขออนุมัติ
                </Button>
              </Popconfirm>
            )}
            {isDraft && can('inventory.movement.create') && (
              <Popconfirm title="ยกเลิกใบขอโอนย้าย?" onConfirm={handleCancel}>
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
                onClick={() => setExecuteModalOpen(true)}
                style={{ background: COLORS.success }}
              >
                ดำเนินการโอนย้าย
              </Button>
            )}
            {isPending && can('inventory.movement.create') && (
              <Popconfirm title="ยกเลิกใบขอโอนย้าย?" onConfirm={handleCancel}>
                <Button danger icon={<X size={14} />} loading={actionLoading}>
                  ยกเลิก
                </Button>
              </Popconfirm>
            )}

            {/* TRANSFERRED actions */}
            {isTransferred && (
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
          <Descriptions.Item label="เลขที่">
            <span style={{ fontFamily: 'monospace' }}>{tf.transfer_number}</span>
          </Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            <StatusBadge status={tf.status} />
          </Descriptions.Item>
          <Descriptions.Item label="วันที่สร้าง">
            {formatDate(tf.created_at)}
          </Descriptions.Item>

          <Descriptions.Item label="คลังต้นทาง">
            <span style={{ color: COLORS.text, fontWeight: 600 }}>
              {tf.source_warehouse_name || '-'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="ตำแหน่งต้นทาง">
            {tf.source_location_name || <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>
          <Descriptions.Item label="ผู้ขอโอนย้าย">
            {tf.requester_name || <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>

          <Descriptions.Item label="คลังปลายทาง">
            <span style={{ color: COLORS.accent, fontWeight: 600 }}>
              {tf.dest_warehouse_name || '-'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="ตำแหน่งปลายทาง">
            {tf.dest_location_name || <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>
          <Descriptions.Item label="">
            {/* spacer */}
          </Descriptions.Item>

          {tf.transferred_at && (
            <Descriptions.Item label="วันที่โอนย้าย">
              <span style={{ color: COLORS.success }}>{formatDate(tf.transferred_at)}</span>
            </Descriptions.Item>
          )}
          {tf.transferrer_name && (
            <Descriptions.Item label="ผู้ดำเนินการ">
              {tf.transferrer_name}
            </Descriptions.Item>
          )}
          {tf.reference && (
            <Descriptions.Item label="อ้างอิง">
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{tf.reference}</span>
            </Descriptions.Item>
          )}
          {tf.note && (
            <Descriptions.Item label="หมายเหตุ" span={3}>
              {tf.note}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Lines Table */}
      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>
        <ArrowLeftRight size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
        รายการสินค้า
      </h3>
      <Table
        dataSource={tf.lines || []}
        columns={lineColumns}
        rowKey="id"
        pagination={false}
        size="small"
      />

      {/* Edit Modal */}
      <TransferRequestFormModal
        open={editModalOpen}
        editRecord={tf}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => { setEditModalOpen(false); fetchData(); }}
      />

      {/* Execute Modal */}
      <TransferRequestExecuteModal
        open={executeModalOpen}
        tf={tf}
        onClose={() => setExecuteModalOpen(false)}
        onSuccess={() => { setExecuteModalOpen(false); fetchData(); }}
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
        title="ใบขอโอนย้ายสินค้า / Transfer Request"
        width={700}
        destroyOnHidden
      >
        <TransferRequestPrintView tf={tf} orgName={orgName} orgAddress={orgAddress} orgTaxId={orgTaxId} />
      </Modal>
    </div>
  );
}
