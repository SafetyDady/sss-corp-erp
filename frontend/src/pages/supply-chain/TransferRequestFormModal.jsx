import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Table, InputNumber, Button, App } from 'antd';
import { Plus, Trash2, Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import api from '../../services/api';
import { getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

/**
 * TransferRequestFormModal — Create / Edit transfer request
 * Source/Destination cascade pickers (Warehouse → Location) at header level
 * Product lines with qty + note
 */
export default function TransferRequestFormModal({ open, editRecord, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  // Data lists
  const [warehouses, setWarehouses] = useState([]);
  const [sourceLocations, setSourceLocations] = useState([]);
  const [destLocations, setDestLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Line items
  const [lines, setLines] = useState([{ product_id: null, quantity: 1, note: '' }]);

  // Selected warehouse IDs for location cascade
  const [srcWarehouseId, setSrcWarehouseId] = useState(null);
  const [dstWarehouseId, setDstWarehouseId] = useState(null);

  const isEdit = !!editRecord;

  // Fetch reference data on open
  useEffect(() => {
    if (!open) return;
    Promise.allSettled([
      api.get('/api/warehouse/warehouses', { params: { limit: 100, offset: 0 } }),
      api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } }),
      api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } }),
    ]).then(([whRes, prodRes, empRes]) => {
      if (whRes.status === 'fulfilled') setWarehouses(whRes.value.data?.items || []);
      if (prodRes.status === 'fulfilled') {
        // Filter out SERVICE products
        const prods = (prodRes.value.data?.items || []).filter((p) => p.product_type !== 'SERVICE');
        setProducts(prods);
      }
      if (empRes.status === 'fulfilled') setEmployees(empRes.value.data?.items || []);
    });
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (!open) return;
    if (editRecord) {
      form.setFieldsValue({
        source_warehouse_id: editRecord.source_warehouse_id,
        source_location_id: editRecord.source_location_id,
        dest_warehouse_id: editRecord.dest_warehouse_id,
        dest_location_id: editRecord.dest_location_id,
        requested_by: editRecord.requested_by,
        note: editRecord.note,
        reference: editRecord.reference,
      });
      setSrcWarehouseId(editRecord.source_warehouse_id);
      setDstWarehouseId(editRecord.dest_warehouse_id);
      setLines(
        (editRecord.lines || []).map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          note: l.note || '',
        }))
      );
    } else {
      form.resetFields();
      setSrcWarehouseId(null);
      setDstWarehouseId(null);
      setLines([{ product_id: null, quantity: 1, note: '' }]);
    }
  }, [open, editRecord?.id]);

  // Fetch locations when source warehouse changes
  useEffect(() => {
    if (!srcWarehouseId) {
      setSourceLocations([]);
      return;
    }
    api.get('/api/warehouse/locations', { params: { limit: 100, offset: 0, warehouse_id: srcWarehouseId } })
      .then((r) => setSourceLocations(r.data?.items || []))
      .catch(() => setSourceLocations([]));
  }, [srcWarehouseId]);

  // Fetch locations when dest warehouse changes
  useEffect(() => {
    if (!dstWarehouseId) {
      setDestLocations([]);
      return;
    }
    api.get('/api/warehouse/locations', { params: { limit: 100, offset: 0, warehouse_id: dstWarehouseId } })
      .then((r) => setDestLocations(r.data?.items || []))
      .catch(() => setDestLocations([]));
  }, [dstWarehouseId]);

  const handleSrcWarehouseChange = (val) => {
    setSrcWarehouseId(val);
    form.setFieldsValue({ source_location_id: undefined });
  };

  const handleDstWarehouseChange = (val) => {
    setDstWarehouseId(val);
    form.setFieldsValue({ dest_location_id: undefined });
  };

  // Line management
  const addLine = () => setLines([...lines, { product_id: null, quantity: 1, note: '' }]);
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx, field, value) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate lines
      const validLines = lines.filter((l) => l.product_id && l.quantity > 0);
      if (validLines.length === 0) {
        message.error('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
        return;
      }

      // Validate source != dest
      const sameWh = values.source_warehouse_id === values.dest_warehouse_id;
      const sameLoc = (values.source_location_id || null) === (values.dest_location_id || null);
      if (sameWh && sameLoc) {
        message.error('ต้นทางและปลายทางต้องแตกต่างกัน');
        return;
      }

      const payload = {
        source_warehouse_id: values.source_warehouse_id,
        source_location_id: values.source_location_id || null,
        dest_warehouse_id: values.dest_warehouse_id,
        dest_location_id: values.dest_location_id || null,
        requested_by: values.requested_by || null,
        note: values.note || null,
        reference: values.reference || null,
        lines: validLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          note: l.note || null,
        })),
      };

      setLoading(true);
      if (isEdit) {
        await api.put(`/api/inventory/transfer-requests/${editRecord.id}`, payload);
        message.success('แก้ไขใบขอโอนย้ายสำเร็จ');
      } else {
        await api.post('/api/inventory/transfer-requests', payload);
        message.success('สร้างใบขอโอนย้ายสำเร็จ');
      }
      onSuccess();
    } catch (err) {
      if (err?.errorFields) return; // form validation
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  const lineColumns = [
    {
      title: 'สินค้า', key: 'product', width: 300,
      render: (_, record, idx) => (
        <Select
          showSearch
          optionFilterProp="label"
          value={record.product_id}
          onChange={(val) => updateLine(idx, 'product_id', val)}
          placeholder="เลือกสินค้า"
          style={{ width: '100%' }}
          size="small"
          options={products.map((p) => ({
            value: p.id,
            label: `${p.sku} — ${p.name}`,
          }))}
        />
      ),
    },
    {
      title: 'จำนวน', key: 'quantity', width: 100,
      render: (_, record, idx) => (
        <InputNumber
          min={1}
          value={record.quantity}
          onChange={(val) => updateLine(idx, 'quantity', val)}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'หมายเหตุ', key: 'note',
      render: (_, record, idx) => (
        <Input
          value={record.note}
          onChange={(e) => updateLine(idx, 'note', e.target.value)}
          size="small"
          placeholder="หมายเหตุ"
          maxLength={200}
        />
      ),
    },
    {
      title: '', key: 'action', width: 50,
      render: (_, __, idx) =>
        lines.length > 1 ? (
          <Button
            type="text"
            size="small"
            danger
            icon={<Trash2 size={14} />}
            onClick={() => removeLine(idx)}
          />
        ) : null,
    },
  ];

  return (
    <Modal
      title={isEdit ? 'แก้ไขใบขอโอนย้าย' : 'สร้างใบขอโอนย้ายสินค้า'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={850}
      okText={isEdit ? 'บันทึก' : 'สร้าง'}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" size="small">
        {/* Source */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <Form.Item
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <WarehouseIcon size={14} /> คลังต้นทาง
              </span>
            }
            name="source_warehouse_id"
            rules={[{ required: true, message: 'เลือกคลังต้นทาง' }]}
            style={{ flex: 1 }}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="เลือกคลังต้นทาง"
              onChange={handleSrcWarehouseChange}
              options={warehouses.map((w) => ({ value: w.id, label: `${w.code} - ${w.name}` }))}
            />
          </Form.Item>

          <Form.Item
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={14} /> ตำแหน่งต้นทาง
              </span>
            }
            name="source_location_id"
            style={{ flex: 1 }}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="เลือก Location"
              disabled={!srcWarehouseId}
              options={sourceLocations.map((l) => ({
                value: l.id,
                label: `${l.code} - ${l.name} (${l.zone_type})`,
              }))}
            />
          </Form.Item>
        </div>

        {/* Destination */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <Form.Item
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <WarehouseIcon size={14} /> คลังปลายทาง
              </span>
            }
            name="dest_warehouse_id"
            rules={[{ required: true, message: 'เลือกคลังปลายทาง' }]}
            style={{ flex: 1 }}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="เลือกคลังปลายทาง"
              onChange={handleDstWarehouseChange}
              options={warehouses.map((w) => ({ value: w.id, label: `${w.code} - ${w.name}` }))}
            />
          </Form.Item>

          <Form.Item
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={14} /> ตำแหน่งปลายทาง
              </span>
            }
            name="dest_location_id"
            style={{ flex: 1 }}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="เลือก Location"
              disabled={!dstWarehouseId}
              options={destLocations.map((l) => ({
                value: l.id,
                label: `${l.code} - ${l.name} (${l.zone_type})`,
              }))}
            />
          </Form.Item>
        </div>

        {/* Requested by + Reference */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <Form.Item label="ผู้ขอโอนย้าย" name="requested_by" style={{ flex: 1 }}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="เลือกผู้ขอโอนย้าย"
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.employee_code} - ${e.full_name}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="อ้างอิง" name="reference" style={{ flex: 1 }}>
            <Input placeholder="เลขที่อ้างอิง (ไม่บังคับ)" maxLength={255} />
          </Form.Item>
        </div>

        {/* Note */}
        <Form.Item label="หมายเหตุ" name="note">
          <Input.TextArea rows={2} placeholder="หมายเหตุ (ไม่บังคับ)" maxLength={500} />
        </Form.Item>
      </Form>

      {/* Lines */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ color: COLORS.text, margin: 0 }}>รายการสินค้า</h4>
        <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={addLine}>
          เพิ่มรายการ
        </Button>
      </div>

      <Table
        dataSource={lines.map((l, i) => ({ ...l, _key: i }))}
        columns={lineColumns}
        rowKey="_key"
        pagination={false}
        size="small"
      />
    </Modal>
  );
}
