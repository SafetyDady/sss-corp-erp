import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint } from '../../components/PrintStyles';
import useAuthStore from '../../stores/authStore';

const DOPrintView = forwardRef(function DOPrintView({ doData }, ref) {
  const user = useAuthStore((s) => s.user);

  if (!doData) return null;

  const isShipped = doData.status === 'SHIPPED';
  const lines = doData.lines || [];

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      {/* Header */}
      <CompanyHeader
        orgName={user?.org_name}
        orgAddress={user?.org_address}
        orgTaxId={user?.org_tax_id}
        docTitle="ใบส่งของ / Delivery Order"
      />

      {/* Info section */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>เลขที่ DO: </span>
          {doData.do_number}
        </div>
        <div>
          <span style={PS.infoLabel}>วันที่ส่ง: </span>
          {formatDatePrint(doData.delivery_date)}
        </div>
        <div>
          <span style={PS.infoLabel}>SO: </span>
          {doData.so_number || '-'}
        </div>
        <div>
          <span style={PS.infoLabel}>ลูกค้า: </span>
          {doData.customer_name || '-'}
          {doData.customer_code && ` (${doData.customer_code})`}
        </div>
        {doData.shipping_address && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={PS.infoLabel}>ที่อยู่จัดส่ง: </span>
            {doData.shipping_address}
          </div>
        )}
        {doData.shipping_method && (
          <div>
            <span style={PS.infoLabel}>วิธีการส่ง: </span>
            {doData.shipping_method}
          </div>
        )}
        {isShipped && doData.shipped_at && (
          <div>
            <span style={PS.infoLabel}>จัดส่งเมื่อ: </span>
            {formatDatePrint(doData.shipped_at)}
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
            <th style={{ ...PS.th, width: 80 }}>จำนวนสั่ง</th>
            <th style={{ ...PS.th, width: 90 }}>จำนวนส่ง</th>
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
              <td style={PS.tdRight}>{line.ordered_qty}</td>
              <td style={PS.tdRight}>
                {isShipped ? line.shipped_qty : '________'}
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
        {doData.note || '...........................................................'}
      </div>

      {/* Signature blocks */}
      <SignatureSection labels={['ผู้จัดเตรียม', 'ผู้ตรวจสอบ', 'ผู้รับของ']} />

      {/* Footer */}
      <PrintFooter />
    </div>
  );
});

export default DOPrintView;
