import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, Button, Table, App } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';

export default function SOFormModal({ open, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [lines, setLines] = useState([]);
  const { message } = App.useApp();

  useEffect(() => {
    if (open) {
      form.resetFields();
      setLines([{ key: Date.now(), product_id: undefined, quantity: 1, unit_price: 0 }]);
      Promise.all([
        api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } }),
        api.get('/api/customers', { params: { limit: 500, offset: 0 } }),
      ]).then(([prodRes, custRes]) => {
        setProducts(prodRes.data.items);
        setCustomers(custRes.data.items);
      }).catch(() => {});
    }
  }, [open]);

  const onFinish = async (values) => {
    if (lines.length === 0 || lines.some((l) => !l.product_id)) {
      message.error('\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/sales/orders', {
        ...values,
        order_date: values.order_date?.format('YYYY-MM-DD'),
        lines: lines.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      message.success('\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      onSuccess();
    } catch (err) {
      message.error(err.response?.data?.detail || '\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14');
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => setLines([...lines, { key: Date.now(), product_id: undefined, quantity: 1, unit_price: 0 }]);
  const removeLine = (key) => setLines(lines.filter((l) => l.key !== key));
  const updateLine = (key, field, value) => setLines(lines.map((l) => l.key === key ? { ...l, [field]: value } : l));

  const lineColumns = [
    {
      title: '\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', dataIndex: 'product_id', width: 250,
      render: (v, record) => (
        <Select
          showSearch optionFilterProp="label" value={v}
          onChange={(val) => updateLine(record.key, 'product_id', val)}
          options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
          style={{ width: '100%' }} placeholder={'\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}
        />
      ),
    },
    {
      title: '\u0E08\u0E33\u0E19\u0E27\u0E19', dataIndex: 'quantity', width: 100,
      render: (v, record) => <InputNumber min={1} value={v} onChange={(val) => updateLine(record.key, 'quantity', val)} style={{ width: '100%' }} />,
    },
    {
      title: '\u0E23\u0E32\u0E04\u0E32/\u0E2B\u0E19\u0E48\u0E27\u0E22', dataIndex: 'unit_price', width: 120,
      render: (v, record) => <InputNumber min={0} step={0.01} value={v} onChange={(val) => updateLine(record.key, 'unit_price', val)} style={{ width: '100%' }} />,
    },
    {
      title: '', width: 50,
      render: (_, record) => <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={() => removeLine(record.key)} />,
    },
  ];

  return (
    <Modal
      title={'\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E02\u0E32\u0E22'}
      open={open} onCancel={onClose} onOk={() => form.submit()}
      confirmLoading={loading} width={700} destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="customer_id" label={'\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32' }]}>
          <Select
            showSearch optionFilterProp="label"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
            placeholder={'\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32'}
          />
        </Form.Item>
        <Form.Item name="order_date" label={'\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E48\u0E07'}>
          <DatePicker style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="note" label={'\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38'}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>{'\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'}</span>
          <Button size="small" icon={<Plus size={12} />} onClick={addLine}>{'\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23'}</Button>
        </div>
        <Table dataSource={lines} columns={lineColumns} rowKey="key" pagination={false} size="small" />
      </div>
    </Modal>
  );
}
