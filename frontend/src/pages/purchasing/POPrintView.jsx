import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint, formatCurrencyPrint } from '../../components/PrintStyles';

const POPrintView = forwardRef(function POPrintView({ po, products, orgName, orgAddress, orgTaxId }, ref) {
  if (!po) return null;

  const lines = po.lines || [];
  const totalAmount = lines.reduce((sum, l) => sum + (l.unit_cost || 0) * l.quantity, 0);

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        docTitle={'\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D / Purchase Order'}
      />

      {/* Info section */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>PO Number: </span>
          <span style={{ fontFamily: 'monospace' }}>{po.po_number}</span>
        </div>
        <div>
          <span style={PS.infoLabel}>{'\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D'}: </span>
          {formatDatePrint(po.order_date)}
        </div>
        <div>
          <span style={PS.infoLabel}>{'\u0E0B\u0E31\u0E1E\u0E1E\u0E25\u0E32\u0E22\u0E40\u0E2D\u0E2D\u0E23\u0E4C'}: </span>
          {po.supplier_code && (
            <span style={{ fontFamily: 'monospace' }}>{po.supplier_code} — </span>
          )}
          {po.supplier_name || '-'}
        </div>
        <div>
          <span style={PS.infoLabel}>{'\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E04\u0E32\u0E14\u0E23\u0E31\u0E1A'}: </span>
          {formatDatePrint(po.expected_date)}
        </div>
        {po.supplier_contact && (
          <div>
            <span style={PS.infoLabel}>{'\u0E1C\u0E39\u0E49\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D'}: </span>
            {po.supplier_contact}
          </div>
        )}
        {po.supplier_phone && (
          <div>
            <span style={PS.infoLabel}>{'\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C'}: </span>
            {po.supplier_phone}
          </div>
        )}
        {po.pr_number && (
          <div>
            <span style={PS.infoLabel}>PR {'\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07'}: </span>
            <span style={{ fontFamily: 'monospace' }}>{po.pr_number}</span>
          </div>
        )}
        {po.delivery_note_number && (
          <div>
            <span style={PS.infoLabel}>{'\u0E40\u0E25\u0E02\u0E43\u0E1A\u0E27\u0E32\u0E07\u0E02\u0E2D\u0E07'}: </span>
            <span style={{ fontFamily: 'monospace' }}>{po.delivery_note_number}</span>
          </div>
        )}
      </div>

      {/* Lines table */}
      <table style={PS.table}>
        <thead>
          <tr>
            <th style={{ ...PS.th, width: 35 }}>#</th>
            <th style={{ ...PS.th, width: 65 }}>{'\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17'}</th>
            <th style={PS.th}>{'\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32/\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23'}</th>
            <th style={{ ...PS.th, width: 60 }}>{'\u0E08\u0E33\u0E19\u0E27\u0E19'}</th>
            <th style={{ ...PS.th, width: 55 }}>{'\u0E2B\u0E19\u0E48\u0E27\u0E22'}</th>
            <th style={{ ...PS.th, width: 90 }}>{'\u0E23\u0E32\u0E04\u0E32/\u0E2B\u0E19\u0E48\u0E27\u0E22'}</th>
            <th style={{ ...PS.th, width: 100 }}>{'\u0E23\u0E27\u0E21'}</th>
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
              <td colSpan={7} style={{ ...PS.tdCenter, color: '#666' }}>{'\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23'}</td>
            </tr>
          )}
          {/* Total row */}
          <tr className="summary-row">
            <td colSpan={6} style={{ ...PS.summaryRow, textAlign: 'right' }}>{'\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21'}</td>
            <td style={PS.summaryRow}>{formatCurrencyPrint(totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      {/* Note */}
      {po.note && (
        <div style={PS.note}>
          <span style={PS.infoLabel}>{'\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38'}: </span>
          {po.note}
        </div>
      )}

      {/* Signature blocks */}
      <SignatureSection labels={['\u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E17\u0E33', '\u0E1C\u0E39\u0E49\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A', '\u0E1C\u0E39\u0E49\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34']} />

      <PrintFooter />
    </div>
  );
});

export default POPrintView;
