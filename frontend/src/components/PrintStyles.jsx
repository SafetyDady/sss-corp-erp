/**
 * Shared print styles + reusable components for all document print views.
 * Pattern: forwardRef component + className="erp-print-content" + Modal + window.print()
 * @media print rules in App.css handle visibility (hide app, show print content only).
 */

// ── Shared inline styles (black on white, Sarabun Thai font) ──
export const PS = {
  container: {
    fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
    color: '#000',
    background: '#fff',
    padding: 24,
    fontSize: 13,
    lineHeight: 1.6,
  },
  header: {
    textAlign: 'center',
    marginBottom: 16,
  },
  orgName: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    color: '#000',
  },
  orgDetail: {
    fontSize: 11,
    color: '#333',
    margin: '2px 0',
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    margin: '2px 0 12px',
    color: '#000',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px 24px',
    marginBottom: 16,
    fontSize: 13,
    color: '#000',
  },
  infoLabel: {
    fontWeight: 600,
    color: '#000',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    margin: '16px 0 8px',
    color: '#000',
    borderBottom: '1px solid #999',
    paddingBottom: 4,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: 16,
    fontSize: 12,
    color: '#000',
  },
  th: {
    border: '1px solid #444',
    padding: '6px 8px',
    background: '#e5e5e5',
    fontWeight: 600,
    textAlign: 'center',
    color: '#000',
  },
  td: {
    border: '1px solid #444',
    padding: '5px 8px',
    color: '#000',
  },
  tdCenter: {
    border: '1px solid #444',
    padding: '5px 8px',
    textAlign: 'center',
    color: '#000',
  },
  tdRight: {
    border: '1px solid #444',
    padding: '5px 8px',
    textAlign: 'right',
    color: '#000',
  },
  tdBold: {
    border: '1px solid #444',
    padding: '5px 8px',
    textAlign: 'right',
    fontWeight: 700,
    color: '#000',
  },
  summaryRow: {
    border: '1px solid #444',
    padding: '6px 8px',
    fontWeight: 700,
    color: '#000',
    background: '#f0f0f0',
  },
  note: {
    marginBottom: 24,
    fontSize: 13,
    color: '#000',
  },
  signatureGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 24,
    marginTop: 32,
    fontSize: 12,
    color: '#000',
  },
  signatureBlock: {
    textAlign: 'center',
    color: '#000',
  },
  signatureLine: {
    borderBottom: '1px solid #000',
    width: '80%',
    margin: '28px auto 4px',
  },
  signatureLabel: {
    fontWeight: 600,
    marginBottom: 0,
    color: '#000',
  },
  signatureDate: {
    fontSize: 11,
    color: '#333',
    marginTop: 2,
  },
  footer: {
    marginTop: 24,
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
  },
  costRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: 13,
    color: '#000',
  },
  costTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: 15,
    fontWeight: 700,
    color: '#000',
    borderTop: '2px solid #000',
    marginTop: 4,
  },
};

// ── Helpers ──

export function formatDatePrint(isoString) {
  if (!isoString) return '__/__/____';
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatCurrencyPrint(value) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num == null || isNaN(num)) return '\u0E3F0.00';
  return `\u0E3F${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumberPrint(value, decimals = 1) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num == null || isNaN(num)) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Reusable Components ──

/** Company header block — centered with company/org name, address, tax ID, doc title.
 *  When company* props are provided they take priority over org* (multi-company support). */
export function CompanyHeader({ orgName, orgAddress, orgTaxId, companyName, companyAddress, companyTaxId, docTitle, docSubtitle }) {
  const displayName = companyName || orgName || 'SSS Corp';
  const displayAddress = companyAddress || orgAddress;
  const displayTaxId = companyTaxId || orgTaxId;
  return (
    <div style={PS.header}>
      <p style={PS.orgName}>{displayName}</p>
      {displayAddress && <p style={PS.orgDetail}>{displayAddress}</p>}
      {displayTaxId && <p style={PS.orgDetail}>Tax ID: {displayTaxId}</p>}
      <p style={PS.title}>{docTitle}</p>
      {docSubtitle && <p style={{ ...PS.orgDetail, marginTop: -8 }}>{docSubtitle}</p>}
    </div>
  );
}

/** Signature section — 3 configurable signature blocks */
export function SignatureSection({ labels = ['\u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E17\u0E33', '\u0E1C\u0E39\u0E49\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A', '\u0E1C\u0E39\u0E49\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34'] }) {
  return (
    <div style={PS.signatureGrid}>
      {labels.map((label, idx) => (
        <div key={idx} style={PS.signatureBlock}>
          <div style={PS.signatureLine} />
          <p style={PS.signatureLabel}>{label}</p>
          <p style={PS.signatureDate}>วันที่: __/__/____</p>
        </div>
      ))}
    </div>
  );
}

/** Print footer — shows print date/time */
export function PrintFooter() {
  return (
    <div style={PS.footer}>
      Printed: {new Date().toLocaleString('th-TH')}
    </div>
  );
}
