import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Button, Space, App, Spin, Table, Popconfirm, Alert, Divider, Tag, Modal } from 'antd';
import { ArrowLeft, Send, CheckCircle, XCircle, DollarSign, Ban, AlertTriangle, Printer } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import PaymentModal from './PaymentModal';
import SupplierInvoicePrintView from './SupplierInvoicePrintView';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { message } = App.useApp();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const orgName = useAuthStore((s) => s.orgName);
  const orgAddress = useAuthStore((s) => s.orgAddress);
  const orgTaxId = useAuthStore((s) => s.orgTaxId);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/finance/invoices/${id}`);
      setInvoice(res.data);
    } catch (err) {
      message.error('ไม่สามารถโหลดข้อมูลใบวางบิลได้');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  const handleAction = async (action, url, body = {}) => {
    setActionLoading(true);
    try {
      await api.post(url, body);
      message.success(`${action}สำเร็จ`);
      fetchInvoice();
    } catch (err) {
      message.error(err.response?.data?.detail || `${action}ล้มเหลว`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!invoice) return <div style={{ textAlign: 'center', padding: 80 }}>ไม่พบข้อมูล</div>;

  const inv = invoice;
  const remaining = Number(inv.net_payment) - Number(inv.paid_amount);
  const status = inv.status;

  const paymentColumns = [
    { title: 'วันที่จ่าย', dataIndex: 'payment_date', key: 'payment_date', render: (v) => formatDate(v) },
    { title: 'ยอดจ่าย', dataIndex: 'amount', key: 'amount', align: 'right', render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span> },
    { title: 'WHT หัก', dataIndex: 'wht_deducted', key: 'wht_deducted', align: 'right', render: (v) => <span style={{ fontFamily: 'monospace', color: Number(v) > 0 ? COLORS.warning : undefined }}>{formatCurrency(v)}</span> },
    { title: 'วิธีจ่าย', dataIndex: 'payment_method', key: 'payment_method', render: (v) => v || '-' },
    { title: 'อ้างอิง', dataIndex: 'reference', key: 'reference', render: (v) => v || '-' },
    { title: 'ผู้บันทึก', dataIndex: 'paid_by_name', key: 'paid_by_name', render: (v) => v || '-' },
  ];

  return (
    <div>
      <PageHeader
        title={
          <Space>
            <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/finance')} type="text" />
            {`ใบวางบิล: ${inv.invoice_number}`}
            <StatusBadge status={status} />
            {inv.is_overdue && <StatusBadge status="OVERDUE" />}
          </Space>
        }
        subtitle={`PO: ${inv.po_number || '-'} | Supplier: ${inv.supplier_name || '-'}`}
      />

      {/* Overdue Alert */}
      {inv.is_overdue && (
        <Alert
          type="error"
          showIcon
          icon={<AlertTriangle size={16} />}
          message="ใบวางบิลเกินกำหนดชำระ"
          description={`ครบกำหนด: ${formatDate(inv.due_date)} — กรุณาดำเนินการชำระเงินโดยเร็ว`}
          style={{ marginBottom: 20 }}
        />
      )}

      {/* Action Buttons */}
      <div style={{ marginBottom: 20 }}>
        <Space wrap>
          {status === 'DRAFT' && can('finance.invoice.create') && (
            <Popconfirm title="ยืนยันส่งขออนุมัติ?" onConfirm={() => handleAction('ส่งขออนุมัติ', `/api/finance/invoices/${id}/submit`)}>
              <Button icon={<Send size={14} />} type="primary" loading={actionLoading}>ส่งขออนุมัติ</Button>
            </Popconfirm>
          )}
          {status === 'PENDING' && can('finance.invoice.approve') && (
            <>
              <Popconfirm title="ยืนยันอนุมัติใบวางบิล?" onConfirm={() => handleAction('อนุมัติ', `/api/finance/invoices/${id}/approve`, { action: 'approve' })}>
                <Button icon={<CheckCircle size={14} />} type="primary" loading={actionLoading} style={{ background: COLORS.success }}>อนุมัติ</Button>
              </Popconfirm>
              <Popconfirm title="ยืนยันปฏิเสธ?" onConfirm={() => handleAction('ปฏิเสธ', `/api/finance/invoices/${id}/approve`, { action: 'reject' })}>
                <Button icon={<XCircle size={14} />} danger loading={actionLoading}>ปฏิเสธ</Button>
              </Popconfirm>
            </>
          )}
          {status === 'APPROVED' && can('finance.invoice.approve') && (
            <Button icon={<DollarSign size={14} />} type="primary" onClick={() => setPaymentModal(true)}>
              บันทึกการจ่ายเงิน
            </Button>
          )}
          {(status === 'DRAFT' || status === 'PENDING') && can('finance.invoice.update') && (
            <Popconfirm title="ยืนยันยกเลิกใบวางบิล?" onConfirm={() => handleAction('ยกเลิก', `/api/finance/invoices/${id}/cancel`)}>
              <Button icon={<Ban size={14} />} danger loading={actionLoading}>ยกเลิก</Button>
            </Popconfirm>
          )}
          <Button icon={<Printer size={14} />} onClick={() => {
            setPrintModalOpen(true);
            setTimeout(() => window.print(), 400);
          }}>พิมพ์</Button>
        </Space>
      </div>

      {/* Invoice Details */}
      <Card style={{ marginBottom: 20 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="เลขใบแจ้งหนี้">{inv.invoice_number}</Descriptions.Item>
          <Descriptions.Item label="PO">{inv.po_number || '-'}</Descriptions.Item>
          <Descriptions.Item label="Supplier">{inv.supplier_name || '-'} {inv.supplier_code && `(${inv.supplier_code})`}</Descriptions.Item>
          <Descriptions.Item label="Cost Center">{inv.cost_center_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="วันที่ใบแจ้งหนี้">{formatDate(inv.invoice_date)}</Descriptions.Item>
          <Descriptions.Item label="ครบกำหนดชำระ">
            <span style={{ color: inv.is_overdue ? COLORS.danger : undefined, fontWeight: inv.is_overdue ? 600 : 400 }}>
              {formatDate(inv.due_date)}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="ผู้สร้าง">{inv.creator_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="ผู้อนุมัติ">{inv.approver_name || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Amount Breakdown */}
      <Card title="สรุปยอดเงิน" style={{ marginBottom: 20 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="ยอดก่อนภาษี">
            <span style={{ fontFamily: 'monospace' }}>{formatCurrency(inv.subtotal_amount)}</span>
          </Descriptions.Item>
          <Descriptions.Item label={`VAT ${Number(inv.vat_rate)}%`}>
            <span style={{ fontFamily: 'monospace' }}>{formatCurrency(inv.vat_amount)}</span>
          </Descriptions.Item>
          <Descriptions.Item label="ยอดรวม (รวม VAT)">
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(inv.total_amount)}</span>
          </Descriptions.Item>
          {Number(inv.wht_rate) > 0 && (
            <Descriptions.Item label={`หัก ณ ที่จ่าย ${Number(inv.wht_rate)}%`}>
              <span style={{ fontFamily: 'monospace', color: COLORS.warning }}>-{formatCurrency(inv.wht_amount)}</span>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="ยอดชำระสุทธิ">
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: COLORS.accent, fontSize: 16 }}>
              {formatCurrency(inv.net_payment)}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="จ่ายแล้ว">
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.success }}>
              {formatCurrency(inv.paid_amount)}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="คงเหลือ">
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: remaining > 0 ? COLORS.danger : COLORS.success }}>
              {formatCurrency(remaining > 0 ? remaining : 0)}
            </span>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Note */}
      {inv.note && (
        <Card title="หมายเหตุ" style={{ marginBottom: 20 }}>
          <p style={{ whiteSpace: 'pre-wrap' }}>{inv.note}</p>
        </Card>
      )}

      {/* Payment History */}
      <Card title="ประวัติการจ่ายเงิน">
        <Table
          dataSource={inv.payments || []}
          columns={paymentColumns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'ยังไม่มีรายการจ่ายเงิน' }}
          summary={() => {
            if (!inv.payments?.length) return null;
            const totalAmt = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
            const totalWht = inv.payments.reduce((s, p) => s + Number(p.wht_deducted), 0);
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><strong>รวม</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(totalAmt)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(totalWht)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} />
                  <Table.Summary.Cell index={4} />
                  <Table.Summary.Cell index={5} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        onSuccess={() => { setPaymentModal(false); fetchInvoice(); }}
        invoice={inv}
      />

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
        title="ใบวางบิล / Supplier Invoice"
        width={700}
        destroyOnHidden
      >
        <SupplierInvoicePrintView
          invoice={inv}
          orgName={orgName}
          orgAddress={orgAddress}
          orgTaxId={orgTaxId}
        />
      </Modal>
    </div>
  );
}
