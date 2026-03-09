import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint, formatCurrencyPrint } from '../../components/PrintStyles';

const SupplierInvoicePrintView = forwardRef(function SupplierInvoicePrintView({ invoice, orgName, orgAddress, orgTaxId }, ref) {
  if (!invoice) return null;

  const subtotal = Number(invoice.subtotal_amount) || 0;
  const vatRate = Number(invoice.vat_rate) || 0;
  const vatAmount = Number(invoice.vat_amount) || 0;
  const totalAmount = Number(invoice.total_amount) || 0;
  const whtRate = Number(invoice.wht_rate) || 0;
  const whtAmount = Number(invoice.wht_amount) || 0;
  const netPayment = Number(invoice.net_payment) || 0;
  const paidAmount = Number(invoice.paid_amount) || 0;
  const payments = invoice.payments || [];

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        companyName={invoice.company_name}
        docTitle={'ใบวางบิล / Supplier Invoice'}
      />

      {/* Info section */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>Invoice No: </span>
          <span style={{ fontFamily: 'monospace' }}>{invoice.invoice_number}</span>
        </div>
        <div>
          <span style={PS.infoLabel}>{'สถานะ'}: </span>
          {invoice.status}
        </div>
        {invoice.po_number && (
          <div>
            <span style={PS.infoLabel}>PO {'อ้างอิง'}: </span>
            <span style={{ fontFamily: 'monospace' }}>{invoice.po_number}</span>
          </div>
        )}
        <div>
          <span style={PS.infoLabel}>{'วันที่ออก'}: </span>
          {formatDatePrint(invoice.invoice_date)}
        </div>
        {invoice.supplier_name && (
          <div>
            <span style={PS.infoLabel}>{'ซัพพลายเออร์'}: </span>
            {invoice.supplier_code && (
              <span style={{ fontFamily: 'monospace' }}>{invoice.supplier_code} — </span>
            )}
            {invoice.supplier_name}
          </div>
        )}
        <div>
          <span style={PS.infoLabel}>{'ครบกำหนด'}: </span>
          {formatDatePrint(invoice.due_date)}
        </div>
        {invoice.cost_center_name && (
          <div>
            <span style={PS.infoLabel}>Cost Center: </span>
            {invoice.cost_center_name}
          </div>
        )}
      </div>

      {/* Amount summary */}
      <div style={PS.sectionTitle}>{'รายละเอียดยอดเงิน'}</div>
      <table style={PS.table}>
        <tbody>
          <tr>
            <td style={{ ...PS.td, fontWeight: 500 }}>{'ยอดก่อนภาษี'}</td>
            <td style={{ ...PS.tdRight, width: 150 }}>{formatCurrencyPrint(subtotal)}</td>
          </tr>
          {vatRate > 0 && (
            <tr>
              <td style={PS.td}>VAT {vatRate}%</td>
              <td style={PS.tdRight}>{formatCurrencyPrint(vatAmount)}</td>
            </tr>
          )}
          <tr>
            <td style={{ ...PS.td, fontWeight: 600 }}>{'ยอดรวมทั้งสิ้น'}</td>
            <td style={{ ...PS.tdRight, fontWeight: 600 }}>{formatCurrencyPrint(totalAmount)}</td>
          </tr>
          {whtRate > 0 && (
            <tr>
              <td style={PS.td}>{'หัก ณ ที่จ่าย'} {whtRate}%</td>
              <td style={PS.tdRight}>-{formatCurrencyPrint(whtAmount)}</td>
            </tr>
          )}
          <tr className="summary-row">
            <td style={{ ...PS.summaryRow }}>{'ยอดชำระสุทธิ'}</td>
            <td style={PS.summaryRow}>{formatCurrencyPrint(netPayment)}</td>
          </tr>
          <tr>
            <td style={{ ...PS.td, color: '#333' }}>{'จ่ายแล้ว'}</td>
            <td style={{ ...PS.tdRight, color: '#333' }}>{formatCurrencyPrint(paidAmount)}</td>
          </tr>
        </tbody>
      </table>

      {/* Payment history */}
      {payments.length > 0 && (
        <>
          <div style={PS.sectionTitle}>{'ประวัติการชำระ'}</div>
          <table style={PS.table}>
            <thead>
              <tr>
                <th style={{ ...PS.th, width: 35 }}>#</th>
                <th style={PS.th}>{'วันที่จ่าย'}</th>
                <th style={PS.th}>{'จำนวน'}</th>
                <th style={PS.th}>{'หัก ณ ที่จ่าย'}</th>
                <th style={PS.th}>{'วิธี'}</th>
                <th style={PS.th}>{'อ้างอิง'}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, idx) => (
                <tr key={p.id || idx}>
                  <td style={PS.tdCenter}>{idx + 1}</td>
                  <td style={PS.tdCenter}>{formatDatePrint(p.payment_date)}</td>
                  <td style={PS.tdRight}>{formatCurrencyPrint(p.amount)}</td>
                  <td style={PS.tdRight}>{formatCurrencyPrint(p.wht_deducted)}</td>
                  <td style={PS.tdCenter}>{p.payment_method || '-'}</td>
                  <td style={PS.td}>{p.reference || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Note */}
      {invoice.note && (
        <div style={PS.note}>
          <span style={PS.infoLabel}>{'หมายเหตุ'}: </span>
          {invoice.note}
        </div>
      )}

      {/* Signature blocks */}
      <SignatureSection labels={['ผู้จัดทำ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ']} />

      <PrintFooter />
    </div>
  );
});

export default SupplierInvoicePrintView;
