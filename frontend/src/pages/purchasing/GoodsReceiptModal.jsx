import { useState } from 'react';
import { Modal, Table, InputNumber, App, Tag } from 'antd';
import api from '../../services/api';
import { getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function GoodsReceiptModal({ open, po, products, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [receiptQtys, setReceiptQtys] = useState({});
  const { message } = App.useApp();

  const getReceiptQty = (lineId) => receiptQtys[lineId] || 0;
  const updateReceiptQty = (lineId, value) => {
    setReceiptQtys({ ...receiptQtys, [lineId]: value || 0 });
  };

  const handleSubmit = async () => {
    const receiptLines = (po?.lines || [])
      .filter((line) => getReceiptQty(line.id) > 0)
      .map((line) => ({
        line_id: line.id,
        received_qty: getReceiptQty(line.id),
      }));

    if (receiptLines.length === 0) {
      message.error('กรุณาระบุจำนวนรับอย่างน้อย 1 รายการ');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/api/purchasing/po/${po.id}/receive`, { lines: receiptLines });
      message.success('รับสินค้า/บริการสำเร็จ');
      setReceiptQtys({});
      onSuccess();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  const goodsLines = (po?.lines || []).filter((l) => (l.item_type || 'GOODS') === 'GOODS');
  const serviceLines = (po?.lines || []).filter((l) => l.item_type === 'SERVICE');

  const makeColumns = (isService) => [
    {
      title: isService ? 'บริการ' : 'สินค้า', key: 'product', ellipsis: true,
      render: (_, record) => {
        if (record.product_id && products?.[record.product_id]) {
          const p = products[record.product_id];
          return `${p.sku} - ${p.name}`;
        }
        return record.description || '-';
      },
    },
    { title: 'สั่ง', dataIndex: 'quantity', width: 60, align: 'right' },
    {
      title: 'รับแล้ว', dataIndex: 'received_qty', width: 70, align: 'right',
      render: (v) => <span style={{ color: COLORS.success }}>{v || 0}</span>,
    },
    {
      title: 'คงเหลือ', key: 'remaining', width: 70, align: 'right',
      render: (_, record) => {
        const remaining = record.quantity - (record.received_qty || 0);
        return <span style={{ color: remaining > 0 ? COLORS.warning : COLORS.success }}>{remaining}</span>;
      },
    },
    {
      title: isService ? 'จำนวนยืนยัน' : 'จำนวนรับ', key: 'receipt', width: 120,
      render: (_, record) => {
        const remaining = record.quantity - (record.received_qty || 0);
        if (remaining <= 0) return <Tag color="green">ครบแล้ว</Tag>;
        return (
          <InputNumber
            min={0}
            max={remaining}
            value={getReceiptQty(record.id)}
            onChange={(val) => updateReceiptQty(record.id, val)}
            size="small"
            style={{ width: '100%' }}
          />
        );
      },
    },
  ];

  return (
    <Modal
      title="Goods Receipt / รับสินค้าและบริการ"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={750}
      okText="ยืนยันการรับ"
      destroyOnHidden
    >
      {goodsLines.length > 0 && (
        <>
          <h4 style={{ color: COLORS.text, marginBottom: 8 }}>
            <Tag color="blue">GOODS</Tag> สินค้า — รับเข้าคลัง (สร้าง Stock Movement อัตโนมัติ)
          </h4>
          <Table
            dataSource={goodsLines}
            columns={makeColumns(false)}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginBottom: 24 }}
          />
        </>
      )}

      {serviceLines.length > 0 && (
        <>
          <h4 style={{ color: COLORS.text, marginBottom: 8 }}>
            <Tag color="green">SERVICE</Tag> บริการ — ยืนยันรับงาน (ไม่มี Stock Movement)
          </h4>
          <Table
            dataSource={serviceLines}
            columns={makeColumns(true)}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </>
      )}
    </Modal>
  );
}
