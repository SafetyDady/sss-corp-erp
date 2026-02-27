import { useState, useEffect } from 'react';
import { Card, Descriptions, Button, Modal, Form, DatePicker, InputNumber, Input, Table, App, Space, Tag, Empty } from 'antd';
import { Calendar, Edit3, Plus, Users, Package, Wrench } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import { formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import dayjs from 'dayjs';

const LINE_TYPE_CONFIG = {
  MANPOWER: { color: '#06b6d4', icon: Users, label: 'กำลังคน' },
  MATERIAL: { color: '#f97316', icon: Package, label: 'วัสดุ' },
  TOOL:     { color: '#8b5cf6', icon: Wrench, label: 'เครื่องมือ' },
};

export default function MasterPlanSection({ workOrderId }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/work-orders/${workOrderId}/plan`);
      setPlan(data);
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlan(); }, [workOrderId]);

  const handleOpenModal = () => {
    if (plan) {
      form.setFieldsValue({
        planned_start: dayjs(plan.planned_start),
        planned_end: dayjs(plan.planned_end),
        total_manhours: Number(plan.total_manhours),
        note: plan.note,
      });
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        planned_start: values.planned_start.format('YYYY-MM-DD'),
        planned_end: values.planned_end.format('YYYY-MM-DD'),
        total_manhours: values.total_manhours || 0,
        note: values.note || null,
      };

      if (plan) {
        await api.put(`/api/work-orders/${workOrderId}/plan`, payload);
        message.success('อัปเดต Master Plan สำเร็จ');
      } else {
        await api.post(`/api/work-orders/${workOrderId}/plan`, payload);
        message.success('สร้าง Master Plan สำเร็จ');
      }
      setModalOpen(false);
      fetchPlan();
    } catch (err) {
      if (err.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    } finally {
      setSaving(false);
    }
  };

  const lineColumns = [
    {
      title: 'ประเภท', dataIndex: 'line_type', key: 'line_type', width: 120,
      render: (v) => {
        const cfg = LINE_TYPE_CONFIG[v] || { color: COLORS.textMuted, label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'รายละเอียด', key: 'detail',
      render: (_, r) => {
        if (r.line_type === 'MANPOWER') {
          return `${r.employee_count || 0} คน, ${Number(r.estimated_hours || 0).toFixed(1)} ชม.${r.skill_description ? ` (${r.skill_description})` : ''}`;
        }
        if (r.line_type === 'MATERIAL') {
          return `จำนวน ${r.quantity || 0}`;
        }
        if (r.line_type === 'TOOL') {
          return `${r.estimated_days || 0} วัน`;
        }
        return '-';
      },
    },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ color: COLORS.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} /> Master Plan
        </h3>
        {can('workorder.plan.create') && (
          <Button
            size="small"
            icon={plan ? <Edit3 size={14} /> : <Plus size={14} />}
            onClick={handleOpenModal}
          >
            {plan ? 'แก้ไข' : 'สร้าง Plan'}
          </Button>
        )}
      </div>

      {loading ? null : plan ? (
        <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="เริ่มต้น">{formatDate(plan.planned_start)}</Descriptions.Item>
            <Descriptions.Item label="สิ้นสุด">{formatDate(plan.planned_end)}</Descriptions.Item>
            <Descriptions.Item label="ManHours รวม">
              <span style={{ fontWeight: 600, color: COLORS.accent }}>
                {Number(plan.total_manhours).toFixed(1)} ชม.
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="หมายเหตุ">{plan.note || '-'}</Descriptions.Item>
          </Descriptions>

          {plan.lines && plan.lines.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Table
                dataSource={plan.lines}
                columns={lineColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </div>
          )}
        </Card>
      ) : (
        <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
          <Empty
            description={<span style={{ color: COLORS.textMuted }}>ยังไม่มี Master Plan</span>}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}

      <Modal
        title={plan ? 'แก้ไข Master Plan' : 'สร้าง Master Plan'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="บันทึก"
        cancelText="ยกเลิก"
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item name="planned_start" label="วันเริ่มต้น" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="planned_end" label="วันสิ้นสุด" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
          <Form.Item name="total_manhours" label="ManHours รวม (ชม.)" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
            <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="หมายเหตุ">
            <Input.TextArea rows={2} placeholder="รายละเอียดเพิ่มเติม..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
