import { forwardRef } from 'react';
import { PS, CompanyHeader, PrintFooter, formatCurrencyPrint, formatNumberPrint } from '../../components/PrintStyles';

const PayslipPrintView = forwardRef(function PayslipPrintView(
  { slip, employeeName, employeeCode, departmentName, position, orgName, orgAddress, orgTaxId },
  ref,
) {
  if (!slip) return null;

  const rows = [
    { label: '\u0E40\u0E07\u0E34\u0E19\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19 (Base Salary)', value: formatCurrencyPrint(slip.base_salary), type: 'currency' },
    { label: '\u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07\u0E1B\u0E01\u0E15\u0E34 (Regular Hours)', value: `${formatNumberPrint(slip.regular_hours)} hrs`, type: 'info' },
    { label: '\u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07 OT (OT Hours)', value: `${formatNumberPrint(slip.ot_hours)} hrs`, type: 'info' },
    { label: '\u0E04\u0E48\u0E32 OT (OT Amount)', value: formatCurrencyPrint(slip.ot_amount), type: 'currency' },
  ];

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        docTitle={'\u0E2A\u0E25\u0E34\u0E1B\u0E40\u0E07\u0E34\u0E19\u0E40\u0E14\u0E37\u0E2D\u0E19 / Payslip'}
        docSubtitle={slip.period_label || ''}
      />

      {/* Employee Info */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>{'\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19'}: </span>
          {employeeCode && <span style={{ fontFamily: 'monospace', marginRight: 6 }}>{employeeCode}</span>}
          {employeeName || '-'}
        </div>
        <div>
          <span style={PS.infoLabel}>{'\u0E41\u0E1C\u0E19\u0E01'}: </span>
          {departmentName || '-'}
        </div>
        {position && (
          <div>
            <span style={PS.infoLabel}>{'\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07'}: </span>
            {position}
          </div>
        )}
      </div>

      {/* Earnings Table */}
      <table style={PS.table}>
        <thead>
          <tr>
            <th style={PS.th}>{'\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23'}</th>
            <th style={{ ...PS.th, width: 150 }}>{'\u0E08\u0E33\u0E19\u0E27\u0E19'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td style={PS.td}>{row.label}</td>
              <td style={PS.tdRight}>{row.value}</td>
            </tr>
          ))}
          {/* Divider — Gross */}
          <tr className="summary-row">
            <td style={{ ...PS.summaryRow, textAlign: 'left' }}>{'\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E23\u0E27\u0E21'} (Gross)</td>
            <td style={PS.summaryRow}>{formatCurrencyPrint(slip.gross_amount)}</td>
          </tr>
          {/* Deductions */}
          <tr>
            <td style={PS.td}>{'\u0E2B\u0E31\u0E01'} (Deductions)</td>
            <td style={PS.tdRight}>{formatCurrencyPrint(slip.deductions)}</td>
          </tr>
          {/* Net */}
          <tr className="summary-row">
            <td style={{ ...PS.summaryRow, textAlign: 'left', fontSize: 14 }}>{'\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E2A\u0E38\u0E17\u0E18\u0E34'} (Net)</td>
            <td style={{ ...PS.summaryRow, fontSize: 14 }}>{formatCurrencyPrint(slip.net_amount)}</td>
          </tr>
        </tbody>
      </table>

      {/* Confidentiality note */}
      <div style={{ ...PS.note, fontSize: 11, color: '#666', fontStyle: 'italic', marginTop: 24 }}>
        {'\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E09\u0E1A\u0E31\u0E1A\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E27\u0E32\u0E21\u0E25\u0E31\u0E1A \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E1C\u0E22\u0E41\u0E1E\u0E23\u0E48\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 / This document is confidential.'}
      </div>

      <PrintFooter />
    </div>
  );
});

export default PayslipPrintView;
