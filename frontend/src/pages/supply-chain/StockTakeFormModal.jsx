import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, App, Spin } from 'antd';
import api from '../../services/api';

export default function StockTakeFormModal({ open, onCancel, onSuccess }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [productCount, setProductCount] = useState(null);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setProductCount(null);
    setLocations([]);
    // Load warehouses + employees
    api.get('/api/warehouse/warehouses').then(({ data }) => {
      setWarehouses((data.items || data || []).map((w) => ({ value: w.id, label: w.name })));
    });
    api.get('/api/hr/employees', { params: { limit: 200 } }).then(({ data }) => {
      setEmployees((data.items || []).map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.full_name}` })));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleWarehouseChange = async (warehouseId) => {
    form.setFieldValue('location_id', undefined);
    setLocations([]);
    setProductCount(null);
    if (!warehouseId) return;
    try {
      const { data } = await api.get('/api/warehouse/locations', { params: { warehouse_id: warehouseId, limit: 100 } });
      setLocations((data.items || data || []).map((l) => ({ value: l.id, label: l.name })));
      // Preview product count
      const res = await api.get('/api/inventory/stock-take/products', { params: { warehouse_id: warehouseId } });
      setProductCount(Array.isArray(res.data) ? res.data.length : 0);
    } catch { /* ignore */ }
  };

  const handleLocationChange = async (locationId) => {
    const warehouseId = form.getFieldValue('warehouse_id');
    if (!warehouseId) return;
    try {
      const params = { warehouse_id: warehouseId };
      if (locationId) params.location_id = locationId;
      const res = await api.get('/api/inventory/stock-take/products', { params });
      setProductCount(Array.isArray(res.data) ? res.data.length : 0);
    } catch { /* ignore */ }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await api.post('/api/inventory/stock-take', values);
      message.success('สร้าง Stock Take เรียบร้อย');
      onSuccess();
    } catch (err) {
      if (err.response) message.error(err.response.data?.detail || 'สร้างไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="สร้าง Stock Take"
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="สร้าง"
      width={600}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          <Form.Item name="warehouse_id" label="คลังสินค้า" rules={[{ required: true, message: 'กรุณาเลือกคลังสินค้า' }]}>
            <Select
              placeholder="เลือกคลังสินค้า"
              options={warehouses}
              showSearch
              optionFilterProp="label"
              onChange={handleWarehouseChange}
              allowClear
            />
          </Form.Item>

          <Form.Item name="location_id" label="ตำแหน่ง (ไม่ระบุ = นับทั้งคลัง)">
            <Select
              placeholder="เลือกตำแหน่ง (optional)"
              options={locations}
              showSearch
              optionFilterProp="label"
              onChange={handleLocationChange}
              allowClear
              disabled={locations.length === 0}
            />
          </Form.Item>

          {productCount !== null && (
            <div style={{ marginBottom: 16, fontSize: 13, color: '#06b6d4' }}>
              จะสร้างรายการนับ {productCount} รายการ (สินค้าที่มี stock)
            </div>
          )}

          <Form.Item name="counted_by" label="ผู้นับ">
            <Select
              placeholder="เลือกผู้นับ (optional)"
              options={employees}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>

          <Form.Item name="reference" label="เลขอ้างอิง">
            <Input placeholder="เลขอ้างอิงภายใน (optional)" />
          </Form.Item>

          <Form.Item name="note" label="หมายเหตุ">
            <Input.TextArea rows={2} placeholder="หมายเหตุ (optional)" />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
}
