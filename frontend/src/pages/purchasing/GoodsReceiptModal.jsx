import { useState, useEffect } from 'react';
import { Modal, Table, InputNumber, App, Tag, Row, Col, Select } from 'antd';
import { Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import api from '../../services/api';
import { getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function GoodsReceiptModal({ open, po, products, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [receiptQtys, setReceiptQtys] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(undefined);
  const [selectedLocationId, setSelectedLocationId] = useState(undefined);
  const { message } = App.useApp();

  // Fetch warehouses on open
  useEffect(() => {
    if (!open) return;
    api.get('/api/warehouse/warehouses', { params: { limit: 100, offset: 0 } })
      .then((r) => setWarehouses(r.data.items || []))
      .catch(() => {});
  }, [open]);

  // Fetch locations when warehouse changes
  useEffect(() => {
    if (!selectedWarehouseId) { setLocations([]); setSelectedLocationId(undefined); return; }
    api.get('/api/warehouse/locations', { params: { limit: 100, offset: 0, warehouse_id: selectedWarehouseId } })
      .then((r) => setLocations(r.data.items || []))
      .catch(() => {});
    setSelectedLocationId(undefined);
  }, [selectedWarehouseId]);

  const getReceiptQty = (lineId) => receiptQtys[lineId] || 0;
  const updateReceiptQty = (lineId, value) => {
    setReceiptQtys({ ...receiptQtys, [lineId]: value || 0 });
  };

  const handleSubmit = async () => {
    const receiptLines = (po?.lines || [])
      .filter((line) => getReceiptQty(line.id) > 0)
      .map((line) => {
        const isGoods = (line.item_type || 'GOODS') === 'GOODS';
        return {
          line_id: line.id,
          received_qty: getReceiptQty(line.id),
          ...(isGoods && selectedLocationId ? { location_id: selectedLocationId } : {}),
        };
      });

    if (receiptLines.length === 0) {
      message.error('กรุณาระบุจำนวนรับอย่างน้อย 1 รายการ');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/api/purchasing/po/${po.id}/receive`, { lines: receiptLines });
      message.success('รับสินค้า/บริการสำเร็จ');
      setReceiptQtys({});
      setSelectedWarehouseId(undefined);
      setSelectedLocationId(undefined);
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
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <label style={{ color: COLORS.textSecondary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <WarehouseIcon size={12} /> คลังสินค้า
              </label>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="เลือกคลังสินค้า"
                value={selectedWarehouseId}
                onChange={setSelectedWarehouseId}
                options={warehouses.map((w) => ({ value: w.id, label: `${w.code} - ${w.name}` }))}
                size="small"
              />
            </Col>
            <Col span={12}>
              <label style={{ color: COLORS.textSecondary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <MapPin size={12} /> ตำแหน่ง (Location)
              </label>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="เลือก Location"
                value={selectedLocationId}
                onChange={setSelectedLocationId}
                disabled={!selectedWarehouseId}
                options={locations.map((l) => ({ value: l.id, label: `${l.code} - ${l.name} (${l.zone_type})` }))}
                size="small"
              />
            </Col>
          </Row>
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
