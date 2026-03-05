import { useState, useEffect } from 'react';
import { Modal, Table, InputNumber, Input, App, Select } from 'antd';
import { Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import api from '../../services/api';
import { getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function DOShipModal({ open, doData, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [shippedQtys, setShippedQtys] = useState({});
  const [locationOverrides, setLocationOverrides] = useState({});
  const [shipNote, setShipNote] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [locationsByWarehouse, setLocationsByWarehouse] = useState({});
  const [selectedWarehouses, setSelectedWarehouses] = useState({});
  const { message } = App.useApp();

  // Fetch warehouses on open
  useEffect(() => {
    if (!open) return;
    api.get('/api/warehouse/warehouses', { params: { limit: 100, offset: 0 } })
      .then((r) => setWarehouses(r.data.items || []))
      .catch(() => {});
  }, [open]);

  // Reset state when modal opens
  useEffect(() => {
    if (!open || !doData) return;
    const defaultQtys = {};
    (doData.lines || []).forEach((line) => {
      defaultQtys[line.id] = line.ordered_qty;
    });
    setShippedQtys(defaultQtys);
    setLocationOverrides({});
    setSelectedWarehouses({});
    setShipNote('');
  }, [open, doData?.id]);

  const fetchLocations = (warehouseId, lineId) => {
    if (!warehouseId) {
      setLocationsByWarehouse((prev) => {
        const next = { ...prev };
        delete next[lineId];
        return next;
      });
      setLocationOverrides((prev) => {
        const next = { ...prev };
        delete next[lineId];
        return next;
      });
      return;
    }
    api.get('/api/warehouse/locations', { params: { limit: 100, offset: 0, warehouse_id: warehouseId } })
      .then((r) => setLocationsByWarehouse((prev) => ({ ...prev, [lineId]: r.data.items || [] })))
      .catch(() => {});
  };

  const handleWarehouseChange = (lineId, warehouseId) => {
    setSelectedWarehouses((prev) => ({ ...prev, [lineId]: warehouseId }));
    setLocationOverrides((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
    fetchLocations(warehouseId, lineId);
  };

  const handleSubmit = async () => {
    const lines = (doData?.lines || []).map((line) => ({
      line_id: line.id,
      shipped_qty: shippedQtys[line.id] ?? line.ordered_qty,
      ...(locationOverrides[line.id] ? { location_id: locationOverrides[line.id] } : {}),
    }));

    const hasQty = lines.some((l) => l.shipped_qty > 0);
    if (!hasQty) {
      message.error('กรุณาระบุจำนวนส่งอย่างน้อย 1 รายการ');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/api/sales/delivery/${doData.id}/ship`, {
        lines,
        note: shipNote || undefined,
      });
      message.success('ยืนยันจัดส่งสำเร็จ — ตัดสต็อกเรียบร้อย');
      onSuccess();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'สินค้า', key: 'product', ellipsis: true,
      render: (_, record) => (
        <div>
          <span style={{ fontFamily: 'monospace', color: COLORS.accent, fontSize: 12 }}>
            {record.product_sku || '-'}
          </span>
          {record.product_name && (
            <span style={{ color: COLORS.text, marginLeft: 8 }}>{record.product_name}</span>
          )}
        </div>
      ),
    },
    {
      title: 'สั่ง', dataIndex: 'ordered_qty', key: 'ordered_qty', width: 70, align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'จำนวนส่ง', key: 'shipped_qty', width: 110,
      render: (_, record) => (
        <InputNumber
          min={0}
          max={record.ordered_qty}
          value={shippedQtys[record.id] ?? record.ordered_qty}
          onChange={(val) => setShippedQtys((prev) => ({ ...prev, [record.id]: val }))}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <WarehouseIcon size={12} /> คลัง
        </span>
      ),
      key: 'warehouse', width: 150,
      render: (_, record) => (
        <Select
          allowClear
          size="small"
          style={{ width: '100%' }}
          placeholder="เลือกคลัง"
          value={selectedWarehouses[record.id]}
          onChange={(val) => handleWarehouseChange(record.id, val)}
          options={warehouses.map((w) => ({ value: w.id, label: `${w.code} - ${w.name}` }))}
        />
      ),
    },
    {
      title: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={12} /> ตำแหน่ง
        </span>
      ),
      key: 'location', width: 170,
      render: (_, record) => (
        <Select
          allowClear
          size="small"
          style={{ width: '100%' }}
          placeholder="เลือก Location"
          value={locationOverrides[record.id]}
          onChange={(val) => setLocationOverrides((prev) => ({ ...prev, [record.id]: val }))}
          disabled={!selectedWarehouses[record.id]}
          options={(locationsByWarehouse[record.id] || []).map((l) => ({
            value: l.id,
            label: `${l.code} - ${l.name} (${l.zone_type})`,
          }))}
        />
      ),
    },
  ];

  return (
    <Modal
      title="ยืนยันจัดส่ง / Ship Delivery"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={900}
      okText="ยืนยันจัดส่ง"
      okButtonProps={{ style: { background: COLORS.success } }}
      destroyOnHidden
    >
      <p style={{ color: COLORS.textSecondary, marginBottom: 16, fontSize: 13 }}>
        ตรวจสอบจำนวนส่งและเลือกตำแหน่งจัดเก็บ (ต้นทาง) สำหรับแต่ละรายการ
        ระบบจะตัดสต็อกอัตโนมัติ (ISSUE movement)
      </p>

      <Table
        dataSource={doData?.lines || []}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
        style={{ marginBottom: 16 }}
      />

      {/* Ship note */}
      <div>
        <label style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4, display: 'block' }}>
          หมายเหตุการจัดส่ง
        </label>
        <Input.TextArea
          rows={2}
          value={shipNote}
          onChange={(e) => setShipNote(e.target.value)}
          placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
          maxLength={500}
        />
      </div>
    </Modal>
  );
}
