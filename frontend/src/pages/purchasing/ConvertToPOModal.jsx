import { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, InputNumber, Table, App, Tag, Select, Switch } from 'antd';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function ConvertToPOModal({ open, pr, products, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [lineCosts, setLineCosts] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState(7);
  const [whtEnabled, setWhtEnabled] = useState(false);
  const [whtTypes, setWhtTypes] = useState([]);
  const [selectedWhtTypeId, setSelectedWhtTypeId] = useState(null);
  const { message } = App.useApp();

  useEffect(() => {
    if (open) {
      setSuppliersLoading(true);
      setSelectedWhtTypeId(null);
      Promise.all([
        api.get('/api/master/suppliers', { params: { limit: 50, offset: 0 } }),
        api.get('/api/admin/config/tax').catch(() => ({ data: { vat_enabled: true, default_vat_rate: 7, wht_enabled: false } })),
        api.get('/api/master/wht-types', { params: { limit: 50, offset: 0 } }).catch(() => ({ data: { items: [] } })),
      ]).then(([suppRes, taxRes, whtRes]) => {
        setSuppliers(suppRes.data.items || []);
        const taxCfg = taxRes.data;
        setVatEnabled(taxCfg.vat_enabled);
        setVatRate(Number(taxCfg.default_vat_rate) || 7);
        setWhtEnabled(!!taxCfg.wht_enabled);
        setWhtTypes((whtRes.data.items || []).filter((w) => w.is_active));
      }).catch(() => {
        setSuppliers([]);
      }).finally(() => setSuppliersLoading(false));
    }
  }, [open]);

  // Initialize line costs from PR estimated
  const getLineCost = (lineId, estimated) => {
    if (lineCosts[lineId] !== undefined) return lineCosts[lineId];
    return estimated || 0;
  };

  const updateLineCost = (lineId, value) => {
    setLineCosts({ ...lineCosts, [lineId]: value || 0 });
  };

  const onFinish = async (values) => {
    if (!pr?.lines?.length) return;

    setLoading(true);
    try {
      // Find supplier name from selected supplier_id
      const selectedSupplier = suppliers.find((s) => s.id === values.supplier_id);
      const payload = {
        supplier_id: values.supplier_id || null,
        supplier_name: selectedSupplier?.name || values.supplier_name || '',
        expected_date: values.expected_date?.format('YYYY-MM-DD') || null,
        note: values.note || null,
        vat_rate: vatEnabled ? vatRate : 0,
        wht_type_id: whtEnabled ? selectedWhtTypeId || null : null,
        lines: pr.lines.map((line) => ({
          pr_line_id: line.id,
          unit_cost: getLineCost(line.id, line.estimated_unit_cost),
        })),
      };

      const { data } = await api.post(`/api/purchasing/pr/${pr.id}/convert-to-po`, payload);
      message.success('แปลง PR เป็น PO สำเร็จ');
      onSuccess(data.id);
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  const renderDiffIndicator = (estimated, actual) => {
    if (!estimated || estimated === 0) return null;
    if (actual === estimated) return <Minus size={12} style={{ color: COLORS.textMuted }} />;
    if (actual < estimated) {
      const pct = (((estimated - actual) / estimated) * 100).toFixed(0);
      return (
        <span style={{ color: COLORS.success, fontSize: 11 }}>
          <ArrowDown size={12} style={{ verticalAlign: 'middle' }} /> -{pct}%
        </span>
      );
    }
    const pct = (((actual - estimated) / estimated) * 100).toFixed(0);
    return (
      <span style={{ color: COLORS.danger, fontSize: 11 }}>
        <ArrowUp size={12} style={{ verticalAlign: 'middle' }} /> +{pct}%
      </span>
    );
  };

  const lineColumns = [
    {
      title: 'ประเภท', dataIndex: 'item_type', width: 90,
      render: (v) => <Tag color={v === 'GOODS' ? 'blue' : 'green'}>{v}</Tag>,
    },
    {
      title: 'สินค้า/บริการ', key: 'product', ellipsis: true,
      render: (_, record) => {
        if (record.product_id && products?.[record.product_id]) {
          const p = products[record.product_id];
          return `${p.sku} - ${p.name}`;
        }
        return record.description || '-';
      },
    },
    { title: 'จำนวน', dataIndex: 'quantity', width: 70, align: 'right' },
    { title: 'หน่วย', dataIndex: 'unit', width: 60 },
    {
      title: 'ราคาประมาณ', dataIndex: 'estimated_unit_cost', width: 120, align: 'right',
      render: (v) => v > 0 ? formatCurrency(v) : <span style={{ color: COLORS.textMuted }}>ไม่ระบุ</span>,
    },
    {
      title: 'ราคาจริง', dataIndex: 'id', width: 130,
      render: (lineId, record) => (
        <InputNumber
          min={0} step={0.01}
          value={getLineCost(lineId, record.estimated_unit_cost)}
          onChange={(val) => updateLineCost(lineId, val)}
          style={{ width: '100%' }}
          size="small"
        />
      ),
    },
    {
      title: '', width: 60, align: 'center',
      render: (_, record) => {
        const actual = getLineCost(record.id, record.estimated_unit_cost);
        return renderDiffIndicator(record.estimated_unit_cost, actual);
      },
    },
    {
      title: 'รวม', key: 'total', width: 120, align: 'right',
      render: (_, record) => {
        const cost = getLineCost(record.id, record.estimated_unit_cost);
        return formatCurrency(cost * record.quantity);
      },
    },
  ];

  // Calculate subtotal, VAT, grand total
  const subtotal = (pr?.lines || []).reduce((sum, line) => {
    const cost = getLineCost(line.id, line.estimated_unit_cost);
    return sum + cost * line.quantity;
  }, 0);
  const effectiveRate = vatEnabled ? vatRate : 0;
  const vatAmount = Math.round(subtotal * effectiveRate) / 100;
  const grandTotal = subtotal + vatAmount;

  // WHT calculation (base = subtotal, before VAT per Thai law)
  const selectedWht = whtTypes.find((w) => w.id === selectedWhtTypeId);
  const whtRate = whtEnabled && selectedWht ? Number(selectedWht.rate) : 0;
  const whtAmount = Math.round(subtotal * whtRate) / 100;
  const netPayment = grandTotal - whtAmount;

  return (
    <Modal
      title="Convert PR to PO"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={950}
      destroyOnHidden
    >
      <div style={{ marginBottom: 16, padding: '8px 12px', background: COLORS.surface, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
        <span style={{ color: COLORS.textMuted, fontSize: 12 }}>
          PR: <strong style={{ color: COLORS.accent }}>{pr?.pr_number}</strong>
          {pr?.pr_type === 'BLANKET' && <Tag color="purple" style={{ marginLeft: 8 }}>BLANKET</Tag>}
        </span>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="supplier_id" label="ซัพพลายเออร์" style={{ flex: 1 }}
            rules={[{ required: true, message: 'กรุณาเลือกซัพพลายเออร์' }]}>
            <Select
              showSearch
              placeholder="เลือกซัพพลายเออร์"
              loading={suppliersLoading}
              optionFilterProp="label"
              onChange={(supplierId) => {
                const sup = suppliers.find((s) => s.id === supplierId);
                if (sup?.default_wht_type_id && whtEnabled) {
                  setSelectedWhtTypeId(sup.default_wht_type_id);
                }
              }}
              options={suppliers.map((s) => ({
                value: s.id,
                label: `${s.code} — ${s.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="expected_date" label="วันที่คาดว่าจะได้รับ">
            <DatePicker style={{ width: 180 }} />
          </Form.Item>
        </div>
        <Form.Item name="note" label="หมายเหตุ">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>

      <h4 style={{ color: COLORS.text, marginBottom: 8 }}>รายการสินค้า/บริการ</h4>
      <Table
        dataSource={pr?.lines || []}
        columns={lineColumns}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={{ x: 800 }}
      />

      {/* VAT + WHT Section */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: COLORS.surface, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
        {/* VAT controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <span style={{ fontWeight: 500, color: COLORS.text }}>VAT</span>
          <Switch checked={vatEnabled} onChange={setVatEnabled} size="small" />
          {vatEnabled && (
            <InputNumber
              min={0} max={100} step={0.01} value={vatRate}
              onChange={(v) => setVatRate(v || 0)}
              style={{ width: 90 }} size="small" addonAfter="%"
            />
          )}
        </div>

        {/* WHT controls */}
        {whtEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <span style={{ fontWeight: 500, color: COLORS.text }}>WHT</span>
            <Select
              allowClear
              placeholder="ไม่หัก ณ ที่จ่าย"
              value={selectedWhtTypeId}
              onChange={setSelectedWhtTypeId}
              style={{ width: 280 }}
              size="small"
              options={whtTypes.map((w) => ({
                value: w.id,
                label: `${w.code} — ${w.name} (${parseFloat(w.rate).toFixed(2)}%)`,
              }))}
            />
          </div>
        )}

        {/* Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <div style={{ color: COLORS.textMuted, fontSize: 13 }}>
            {'ยอดรวมก่อน VAT'}: <span style={{ fontFamily: 'monospace' }}>{formatCurrency(subtotal)}</span>
          </div>
          {vatEnabled && (
            <div style={{ color: COLORS.textMuted, fontSize: 13 }}>
              VAT {vatRate}%: <span style={{ fontFamily: 'monospace' }}>{formatCurrency(vatAmount)}</span>
            </div>
          )}
          <div style={{ color: COLORS.accent, fontWeight: 600, fontSize: 14 }}>
            {'ยอดรวม PO'}: <span style={{ fontFamily: 'monospace' }}>{formatCurrency(grandTotal)}</span>
          </div>
          {whtEnabled && whtRate > 0 && (
            <>
              <div style={{ color: COLORS.warning, fontSize: 13 }}>
                {'หัก ณ ที่จ่าย'} {selectedWht?.name} {whtRate}%: <span style={{ fontFamily: 'monospace' }}>-{formatCurrency(whtAmount)}</span>
              </div>
              <div style={{ color: COLORS.success, fontWeight: 600, fontSize: 14 }}>
                {'ยอดชำระสุทธิ'}: <span style={{ fontFamily: 'monospace' }}>{formatCurrency(netPayment)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
