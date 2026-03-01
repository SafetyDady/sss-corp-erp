import { Modal, Button, Divider, QRCode } from 'antd';
import { Printer } from 'lucide-react';
import { COLORS } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function POQRCodeModal({ open, po, products, onClose }) {
  if (!po) return null;

  const grUrl = `${window.location.origin}/purchasing/po/${po.id}?action=receive`;

  const handlePrint = () => {
    window.print();
  };

  // Build items summary (max 5 lines)
  const itemsSummary = (po.lines || []).slice(0, 5).map((line) => {
    const product = line.product_id && products?.[line.product_id];
    const name = product ? `${product.sku} - ${product.name}` : (line.description || '-');
    return `${name}  x${line.quantity} ${line.unit || ''}`;
  });
  const remainingCount = (po.lines || []).length - 5;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="QR Code - Goods Receipt"
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        <Button key="print" type="primary" icon={<Printer size={14} />} onClick={handlePrint}>
          Print QR Label
        </Button>,
      ]}
      width={480}
      destroyOnHidden
    >
      <div className="qr-print-content" style={{ textAlign: 'center', padding: 16 }}>
        <h2 style={{ margin: 0, color: COLORS.text, fontSize: 20 }}>{po.po_number}</h2>
        <p style={{ color: COLORS.textSecondary, margin: '4px 0 16px', fontSize: 14 }}>
          {po.supplier_name}
        </p>

        <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 8 }}>
          <QRCode
            value={grUrl}
            size={200}
            color="#000000"
            bgColor="#ffffff"
          />
        </div>

        <p style={{ fontSize: 11, color: COLORS.textMuted, margin: '8px 0 0' }}>
          Scan to open Goods Receipt
        </p>

        <Divider style={{ margin: '12px 0', borderColor: COLORS.border }} />

        <div style={{ textAlign: 'left', fontSize: 12, color: COLORS.textSecondary }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 8 }}>
            <span><strong style={{ color: COLORS.text }}>Order Date:</strong> {formatDate(po.order_date)}</span>
            <span><strong style={{ color: COLORS.text }}>Expected:</strong> {formatDate(po.expected_date) || '-'}</span>
            <span><strong style={{ color: COLORS.text }}>Total:</strong> {formatCurrency(po.total_amount)}</span>
            <span><strong style={{ color: COLORS.text }}>Status:</strong> {po.status}</span>
          </div>
          <p style={{ color: COLORS.text, fontWeight: 600, margin: '4px 0 2px' }}>Items:</p>
          <ul style={{ margin: 0, paddingLeft: 20, color: COLORS.textSecondary }}>
            {itemsSummary.map((item, i) => <li key={i}>{item}</li>)}
            {remainingCount > 0 && <li style={{ color: COLORS.textMuted }}>...and {remainingCount} more</li>}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
