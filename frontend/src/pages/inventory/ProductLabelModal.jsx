import { useState } from 'react';
import { Modal, Button, Switch, Space, Radio, Divider } from 'antd';
import { Printer } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { COLORS } from '../../utils/constants';
import ProductLabel from './ProductLabel';

/**
 * ProductLabelModal — Preview + print product labels (single or bulk)
 * Follows POQRCodeModal pattern: Modal + qr-print-content + window.print()
 */
export default function ProductLabelModal({ open, products = [], onClose }) {
  const orgName = useAuthStore((s) => s.orgName);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [columns, setColumns] = useState(3);

  const handlePrint = () => {
    window.print();
  };

  if (!products.length) return null;

  const isSingle = products.length === 1;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={isSingle ? `Label — ${products[0].sku}` : `Print Labels (${products.length})`}
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        <Button key="print" type="primary" icon={<Printer size={14} />} onClick={handlePrint}>
          Print Labels
        </Button>,
      ]}
      width={isSingle ? 420 : 780}
      destroyOnHidden
    >
      {/* Options bar */}
      <div style={optionStyles.bar}>
        <Space size={16} wrap>
          <Space size={6}>
            <span style={optionStyles.label}>Barcode</span>
            <Switch size="small" checked={showBarcode} onChange={setShowBarcode} />
          </Space>
          <Space size={6}>
            <span style={optionStyles.label}>QR Code</span>
            <Switch size="small" checked={showQR} onChange={setShowQR} />
          </Space>
          {!isSingle && (
            <Space size={6}>
              <span style={optionStyles.label}>Columns</span>
              <Radio.Group size="small" value={columns} onChange={(e) => setColumns(e.target.value)}>
                <Radio.Button value={2}>2</Radio.Button>
                <Radio.Button value={3}>3</Radio.Button>
              </Radio.Group>
            </Space>
          )}
        </Space>
      </div>

      <Divider style={{ margin: '12px 0', borderColor: COLORS.border }} />

      {/* Print content */}
      <div className="qr-print-content" style={isSingle ? printStyles.single : printStyles.grid(columns)}>
        {products.map((product) => (
          <ProductLabel
            key={product.id}
            product={product}
            showBarcode={showBarcode}
            showQR={showQR}
            orgName={orgName}
          />
        ))}
      </div>
    </Modal>
  );
}

const optionStyles = {
  bar: {
    padding: '8px 0',
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
};

const printStyles = {
  single: {
    display: 'flex',
    justifyContent: 'center',
    padding: 16,
  },
  grid: (cols) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: '8px',
    padding: '8px',
  }),
};
