import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, App, Radio } from 'antd';
import { Warehouse as WarehouseIcon, MapPin, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const MOVEMENT_TYPES = [
  { value: 'RECEIVE', label: 'RECEIVE - รับเข้า' },
  { value: 'ISSUE', label: 'ISSUE - เบิกจ่าย' },
  { value: 'TRANSFER', label: 'TRANSFER - ย้าย' },
  { value: 'ADJUST', label: 'ADJUST - ปรับยอด' },
  { value: 'CONSUME', label: 'CONSUME - เบิกใช้ (WO)' },
  { value: 'RETURN', label: 'RETURN - คืนวัสดุ (WO)' },
];

export default function MovementCreateModal({ open, products, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [destLocations, setDestLocations] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(undefined);
  const [destWarehouse, setDestWarehouse] = useState(undefined);
  const [workOrders, setWorkOrders] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [costElements, setCostElements] = useState([]);
  const { message } = App.useApp();

  const moveType = Form.useWatch('movement_type', form);

  // Fetch reference data on open
  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get('/api/warehouse/warehouses', { params: { limit: 100, offset: 0 } }),
      api.get('/api/work-orders', { params: { limit: 200, offset: 0, status: 'OPEN' } }),
      api.get('/api/master/cost-centers', { params: { limit: 200, offset: 0 } }),
      api.get('/api/master/cost-elements', { params: { limit: 200, offset: 0 } }),
    ]).then(([whRes, woRes, ccRes, ceRes]) => {
      setWarehouses(whRes.data.items || []);
      setWorkOrders(woRes.data.items || []);
      setCostCenters(ccRes.data.items || []);
      setCostElements(ceRes.data.items || []);
    }).catch(() => {});
  }, [open]);

  // Fetch locations when source warehouse changes
  useEffect(() => {
    if (!selectedWarehouse) { setLocations([]); return; }
    api.get('/api/warehouse/locations', { params: { limit: 100, offset: 0, warehouse_id: selectedWarehouse } })
      .then((r) => setLocations(r.data.items || []))
      .catch(() => {});
  }, [selectedWarehouse]);

  // Fetch locations when dest warehouse changes (for TRANSFER)
  useEffect(() => {
    if (!destWarehouse) { setDestLocations([]); return; }
    api.get('/api/warehouse/locations', { params: { limit: 100, offset: 0, warehouse_id: destWarehouse } })
      .then((r) => setDestLocations(r.data.items || []))
      .catch(() => {});
  }, [destWarehouse]);

  const handleWarehouseChange = (val) => {
    setSelectedWarehouse(val);
    form.setFieldsValue({ location_id: undefined });
  };

  const handleDestWarehouseChange = (val) => {
    setDestWarehouse(val);
    form.setFieldsValue({ to_location_id: undefined });
  };

  // Reset conditional fields when type changes
  const handleTypeChange = () => {
    form.setFieldsValue({
      work_order_id: undefined,
      cost_center_id: undefined,
      cost_element_id: undefined,
      adjust_type: undefined,
    });
    setDestWarehouse(undefined);
    form.setFieldsValue({ dest_warehouse_id: undefined, to_location_id: undefined });
  };

  // Filter products: for CONSUME/RETURN exclude SERVICE
  const filteredProducts = (moveType === 'CONSUME' || moveType === 'RETURN')
    ? products.filter((p) => p.product_type !== 'SERVICE')
    : products;

  // Conditional flags
  const showWorkOrder = moveType === 'CONSUME' || moveType === 'RETURN';
  const showCostCenter = moveType === 'ISSUE';
  const showCostElement = moveType === 'ISSUE';
  const showUnitCost = moveType !== 'TRANSFER' && moveType !== 'ADJUST';
  const showSourceLocation = moveType !== 'RETURN';
  const showDestLocation = moveType === 'TRANSFER';
  const showAdjustType = moveType === 'ADJUST';
  const sourceRequired = moveType === 'TRANSFER';

  const onFinish = async (values) => {
    // Build payload — strip UI-only fields
    const { warehouse_id, dest_warehouse_id, ...payload } = values;

    // Remove empty optional fields
    if (!payload.location_id) delete payload.location_id;
    if (!payload.to_location_id) delete payload.to_location_id;
    if (!payload.work_order_id) delete payload.work_order_id;
    if (!payload.cost_center_id) delete payload.cost_center_id;
    if (!payload.cost_element_id) delete payload.cost_element_id;
    if (!payload.adjust_type) delete payload.adjust_type;
    if (!payload.unit_cost) payload.unit_cost = 0;

    setLoading(true);
    try {
      await api.post('/api/stock/movements', payload);
      message.success('บันทึกสำเร็จ');
      form.resetFields();
      setSelectedWarehouse(undefined);
      setDestWarehouse(undefined);
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
      width={580}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="movement_type" label="ประเภท"
          rules={[{ required: true, message: 'กรุณาเลือกประเภท' }]}>
          <Select options={MOVEMENT_TYPES} onChange={handleTypeChange} />
        </Form.Item>

        <Form.Item name="product_id" label="สินค้า"
          rules={[{ required: true, message: 'กรุณาเลือกสินค้า' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={filteredProducts.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
            placeholder="เลือกสินค้า"
          />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="quantity" label="จำนวน" style={{ flex: 1 }}
            rules={[{ required: true, message: 'กรุณากรอกจำนวน' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          {showUnitCost && (
            <Form.Item name="unit_cost" label="ต้นทุน/หน่วย (บาท)" style={{ flex: 1 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </div>

        {/* ADJUST: direction selector */}
        {showAdjustType && (
          <Form.Item name="adjust_type" label="ทิศทาง"
            rules={[{ required: true, message: 'กรุณาเลือกทิศทาง' }]}>
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="INCREASE" style={{ color: COLORS.success }}>
                เพิ่ม (INCREASE)
              </Radio.Button>
              <Radio.Button value="DECREASE" style={{ color: COLORS.danger }}>
                ลด (DECREASE)
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
        )}

        {/* CONSUME/RETURN: Work Order selector */}
        {showWorkOrder && (
          <Form.Item name="work_order_id" label="Work Order"
            rules={[{ required: true, message: 'กรุณาเลือก Work Order' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="เลือก Work Order (OPEN)"
              options={workOrders.map((wo) => ({
                value: wo.id,
                label: `${wo.wo_number}${wo.customer_name ? ' — ' + wo.customer_name : ''}`,
              }))}
            />
          </Form.Item>
        )}

        {/* ISSUE: Cost Center + Cost Element */}
        {showCostCenter && (
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="cost_center_id" label="Cost Center" style={{ flex: 1 }}
              rules={[{ required: true, message: 'กรุณาเลือก Cost Center' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="เลือก Cost Center"
                options={costCenters.map((cc) => ({
                  value: cc.id,
                  label: `${cc.code} - ${cc.name}`,
                }))}
              />
            </Form.Item>
            {showCostElement && (
              <Form.Item name="cost_element_id" label="Cost Element" style={{ flex: 1 }}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="เลือก Cost Element"
                  options={costElements.map((ce) => ({
                    value: ce.id,
                    label: `${ce.code} - ${ce.name}`,
                  }))}
                />
              </Form.Item>
            )}
          </div>
        )}

        {/* Source Location Picker */}
        {showSourceLocation && (
          <div style={{ background: COLORS.surface, borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: `1px solid ${COLORS.card}` }}>
            <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} /> {showDestLocation ? 'ต้นทาง' : 'ตำแหน่งคลังสินค้า'} {sourceRequired ? '(บังคับ)' : '(ไม่บังคับ)'}
            </div>
            <Form.Item name="warehouse_id" label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><WarehouseIcon size={12} /> คลัง</span>} style={{ marginBottom: 8 }}
              rules={sourceRequired ? [{ required: true, message: 'กรุณาเลือกคลัง' }] : []}>
              <Select
                allowClear
                placeholder="เลือกคลังสินค้า"
                options={warehouses.map((w) => ({ value: w.id, label: `${w.code} - ${w.name}` }))}
                onChange={handleWarehouseChange}
              />
            </Form.Item>
            <Form.Item name="location_id" label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> ตำแหน่ง</span>} style={{ marginBottom: 0 }}
              rules={sourceRequired ? [{ required: true, message: 'กรุณาเลือกตำแหน่ง' }] : []}>
              <Select
                allowClear
                placeholder="เลือก Location"
                disabled={!selectedWarehouse}
                options={locations.map((l) => ({ value: l.id, label: `${l.code} - ${l.name} (${l.zone_type})` }))}
              />
            </Form.Item>
          </div>
        )}

        {/* TRANSFER: Destination Location Picker */}
        {showDestLocation && (
          <div style={{ background: COLORS.surface, borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: `1px solid ${COLORS.accent}30` }}>
            <div style={{ color: COLORS.accent, fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowRight size={12} /> ปลายทาง (บังคับ)
            </div>
            <Form.Item name="dest_warehouse_id" label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><WarehouseIcon size={12} /> คลัง</span>} style={{ marginBottom: 8 }}
              rules={[{ required: true, message: 'กรุณาเลือกคลังปลายทาง' }]}>
              <Select
                allowClear
                placeholder="เลือกคลังปลายทาง"
                options={warehouses.map((w) => ({ value: w.id, label: `${w.code} - ${w.name}` }))}
                onChange={handleDestWarehouseChange}
              />
            </Form.Item>
            <Form.Item name="to_location_id" label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> ตำแหน่ง</span>} style={{ marginBottom: 0 }}
              rules={[{ required: true, message: 'กรุณาเลือกตำแหน่งปลายทาง' }]}>
              <Select
                allowClear
                placeholder="เลือก Location"
                disabled={!destWarehouse}
                options={destLocations.map((l) => ({ value: l.id, label: `${l.code} - ${l.name} (${l.zone_type})` }))}
              />
            </Form.Item>
          </div>
        )}

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
