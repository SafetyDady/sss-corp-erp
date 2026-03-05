import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, Button, Table, App, Switch } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import SearchSelect from '../../components/SearchSelect';

export default function SOFormModal({ open, onClose, onSuccess, editRecord }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState([]);
  const { message } = App.useApp();

  const [approvers, setApprovers] = useState([]);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState(7);

  const isEdit = !!editRecord;

  useEffect(() => {
    if (open) {
      Promise.all([
        api.get('/api/admin/approvers', { params: { module: 'sales.order' } }),
        api.get('/api/admin/config/tax').catch(() => ({ data: { vat_enabled: true, default_vat_rate: 7 } })),
      ]).then(([appRes, taxRes]) => {
        setApprovers(appRes.data);

        if (editRecord) {
          // Edit mode: populate form from editRecord
          form.setFieldsValue({
            customer_id: editRecord.customer_id,
            order_date: editRecord.order_date ? dayjs(editRecord.order_date) : null,
            note: editRecord.note || '',
            requested_approver_id: editRecord.requested_approver_id || undefined,
          });
          // Populate lines
          const editLines = (editRecord.lines || []).map((l, i) => ({
            key: `edit-${i}-${Date.now()}`,
            product_id: l.product_id,
            quantity: l.quantity,
            unit_price: Number(l.unit_price),
          }));
          setLines(editLines.length > 0 ? editLines : [{ key: Date.now(), product_id: undefined, quantity: 1, unit_price: 0 }]);
          // Restore VAT from editRecord
          const editVatRate = Number(editRecord.vat_rate) || 0;
          if (editVatRate > 0) {
            setVatEnabled(true);
            setVatRate(editVatRate);
          } else {
            setVatEnabled(false);
            setVatRate(0);
          }
        } else {
          // Create mode: reset
          form.resetFields();
          setLines([{ key: Date.now(), product_id: undefined, quantity: 1, unit_price: 0 }]);
          const taxCfg = taxRes.data;
          setVatEnabled(taxCfg.vat_enabled);
          setVatRate(Number(taxCfg.default_vat_rate) || 7);
        }
      }).catch((err) => console.warn('[SOForm] load:', err?.response?.status));
    }
  }, [open, editRecord]);

  const subtotal = lines.reduce((sum, l) => sum + (l.quantity || 0) * (l.unit_price || 0), 0);
  const effectiveRate = vatEnabled ? vatRate : 0;
  const vatAmount = Math.round(subtotal * effectiveRate) / 100;
  const grandTotal = subtotal + vatAmount;

  const onFinish = async (values) => {
    if (lines.length === 0 || lines.some((l) => !l.product_id)) {
      message.error('กรุณาเพิ่มรายการสินค้า');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...values,
        order_date: values.order_date?.format('YYYY-MM-DD'),
        vat_rate: vatEnabled ? vatRate : 0,
        lines: lines.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      };

      if (isEdit) {
        await api.put(`/api/sales/orders/${editRecord.id}`, payload);
        message.success('แก้ไขสำเร็จ');
      } else {
        await api.post('/api/sales/orders', payload);
        message.success('บันทึกสำเร็จ');
      }
      onSuccess();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => setLines([...lines, { key: Date.now(), product_id: undefined, quantity: 1, unit_price: 0 }]);
  const removeLine = (key) => setLines(lines.filter((l) => l.key !== key));
  const updateLine = (key, field, value) => setLines(lines.map((l) => l.key === key ? { ...l, [field]: value } : l));

  const lineColumns = [
    {
      title: 'สินค้า', dataIndex: 'product_id', width: 250,
      render: (v, record) => (
        <SearchSelect
          apiUrl="/api/inventory/products"
          labelRender={(item) => `${item.sku} - ${item.name}`}
          value={v}
          onChange={(val) => updateLine(record.key, 'product_id', val)}
          style={{ width: '100%' }}
          placeholder={'เลือกสินค้า'}
        />
      ),
    },
    {
      title: 'จำนวน', dataIndex: 'quantity', width: 100,
      render: (v, record) => <InputNumber min={1} value={v} onChange={(val) => updateLine(record.key, 'quantity', val)} style={{ width: '100%' }} />,
    },
    {
      title: 'ราคา/หน่วย', dataIndex: 'unit_price', width: 120,
      render: (v, record) => <InputNumber min={0} step={0.01} value={v} onChange={(val) => updateLine(record.key, 'unit_price', val)} style={{ width: '100%' }} />,
    },
    {
      title: '', width: 50,
      render: (_, record) => <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={() => removeLine(record.key)} />,
    },
  ];

  return (
    <Modal
      title={isEdit ? 'แก้ไขใบสั่งขาย' : 'สร้างใบสั่งขาย'}
      open={open} onCancel={onClose} onOk={() => form.submit()}
      confirmLoading={loading} width={700} destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="customer_id" label={'ลูกค้า'}
          rules={[{ required: true, message: 'กรุณาเลือกลูกค้า' }]}>
          <SearchSelect
            apiUrl="/api/customers"
            labelField="name"
            placeholder={'เลือกลูกค้า'}
            defaultOptions={editRecord?.customer_id ? [{ value: editRecord.customer_id, label: editRecord.customer_name || editRecord.customer_id }] : []}
          />
        </Form.Item>
        <Form.Item name="order_date" label={'วันที่สั่ง'}>
          <DatePicker style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="note" label={'หมายเหตุ'}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="requested_approver_id" label={'ผู้อนุมัติ'}>
          <Select
            showSearch optionFilterProp="label" allowClear
            placeholder={'เลือกผู้อนุมัติ'}
            options={approvers.map((a) => ({ value: a.id, label: a.full_name }))}
          />
        </Form.Item>
      </Form>
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>{'รายการสินค้า'}</span>
          <Button size="small" icon={<Plus size={12} />} onClick={addLine}>{'เพิ่มรายการ'}</Button>
        </div>
        <Table dataSource={lines} columns={lineColumns} rowKey="key" pagination={false} size="small" />
      </div>

      {/* VAT Section */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: COLORS.surface, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: vatEnabled ? 12 : 0 }}>
          <span style={{ fontWeight: 500, color: COLORS.text }}>VAT</span>
          <Switch checked={vatEnabled} onChange={setVatEnabled} size="small" />
          {vatEnabled && (
            <InputNumber
              min={0} max={100} step={0.01} value={vatRate}
              onChange={(v) => setVatRate(v || 0)}
              style={{ width: 90 }}
              size="small"
              addonAfter="%"
            />
          )}
        </div>
        {vatEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <div style={{ color: COLORS.textMuted, fontSize: 13 }}>
              {'ยอดรวมก่อน VAT'}: <span style={{ fontFamily: 'monospace' }}>{formatCurrency(subtotal)}</span>
            </div>
            <div style={{ color: COLORS.textMuted, fontSize: 13 }}>
              VAT {vatRate}%: <span style={{ fontFamily: 'monospace' }}>{formatCurrency(vatAmount)}</span>
            </div>
            <div style={{ color: COLORS.accent, fontWeight: 600, fontSize: 14 }}>
              {'ยอดรวมทั้งสิ้น'}: <span style={{ fontFamily: 'monospace' }}>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        )}
        {!vatEnabled && (
          <div style={{ textAlign: 'right', color: COLORS.accent, fontWeight: 600, fontSize: 14 }}>
            {'ยอดรวม'}: <span style={{ fontFamily: 'monospace' }}>{formatCurrency(subtotal)}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
