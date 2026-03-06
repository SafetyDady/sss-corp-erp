import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, App } from 'antd';
import api from '../../services/api';
import dayjs from 'dayjs';

export default function AssetFormModal({ open, onClose, onSuccess, categories = [], asset = null }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [costCenters, setCostCenters] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tools, setTools] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ccRes, empRes, toolRes] = await Promise.all([
          api.get('/api/master/cost-centers'),
          api.get('/api/hr/employees', { params: { limit: 200 } }).catch(() => ({ data: { items: [] } })),
          api.get('/api/tools', { params: { limit: 200 } }).catch(() => ({ data: { items: [] } })),
        ]);
        setCostCenters(ccRes.data?.items || ccRes.data || []);
        setEmployees(empRes.data?.items || []);
        setTools(toolRes.data?.items || []);
      } catch { /* ignore */ }
    };
    if (open) fetchData();
  }, [open]);

  useEffect(() => {
    if (asset) {
      form.setFieldsValue({
        ...asset,
        acquisition_date: asset.acquisition_date ? dayjs(asset.acquisition_date) : null,
      });
    } else {
      form.resetFields();
    }
  }, [asset, form]);

  const handleCategoryChange = (catId) => {
    const cat = categories.find((c) => c.id === catId);
    if (cat && !asset) {
      form.setFieldsValue({ useful_life_years: cat.useful_life_years });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        ...values,
        acquisition_date: values.acquisition_date?.format('YYYY-MM-DD'),
        salvage_value: values.salvage_value || 0,
      };

      if (asset) {
        await api.put(`/api/asset/assets/${asset.id}`, {
          asset_name: payload.asset_name,
          description: payload.description,
          location: payload.location,
          responsible_employee_id: payload.responsible_employee_id || null,
          cost_center_id: payload.cost_center_id,
          tool_id: payload.tool_id || null,
        });
        message.success('อัปเดตสินทรัพย์สำเร็จ');
      } else {
        await api.post('/api/asset/assets', payload);
        message.success('ลงทะเบียนสินทรัพย์สำเร็จ');
      }
      onSuccess();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={asset ? 'แก้ไขสินทรัพย์' : 'ลงทะเบียนสินทรัพย์ใหม่'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={640}
      okText={asset ? 'บันทึก' : 'ลงทะเบียน'}
    >
      <Form form={form} layout="vertical" size="small">
        <Form.Item name="asset_code" label="รหัสสินทรัพย์" extra="เว้นว่างเพื่อสร้างอัตโนมัติ">
          <Input placeholder="AST-0001" disabled={!!asset} />
        </Form.Item>
        <Form.Item name="asset_name" label="ชื่อสินทรัพย์" rules={[{ required: true, message: 'กรุณาระบุชื่อ' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="รายละเอียด">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="category_id" label="หมวดสินทรัพย์" rules={[{ required: true, message: 'กรุณาเลือกหมวด' }]}>
          <Select
            placeholder="เลือกหมวด"
            onChange={handleCategoryChange}
            disabled={!!asset}
            options={categories.map((c) => ({ label: `${c.code} — ${c.name}`, value: c.id }))}
            showSearch
            filterOption={(input, opt) => (opt?.label || '').toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>

        {!asset && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="acquisition_date" label="วันที่ได้มา" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item name="acquisition_cost" label="ราคาทุน (บาท)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} precision={2} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="salvage_value" label="มูลค่าซาก (บาท)" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
              <Form.Item name="useful_life_years" label="อายุใช้งาน (ปี)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </div>
          </>
        )}

        <Form.Item name="cost_center_id" label="Cost Center" rules={[{ required: true }]}>
          <Select
            placeholder="เลือก Cost Center"
            options={costCenters.map((c) => ({ label: `${c.code} — ${c.name}`, value: c.id }))}
            showSearch
            filterOption={(input, opt) => (opt?.label || '').toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>
        <Form.Item name="location" label="ที่ตั้ง/สถานที่">
          <Input placeholder="เช่น ชั้น 2 อาคาร A" />
        </Form.Item>
        <Form.Item name="responsible_employee_id" label="ผู้รับผิดชอบ">
          <Select
            placeholder="เลือกพนักงาน"
            allowClear
            options={employees.map((e) => ({ label: `${e.employee_code || ''} ${e.full_name}`, value: e.id }))}
            showSearch
            filterOption={(input, opt) => (opt?.label || '').toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>
        <Form.Item name="tool_id" label="เชื่อมเครื่องมือ">
          <Select
            placeholder="เลือกเครื่องมือ (ถ้ามี)"
            allowClear
            options={tools.map((t) => ({ label: `${t.code} — ${t.name}`, value: t.id }))}
            showSearch
            filterOption={(input, opt) => (opt?.label || '').toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
