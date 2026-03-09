import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint } from '../../components/PrintStyles';

const TYPE_LABELS = {
  WO_CONSUME: 'เบิกเข้า Work Order',
  CC_ISSUE: 'เบิกเข้า Cost Center',
};

const WithdrawalSlipPrintView = forwardRef(function WithdrawalSlipPrintView({ slip, orgName, orgAddress, orgTaxId }, ref) {
  if (!slip) return null;

  const isIssued = slip.status === 'ISSUED';
  const lines = slip.lines || [];

  const woOrCcLabel = slip.withdrawal_type === 'WO_CONSUME' ? 'Work Order' : 'Cost Center';
  const woOrCcValue = slip.withdrawal_type === 'WO_CONSUME'
    ? (slip.work_order_number || '-')
    : (slip.cost_center_name || '-');

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        docTitle="ใบเบิกของ / Stock Withdrawal Slip"
      />

      {/* Info section */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>เลขที่: </span>
          {slip.slip_number}
        </div>
        <div>
          <span style={PS.infoLabel}>วันที่: </span>
          {formatDatePrint(slip.created_at)}
        </div>
        <div>
          <span style={PS.infoLabel}>ประเภท: </span>
          {TYPE_LABELS[slip.withdrawal_type] || slip.withdrawal_type}
        </div>
        <div>
          <span style={PS.infoLabel}>{woOrCcLabel}: </span>
          {woOrCcValue}
        </div>
        <div>
          <span style={PS.infoLabel}>ผู้เบิก: </span>
          {slip.requester_name || '-'}
        </div>
        {slip.reference && (
          <div>
            <span style={PS.infoLabel}>อ้างอิง: </span>
            {slip.reference}
          </div>
        )}
      </div>

      {/* Lines table */}
      <table style={PS.table}>
        <thead>
          <tr>
            <th style={{ ...PS.th, width: 40 }}>#</th>
            <th style={PS.th}>สินค้า</th>
            <th style={{ ...PS.th, width: 70 }}>หน่วย</th>
            <th style={{ ...PS.th, width: 80 }}>จำนวน</th>
            <th style={{ ...PS.th, width: 90 }}>จำนวนจ่าย</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={line.id || idx}>
              <td style={PS.tdCenter}>{line.line_number ?? idx + 1}</td>
              <td style={PS.td}>
                {line.product_sku && (
                  <span style={{ fontFamily: 'monospace', marginRight: 6 }}>{line.product_sku}</span>
                )}
                {line.product_name || '-'}
              </td>
              <td style={PS.tdCenter}>{line.product_unit || '-'}</td>
              <td style={PS.tdRight}>{line.quantity}</td>
              <td style={PS.tdRight}>
                {isIssued && line.issued_qty != null ? line.issued_qty : '________'}
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={5} style={{ ...PS.tdCenter, color: '#666' }}>ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Note */}
      <div style={PS.note}>
        <span style={PS.infoLabel}>หมายเหตุ: </span>
        {slip.note || '...........................................................'}
      </div>

      <SignatureSection labels={['ผู้เบิก', 'ผู้จัดเตรียม', 'ผู้อนุมัติ']} />
      <PrintFooter />
    </div>
  );
});

export default WithdrawalSlipPrintView;
