import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, Button, Table, App, Space, Radio, Divider } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../services/api';
import { getApiErrorMsg } from '../../utils/formatters';

export default function PRFormModal({ open, editRecord, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [costElements, setCostElements] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [lines, setLines] = useState([]);
  const [prType, setPrType] = useState('STANDARD');
  const { message } = App.useApp();

  useEffect(() => {
    if (open) {
      form.resetFields();
      setPrType('STANDARD');

      if (editRecord) {
        // Pre-fill for edit mode
        form.setFieldsValue({
          pr_type: editRecord.pr_type || 'STANDARD',
          cost_center_id: editRecord.cost_center_id,
          department_id: editRecord.department_id,
          required_date: editRecord.required_date ? dayjs(editRecord.required_date) : undefined,
          delivery_date: editRecord.delivery_date ? dayjs(editRecord.delivery_date) : undefined,
          priority: editRecord.priority || 'NORMAL',
          validity_start_date: editRecord.validity_start_date ? dayjs(editRecord.validity_start_date) : undefined,
          validity_end_date: editRecord.validity_end_date ? dayjs(editRecord.validity_end_date) : undefined,
          note: editRecord.note,
          requested_approver_id: editRecord.requested_approver_id,
        });
        setPrType(editRecord.pr_type || 'STANDARD');
        setLines(
          (editRecord.lines || []).map((l, idx) => ({
            key: Date.now() + idx,
            item_type: l.item_type,
            product_id: l.product_id,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit || 'PCS',
            estimated_unit_cost: l.estimated_unit_cost || 0,
            cost_element_id: l.cost_element_id,
            note: l.note,
          }))
        );
      } else {
        form.setFieldsValue({ pr_type: 'STANDARD', priority: 'NORMAL' });
        setLines([{
          key: Date.now(), item_type: 'GOODS', product_id: undefined,
          description: '', quantity: 1, unit: 'PCS', estimated_unit_cost: 0,
          cost_element_id: undefined, note: '',
        }]);
      }

      // Fetch reference data
      Promise.all([
        api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } }),
        api.get('/api/master/cost-centers', { params: { limit: 100, offset: 0 } }),
        api.get('/api/master/cost-elements', { params: { limit: 100, offset: 0 } }),
        api.get('/api/master/departments', { params: { limit: 100, offset: 0 } }),
        api.get('/api/admin/approvers', { params: { module: 'purchasing.pr' } }),
      ]).then(([prodRes, ccRes, ceRes, deptRes, appRes]) => {
        setProducts(prodRes.data.items || []);
        setCostCenters(ccRes.data.items || ccRes.data || []);
        setCostElements(ceRes.data.items || ceRes.data || []);
        setDepartments(deptRes.data.items || deptRes.data || []);
        setApprovers(appRes.data || []);
      }).catch(() => {});
    }
  }, [open, editRecord]);

  const onFinish = async (values) => {
    // Validate lines
    if (lines.length === 0) {
      message.error('กรุณาเพิ่มอย่างน้อย 1 รายการ');
      return;
    }
    for (const l of lines) {
      if (l.item_type === 'GOODS' && !l.product_id) {
        message.error('GOODS ต้องเลือกสินค้า');
        return;
      }
      if (l.item_type === 'SERVICE' && !l.product_id && !l.description) {
        message.error('SERVICE ต้องระบุสินค้าหรือรายละเอียด');
        return;
      }
      if (!l.cost_element_id) {
        message.error('ทุกรายการต้องระบุ Cost Element');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        pr_type: values.pr_type || 'STANDARD',
        cost_center_id: values.cost_center_id,
        department_id: values.department_id || null,
        required_date: values.required_date?.format('YYYY-MM-DD'),
        delivery_date: values.delivery_date?.format('YYYY-MM-DD') || null,
        priority: values.priority || 'NORMAL',
        validity_start_date: values.validity_start_date?.format('YYYY-MM-DD') || null,
        validity_end_date: values.validity_end_date?.format('YYYY-MM-DD') || null,
        note: values.note || null,
        requested_approver_id: values.requested_approver_id || null,
        lines: lines.map(({ item_type, product_id, description, quantity, unit, estimated_unit_cost, cost_element_id, note }) => ({
          item_type,
          product_id: product_id || null,
          description: description || null,
          quantity,
          unit: unit || 'PCS',
          estimated_unit_cost: estimated_unit_cost || 0,
          cost_element_id,
          note: note || null,
        })),
      };

      if (editRecord) {
        await api.put(`/api/purchasing/pr/${editRecord.id}`, payload);
        message.success('อัปเดต PR สำเร็จ');
      } else {
        await api.post('/api/purchasing/pr', payload);
        message.success('สร้าง PR สำเร็จ');
      }
      onSuccess();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => setLines([...lines, {
    key: Date.now(), item_type: 'GOODS', product_id: undefined,
    description: '', quantity: 1, unit: 'PCS', estimated_unit_cost: 0,
    cost_element_id: undefined, note: '',
  }]);
  const removeLine = (key) => setLines(lines.filter((l) => l.key !== key));
  const updateLine = (key, field, value) => setLines(lines.map((l) => l.key === key ? { ...l, [field]: value } : l));

  const goodsProducts = products.filter((p) => p.product_type === 'MATERIAL' || p.product_type === 'CONSUMABLE');
  const serviceProducts = products.filter((p) => p.product_type === 'SERVICE');

  const lineColumns = [
    {
      title: 'ประเภท', dataIndex: 'item_type', width: 110,
      render: (v, record) => (
        <Select
          value={v}
          onChange={(val) => {
            updateLine(record.key, 'item_type', val);
            updateLine(record.key, 'product_id', undefined);
            updateLine(record.key, 'description', '');
          }}
          options={[{ value: 'GOODS', label: 'GOODS' }, { value: 'SERVICE', label: 'SERVICE' }]}
          style={{ width: '100%' }}
          size="small"
        />
      ),
    },
    {
      title: 'สินค้า/บริการ', dataIndex: 'product_id', width: 220,
      render: (v, record) => (
        <Select
          showSearch optionFilterProp="label" allowClear
          value={v}
          onChange={(val) => updateLine(record.key, 'product_id', val)}
          options={(record.item_type === 'GOODS' ? goodsProducts : serviceProducts).map((p) => ({
            value: p.id, label: `${p.sku} - ${p.name}`,
          }))}
          style={{ width: '100%' }}
          size="small"
          placeholder={record.item_type === 'GOODS' ? 'เลือกสินค้า' : 'เลือกบริการ (ถ้ามี)'}
        />
      ),
    },
    {
      title: 'รายละเอียด', dataIndex: 'description', width: 160,
      render: (v, record) => (
        record.item_type === 'SERVICE' ? (
          <Input
            value={v} size="small"
            onChange={(e) => updateLine(record.key, 'description', e.target.value)}
            placeholder="รายละเอียดบริการ"
          />
        ) : <span style={{ color: '#718096', fontSize: 12 }}>-</span>
      ),
    },
    {
      title: 'จำนวน', dataIndex: 'quantity', width: 80,
      render: (v, record) => (
        <InputNumber min={1} value={v} size="small"
          onChange={(val) => updateLine(record.key, 'quantity', val || 1)}
          style={{ width: '100%' }} />
      ),
    },
    {
      title: 'หน่วย', dataIndex: 'unit', width: 75,
      render: (v, record) => (
        <Input value={v} size="small"
          onChange={(e) => updateLine(record.key, 'unit', e.target.value)}
          style={{ width: '100%' }} />
      ),
    },
    {
      title: 'ราคาประมาณ', dataIndex: 'estimated_unit_cost', width: 110,
      render: (v, record) => (
        <InputNumber min={0} step={0.01} value={v} size="small"
          onChange={(val) => updateLine(record.key, 'estimated_unit_cost', val || 0)}
          style={{ width: '100%' }}
          placeholder="0 = ไม่ทราบ" />
      ),
    },
    {
      title: 'Cost Element', dataIndex: 'cost_element_id', width: 180,
      render: (v, record) => (
        <Select
          showSearch optionFilterProp="label"
          value={v}
          onChange={(val) => updateLine(record.key, 'cost_element_id', val)}
          options={costElements.map((ce) => ({ value: ce.id, label: `${ce.code} - ${ce.name}` }))}
          style={{ width: '100%' }}
          size="small"
          placeholder="เลือก Cost Element"
        />
      ),
    },
    {
      title: '', width: 40,
      render: (_, record) => (
        <Button type="text" size="small" danger icon={<Trash2 size={14} />}
          onClick={() => removeLine(record.key)} />
      ),
    },
  ];

  return (
    <Modal
      title={editRecord ? 'แก้ไขใบขอซื้อ (PR)' : 'สร้างใบขอซื้อ (PR)'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={1100}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* PR Type */}
        <Form.Item name="pr_type" label="ประเภท PR">
          <Radio.Group onChange={(e) => setPrType(e.target.value)}>
            <Radio.Button value="STANDARD">STANDARD (ปกติ)</Radio.Button>
            <Radio.Button value="BLANKET">BLANKET (สัญญาระยะยาว)</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Space style={{ width: '100%' }} size={16} wrap>
          <Form.Item name="cost_center_id" label="Cost Center" rules={[{ required: true, message: 'กรุณาเลือก Cost Center' }]}>
            <Select
              showSearch optionFilterProp="label"
              placeholder="เลือก Cost Center" style={{ width: 240 }}
              options={costCenters.map((cc) => ({ value: cc.id, label: `${cc.code} - ${cc.name}` }))}
            />
          </Form.Item>
          <Form.Item name="department_id" label="แผนก">
            <Select
              showSearch optionFilterProp="label" allowClear
              placeholder="เลือกแผนก" style={{ width: 200 }}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </Form.Item>
          <Form.Item name="required_date" label="วันที่ต้องการ" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
            <DatePicker style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="delivery_date" label="วันที่คาดว่าจะได้รับ">
            <DatePicker style={{ width: 160 }} />
          </Form.Item>
        </Space>

        <Space style={{ width: '100%' }} size={16} wrap>
          <Form.Item name="priority" label="ลำดับความสำคัญ">
            <Radio.Group>
              <Radio.Button value="NORMAL">NORMAL</Radio.Button>
              <Radio.Button value="URGENT">URGENT</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="requested_approver_id" label="ผู้อนุมัติ">
            <Select
              showSearch optionFilterProp="label" allowClear
              placeholder="เลือกผู้อนุมัติ" style={{ width: 240 }}
              options={approvers.map((a) => ({ value: a.id, label: a.full_name }))}
            />
          </Form.Item>
        </Space>

        {/* BLANKET fields */}
        {prType === 'BLANKET' && (
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="validity_start_date" label="เริ่มสัญญา" rules={[{ required: prType === 'BLANKET', message: 'กรุณาระบุ' }]}>
              <DatePicker style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="validity_end_date" label="สิ้นสุดสัญญา" rules={[{ required: prType === 'BLANKET', message: 'กรุณาระบุ' }]}>
              <DatePicker style={{ width: 160 }} />
            </Form.Item>
          </Space>
        )}

        <Form.Item name="note" label="หมายเหตุ">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>

      <Divider style={{ margin: '12px 0' }} />

      {/* Line Items */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: '#e2e8f0' }}>รายการสินค้า/บริการ</span>
          <Button size="small" icon={<Plus size={12} />} onClick={addLine}>เพิ่มรายการ</Button>
        </div>
        <Table
          dataSource={lines}
          columns={lineColumns}
          rowKey="key"
          pagination={false}
          size="small"
          scroll={{ x: 1000 }}
        />
      </div>
    </Modal>
  );
}
