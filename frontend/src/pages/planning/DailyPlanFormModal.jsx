import { useEffect, useState } from 'react';
import { Modal, Form, Select, DatePicker, Input, InputNumber, Button, Table, App, Space, Alert } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

export default function DailyPlanFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tools, setTools] = useState([]);
  const [products, setProducts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [planTools, setPlanTools] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [conflicts, setConflicts] = useState([]);

  const isEdit = !!editItem;

  useEffect(() => {
    if (open) {
      form.resetFields();
      setConflicts([]);

      Promise.all([
        api.get('/api/work-orders', { params: { limit: 500, offset: 0, status: 'OPEN' } }),
        api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } }),
        api.get('/api/tools', { params: { limit: 500, offset: 0 } }),
        api.get('/api/inventory/products', { params: { limit: 500, offset: 0 } }),
      ]).then(([woRes, empRes, toolRes, prodRes]) => {
        setWorkOrders(woRes.data.items || []);
        setEmployees((empRes.data.items || []).filter((e) => e.is_active));
        setTools(toolRes.data.items || []);
        setProducts(prodRes.data.items || []);
      }).catch(() => {});

      if (isEdit) {
        form.setFieldsValue({
          note: editItem.note,
        });
        setWorkers(
          Array.isArray(editItem.workers)
            ? editItem.workers.map((w, i) => ({
                key: Date.now() + i,
                employee_id: w.employee_id,
                planned_hours: w.planned_hours || 8,
              }))
            : []
        );
        setPlanTools(
          Array.isArray(editItem.tools)
            ? editItem.tools.map((t, i) => ({
                key: Date.now() + 100 + i,
                tool_id: t.tool_id,
              }))
            : []
        );
        setMaterials(
          Array.isArray(editItem.materials)
            ? editItem.materials.map((m, i) => ({
                key: Date.now() + 200 + i,
                product_id: m.product_id,
                quantity: m.planned_qty ?? m.quantity,
              }))
            : []
        );
      } else {
        setWorkers([]);
        setPlanTools([]);
        setMaterials([]);
      }
    }
  }, [open, editItem]);

  const checkConflicts = async (date, employeeId) => {
    if (!date || !employeeId) return;
    try {
      const dateStr = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
      const { data } = await api.get('/api/planning/conflicts', {
        params: { date: dateStr, employee_id: employeeId },
      });
      if (data && data.has_conflict) {
        setConflicts((prev) => {
          const exists = prev.find((c) => c.employee_id === employeeId);
          if (exists) return prev;
          return [...prev, { employee_id: employeeId, detail: data.detail || 'พนักงานมีแผนงานอื่นในวันเดียวกัน' }];
        });
      }
    } catch {
      // Conflict check is best-effort
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        note: values.note || '',
        workers: workers.map(({ employee_id, planned_hours }) => ({ employee_id, planned_hours })),
        tools: planTools.map(({ tool_id }) => ({ tool_id })),
        materials: materials.map(({ product_id, quantity }) => ({ product_id, planned_qty: quantity })),
      };

      if (isEdit) {
        await api.put(`/api/planning/daily/${editItem.id}`, payload);
        message.success('อัปเดตแผนงานสำเร็จ');
      } else {
        payload.plan_date = values.plan_date.format('YYYY-MM-DD');
        payload.work_order_id = values.work_order_id;
        await api.post('/api/planning/daily', payload);
        message.success('สร้างแผนงานสำเร็จ');
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Workers sub-table ---
  const addWorker = () => setWorkers([...workers, { key: Date.now(), employee_id: undefined, planned_hours: 8 }]);
  const removeWorker = (key) => {
    setWorkers(workers.filter((w) => w.key !== key));
    const removed = workers.find((w) => w.key === key);
    if (removed) {
      setConflicts((prev) => prev.filter((c) => c.employee_id !== removed.employee_id));
    }
  };
  const updateWorker = (key, field, value) => {
    setWorkers(workers.map((w) => (w.key === key ? { ...w, [field]: value } : w)));
    if (field === 'employee_id' && value) {
      const date = form.getFieldValue('plan_date');
      const dateStr = isEdit ? editItem.plan_date : date;
      checkConflicts(dateStr, value);
    }
  };

  const workerColumns = [
    {
      title: 'พนักงาน', dataIndex: 'employee_id', width: 280,
      render: (v, record) => (
        <Select
          showSearch optionFilterProp="label"
          value={v}
          onChange={(val) => updateWorker(record.key, 'employee_id', val)}
          options={employees.map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.full_name}` }))}
          style={{ width: '100%' }}
          placeholder="เลือกพนักงาน"
        />
      ),
    },
    {
      title: 'ชม.ที่วางแผน', dataIndex: 'planned_hours', width: 130,
      render: (v, record) => (
        <InputNumber
          min={0.5} max={24} step={0.5}
          value={v}
          onChange={(val) => updateWorker(record.key, 'planned_hours', val)}
          style={{ width: '100%' }}
          addonAfter="ชม."
        />
      ),
    },
    {
      title: '', width: 50,
      render: (_, record) => (
        <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={() => removeWorker(record.key)} />
      ),
    },
  ];

  // --- Tools sub-table ---
  const addPlanTool = () => setPlanTools([...planTools, { key: Date.now(), tool_id: undefined }]);
  const removePlanTool = (key) => setPlanTools(planTools.filter((t) => t.key !== key));
  const updatePlanTool = (key, field, value) => setPlanTools(planTools.map((t) => (t.key === key ? { ...t, [field]: value } : t)));

  const toolColumns = [
    {
      title: 'เครื่องมือ', dataIndex: 'tool_id', width: 400,
      render: (v, record) => (
        <Select
          showSearch optionFilterProp="label"
          value={v}
          onChange={(val) => updatePlanTool(record.key, 'tool_id', val)}
          options={tools.map((t) => ({ value: t.id, label: `${t.code} — ${t.name}` }))}
          style={{ width: '100%' }}
          placeholder="เลือกเครื่องมือ"
        />
      ),
    },
    {
      title: '', width: 50,
      render: (_, record) => (
        <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={() => removePlanTool(record.key)} />
      ),
    },
  ];

  // --- Materials sub-table ---
  const addMaterial = () => setMaterials([...materials, { key: Date.now(), product_id: undefined, quantity: 1 }]);
  const removeMaterial = (key) => setMaterials(materials.filter((m) => m.key !== key));
  const updateMaterial = (key, field, value) => setMaterials(materials.map((m) => (m.key === key ? { ...m, [field]: value } : m)));

  const materialColumns = [
    {
      title: 'สินค้า', dataIndex: 'product_id', width: 280,
      render: (v, record) => (
        <Select
          showSearch optionFilterProp="label"
          value={v}
          onChange={(val) => updateMaterial(record.key, 'product_id', val)}
          options={products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))}
          style={{ width: '100%' }}
          placeholder="เลือกสินค้า"
        />
      ),
    },
    {
      title: 'จำนวน', dataIndex: 'quantity', width: 130,
      render: (v, record) => (
        <InputNumber
          min={1} step={1}
          value={v}
          onChange={(val) => updateMaterial(record.key, 'quantity', val)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '', width: 50,
      render: (_, record) => (
        <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={() => removeMaterial(record.key)} />
      ),
    },
  ];

  const sectionStyle = { marginTop: 20 };
  const sectionHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 };
  const sectionTitle = { fontWeight: 600, fontSize: 13, color: COLORS.text };

  return (
    <Modal
      title={isEdit ? 'แก้ไขแผนงานรายวัน' : 'สร้างแผนงานรายวัน'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={isEdit ? 'อัปเดต' : 'สร้าง'}
      cancelText="ยกเลิก"
      width={780}
      destroyOnHidden
    >
      {conflicts.length > 0 && (
        <Alert
          type="warning" showIcon closable
          message="พบแผนงานซ้อนทับ"
          description={conflicts.map((c) => {
            const emp = employees.find((e) => e.id === c.employee_id);
            return `${emp ? emp.full_name : c.employee_id?.slice(0, 8)}: ${c.detail}`;
          }).join(' | ')}
          style={{ marginBottom: 16, background: COLORS.accentMuted, border: 'none' }}
          onClose={() => setConflicts([])}
        />
      )}

      <Form form={form} layout="vertical">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            name="plan_date"
            label="วันที่"
            rules={!isEdit ? [{ required: true, message: 'กรุณาเลือกวันที่' }] : undefined}
          >
            {isEdit ? (
              <Input value={editItem?.plan_date} disabled style={{ color: COLORS.textSecondary }} />
            ) : (
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            )}
          </Form.Item>

          <Form.Item
            name="work_order_id"
            label="Work Order (เฉพาะ OPEN)"
            rules={!isEdit ? [{ required: true, message: 'กรุณาเลือก Work Order' }] : undefined}
          >
            {isEdit ? (
              <Input
                value={
                  (() => {
                    const wo = workOrders.find((w) => w.id === editItem?.work_order_id);
                    return wo ? `${wo.wo_number} — ${wo.description || ''}` : editItem?.work_order_id?.slice(0, 12);
                  })()
                }
                disabled
                style={{ color: COLORS.textSecondary }}
              />
            ) : (
              <Select
                placeholder="เลือก Work Order" showSearch optionFilterProp="label"
                options={workOrders.map((w) => ({ value: w.id, label: `${w.wo_number} — ${w.description || ''}` }))}
              />
            )}
          </Form.Item>
        </div>

        <Form.Item name="note" label="หมายเหตุ">
          <Input.TextArea rows={2} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" maxLength={500} showCount />
        </Form.Item>
      </Form>

      {/* Workers Section */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitle}>พนักงาน ({workers.length} คน)</span>
          <Button size="small" icon={<Plus size={12} />} onClick={addWorker}>เพิ่มพนักงาน</Button>
        </div>
        <Table
          dataSource={workers}
          columns={workerColumns}
          rowKey="key"
          pagination={false}
          size="small"
          locale={{ emptyText: <span style={{ color: COLORS.textMuted, fontSize: 12 }}>ยังไม่มีพนักงาน</span> }}
        />
      </div>

      {/* Tools Section */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitle}>เครื่องมือ ({planTools.length} รายการ)</span>
          <Button size="small" icon={<Plus size={12} />} onClick={addPlanTool}>เพิ่มเครื่องมือ</Button>
        </div>
        <Table
          dataSource={planTools}
          columns={toolColumns}
          rowKey="key"
          pagination={false}
          size="small"
          locale={{ emptyText: <span style={{ color: COLORS.textMuted, fontSize: 12 }}>ยังไม่มีเครื่องมือ</span> }}
        />
      </div>

      {/* Materials Section */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitle}>วัสดุ ({materials.length} รายการ)</span>
          <Button size="small" icon={<Plus size={12} />} onClick={addMaterial}>เพิ่มวัสดุ</Button>
        </div>
        <Table
          dataSource={materials}
          columns={materialColumns}
          rowKey="key"
          pagination={false}
          size="small"
          locale={{ emptyText: <span style={{ color: COLORS.textMuted, fontSize: 12 }}>ยังไม่มีวัสดุ</span> }}
        />
      </div>
    </Modal>
  );
}
