import { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, InputNumber, Table, App, Tag, Select } from 'antd';
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
  const { message } = App.useApp();

  useEffect(() => {
    if (open) {
      setSuppliersLoading(true);
      api.get('/api/master/suppliers', { params: { limit: 500, offset: 0 } })
        .then(({ data }) => setSuppliers(data.items || []))
        .catch(() => setSuppliers([]))
        .finally(() => setSuppliersLoading(false));
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

  // Calculate grand total
  const grandTotal = (pr?.lines || []).reduce((sum, line) => {
    const cost = getLineCost(line.id, line.estimated_unit_cost);
    return sum + cost * line.quantity;
  }, 0);

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
        footer={() => (
          <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
            ยอดรวม PO: <span style={{ color: COLORS.accent, fontFamily: 'monospace' }}>{formatCurrency(grandTotal)}</span>
          </div>
        )}
      />
    </Modal>
  );
}
