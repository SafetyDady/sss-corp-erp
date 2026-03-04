import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint, formatCurrencyPrint } from '../../components/PrintStyles';

const POPrintView = forwardRef(function POPrintView({ po, products, orgName, orgAddress, orgTaxId }, ref) {
  if (!po) return null;

  const lines = po.lines || [];
  const subtotal = po.subtotal_amount != null ? Number(po.subtotal_amount) : lines.reduce((sum, l) => sum + (l.unit_cost || 0) * l.quantity, 0);
  const vatRate = Number(po.vat_rate) || 0;
  const vatAmount = po.vat_amount != null ? Number(po.vat_amount) : 0;
  const totalAmount = po.total_amount != null ? Number(po.total_amount) : subtotal;
  const whtRate = Number(po.wht_rate) || 0;
  const whtAmount = Number(po.wht_amount) || 0;
  const netPayment = Number(po.net_payment) || totalAmount;

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        docTitle={'ใบสั่งซื้อ / Purchase Order'}
      />

      {/* Info section */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>PO Number: </span>
          <span style={{ fontFamily: 'monospace' }}>{po.po_number}</span>
        </div>
        <div>
          <span style={PS.infoLabel}>{'วันที่สั่งซื้อ'}: </span>
          {formatDatePrint(po.order_date)}
        </div>
        <div>
          <span style={PS.infoLabel}>{'ซัพพลายเออร์'}: </span>
          {po.supplier_code && (
            <span style={{ fontFamily: 'monospace' }}>{po.supplier_code} — </span>
          )}
          {po.supplier_name || '-'}
        </div>
        <div>
          <span style={PS.infoLabel}>{'วันที่คาดรับ'}: </span>
          {formatDatePrint(po.expected_date)}
        </div>
        {po.supplier_contact && (
          <div>
            <span style={PS.infoLabel}>{'ผู้ติดต่อ'}: </span>
            {po.supplier_contact}
          </div>
        )}
        {po.supplier_phone && (
          <div>
            <span style={PS.infoLabel}>{'โทรศัพท์'}: </span>
            {po.supplier_phone}
          </div>
        )}
        {po.pr_number && (
          <div>
            <span style={PS.infoLabel}>PR {'อ้างอิง'}: </span>
            <span style={{ fontFamily: 'monospace' }}>{po.pr_number}</span>
          </div>
        )}
        {po.delivery_note_number && (
          <div>
            <span style={PS.infoLabel}>{'เลขใบวางของ'}: </span>
            <span style={{ fontFamily: 'monospace' }}>{po.delivery_note_number}</span>
          </div>
        )}
      </div>

      {/* Lines table */}
      <table style={PS.table}>
        <thead>
          <tr>
            <th style={{ ...PS.th, width: 35 }}>#</th>
            <th style={{ ...PS.th, width: 65 }}>{'ประเภท'}</th>
            <th style={PS.th}>{'สินค้า/บริการ'}</th>
            <th style={{ ...PS.th, width: 60 }}>{'จำนวน'}</th>
            <th style={{ ...PS.th, width: 55 }}>{'หน่วย'}</th>
            <th style={{ ...PS.th, width: 90 }}>{'ราคา/หน่วย'}</th>
            <th style={{ ...PS.th, width: 100 }}>{'รวม'}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const itemType = line.item_type || 'GOODS';
            const product = line.product_id ? products[line.product_id] : null;
            const itemName = product ? `${product.sku} - ${product.name}` : (line.description || '-');
            const lineTotal = (line.unit_cost || 0) * line.quantity;

            return (
              <tr key={line.id || idx}>
                <td style={PS.tdCenter}>{idx + 1}</td>
                <td style={PS.tdCenter}>{itemType === 'GOODS' ? 'GOODS' : 'SVC'}</td>
                <td style={PS.td}>{itemName}</td>
                <td style={PS.tdRight}>{line.quantity}</td>
                <td style={PS.tdCenter}>{line.unit || '-'}</td>
                <td style={PS.tdRight}>{formatCurrencyPrint(line.unit_cost)}</td>
                <td style={PS.tdRight}>{formatCurrencyPrint(lineTotal)}</td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={7} style={{ ...PS.tdCenter, color: '#666' }}>{'ไม่มีรายการ'}</td>
            </tr>
          )}
          {/* Summary rows — VAT breakdown */}
          {vatRate > 0 ? (
            <>
              <tr>
                <td colSpan={6} style={{ ...PS.td, textAlign: 'right', fontWeight: 500 }}>{'ยอดรวมก่อน VAT'}</td>
                <td style={{ ...PS.tdRight, fontWeight: 500 }}>{formatCurrencyPrint(subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={6} style={{ ...PS.td, textAlign: 'right' }}>VAT {vatRate}%</td>
                <td style={PS.tdRight}>{formatCurrencyPrint(vatAmount)}</td>
              </tr>
              <tr className={whtRate > 0 ? '' : 'summary-row'}>
                <td colSpan={6} style={{ ...(whtRate > 0 ? { ...PS.td, textAlign: 'right', fontWeight: 500 } : { ...PS.summaryRow, textAlign: 'right' }) }}>{'ยอดรวมทั้งสิ้น'}</td>
                <td style={whtRate > 0 ? { ...PS.tdRight, fontWeight: 500 } : PS.summaryRow}>{formatCurrencyPrint(totalAmount)}</td>
              </tr>
            </>
          ) : (
            <tr className={whtRate > 0 ? '' : 'summary-row'}>
              <td colSpan={6} style={{ ...(whtRate > 0 ? { ...PS.td, textAlign: 'right', fontWeight: 500 } : { ...PS.summaryRow, textAlign: 'right' }) }}>{'ยอดรวม'}</td>
              <td style={whtRate > 0 ? { ...PS.tdRight, fontWeight: 500 } : PS.summaryRow}>{formatCurrencyPrint(totalAmount)}</td>
            </tr>
          )}
          {/* WHT + Net Payment rows */}
          {whtRate > 0 && (
            <>
              <tr>
                <td colSpan={6} style={{ ...PS.td, textAlign: 'right' }}>
                  {'หัก ณ ที่จ่าย'} {po.wht_type_name || ''} {whtRate}%
                </td>
                <td style={PS.tdRight}>-{formatCurrencyPrint(whtAmount)}</td>
              </tr>
              <tr className="summary-row">
                <td colSpan={6} style={{ ...PS.summaryRow, textAlign: 'right' }}>{'ยอดชำระสุทธิ'}</td>
                <td style={PS.summaryRow}>{formatCurrencyPrint(netPayment)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Note */}
      {po.note && (
        <div style={PS.note}>
          <span style={PS.infoLabel}>{'หมายเหตุ'}: </span>
          {po.note}
        </div>
      )}

      {/* Signature blocks */}
      <SignatureSection labels={['ผู้จัดทำ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ']} />

      <PrintFooter />
    </div>
  );
});

export default POPrintView;
