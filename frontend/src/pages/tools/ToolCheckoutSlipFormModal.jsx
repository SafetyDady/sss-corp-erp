import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Button, Table, App, Space, Divider } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import SearchSelect from '../../components/SearchSelect';

export default function ToolCheckoutSlipFormModal({ open, editRecord, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState([]);
  const { message } = App.useApp();

  // Reset and populate when modal opens
  useEffect(() => {
    if (!open) return;

    form.resetFields();

    if (editRecord) {
      form.setFieldsValue({
        work_order_id: editRecord.work_order_id,
        requested_by: editRecord.requested_by,
        note: editRecord.note,
        reference: editRecord.reference,
      });
      setLines(
        (editRecord.lines || []).map((l, idx) => ({
          key: Date.now() + idx,
          tool_id: l.tool_id,
          employee_id: l.employee_id,
          note: l.note || '',
          _toolLabel: l.tool_code && l.tool_name ? `${l.tool_code} - ${l.tool_name}` : undefined,
          _empLabel: l.employee_name || undefined,
        }))
      );
    } else {
      setLines([{ key: Date.now(), tool_id: undefined, employee_id: undefined, note: '' }]);
    }
  }, [open, editRecord]);

  // Line manipulation
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { key: Date.now(), tool_id: undefined, employee_id: undefined, note: '' },
    ]);
  };

  const removeLine = (key) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
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
      if (!l.tool_id) {
        message.error('ทุกรายการต้องเลือกเครื่องมือ');
        return;
      }
      if (!l.employee_id) {
        message.error('ทุกรายการต้องเลือกผู้ใช้เครื่องมือ');
        return;
      }
    }

    // Check duplicate tool_id
    const toolIds = lines.map((l) => l.tool_id);
    if (new Set(toolIds).size !== toolIds.length) {
      message.error('ห้ามเลือกเครื่องมือซ้ำกัน');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        work_order_id: values.work_order_id,
        requested_by: values.requested_by || null,
        note: values.note || null,
        reference: values.reference || null,
        lines: lines.map(({ tool_id, employee_id, note }) => ({
          tool_id,
          employee_id,
          note: note || null,
        })),
      };

      if (editRecord) {
        await api.put(`/api/tools/checkout-slips/${editRecord.id}`, payload);
        message.success('อัปเดตใบเบิกเครื่องมือสำเร็จ');
      } else {
        await api.post('/api/tools/checkout-slips', payload);
        message.success('สร้างใบเบิกเครื่องมือสำเร็จ');
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
      title: 'เครื่องมือ', dataIndex: 'tool_id', width: 280,
      render: (v, record) => (
        <SearchSelect
          apiUrl="/api/tools"
          labelRender={(item) => `${item.code} - ${item.name}`}
          extraParams={{ status: editRecord ? undefined : 'AVAILABLE' }}
          value={v}
          onChange={(val) => updateLine(record.key, 'tool_id', val)}
          style={{ width: '100%' }}
          size="small"
          placeholder="เลือกเครื่องมือ"
          defaultOptions={v ? [{ value: v, label: record._toolLabel || v }] : []}
        />
      ),
    },
    {
      title: 'ผู้ใช้เครื่องมือ', dataIndex: 'employee_id', width: 260,
      render: (v, record) => (
        <SearchSelect
          apiUrl="/api/hr/employees"
          labelRender={(item) => `${item.employee_code} - ${item.first_name} ${item.last_name}`}
          value={v}
          onChange={(val) => updateLine(record.key, 'employee_id', val)}
          style={{ width: '100%' }}
          size="small"
          placeholder="เลือกพนักงาน"
          defaultOptions={v ? [{ value: v, label: record._empLabel || v }] : []}
        />
      ),
    },
    {
      title: 'หมายเหตุ', dataIndex: 'note', width: 180,
      render: (v, record) => (
        <Input
          value={v}
          size="small"
          onChange={(e) => updateLine(record.key, 'note', e.target.value)}
          placeholder="หมายเหตุ"
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
      title={editRecord ? 'แก้ไขใบเบิกเครื่องมือ' : 'สร้างใบเบิกเครื่องมือ'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={900}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* Work Order */}
        <Form.Item
          name="work_order_id"
          label="Work Order"
          rules={[{ required: true, message: 'กรุณาเลือก Work Order' }]}
        >
          <SearchSelect
            apiUrl="/api/work-orders"
            extraParams={{ status: 'OPEN' }}
            labelRender={(item) => `${item.wo_number}${item.customer_name ? ' — ' + item.customer_name : ''}`}
            placeholder="เลือก Work Order (OPEN)"
            style={{ width: 400 }}
            defaultOptions={editRecord?.work_order_id ? [{
              value: editRecord.work_order_id,
              label: editRecord.work_order_number || editRecord.work_order_id,
            }] : []}
          />
        </Form.Item>

        {/* Requester + Reference */}
        <Space style={{ width: '100%' }} size={16} wrap>
          <Form.Item name="requested_by" label="ผู้เบิก">
            <SearchSelect
              apiUrl="/api/hr/employees"
              labelRender={(item) => `${item.employee_code} - ${item.first_name} ${item.last_name}`}
              allowClear
              placeholder="เลือกพนักงาน"
              style={{ width: 280 }}
              defaultOptions={editRecord?.requested_by ? [{
                value: editRecord.requested_by,
                label: editRecord.requester_name || editRecord.requested_by,
              }] : []}
            />
          </Form.Item>
          <Form.Item name="reference" label="เอกสารอ้างอิง">
            <Input placeholder="เลขที่เอกสาร Hardcopy" style={{ width: 240 }} />
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
            รายการเครื่องมือที่เบิก
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
          scroll={{ x: 760 }}
          locale={{ emptyText: <span style={{ color: COLORS.textMuted }}>ยังไม่มีรายการ</span> }}
        />
      </div>
    </Modal>
  );
}
