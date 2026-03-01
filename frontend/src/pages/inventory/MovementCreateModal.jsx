import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, App } from 'antd';
import { Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

export default function MovementCreateModal({ open, products, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(undefined);
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
    if (!selectedWarehouse) { setLocations([]); return; }
    api.get('/api/warehouse/locations', { params: { limit: 100, offset: 0, warehouse_id: selectedWarehouse } })
      .then((r) => setLocations(r.data.items || []))
      .catch(() => {});
  }, [selectedWarehouse]);

  const handleWarehouseChange = (val) => {
    setSelectedWarehouse(val);
    form.setFieldsValue({ location_id: undefined });
  };

  const onFinish = async (values) => {
    // Remove warehouse_id before sending (not part of API)
    const { warehouse_id, ...payload } = values;
    // Remove undefined/null location_id
    if (!payload.location_id) delete payload.location_id;
    setLoading(true);
    try {
      await api.post('/api/stock/movements', payload);
      message.success('บันทึกสำเร็จ');
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
      title="สร้างรายการเคลื่อนไหว"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="product_id" label="สินค้า"
          rules={[{ required: true, message: 'กรุณาเลือกสินค้า' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
            placeholder="เลือกสินค้า"
          />
        </Form.Item>
        <Form.Item name="movement_type" label="ประเภท"
          rules={[{ required: true, message: 'กรุณาเลือกประเภท' }]}>
          <Select options={[
            { value: 'RECEIVE', label: 'RECEIVE - รับเข้า' },
            { value: 'ISSUE', label: 'ISSUE - เบิกจ่าย' },
            { value: 'TRANSFER', label: 'TRANSFER - ย้าย' },
            { value: 'ADJUST', label: 'ADJUST - ปรับยอด' },
            { value: 'CONSUME', label: 'CONSUME - เบิกใช้' },
          ]} />
        </Form.Item>
        <Form.Item name="quantity" label="จำนวน"
          rules={[{ required: true, message: 'กรุณากรอกจำนวน' }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="unit_cost" label="ต้นทุน/หน่วย (บาท)">
          <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
        </Form.Item>

        {/* Warehouse / Location Picker */}
        <div style={{ background: COLORS.surface, borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: `1px solid ${COLORS.card}` }}>
          <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={12} /> ตำแหน่งคลังสินค้า (ไม่บังคับ)
          </div>
          <Form.Item name="warehouse_id" label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><WarehouseIcon size={12} /> คลังสินค้า</span>} style={{ marginBottom: 8 }}>
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

        <Form.Item name="reference" label="อ้างอิง">
          <Input placeholder="PO-001, WO-001, etc." />
        </Form.Item>
        <Form.Item name="note" label="หมายเหตุ">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
