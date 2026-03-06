import { forwardRef } from 'react';

function formatDatePrint(isoString) {
  if (!isoString) return '__/__/____';
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatCurrencyPrint(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Shared inline styles for print (black on white)
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
  totalRow: {
    border: '1px solid #444',
    padding: '6px 8px',
    fontWeight: 700,
    textAlign: 'right',
    color: '#000',
    background: '#f0f0f0',
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

const ToolCheckoutSlipPrintView = forwardRef(function ToolCheckoutSlipPrintView({ slip, orgName }, ref) {
  if (!slip) return null;

  const lines = slip.lines || [];
  const totalCharge = lines.reduce((sum, l) => sum + Number(l.charge_amount || 0), 0);
  const returnedCount = lines.filter((l) => l.is_returned).length;

  return (
    <div className="erp-print-content" ref={ref} style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <p style={S.orgName}>{orgName || 'SSS Corp'}</p>
        <p style={S.title}>ใบเบิกเครื่องมือ / Tool Checkout Slip</p>
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
          <span style={S.infoLabel}>Work Order: </span>
          {slip.work_order_number || '-'}
        </div>
        <div>
          <span style={S.infoLabel}>สถานะ: </span>
          {slip.status}
        </div>
        <div>
          <span style={S.infoLabel}>ผู้เบิก: </span>
          {slip.requester_name || '-'}
        </div>
        {slip.issued_at && (
          <div>
            <span style={S.infoLabel}>วันที่จ่าย: </span>
            {formatDatePrint(slip.issued_at)}
          </div>
        )}
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
            <th style={S.th}>รหัส</th>
            <th style={S.th}>เครื่องมือ</th>
            <th style={S.th}>ผู้ใช้</th>
            <th style={{ ...S.th, width: 80 }}>อัตรา/ชม.</th>
            <th style={{ ...S.th, width: 60 }}>คืนแล้ว</th>
            <th style={{ ...S.th, width: 90 }}>ค่าใช้จ่าย</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={line.id || idx}>
              <td style={S.tdCenter}>{line.line_number ?? idx + 1}</td>
              <td style={{ ...S.td, fontFamily: 'monospace' }}>{line.tool_code || '-'}</td>
              <td style={S.td}>{line.tool_name || '-'}</td>
              <td style={S.td}>{line.employee_name || '-'}</td>
              <td style={S.tdRight}>{line.rate_per_hour ? formatCurrencyPrint(line.rate_per_hour) : '-'}</td>
              <td style={S.tdCenter}>{line.is_returned ? '✓' : '-'}</td>
              <td style={S.tdRight}>
                {Number(line.charge_amount) > 0 ? formatCurrencyPrint(line.charge_amount) : '-'}
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={7} style={{ ...S.tdCenter, color: '#666' }}>ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={S.totalRow}>
              คืนแล้ว {returnedCount}/{lines.length} | รวมค่าใช้จ่าย
            </td>
            <td style={S.totalRow}></td>
            <td style={S.totalRow}>{formatCurrencyPrint(totalCharge)}</td>
          </tr>
        </tfoot>
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
          <p style={S.signatureLabel}>ผู้จ่าย</p>
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

export default ToolCheckoutSlipPrintView;
