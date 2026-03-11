import Barcode from 'react-barcode';
import { QRCode } from 'antd';

/**
 * ProductLabel — Single product label for print
 * Renders Code128 barcode + QR + product info
 * Black-on-white, print-optimized, fixed size
 */
export default function ProductLabel({ product, showBarcode = true, showQR = true, orgName }) {
  if (!product) return null;

  const qrText = [
    `SKU:${product.sku}`,
    `Name:${product.name}`,
    product.id ? `ID:${product.id}` : '',
  ].filter(Boolean).join('\n');

  return (
    <div style={styles.container}>
      {/* Barcode section */}
      {showBarcode && (
        <div style={styles.barcodeWrap}>
          <Barcode
            value={product.sku}
            format="CODE128"
            width={1.5}
            height={44}
            fontSize={12}
            displayValue={false}
            margin={0}
            background="#ffffff"
            lineColor="#000000"
          />
          <div style={styles.skuText}>{product.sku}</div>
        </div>
      )}

      {/* Info + QR row */}
      <div style={styles.infoRow}>
        <div style={styles.infoBlock}>
          <div style={styles.productName}>{product.name}</div>
          <div style={styles.metaRow}>
            {product.model && <span>Model: {product.model}</span>}
            {product.model && product.unit && <span style={styles.separator}>|</span>}
            {product.unit && <span>Unit: {product.unit}</span>}
          </div>
          {orgName && <div style={styles.orgText}>{orgName}</div>}
        </div>
        {showQR && (
          <div style={styles.qrWrap}>
            <QRCode
              value={qrText}
              size={52}
              color="#000000"
              bgColor="#ffffff"
              bordered={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '70mm',
    minHeight: '35mm',
    padding: '3mm 4mm',
    background: '#ffffff',
    color: '#000000',
    fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
    fontSize: 11,
    border: '1px solid #ccc',
    boxSizing: 'border-box',
    display: 'inline-block',
    breakInside: 'avoid',
    pageBreakInside: 'avoid',
  },
  barcodeWrap: {
    textAlign: 'center',
    marginBottom: 2,
  },
  skuText: {
    fontFamily: "'Courier New', monospace",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    marginTop: 1,
    color: '#000000',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 3,
  },
  infoBlock: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#000000',
  },
  metaRow: {
    fontSize: 9,
    color: '#333333',
    marginTop: 1,
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  separator: {
    color: '#999999',
  },
  orgText: {
    fontSize: 8,
    color: '#666666',
    marginTop: 2,
  },
  qrWrap: {
    flexShrink: 0,
  },
};
