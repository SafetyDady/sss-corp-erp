import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint, formatCurrencyPrint } from '../../components/PrintStyles';

const PRPrintView = forwardRef(function PRPrintView({ pr, products, orgName, orgAddress, orgTaxId }, ref) {
  if (!pr) return null;

  const lines = pr.lines || [];
  const totalEstimated = pr.total_estimated != null
    ? Number(pr.total_estimated)
    : lines.reduce((sum, l) => sum + (Number(l.estimated_unit_cost) || 0) * (l.quantity || 0), 0);

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        companyName={pr.company_name}
        docTitle={'ใบขอซื้อ / Purchase Requisition'}
      />

      {/* Info section */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>PR Number: </span>
          <span style={{ fontFamily: 'monospace' }}>{pr.pr_number}</span>
        </div>
        <div>
          <span style={PS.infoLabel}>{'ประเภท'}: </span>
          {pr.pr_type === 'BLANKET' ? 'BLANKET' : 'STANDARD'}
        </div>
        <div>
          <span style={PS.infoLabel}>{'ความเร่งด่วน'}: </span>
          {pr.priority === 'URGENT' ? 'เร่งด่วน' : 'ปกติ'}
        </div>
        <div>
          <span style={PS.infoLabel}>{'สถานะ'}: </span>
          {pr.status}
        </div>
        <div>
          <span style={PS.infoLabel}>{'วันที่ต้องการ'}: </span>
          {formatDatePrint(pr.required_date)}
        </div>
        {pr.delivery_date && (
          <div>
            <span style={PS.infoLabel}>{'วันที่ส่ง'}: </span>
            {formatDatePrint(pr.delivery_date)}
          </div>
        )}
        {pr.pr_type === 'BLANKET' && pr.validity_start_date && (
          <div>
            <span style={PS.infoLabel}>{'ช่วงสัญญา'}: </span>
            {formatDatePrint(pr.validity_start_date)} - {formatDatePrint(pr.validity_end_date)}
          </div>
        )}
        {pr.note && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={PS.infoLabel}>{'หมายเหตุ'}: </span>
            {pr.note}
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
            <th style={{ ...PS.th, width: 90 }}>{'ราคาประมาณ'}</th>
            <th style={{ ...PS.th, width: 100 }}>{'รวม'}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const itemType = line.item_type || 'GOODS';
            const product = line.product_id ? products[line.product_id] : null;
            const itemName = product
              ? `${product.sku} - ${product.name}`
              : (line.description || '-');
            const lineTotal = (Number(line.estimated_unit_cost) || 0) * (line.quantity || 0);

            return (
              <tr key={line.id || idx}>
                <td style={PS.tdCenter}>{idx + 1}</td>
                <td style={PS.tdCenter}>{itemType === 'GOODS' ? 'GOODS' : 'SVC'}</td>
                <td style={PS.td}>{itemName}</td>
                <td style={PS.tdRight}>{line.quantity}</td>
                <td style={PS.tdCenter}>{line.unit || '-'}</td>
                <td style={PS.tdRight}>{formatCurrencyPrint(line.estimated_unit_cost)}</td>
                <td style={PS.tdRight}>{formatCurrencyPrint(lineTotal)}</td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={7} style={{ ...PS.tdCenter, color: '#666' }}>{'ไม่มีรายการ'}</td>
            </tr>
          )}
          {/* Total row */}
          <tr className="summary-row">
            <td colSpan={6} style={{ ...PS.summaryRow, textAlign: 'right' }}>{'ยอดประมาณรวม'}</td>
            <td style={PS.summaryRow}>{formatCurrencyPrint(totalEstimated)}</td>
          </tr>
        </tbody>
      </table>

      {/* Signature blocks */}
      <SignatureSection labels={['ผู้ขอซื้อ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ']} />

      <PrintFooter />
    </div>
  );
});

export default PRPrintView;
