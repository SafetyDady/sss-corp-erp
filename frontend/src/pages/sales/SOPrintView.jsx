import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint, formatCurrencyPrint } from '../../components/PrintStyles';

const SOPrintView = forwardRef(function SOPrintView({ so, products, orgName, orgAddress, orgTaxId }, ref) {
  if (!so) return null;

  const lines = so.lines || [];
  const subtotal = Number(so.subtotal_amount) || 0;
  const vatRate = Number(so.vat_rate) || 0;
  const vatAmount = Number(so.vat_amount) || 0;
  const totalAmount = Number(so.total_amount) || 0;

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        companyName={so.company_name}
        docTitle={'ใบสั่งขาย / Sales Order'}
      />

      {/* Info section */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>SO Number: </span>
          <span style={{ fontFamily: 'monospace' }}>{so.so_number}</span>
        </div>
        <div>
          <span style={PS.infoLabel}>{'วันที่สั่ง'}: </span>
          {formatDatePrint(so.order_date)}
        </div>
        <div>
          <span style={PS.infoLabel}>{'ลูกค้า'}: </span>
          {so.customer_code && (
            <span style={{ fontFamily: 'monospace' }}>{so.customer_code} — </span>
          )}
          {so.customer_name || '-'}
        </div>
        <div>
          <span style={PS.infoLabel}>{'สถานะ'}: </span>
          {so.status}
        </div>
      </div>

      {/* Lines table */}
      <table style={PS.table}>
        <thead>
          <tr>
            <th style={{ ...PS.th, width: 35 }}>#</th>
            <th style={PS.th}>{'สินค้า'}</th>
            <th style={{ ...PS.th, width: 60 }}>{'จำนวน'}</th>
            <th style={{ ...PS.th, width: 55 }}>{'หน่วย'}</th>
            <th style={{ ...PS.th, width: 90 }}>{'ราคา/หน่วย'}</th>
            <th style={{ ...PS.th, width: 100 }}>{'รวม'}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const product = line.product_id ? (products || {})[line.product_id] : null;
            const itemName = product
              ? `${product.sku} - ${product.name}`
              : (line.product_id || '-');
            const lineTotal = (Number(line.unit_price) || 0) * (line.quantity || 0);

            return (
              <tr key={line.id || idx}>
                <td style={PS.tdCenter}>{idx + 1}</td>
                <td style={PS.td}>{itemName}</td>
                <td style={PS.tdRight}>{line.quantity}</td>
                <td style={PS.tdCenter}>{product?.unit || '-'}</td>
                <td style={PS.tdRight}>{formatCurrencyPrint(line.unit_price)}</td>
                <td style={PS.tdRight}>{formatCurrencyPrint(lineTotal)}</td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...PS.tdCenter, color: '#666' }}>{'ไม่มีรายการ'}</td>
            </tr>
          )}
          {/* Summary rows */}
          {vatRate > 0 ? (
            <>
              <tr>
                <td colSpan={5} style={{ ...PS.td, textAlign: 'right', fontWeight: 500 }}>{'ยอดรวมก่อน VAT'}</td>
                <td style={{ ...PS.tdRight, fontWeight: 500 }}>{formatCurrencyPrint(subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={5} style={{ ...PS.td, textAlign: 'right' }}>VAT {vatRate}%</td>
                <td style={PS.tdRight}>{formatCurrencyPrint(vatAmount)}</td>
              </tr>
              <tr className="summary-row">
                <td colSpan={5} style={{ ...PS.summaryRow, textAlign: 'right' }}>{'ยอดรวมทั้งสิ้น'}</td>
                <td style={PS.summaryRow}>{formatCurrencyPrint(totalAmount)}</td>
              </tr>
            </>
          ) : (
            <tr className="summary-row">
              <td colSpan={5} style={{ ...PS.summaryRow, textAlign: 'right' }}>{'ยอดรวม'}</td>
              <td style={PS.summaryRow}>{formatCurrencyPrint(totalAmount)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Note */}
      {so.note && (
        <div style={PS.note}>
          <span style={PS.infoLabel}>{'หมายเหตุ'}: </span>
          {so.note}
        </div>
      )}

      {/* Signature blocks */}
      <SignatureSection labels={['ผู้จัดทำ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ']} />

      <PrintFooter />
    </div>
  );
});

export default SOPrintView;
