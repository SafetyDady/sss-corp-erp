import { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Select, Input, App } from 'antd';
import api from '../../services/api';

export default function RechargeBudgetFormModal({ open, onClose, onSuccess, editBudget }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [costCenters, setCostCenters] = useState([]);

  const isEdit = !!editBudget;

  useEffect(() => {
    if (open) {
      api.get('/api/master/cost-centers').then((res) => {
        setCostCenters(res.data?.items || res.data || []);
      });
      if (isEdit) {
        form.setFieldsValue({
          fiscal_year: editBudget.fiscal_year,
          source_cost_center_id: editBudget.source_cost_center_id,
          annual_budget: parseFloat(editBudget.annual_budget),
          description: editBudget.description,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ fiscal_year: new Date().getFullYear() });
      }
    }
  }, [open, editBudget]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (isEdit) {
        await api.put(`/api/finance/recharge/budgets/${editBudget.id}`, {
          annual_budget: values.annual_budget,
          description: values.description || null,
        });
        message.success('แก้ไขงบประมาณสำเร็จ');
      } else {
        await api.post('/api/finance/recharge/budgets', values);
        message.success('สร้างงบประมาณสำเร็จ');
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      title={isEdit ? 'แก้ไขงบประมาณ Recharge' : 'สร้างงบประมาณ Recharge ใหม่'}
      okText={isEdit ? 'บันทึก' : 'สร้าง'}
      cancelText="ยกเลิก"
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="fiscal_year"
          label="ปีงบประมาณ"
          rules={[{ required: true, message: 'กรุณาระบุปีงบประมาณ' }]}
        >
          <InputNumber
            min={2020} max={2100} style={{ width: '100%' }}
            disabled={isEdit}
            placeholder="เช่น 2026"
          />
        </Form.Item>

        <Form.Item
          name="source_cost_center_id"
          label="Cost Center ต้นทาง (ค่าใช้จ่ายส่วนกลาง)"
          rules={[{ required: true, message: 'กรุณาเลือก Cost Center' }]}
        >
          <Select
            placeholder="เลือก Cost Center"
            disabled={isEdit}
            showSearch
            optionFilterProp="label"
            options={costCenters.map((cc) => ({
              value: cc.id,
              label: `${cc.code} — ${cc.name}`,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="annual_budget"
          label="งบประมาณต่อปี (บาท)"
          rules={[{ required: true, message: 'กรุณาระบุงบประมาณ' }]}
        >
          <InputNumber
            min={0}
            step={10000}
            style={{ width: '100%' }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(v) => v.replace(/,/g, '')}
            placeholder="เช่น 1,200,000"
          />
        </Form.Item>

        <Form.Item name="description" label="รายละเอียด">
          <Input.TextArea rows={3} placeholder="เช่น ค่าน้ำ ค่าไฟ ค่าเช่า สำนักงาน" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
