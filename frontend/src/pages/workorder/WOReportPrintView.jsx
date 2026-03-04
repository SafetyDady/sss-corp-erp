import { forwardRef } from 'react';
import { PS, CompanyHeader, SignatureSection, PrintFooter, formatDatePrint, formatCurrencyPrint, formatNumberPrint } from '../../components/PrintStyles';

const WOReportPrintView = forwardRef(function WOReportPrintView(
  { wo, cost, manhour, materials, orgName, orgAddress, orgTaxId },
  ref,
) {
  if (!wo) return null;

  const activeMatRows = (materials || []).filter((m) => !m.is_reversed);

  return (
    <div className="erp-print-content" ref={ref} style={PS.container}>
      <CompanyHeader
        orgName={orgName}
        orgAddress={orgAddress}
        orgTaxId={orgTaxId}
        docTitle="Work Order Cost Report"
      />

      {/* WO Info */}
      <div style={PS.infoGrid}>
        <div>
          <span style={PS.infoLabel}>WO Number: </span>
          <span style={{ fontFamily: 'monospace' }}>{wo.wo_number}</span>
        </div>
        <div>
          <span style={PS.infoLabel}>Status: </span>
          {wo.status}
        </div>
        <div>
          <span style={PS.infoLabel}>{'\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32'}: </span>
          {wo.customer_name || '-'}
        </div>
        <div>
          <span style={PS.infoLabel}>Cost Center: </span>
          {wo.cost_center_code || '-'}
        </div>
        {wo.description && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={PS.infoLabel}>{'\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14'}: </span>
            {wo.description}
          </div>
        )}
        <div>
          <span style={PS.infoLabel}>{'\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D'}: </span>
          {formatDatePrint(wo.opened_at)}
        </div>
        <div>
          <span style={PS.infoLabel}>{'\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D'}: </span>
          {formatDatePrint(wo.closed_at)}
        </div>
      </div>

      {/* Job Costing Summary */}
      {cost && (
        <>
          <div style={PS.sectionTitle}>Job Costing Summary</div>
          <div style={{ marginBottom: 16 }}>
            <div style={PS.costRow}>
              <span>Material Cost</span>
              <span>{formatCurrencyPrint(cost.material_cost)}</span>
            </div>
            <div style={PS.costRow}>
              <span>ManHour Cost</span>
              <span>{formatCurrencyPrint(cost.manhour_cost)}</span>
            </div>
            <div style={PS.costRow}>
              <span>Tools Recharge</span>
              <span>{formatCurrencyPrint(cost.tools_recharge)}</span>
            </div>
            <div style={PS.costRow}>
              <span>Admin Overhead</span>
              <span>{formatCurrencyPrint(cost.admin_overhead)}</span>
            </div>
            <div style={PS.costTotal}>
              <span>Total Cost</span>
              <span>{formatCurrencyPrint(cost.total_cost)}</span>
            </div>
          </div>
        </>
      )}

      {/* Materials table */}
      {activeMatRows.length > 0 && (
        <>
          <div style={PS.sectionTitle}>{'\u0E27\u0E31\u0E2A\u0E14\u0E38\u0E17\u0E35\u0E48\u0E40\u0E1A\u0E34\u0E01'} (Materials)</div>
          <table style={PS.table}>
            <thead>
              <tr>
                <th style={{ ...PS.th, width: 35 }}>#</th>
                <th style={{ ...PS.th, width: 80 }}>{'\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17'}</th>
                <th style={PS.th}>{'\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}</th>
                <th style={{ ...PS.th, width: 50 }}>{'\u0E2B\u0E19\u0E48\u0E27\u0E22'}</th>
                <th style={{ ...PS.th, width: 60 }}>{'\u0E08\u0E33\u0E19\u0E27\u0E19'}</th>
                <th style={{ ...PS.th, width: 90 }}>{'\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19/\u0E2B\u0E19\u0E48\u0E27\u0E22'}</th>
                <th style={{ ...PS.th, width: 100 }}>{'\u0E23\u0E27\u0E21'}</th>
              </tr>
            </thead>
            <tbody>
              {activeMatRows.map((m, idx) => (
                <tr key={m.id || idx}>
                  <td style={PS.tdCenter}>{idx + 1}</td>
                  <td style={PS.tdCenter}>{m.movement_type}</td>
                  <td style={PS.td}>
                    {m.product_sku && <span style={{ fontFamily: 'monospace', marginRight: 4 }}>{m.product_sku}</span>}
                    {m.product_name || '-'}
                  </td>
                  <td style={PS.tdCenter}>{m.unit || '-'}</td>
                  <td style={PS.tdRight}>{m.quantity}</td>
                  <td style={PS.tdRight}>{formatCurrencyPrint(m.unit_cost)}</td>
                  <td style={PS.tdRight}>{formatCurrencyPrint(m.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ManHour Detail */}
      {manhour && manhour.workers && manhour.workers.length > 0 && (
        <>
          <div style={PS.sectionTitle}>ManHour Detail</div>
          <div style={{ ...PS.infoGrid, marginBottom: 8 }}>
            <div>
              <span style={PS.infoLabel}>Planned Hours: </span>
              {formatNumberPrint(manhour.planned_manhours)} hrs
            </div>
            <div>
              <span style={PS.infoLabel}>Actual Hours: </span>
              {formatNumberPrint(manhour.actual_manhours)} hrs
            </div>
          </div>
          <table style={PS.table}>
            <thead>
              <tr>
                <th style={{ ...PS.th, width: 35 }}>#</th>
                <th style={PS.th}>{'\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19'}</th>
                <th style={{ ...PS.th, width: 90 }}>Regular (hrs)</th>
                <th style={{ ...PS.th, width: 90 }}>OT (hrs)</th>
                <th style={{ ...PS.th, width: 90 }}>Total (hrs)</th>
              </tr>
            </thead>
            <tbody>
              {manhour.workers.map((w, idx) => (
                <tr key={w.employee_id || idx}>
                  <td style={PS.tdCenter}>{idx + 1}</td>
                  <td style={PS.td}>{w.employee_name}</td>
                  <td style={PS.tdRight}>{formatNumberPrint(w.regular_hours)}</td>
                  <td style={PS.tdRight}>{formatNumberPrint(w.ot_hours)}</td>
                  <td style={PS.tdBold}>{formatNumberPrint(w.total_hours)}</td>
                </tr>
              ))}
              {/* Summary row */}
              <tr className="summary-row">
                <td colSpan={2} style={{ ...PS.summaryRow, textAlign: 'right' }}>{'\u0E23\u0E27\u0E21'}</td>
                <td style={PS.summaryRow}>{formatNumberPrint(manhour.workers.reduce((s, w) => s + Number(w.regular_hours || 0), 0))}</td>
                <td style={PS.summaryRow}>{formatNumberPrint(manhour.workers.reduce((s, w) => s + Number(w.ot_hours || 0), 0))}</td>
                <td style={PS.summaryRow}>{formatNumberPrint(manhour.actual_manhours)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Signature blocks */}
      <SignatureSection labels={['\u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E17\u0E33', '\u0E1C\u0E39\u0E49\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A', '\u0E1C\u0E39\u0E49\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34']} />

      <PrintFooter />
    </div>
  );
});

export default WOReportPrintView;
