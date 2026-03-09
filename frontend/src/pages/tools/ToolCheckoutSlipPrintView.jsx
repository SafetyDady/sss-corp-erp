import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint, formatCurrencyPrint } from '../../components/PrintStyles';

const ToolCheckoutSlipPrintView = forwardRef(function ToolCheckoutSlipPrintView({ slip, orgName, orgAddress, orgTaxId }, ref) {
  if (!slip) return null;

  const lines = slip.lines || [];
  const totalCharge = lines.reduce((sum, l) => sum + Number(l.charge_amount || 0), 0);
  const returnedCount = lines.filter((l) => l.is_returned).length;

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        docTitle="ใบเบิกเครื่องมือ / Tool Checkout Slip"
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
          <span style={PS.infoLabel}>Work Order: </span>
          {slip.work_order_number || '-'}
        </div>
        <div>
          <span style={PS.infoLabel}>สถานะ: </span>
          {slip.status}
        </div>
        <div>
          <span style={PS.infoLabel}>ผู้เบิก: </span>
          {slip.requester_name || '-'}
        </div>
        {slip.issued_at && (
          <div>
            <span style={PS.infoLabel}>วันที่จ่าย: </span>
            {formatDatePrint(slip.issued_at)}
          </div>
        )}
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
            <th style={PS.th}>รหัส</th>
            <th style={PS.th}>เครื่องมือ</th>
            <th style={PS.th}>ผู้ใช้</th>
            <th style={{ ...PS.th, width: 80 }}>อัตรา/ชม.</th>
            <th style={{ ...PS.th, width: 60 }}>คืนแล้ว</th>
            <th style={{ ...PS.th, width: 90 }}>ค่าใช้จ่าย</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={line.id || idx}>
              <td style={PS.tdCenter}>{line.line_number ?? idx + 1}</td>
              <td style={{ ...PS.td, fontFamily: 'monospace' }}>{line.tool_code || '-'}</td>
              <td style={PS.td}>{line.tool_name || '-'}</td>
              <td style={PS.td}>{line.employee_name || '-'}</td>
              <td style={PS.tdRight}>{line.rate_per_hour ? formatCurrencyPrint(line.rate_per_hour) : '-'}</td>
              <td style={PS.tdCenter}>{line.is_returned ? '✓' : '-'}</td>
              <td style={PS.tdRight}>
                {Number(line.charge_amount) > 0 ? formatCurrencyPrint(line.charge_amount) : '-'}
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={7} style={{ ...PS.tdCenter, color: '#666' }}>ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ ...PS.summaryRow, textAlign: 'right' }}>
              คืนแล้ว {returnedCount}/{lines.length} | รวมค่าใช้จ่าย
            </td>
            <td style={PS.summaryRow}></td>
            <td style={{ ...PS.summaryRow, textAlign: 'right' }}>{formatCurrencyPrint(totalCharge)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Note */}
      <div style={PS.note}>
        <span style={PS.infoLabel}>หมายเหตุ: </span>
        {slip.note || '...........................................................'}
      </div>

      <SignatureSection labels={['ผู้เบิก', 'ผู้จ่าย', 'ผู้อนุมัติ']} />
      <PrintFooter />
    </div>
  );
});

export default ToolCheckoutSlipPrintView;
