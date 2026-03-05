import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint, formatCurrencyPrint } from '../../components/PrintStyles';
import useAuthStore from '../../stores/authStore';

const ARInvoicePrintView = forwardRef(function ARInvoicePrintView({ invoice }, ref) {
  const user = useAuthStore((s) => s.user);

  if (!invoice) return null;

  const inv = invoice;
  const remaining = Number(inv.total_amount) - Number(inv.received_amount);
  const payments = inv.payments || [];

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      {/* Header */}
      <CompanyHeader
        orgName={user?.org_name}
        orgAddress={user?.org_address}
        orgTaxId={user?.org_tax_id}
        companyName={inv.company_name}
        companyAddress={inv.company_address}
        companyTaxId={inv.company_tax_id}
        docTitle="ใบแจ้งหนี้ / Invoice"
      />

      {/* Info section */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>เลขที่: </span>
          {inv.invoice_number}
        </div>
        <div>
          <span style={PS.infoLabel}>วันที่ออก: </span>
          {formatDatePrint(inv.invoice_date)}
        </div>
        <div>
          <span style={PS.infoLabel}>ครบกำหนด: </span>
          {formatDatePrint(inv.due_date)}
        </div>
        <div>
          <span style={PS.infoLabel}>สถานะ: </span>
          {inv.status}
        </div>
        <div>
          <span style={PS.infoLabel}>SO: </span>
          {inv.so_number || '-'}
        </div>
        {inv.do_number && (
          <div>
            <span style={PS.infoLabel}>DO: </span>
            {inv.do_number}
          </div>
        )}
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={PS.infoLabel}>ลูกค้า: </span>
          {inv.customer_name || '-'}
          {inv.customer_code && ` (${inv.customer_code})`}
        </div>
      </div>

      {/* Amount breakdown */}
      <div style={PS.sectionTitle}>สรุปยอดเงิน</div>
      <table style={{ ...PS.table, maxWidth: 400 }}>
        <tbody>
          <tr>
            <td style={PS.td}>ยอดก่อนภาษี</td>
            <td style={PS.tdRight}>{formatCurrencyPrint(inv.subtotal_amount)}</td>
          </tr>
          {Number(inv.vat_rate) > 0 && (
            <tr>
              <td style={PS.td}>VAT {Number(inv.vat_rate)}%</td>
              <td style={PS.tdRight}>{formatCurrencyPrint(inv.vat_amount)}</td>
            </tr>
          )}
          <tr>
            <td style={{ ...PS.td, fontWeight: 700 }}>ยอดรวม (ลูกค้าต้องจ่าย)</td>
            <td style={PS.tdBold}>{formatCurrencyPrint(inv.total_amount)}</td>
          </tr>
          {Number(inv.received_amount) > 0 && (
            <>
              <tr>
                <td style={PS.td}>รับแล้ว</td>
                <td style={PS.tdRight}>{formatCurrencyPrint(inv.received_amount)}</td>
              </tr>
              <tr>
                <td style={{ ...PS.td, fontWeight: 700 }}>คงเหลือ</td>
                <td style={PS.tdBold}>{formatCurrencyPrint(remaining > 0 ? remaining : 0)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Payment history */}
      {payments.length > 0 && (
        <>
          <div style={PS.sectionTitle}>ประวัติการรับเงิน</div>
          <table style={PS.table}>
            <thead>
              <tr>
                <th style={{ ...PS.th, width: 40 }}>#</th>
                <th style={PS.th}>วันที่</th>
                <th style={PS.th}>ยอดรับ</th>
                <th style={PS.th}>วิธีรับเงิน</th>
                <th style={PS.th}>อ้างอิง</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, idx) => (
                <tr key={p.id || idx}>
                  <td style={PS.tdCenter}>{idx + 1}</td>
                  <td style={PS.tdCenter}>{formatDatePrint(p.payment_date)}</td>
                  <td style={PS.tdRight}>{formatCurrencyPrint(p.amount)}</td>
                  <td style={PS.tdCenter}>{p.payment_method || '-'}</td>
                  <td style={PS.td}>{p.reference || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Note */}
      {inv.note && (
        <div style={PS.note}>
          <span style={PS.infoLabel}>หมายเหตุ: </span>
          {inv.note}
        </div>
      )}

      {/* Signature blocks */}
      <SignatureSection labels={['ผู้ออกใบแจ้งหนี้', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ']} />

      {/* Footer */}
      <PrintFooter />
    </div>
  );
});

export default ARInvoicePrintView;
