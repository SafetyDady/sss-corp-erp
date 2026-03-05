import { useState, useEffect } from 'react';
import { Modal, Form, DatePicker, Input, Select, Table, InputNumber, App, Spin, Typography } from 'antd';
import dayjs from 'dayjs';
import api from '../../services/api';

const { TextArea } = Input;
const { Text } = Typography;

export default function DOFormModal({ open, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [soList, setSoList] = useState([]);
  const [soLoading, setSoLoading] = useState(false);
  const [selectedSoId, setSelectedSoId] = useState(null);
  const [remainingLines, setRemainingLines] = useState([]);
  const [remainingLoading, setRemainingLoading] = useState(false);
  const [lineQtys, setLineQtys] = useState({});

  // Fetch approved SOs for picker
  useEffect(() => {
    if (!open) return;
    const fetchSOs = async () => {
      setSoLoading(true);
      try {
        const { data } = await api.get('/api/sales/orders', {
          params: { status: 'APPROVED', limit: 100 },
        });
        setSoList(data.items || []);
      } catch {
        setSoList([]);
      } finally {
        setSoLoading(false);
      }
    };
    fetchSOs();
  }, [open]);

  // Fetch remaining qty when SO selected
  useEffect(() => {
    if (!selectedSoId) {
      setRemainingLines([]);
      setLineQtys({});
      return;
    }
    const fetchRemaining = async () => {
      setRemainingLoading(true);
      try {
        const { data } = await api.get(`/api/sales/delivery/remaining/${selectedSoId}`);
        const lines = (data.lines || []).filter((l) => l.remaining_qty > 0);
        setRemainingLines(lines);
        const qtys = {};
        lines.forEach((l) => { qtys[l.so_line_id] = l.remaining_qty; });
        setLineQtys(qtys);
      } catch (err) {
        message.error(err.response?.data?.detail || '\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E42\u0E2B\u0E25\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 SO');
        setRemainingLines([]);
      } finally {
        setRemainingLoading(false);
      }
    };
    fetchRemaining();
  }, [selectedSoId]);

  const handleSoChange = (soId) => {
    setSelectedSoId(soId);
    const so = soList.find((s) => s.id === soId);
    if (so) {
      form.setFieldsValue({
        shipping_address: so.customer_name || '',
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // Build lines from remaining with qty > 0
      const lines = remainingLines
        .filter((l) => (lineQtys[l.so_line_id] || 0) > 0)
        .map((l) => ({
          product_id: l.product_id,
          ordered_qty: lineQtys[l.so_line_id],
          so_line_id: l.so_line_id,
        }));

      if (lines.length === 0) {
        message.warning('\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E08\u0E33\u0E19\u0E27\u0E19\u0E2A\u0E48\u0E07\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22 1 \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23');
        return;
      }

      setLoading(true);
      await api.post('/api/sales/delivery', {
        so_id: selectedSoId,
        delivery_date: values.delivery_date.format('YYYY-MM-DD'),
        shipping_address: values.shipping_address || null,
        shipping_method: values.shipping_method || null,
        note: values.note || null,
        lines,
      });
      message.success('\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E1A\u0E2A\u0E48\u0E07\u0E02\u0E2D\u0E07\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
      onSuccess?.();
      resetForm();
    } catch (err) {
      if (err.response) {
        message.error(err.response.data?.detail || '\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    form.resetFields();
    setSelectedSoId(null);
    setRemainingLines([]);
    setLineQtys({});
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const lineColumns = [
    {
      title: 'SKU', dataIndex: 'product_sku', key: 'product_sku', width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', dataIndex: 'product_name', key: 'product_name', ellipsis: true,
    },
    {
      title: '\u0E2B\u0E19\u0E48\u0E27\u0E22', dataIndex: 'product_unit', key: 'product_unit', width: 80,
    },
    {
      title: 'SO Qty', dataIndex: 'so_qty', key: 'so_qty', width: 80, align: 'right',
    },
    {
      title: '\u0E2A\u0E48\u0E07\u0E41\u0E25\u0E49\u0E27', dataIndex: 'shipped_qty', key: 'shipped_qty', width: 80, align: 'right',
      render: (v) => <span style={{ color: v > 0 ? '#10b981' : undefined }}>{v}</span>,
    },
    {
      title: '\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D', dataIndex: 'remaining_qty', key: 'remaining_qty', width: 80, align: 'right',
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: '\u0E08\u0E33\u0E19\u0E27\u0E19\u0E2A\u0E48\u0E07', key: 'qty_to_ship', width: 120, align: 'right',
      render: (_, record) => (
        <InputNumber
          min={0}
          max={record.remaining_qty}
          value={lineQtys[record.so_line_id] || 0}
          onChange={(v) => setLineQtys((prev) => ({ ...prev, [record.so_line_id]: v || 0 }))}
          size="small"
          style={{ width: 90 }}
        />
      ),
    },
  ];

  return (
    <Modal
      title={'\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E1A\u0E2A\u0E48\u0E07\u0E02\u0E2D\u0E07 (DO)'}
      open={open}
      onCancel={handleClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={900}
      okText={'\u0E2A\u0E23\u0E49\u0E32\u0E07'}
      cancelText={'\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01'}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={'\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E02\u0E32\u0E22 (SO)'}
          required
        >
          <Select
            showSearch
            placeholder={'\u0E40\u0E25\u0E37\u0E2D\u0E01 SO \u0E17\u0E35\u0E48\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E41\u0E25\u0E49\u0E27'}
            loading={soLoading}
            value={selectedSoId}
            onChange={handleSoChange}
            filterOption={(input, option) =>
              (option?.label || '').toLowerCase().includes(input.toLowerCase())
            }
            options={soList.map((so) => ({
              value: so.id,
              label: `${so.so_number} \u2014 ${so.customer_name || 'N/A'} (\u0E22\u0E2D\u0E14: ${Number(so.total_amount || 0).toLocaleString()})`,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="delivery_date"
          label={'\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07'}
          rules={[{ required: true, message: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48' }]}
          initialValue={dayjs()}
        >
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="shipping_address" label={'\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07'}>
          <TextArea rows={2} />
        </Form.Item>

        <Form.Item name="shipping_method" label={'\u0E27\u0E34\u0E18\u0E35\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07'}>
          <Input placeholder={'\u0E40\u0E0A\u0E48\u0E19 \u0E02\u0E19\u0E2A\u0E48\u0E07, \u0E23\u0E16\u0E1A\u0E23\u0E34\u0E29\u0E31\u0E17, \u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E21\u0E32\u0E23\u0E31\u0E1A'} />
        </Form.Item>

        <Form.Item name="note" label={'\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38'}>
          <TextArea rows={2} />
        </Form.Item>
      </Form>

      {selectedSoId && (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {'\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2A\u0E48\u0E07:'}
          </Text>
          {remainingLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          ) : remainingLines.length === 0 ? (
            <Text type="secondary">{'\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E16\u0E39\u0E01\u0E2A\u0E48\u0E07\u0E04\u0E23\u0E1A\u0E41\u0E25\u0E49\u0E27'}</Text>
          ) : (
            <Table
              dataSource={remainingLines}
              columns={lineColumns}
              rowKey="so_line_id"
              pagination={false}
              size="small"
            />
          )}
        </>
      )}
    </Modal>
  );
}
