import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint, formatCurrencyPrint } from '../../components/PrintStyles';

const StockTakePrintView = forwardRef(function StockTakePrintView({ st, orgName, orgAddress, orgTaxId }, ref) {
  if (!st) return null;

  const lines = st.lines || [];

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        docTitle="ใบตรวจนับสต็อก / Stock Take"
      />

      {/* Info section */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>เลขที่: </span>
          {st.stocktake_number}
        </div>
        <div>
          <span style={PS.infoLabel}>วันที่: </span>
          {formatDatePrint(st.created_at)}
        </div>
        <div>
          <span style={PS.infoLabel}>คลังสินค้า: </span>
          {st.warehouse_name || '-'}
        </div>
        <div>
          <span style={PS.infoLabel}>ตำแหน่ง: </span>
          {st.location_name || 'ทั้งคลัง'}
        </div>
        <div>
          <span style={PS.infoLabel}>ผู้นับ: </span>
          {st.counter_name || '-'}
        </div>
        <div>
          <span style={PS.infoLabel}>สถานะ: </span>
          {st.status}
        </div>
        {st.reference && (
          <div>
            <span style={PS.infoLabel}>อ้างอิง: </span>
            {st.reference}
          </div>
        )}
      </div>

      {/* Lines table */}
      <table style={PS.table}>
        <thead>
          <tr>
            <th style={{ ...PS.th, width: 35 }}>#</th>
            <th style={PS.th}>สินค้า</th>
            <th style={{ ...PS.th, width: 60 }}>หน่วย</th>
            <th style={{ ...PS.th, width: 70 }}>ตำแหน่ง</th>
            <th style={{ ...PS.th, width: 70 }}>ยอดระบบ</th>
            <th style={{ ...PS.th, width: 70 }}>ยอดนับ</th>
            <th style={{ ...PS.th, width: 65 }}>ผลต่าง</th>
            <th style={{ ...PS.th, width: 90 }}>มูลค่าผลต่าง</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const variance = line.variance;
            const varianceStyle = variance > 0
              ? { ...PS.tdRight, color: 'red' }
              : variance < 0
                ? { ...PS.tdRight, color: 'green' }
                : PS.tdRight;
            return (
              <tr key={line.id || idx}>
                <td style={PS.tdCenter}>{line.line_number ?? idx + 1}</td>
                <td style={PS.td}>
                  {line.product_sku && (
                    <span style={{ fontFamily: 'monospace', marginRight: 6 }}>{line.product_sku}</span>
                  )}
                  {line.product_name || '-'}
                </td>
                <td style={PS.tdCenter}>{line.product_unit || '-'}</td>
                <td style={PS.tdCenter}>{line.location_name || '-'}</td>
                <td style={PS.tdRight}>{line.system_qty}</td>
                <td style={PS.tdRight}>
                  {line.counted_qty != null ? line.counted_qty : '________'}
                </td>
                <td style={varianceStyle}>
                  {variance != null ? (variance > 0 ? `+${variance}` : variance) : '-'}
                </td>
                <td style={PS.tdRight}>
                  {line.variance_value != null ? formatCurrencyPrint(Math.abs(parseFloat(line.variance_value))) : '-'}
                </td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={8} style={{ ...PS.tdCenter, color: '#666' }}>ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Summary */}
      {st.total_variance_value != null && parseFloat(st.total_variance_value) !== 0 && (
        <div style={{ ...PS.costRow, fontWeight: 700, borderTop: '2px solid #000', paddingTop: 8 }}>
          <span>มูลค่าผลต่างรวม:</span>
          <span style={{ color: parseFloat(st.total_variance_value) > 0 ? 'red' : 'green' }}>
            {formatCurrencyPrint(Math.abs(parseFloat(st.total_variance_value)))}
            {parseFloat(st.total_variance_value) > 0 ? ' (สูญหาย)' : ' (ส่วนเกิน)'}
          </span>
        </div>
      )}

      {/* Note */}
      <div style={PS.note}>
        <span style={PS.infoLabel}>หมายเหตุ: </span>
        {st.note || '...........................................................'}
      </div>

      <SignatureSection labels={['ผู้นับ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ']} />
      <PrintFooter />
    </div>
  );
});

export default StockTakePrintView;
