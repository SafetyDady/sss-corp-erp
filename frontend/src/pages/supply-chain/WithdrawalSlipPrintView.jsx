import { forwardRef } from 'react';

const TYPE_LABELS = {
  WO_CONSUME: 'เบิกเข้า Work Order',
  CC_ISSUE: 'เบิกเข้า Cost Center',
};

function formatDatePrint(isoString) {
  if (!isoString) return '__/__/____';
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Shared inline styles for print (black on white, no dark theme)
const S = {
  container: {
    fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
    color: '#000',
    background: '#fff',
    padding: 24,
    fontSize: 13,
    lineHeight: 1.6,
  },
  header: {
    textAlign: 'center',
    marginBottom: 16,
  },
  orgName: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    color: '#000',
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    margin: '2px 0 12px',
    color: '#000',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px 24px',
    marginBottom: 16,
    fontSize: 13,
    color: '#000',
  },
  infoLabel: {
    fontWeight: 600,
    color: '#000',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: 16,
    fontSize: 12,
    color: '#000',
  },
  th: {
    border: '1px solid #444',
    padding: '6px 8px',
    background: '#e5e5e5',
    fontWeight: 600,
    textAlign: 'center',
    color: '#000',
  },
  td: {
    border: '1px solid #444',
    padding: '5px 8px',
    color: '#000',
  },
  tdCenter: {
    border: '1px solid #444',
    padding: '5px 8px',
    textAlign: 'center',
    color: '#000',
  },
  tdRight: {
    border: '1px solid #444',
    padding: '5px 8px',
    textAlign: 'right',
    color: '#000',
  },
  note: {
    marginBottom: 24,
    fontSize: 13,
    color: '#000',
  },
  signatureGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 24,
    marginTop: 32,
    fontSize: 12,
    color: '#000',
  },
  signatureBlock: {
    textAlign: 'center',
    color: '#000',
  },
  signatureLine: {
    borderBottom: '1px solid #000',
    width: '80%',
    margin: '28px auto 4px',
  },
  signatureLabel: {
    fontWeight: 600,
    marginBottom: 0,
    color: '#000',
  },
  signatureDate: {
    fontSize: 11,
    color: '#333',
    marginTop: 2,
  },
};

const WithdrawalSlipPrintView = forwardRef(function WithdrawalSlipPrintView({ slip, orgName }, ref) {
  if (!slip) return null;

  const isIssued = slip.status === 'ISSUED';
  const lines = slip.lines || [];

  const woOrCcLabel = slip.withdrawal_type === 'WO_CONSUME' ? 'Work Order' : 'Cost Center';
  const woOrCcValue = slip.withdrawal_type === 'WO_CONSUME'
    ? (slip.work_order_number || '-')
    : (slip.cost_center_name || '-');

  return (
    <div className="sw-print-content" ref={ref} style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <p style={S.orgName}>{orgName || 'SSS Corp'}</p>
        <p style={S.title}>ใบเบิกของ / Stock Withdrawal Slip</p>
      </div>

      {/* Info section */}
      <div style={S.infoGrid}>
        <div>
          <span style={S.infoLabel}>เลขที่: </span>
          {slip.slip_number}
        </div>
        <div>
          <span style={S.infoLabel}>วันที่: </span>
          {formatDatePrint(slip.created_at)}
        </div>
        <div>
          <span style={S.infoLabel}>ประเภท: </span>
          {TYPE_LABELS[slip.withdrawal_type] || slip.withdrawal_type}
        </div>
        <div>
          <span style={S.infoLabel}>{woOrCcLabel}: </span>
          {woOrCcValue}
        </div>
        <div>
          <span style={S.infoLabel}>ผู้เบิก: </span>
          {slip.requester_name || '-'}
        </div>
        {slip.reference && (
          <div>
            <span style={S.infoLabel}>อ้างอิง: </span>
            {slip.reference}
          </div>
        )}
      </div>

      {/* Lines table */}
      <table style={S.table}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 40 }}>#</th>
            <th style={S.th}>สินค้า</th>
            <th style={{ ...S.th, width: 70 }}>หน่วย</th>
            <th style={{ ...S.th, width: 80 }}>จำนวน</th>
            <th style={{ ...S.th, width: 90 }}>จำนวนจ่าย</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={line.id || idx}>
              <td style={S.tdCenter}>{line.line_number ?? idx + 1}</td>
              <td style={S.td}>
                {line.product_sku && (
                  <span style={{ fontFamily: 'monospace', marginRight: 6 }}>{line.product_sku}</span>
                )}
                {line.product_name || '-'}
              </td>
              <td style={S.tdCenter}>{line.product_unit || '-'}</td>
              <td style={S.tdRight}>{line.quantity}</td>
              <td style={S.tdRight}>
                {isIssued && line.issued_qty != null ? line.issued_qty : '________'}
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={5} style={{ ...S.tdCenter, color: '#666' }}>ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Note */}
      <div style={S.note}>
        <span style={S.infoLabel}>หมายเหตุ: </span>
        {slip.note || '...........................................................'}
      </div>

      {/* Signature blocks */}
      <div style={S.signatureGrid}>
        <div style={S.signatureBlock}>
          <div style={S.signatureLine} />
          <p style={S.signatureLabel}>ผู้เบิก</p>
          <p style={S.signatureDate}>วันที่: __/__/____</p>
        </div>
        <div style={S.signatureBlock}>
          <div style={S.signatureLine} />
          <p style={S.signatureLabel}>ผู้จัดเตรียม</p>
          <p style={S.signatureDate}>วันที่: __/__/____</p>
        </div>
        <div style={S.signatureBlock}>
          <div style={S.signatureLine} />
          <p style={S.signatureLabel}>ผู้อนุมัติ</p>
          <p style={S.signatureDate}>วันที่: __/__/____</p>
        </div>
      </div>
    </div>
  );
});

export default WithdrawalSlipPrintView;
