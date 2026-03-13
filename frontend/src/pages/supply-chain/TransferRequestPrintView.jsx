import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint } from '../../components/PrintStyles';

const TransferRequestPrintView = forwardRef(function TransferRequestPrintView(
  { tf, orgName, orgAddress, orgTaxId },
  ref,
) {
  if (!tf) return null;

  const isTransferred = tf.status === 'TRANSFERRED';
  const lines = tf.lines || [];

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        docTitle="ใบขอโอนย้ายสินค้า / Transfer Request"
      />

      {/* Info section */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>เลขที่: </span>
          {tf.transfer_number}
        </div>
        <div>
          <span style={PS.infoLabel}>วันที่: </span>
          {formatDatePrint(tf.created_at)}
        </div>
        <div>
          <span style={PS.infoLabel}>สถานะ: </span>
          {tf.status}
        </div>
        <div>
          <span style={PS.infoLabel}>คลังต้นทาง: </span>
          {tf.source_warehouse_name || '-'}
          {tf.source_location_name && ` (${tf.source_location_name})`}
        </div>
        <div>
          <span style={PS.infoLabel}>คลังปลายทาง: </span>
          {tf.dest_warehouse_name || '-'}
          {tf.dest_location_name && ` (${tf.dest_location_name})`}
        </div>
        <div>
          <span style={PS.infoLabel}>ผู้ขอโอนย้าย: </span>
          {tf.requester_name || '-'}
        </div>
        {tf.reference && (
          <div>
            <span style={PS.infoLabel}>อ้างอิง: </span>
            {tf.reference}
          </div>
        )}
        {tf.transferred_at && (
          <div>
            <span style={PS.infoLabel}>วันที่โอนย้าย: </span>
            {formatDatePrint(tf.transferred_at)}
          </div>
        )}
        {tf.transferrer_name && (
          <div>
            <span style={PS.infoLabel}>ผู้ดำเนินการ: </span>
            {tf.transferrer_name}
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
            <th style={{ ...PS.th, width: 80 }}>จำนวนขอ</th>
            <th style={{ ...PS.th, width: 90 }}>จำนวนโอน</th>
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
                {isTransferred && line.transferred_qty != null ? line.transferred_qty : '________'}
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
        {tf.note || '...........................................................'}
      </div>

      <SignatureSection labels={['ผู้ขอโอนย้าย', 'ผู้ดำเนินการ', 'ผู้อนุมัติ']} />
      <PrintFooter />
    </div>
  );
});

export default TransferRequestPrintView;
