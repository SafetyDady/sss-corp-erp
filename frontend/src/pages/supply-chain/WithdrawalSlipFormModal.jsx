import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, Button, Table, App, Space, Radio, Divider } from 'antd';
import { Plus, Trash2, Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import api from '../../services/api';
import { getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function WithdrawalSlipFormModal({ open, editRecord, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [withdrawalType, setWithdrawalType] = useState('WO_CONSUME');
  const [lines, setLines] = useState([]);
  const { message } = App.useApp();

  // Reference data
  const [products, setProducts] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [costElements, setCostElements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  // Per-line location state: { [lineKey]: { warehouse_id, locations: [] } }
  const [lineLocations, setLineLocations] = useState({});

  // Reset and fetch data when modal opens
  useEffect(() => {
    if (!open) return;

    form.resetFields();
    setWithdrawalType('WO_CONSUME');
    setLineLocations({});

    if (editRecord) {
      const type = editRecord.withdrawal_type || 'WO_CONSUME';
      form.setFieldsValue({
        withdrawal_type: type,
        work_order_id: editRecord.work_order_id,
        cost_center_id: editRecord.cost_center_id,
        cost_element_id: editRecord.cost_element_id,
        requested_by: editRecord.requested_by,
        note: editRecord.note,
        reference: editRecord.reference,
      });
      setWithdrawalType(type);
      setLines(
        (editRecord.lines || []).map((l, idx) => ({
          key: Date.now() + idx,
          product_id: l.product_id,
          quantity: l.quantity,
          location_id: l.location_id,
          note: l.note || '',
        }))
      );
    } else {
      form.setFieldsValue({ withdrawal_type: 'WO_CONSUME' });
      setLines([{ key: Date.now(), product_id: undefined, quantity: 1, location_id: undefined, note: '' }]);
    }

    // Fetch all reference data in parallel
    Promise.all([
      api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } }),
      api.get('/api/work-orders', { params: { limit: 200, offset: 0, status: 'OPEN' } }),
      api.get('/api/master/cost-centers', { params: { limit: 200, offset: 0 } }),
      api.get('/api/master/cost-elements', { params: { limit: 200, offset: 0 } }),
      api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } }),
      api.get('/api/warehouse/warehouses', { params: { limit: 100, offset: 0 } }),
    ]).then(([prodRes, woRes, ccRes, ceRes, empRes, whRes]) => {
      // Only MATERIAL + CONSUMABLE (exclude SERVICE)
      setProducts((prodRes.data.items || []).filter((p) => p.product_type !== 'SERVICE'));
      setWorkOrders(woRes.data.items || []);
      setCostCenters(ccRes.data.items || []);
      setCostElements(ceRes.data.items || []);
      setEmployees(empRes.data.items || []);
      setWarehouses(whRes.data.items || []);
    }).catch(() => {});
  }, [open, editRecord]);

  // Fetch locations for a specific line's warehouse
  const fetchLocationsForLine = (lineKey, warehouseId) => {
    if (!warehouseId) {
      setLineLocations((prev) => ({
        ...prev,
        [lineKey]: { warehouse_id: undefined, locations: [] },
      }));
      return;
    }
    api.get('/api/warehouse/locations', { params: { limit: 100, offset: 0, warehouse_id: warehouseId } })
      .then((r) => {
        setLineLocations((prev) => ({
          ...prev,
          [lineKey]: { warehouse_id: warehouseId, locations: r.data.items || [] },
        }));
      })
      .catch(() => {});
  };

  const handleWarehouseChangeForLine = (lineKey, warehouseId) => {
    // Clear location_id when warehouse changes
    updateLine(lineKey, 'location_id', undefined);
    fetchLocationsForLine(lineKey, warehouseId);
  };

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setWithdrawalType(newType);
    // Clear conditional fields
    form.setFieldsValue({
      work_order_id: undefined,
      cost_center_id: undefined,
      cost_element_id: undefined,
    });
  };

  // Line manipulation
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { key: Date.now(), product_id: undefined, quantity: 1, location_id: undefined, note: '' },
    ]);
  };

  const removeLine = (key) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setLineLocations((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updateLine = (key, field, value) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  // Submit
  const onFinish = async (values) => {
    if (lines.length === 0) {
      message.error('กรุณาเพิ่มอย่างน้อย 1 รายการ');
      return;
    }
    for (const l of lines) {
      if (!l.product_id) {
        message.error('ทุกรายการต้องเลือกสินค้า');
        return;
      }
      if (!l.quantity || l.quantity < 1) {
        message.error('จำนวนต้องมากกว่า 0');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        withdrawal_type: values.withdrawal_type,
        work_order_id: values.withdrawal_type === 'WO_CONSUME' ? values.work_order_id : null,
        cost_center_id: values.withdrawal_type === 'CC_ISSUE' ? values.cost_center_id : null,
        cost_element_id: values.withdrawal_type === 'CC_ISSUE' ? (values.cost_element_id || null) : null,
        requested_by: values.requested_by || null,
        note: values.note || null,
        reference: values.reference || null,
        lines: lines.map(({ product_id, quantity, location_id, note }) => ({
          product_id,
          quantity,
          location_id: location_id || null,
          note: note || null,
        })),
      };

      if (editRecord) {
        await api.put(`/api/inventory/withdrawal-slips/${editRecord.id}`, payload);
        message.success('อัปเดตใบเบิกสำเร็จ');
      } else {
        await api.post('/api/inventory/withdrawal-slips', payload);
        message.success('สร้างใบเบิกสำเร็จ');
      }
      onSuccess();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  // Line table columns
  const lineColumns = [
    {
      title: 'สินค้า', dataIndex: 'product_id', width: 240,
      render: (v, record) => (
        <Select
          showSearch
          optionFilterProp="label"
          value={v}
          onChange={(val) => updateLine(record.key, 'product_id', val)}
          options={products.map((p) => ({
            value: p.id,
            label: `${p.sku} - ${p.name}`,
          }))}
          style={{ width: '100%' }}
          size="small"
          placeholder="เลือกสินค้า"
        />
      ),
    },
    {
      title: 'จำนวน', dataIndex: 'quantity', width: 100,
      render: (v, record) => (
        <InputNumber
          min={1}
          value={v}
          size="small"
          onChange={(val) => updateLine(record.key, 'quantity', val || 1)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <WarehouseIcon size={12} /> คลัง
        </span>
      ),
      key: 'warehouse',
      width: 180,
      render: (_, record) => (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          value={lineLocations[record.key]?.warehouse_id}
          onChange={(val) => handleWarehouseChangeForLine(record.key, val)}
          options={warehouses.map((w) => ({
            value: w.id,
            label: `${w.code} - ${w.name}`,
          }))}
          style={{ width: '100%' }}
          size="small"
          placeholder="เลือกคลัง"
        />
      ),
    },
    {
      title: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={12} /> ตำแหน่ง
        </span>
      ),
      dataIndex: 'location_id',
      width: 200,
      render: (v, record) => {
        const locs = lineLocations[record.key]?.locations || [];
        const hasWarehouse = !!lineLocations[record.key]?.warehouse_id;
        return (
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            value={v}
            onChange={(val) => updateLine(record.key, 'location_id', val)}
            options={locs.map((l) => ({
              value: l.id,
              label: `${l.code} - ${l.name} (${l.zone_type})`,
            }))}
            style={{ width: '100%' }}
            size="small"
            placeholder="เลือก Location"
            disabled={!hasWarehouse}
          />
        );
      },
    },
    {
      title: 'หมายเหตุ', dataIndex: 'note', width: 160,
      render: (v, record) => (
        <Input
          value={v}
          size="small"
          onChange={(e) => updateLine(record.key, 'note', e.target.value)}
          placeholder="หมายเหตุรายการ"
        />
      ),
    },
    {
      title: '', width: 40,
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<Trash2 size={14} />}
          onClick={() => removeLine(record.key)}
          disabled={lines.length <= 1}
        />
      ),
    },
  ];

  return (
    <Modal
      title={editRecord ? 'แก้ไขใบเบิกสินค้า' : 'สร้างใบเบิกสินค้า'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={1100}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* Withdrawal Type */}
        <Form.Item
          name="withdrawal_type"
          label="ประเภทการเบิก"
          rules={[{ required: true, message: 'กรุณาเลือกประเภท' }]}
        >
          <Radio.Group onChange={handleTypeChange}>
            <Radio.Button value="WO_CONSUME">เบิกเข้า WO</Radio.Button>
            <Radio.Button value="CC_ISSUE">เบิกจ่ายตาม CC</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* Conditional header fields */}
        {withdrawalType === 'WO_CONSUME' && (
          <Form.Item
            name="work_order_id"
            label="Work Order"
            rules={[{ required: true, message: 'กรุณาเลือก Work Order' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="เลือก Work Order (OPEN)"
              style={{ width: 400 }}
              options={workOrders.map((wo) => ({
                value: wo.id,
                label: `${wo.wo_number}${wo.customer_name ? ' — ' + wo.customer_name : ''}`,
              }))}
            />
          </Form.Item>
        )}

        {withdrawalType === 'CC_ISSUE' && (
          <Space style={{ width: '100%' }} size={16} wrap>
            <Form.Item
              name="cost_center_id"
              label="Cost Center"
              rules={[{ required: true, message: 'กรุณาเลือก Cost Center' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="เลือก Cost Center"
                style={{ width: 280 }}
                options={costCenters.map((cc) => ({
                  value: cc.id,
                  label: `${cc.code} - ${cc.name}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="cost_element_id" label="Cost Element">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="เลือก Cost Element"
                style={{ width: 280 }}
                options={costElements.map((ce) => ({
                  value: ce.id,
                  label: `${ce.code} - ${ce.name}`,
                }))}
              />
            </Form.Item>
          </Space>
        )}

        {/* Requester + Reference */}
        <Space style={{ width: '100%' }} size={16} wrap>
          <Form.Item name="requested_by" label="ผู้เบิก">
            <Select
              showSearch
              optionFilterProp="label"
              allowClear
              placeholder="เลือกพนักงาน"
              style={{ width: 280 }}
              options={employees.map((emp) => ({
                value: emp.id,
                label: `${emp.employee_code} - ${emp.first_name} ${emp.last_name}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="reference" label="เอกสารอ้างอิง">
            <Input placeholder="เลขที่เอกสารอ้างอิง" style={{ width: 240 }} />
          </Form.Item>
        </Space>

        <Form.Item name="note" label="หมายเหตุ">
          <Input.TextArea rows={2} placeholder="หมายเหตุเพิ่มเติม" />
        </Form.Item>
      </Form>

      <Divider style={{ margin: '12px 0' }} />

      {/* Line Items */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: COLORS.text }}>
            รายการสินค้าที่เบิก
          </span>
          <Button size="small" icon={<Plus size={12} />} onClick={addLine}>
            เพิ่มรายการ
          </Button>
        </div>
        <Table
          dataSource={lines}
          columns={lineColumns}
          rowKey="key"
          pagination={false}
          size="small"
          scroll={{ x: 920 }}
          locale={{ emptyText: <span style={{ color: COLORS.textMuted }}>ยังไม่มีรายการ</span> }}
        />
      </div>
    </Modal>
  );
}
