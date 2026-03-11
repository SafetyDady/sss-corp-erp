import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Descriptions, Button, App, Space, Popconfirm, Spin, Modal, InputNumber, Input } from 'antd';
import { ArrowLeft, Pencil, Send, CheckCircle, XCircle, X, Printer, Save } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import PageHeader from '../../components/PageHeader';
import StockTakePrintView from './StockTakePrintView';
import { formatDate, formatCurrency, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function StockTakeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const orgName = useAuthStore((s) => s.orgName);
  const orgAddress = useAuthStore((s) => s.orgAddress);
  const orgTaxId = useAuthStore((s) => s.orgTaxId);
  const { message } = App.useApp();
  const [st, setSt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLines, setEditLines] = useState([]);
  const [approveReason, setApproveReason] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/inventory/stock-take/${id}`);
      setSt(data);
    } catch {
      message.error('ไม่พบข้อมูล Stock Take');
      navigate('/supply-chain');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Actions ---
  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/inventory/stock-take/${id}/submit`);
      message.success('ส่ง Stock Take เรียบร้อย');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถส่งได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/inventory/stock-take/${id}/approve`, { action: 'approve', reason: approveReason || null });
      message.success('อนุมัติ Stock Take เรียบร้อย — ปรับ stock แล้ว');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถอนุมัติได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!approveReason?.trim()) {
      message.warning('กรุณาระบุเหตุผล');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/api/inventory/stock-take/${id}/approve`, { action: 'reject', reason: approveReason });
      message.success('ปฏิเสธ Stock Take — กลับเป็น DRAFT');
      setRejectModalOpen(false);
      setApproveReason('');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถปฏิเสธได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/inventory/stock-take/${id}/cancel`);
      message.success('ยกเลิก Stock Take เรียบร้อย');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถยกเลิกได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/api/inventory/stock-take/${id}`);
      message.success('ลบ Stock Take เรียบร้อย');
      navigate('/supply-chain');
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถลบได้'));
    } finally {
      setActionLoading(false);
    }
  };

  // --- Inline Editing ---
  const startEdit = () => {
    setEditLines((st?.lines || []).map((l) => ({ line_id: l.id, counted_qty: l.counted_qty ?? 0, note: l.note || '' })));
    setEditing(true);
  };

  const updateEditLine = (lineId, field, value) => {
    setEditLines((prev) => prev.map((l) => (l.line_id === lineId ? { ...l, [field]: value } : l)));
  };

  const handleSaveCount = async () => {
    setActionLoading(true);
    try {
      await api.put(`/api/inventory/stock-take/${id}`, { lines: editLines });
      message.success('บันทึกยอดนับเรียบร้อย');
      setEditing(false);
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถบันทึกได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    setPrintModalOpen(true);
    setTimeout(() => { window.print(); }, 400);
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!st) return null;

  const isDraft = st.status === 'DRAFT';
  const isSubmitted = st.status === 'SUBMITTED';
  const isApproved = st.status === 'APPROVED';
  const lines = st.lines || [];

  // Build edit lookup
  const editMap = {};
  editLines.forEach((l) => { editMap[l.line_id] = l; });

  const lineColumns = [
    {
      title: '#', dataIndex: 'line_number', key: 'line_number', width: 50, align: 'center',
      render: (v, _, idx) => v ?? idx + 1,
    },
    {
      title: 'สินค้า', key: 'product', ellipsis: true,
      render: (_, r) => (
        <div>
          <span style={{ fontFamily: 'monospace', color: COLORS.accent, fontSize: 12 }}>
            {r.product_sku || '-'}
          </span>
          {r.product_name && <span style={{ color: COLORS.text, marginLeft: 8 }}>{r.product_name}</span>}
        </div>
      ),
    },
    { title: 'หน่วย', key: 'unit', width: 70, render: (_, r) => r.product_unit || '-' },
    {
      title: 'ตำแหน่ง', key: 'location', width: 130,
      render: (_, r) => r.location_name || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'ยอดระบบ', dataIndex: 'system_qty', key: 'system_qty', width: 90, align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'ยอดนับ', key: 'counted_qty', width: 120, align: 'right',
      render: (_, r) => {
        if (editing && isDraft) {
          const el = editMap[r.id];
          return (
            <InputNumber
              size="small"
              min={0}
              value={el?.counted_qty ?? 0}
              onChange={(v) => updateEditLine(r.id, 'counted_qty', v ?? 0)}
              style={{ width: 90 }}
            />
          );
        }
        if (r.counted_qty == null) return <span style={{ color: COLORS.textMuted }}>-</span>;
        return <span style={{ fontWeight: 600 }}>{r.counted_qty}</span>;
      },
    },
    {
      title: 'ผลต่าง', key: 'variance', width: 90, align: 'right',
      render: (_, r) => {
        if (r.variance == null) return <span style={{ color: COLORS.textMuted }}>-</span>;
        const v = r.variance;
        const color = v > 0 ? COLORS.danger : v < 0 ? COLORS.success : COLORS.text;
        const prefix = v > 0 ? '+' : '';
        return <span style={{ fontWeight: 600, color }}>{prefix}{v}</span>;
      },
    },
    {
      title: 'มูลค่าผลต่าง', key: 'variance_value', width: 120, align: 'right',
      render: (_, r) => {
        if (r.variance_value == null) return <span style={{ color: COLORS.textMuted }}>-</span>;
        const v = parseFloat(r.variance_value);
        const color = v > 0 ? COLORS.danger : v < 0 ? COLORS.success : COLORS.text;
        return <span style={{ color }}>{formatCurrency(Math.abs(v))}</span>;
      },
    },
    {
      title: 'ต้นทุน/หน่วย', key: 'unit_cost', width: 110, align: 'right',
      render: (_, r) => formatCurrency(r.unit_cost),
    },
  ];

  if (editing && isDraft) {
    lineColumns.push({
      title: 'หมายเหตุ', key: 'note_edit', width: 150,
      render: (_, r) => {
        const el = editMap[r.id];
        return (
          <Input
            size="small"
            value={el?.note || ''}
            onChange={(e) => updateEditLine(r.id, 'note', e.target.value)}
            placeholder="หมายเหตุ"
          />
        );
      },
    });
  } else {
    lineColumns.push({
      title: 'หมายเหตุ', dataIndex: 'note', key: 'note', width: 150, ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    });
  }

  return (
    <div>
      <PageHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {st.stocktake_number}
            <StatusBadge status={st.status} />
          </span>
        }
        subtitle="รายละเอียด Stock Take"
        actions={
          <Space wrap>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/supply-chain')}>
              กลับ
            </Button>

            {/* DRAFT actions */}
            {isDraft && can('inventory.stocktake.update') && !editing && (
              <Button icon={<Pencil size={14} />} onClick={startEdit}>
                กรอกยอดนับ
              </Button>
            )}
            {isDraft && editing && (
              <>
                <Button onClick={() => setEditing(false)}>ยกเลิกแก้ไข</Button>
                <Button type="primary" icon={<Save size={14} />} onClick={handleSaveCount} loading={actionLoading}>
                  บันทึก
                </Button>
              </>
            )}
            {isDraft && !editing && can('inventory.stocktake.create') && (
              <Popconfirm title="ส่ง Stock Take เพื่อขออนุมัติ?" onConfirm={handleSubmit}>
                <Button type="primary" icon={<Send size={14} />} loading={actionLoading}>
                  ส่งอนุมัติ
                </Button>
              </Popconfirm>
            )}
            {isDraft && !editing && can('inventory.stocktake.update') && (
              <Popconfirm title="ยกเลิก Stock Take?" onConfirm={handleCancel}>
                <Button danger icon={<X size={14} />} loading={actionLoading}>ยกเลิก</Button>
              </Popconfirm>
            )}
            {isDraft && !editing && can('inventory.stocktake.delete') && (
              <Popconfirm title="ลบ Stock Take นี้?" onConfirm={handleDelete} okButtonProps={{ danger: true }}>
                <Button danger type="text" loading={actionLoading}>ลบ</Button>
              </Popconfirm>
            )}

            {/* SUBMITTED actions */}
            {isSubmitted && can('inventory.stocktake.approve') && (
              <Popconfirm title="อนุมัติ Stock Take — จะปรับ stock อัตโนมัติ?" onConfirm={handleApprove}>
                <Button type="primary" icon={<CheckCircle size={14} />} loading={actionLoading}
                  style={{ background: COLORS.success }}
                >
                  อนุมัติ
                </Button>
              </Popconfirm>
            )}
            {isSubmitted && can('inventory.stocktake.approve') && (
              <Button danger icon={<XCircle size={14} />} onClick={() => setRejectModalOpen(true)}>
                ปฏิเสธ
              </Button>
            )}
            {isSubmitted && can('inventory.stocktake.update') && (
              <Popconfirm title="ยกเลิก Stock Take?" onConfirm={handleCancel}>
                <Button danger icon={<X size={14} />} loading={actionLoading}>ยกเลิก</Button>
              </Popconfirm>
            )}

            {/* Print for all statuses */}
            <Button icon={<Printer size={14} />} onClick={handlePrint}>พิมพ์</Button>
          </Space>
        }
      />

      {/* Info Card */}
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="เลขที่">
            <span style={{ fontFamily: 'monospace' }}>{st.stocktake_number}</span>
          </Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            <StatusBadge status={st.status} />
          </Descriptions.Item>
          <Descriptions.Item label="คลังสินค้า">
            {st.warehouse_name || <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>

          <Descriptions.Item label="ตำแหน่ง">
            {st.location_name || <span style={{ color: COLORS.textMuted }}>ทั้งคลัง</span>}
          </Descriptions.Item>
          <Descriptions.Item label="ผู้นับ">
            {st.counter_name || <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>
          <Descriptions.Item label="จำนวนรายการ">
            {st.line_count} รายการ
          </Descriptions.Item>

          <Descriptions.Item label="วันที่สร้าง">
            {formatDate(st.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label="วันที่อนุมัติ">
            {st.approved_at ? <span style={{ color: COLORS.success }}>{formatDate(st.approved_at)}</span> : <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>
          <Descriptions.Item label="ผู้อนุมัติ">
            {st.approver_name || <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>

          <Descriptions.Item label="อ้างอิง">
            {st.reference ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{st.reference}</span> : <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>
          {st.note && (
            <Descriptions.Item label="หมายเหตุ" span={2}>
              {st.note}
            </Descriptions.Item>
          )}
          {st.approved_reason && (
            <Descriptions.Item label="เหตุผลอนุมัติ/ปฏิเสธ" span={st.note ? 3 : 2}>
              {st.approved_reason}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Variance Summary (when applicable) */}
      {st.total_variance_value != null && parseFloat(st.total_variance_value) !== 0 && (
        <Card size="small" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
          <Space size="large">
            <span style={{ color: COLORS.textSecondary }}>มูลค่าผลต่างรวม:</span>
            <span style={{
              fontWeight: 700,
              fontSize: 16,
              color: parseFloat(st.total_variance_value) > 0 ? COLORS.danger : COLORS.success,
            }}>
              {formatCurrency(Math.abs(parseFloat(st.total_variance_value)))}
              {parseFloat(st.total_variance_value) > 0 ? ' (สูญหาย)' : ' (ส่วนเกิน)'}
            </span>
          </Space>
        </Card>
      )}

      {/* Lines Table */}
      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>รายการนับ</h3>
      <Table
        dataSource={lines}
        columns={lineColumns}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={{ x: 1000 }}
        rowClassName={(r) => {
          if (r.variance == null) return '';
          if (r.variance > 0) return 'row-variance-loss';
          if (r.variance < 0) return 'row-variance-gain';
          return '';
        }}
      />

      {/* Reject Modal */}
      <Modal
        title="ปฏิเสธ Stock Take"
        open={rejectModalOpen}
        onCancel={() => { setRejectModalOpen(false); setApproveReason(''); }}
        onOk={handleReject}
        confirmLoading={actionLoading}
        okText="ปฏิเสธ"
        okButtonProps={{ danger: true }}
      >
        <p style={{ color: COLORS.text }}>กรุณาระบุเหตุผลในการปฏิเสธ:</p>
        <Input.TextArea
          rows={3}
          value={approveReason}
          onChange={(e) => setApproveReason(e.target.value)}
          placeholder="เหตุผล..."
        />
      </Modal>

      {/* Print Modal */}
      <Modal
        open={printModalOpen}
        onCancel={() => setPrintModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPrintModalOpen(false)}>ปิด</Button>,
          <Button key="print" type="primary" icon={<Printer size={14} />} onClick={() => window.print()}>
            พิมพ์
          </Button>,
        ]}
        title="Stock Take / ใบตรวจนับสต็อก"
        width={700}
        destroyOnHidden
      >
        <StockTakePrintView st={st} orgName={orgName} orgAddress={orgAddress} orgTaxId={orgTaxId} />
      </Modal>
    </div>
  );
}
