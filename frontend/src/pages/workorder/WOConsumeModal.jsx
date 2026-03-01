import { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Select, App, Input } from 'antd';
import { Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

export default function WOConsumeModal({ open, workOrderId, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(undefined);
  const { message } = App.useApp();

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } }),
      api.get('/api/warehouse/warehouses', { params: { limit: 100, offset: 0 } }),
    ]).then(([prodRes, whRes]) => {
      // Filter out SERVICE products (only MATERIAL and CONSUMABLE)
      setProducts((prodRes.data.items || []).filter((p) => p.product_type !== 'SERVICE'));
      setWarehouses(whRes.data.items || []);
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!selectedWarehouse) { setLocations([]); return; }
    api.get('/api/warehouse/locations', { params: { limit: 100, offset: 0, warehouse_id: selectedWarehouse } })
      .then((r) => setLocations(r.data.items || []))
      .catch(() => {});
  }, [selectedWarehouse]);

  const handleWarehouseChange = (val) => {
    setSelectedWarehouse(val);
    form.setFieldsValue({ location_id: undefined });
  };

  // unit_cost is auto-filled from product.cost on backend — no need for user input

  const onFinish = async (values) => {
    const { warehouse_id, ...rest } = values;
    const payload = {
      movement_type: 'CONSUME',
      work_order_id: workOrderId,
      ...rest,
    };
    if (!payload.location_id) delete payload.location_id;
    payload.unit_cost = 0; // backend auto-fills from product.cost

    setLoading(true);
    try {
      await api.post('/api/stock/movements', payload);
      message.success('เบิกวัสดุสำเร็จ');
      form.resetFields();
      setSelectedWarehouse(undefined);
      onSuccess();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="เบิกวัสดุเข้า Work Order"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="product_id" label="สินค้า/วัตถุดิบ"
          rules={[{ required: true, message: 'กรุณาเลือกสินค้า' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="เลือกสินค้า (เฉพาะ MATERIAL / CONSUMABLE)"
            options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
          />
        </Form.Item>

        <Form.Item name="quantity" label="จำนวน"
          rules={[{ required: true, message: 'กรุณากรอกจำนวน' }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>

        {/* Source Location (optional) */}
        <div style={{ background: COLORS.surface, borderRadius: 8, padding: '12px 16px', border: `1px solid ${COLORS.card}` }}>
          <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={12} /> ตำแหน่งที่เบิก (ไม่บังคับ)
          </div>
          <Form.Item name="warehouse_id" label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><WarehouseIcon size={12} /> คลัง</span>} style={{ marginBottom: 8 }}>
            <Select
              allowClear
              placeholder="เลือกคลังสินค้า"
              options={warehouses.map((w) => ({ value: w.id, label: `${w.code} - ${w.name}` }))}
              onChange={handleWarehouseChange}
            />
          </Form.Item>
          <Form.Item name="location_id" label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> ตำแหน่ง</span>} style={{ marginBottom: 0 }}>
            <Select
              allowClear
              placeholder="เลือก Location"
              disabled={!selectedWarehouse}
              options={locations.map((l) => ({ value: l.id, label: `${l.code} - ${l.name} (${l.zone_type})` }))}
            />
          </Form.Item>
        </div>

        <Form.Item name="reference" label="อ้างอิง" style={{ marginTop: 16 }}>
          <input className="ant-input" placeholder="เลขที่ใบเบิก, หมายเลขอ้างอิง" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: '4px 11px', width: '100%' }} />
        </Form.Item>
        <Form.Item name="note" label="หมายเหตุ">
          <textarea className="ant-input" rows={2} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: '4px 11px', width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
