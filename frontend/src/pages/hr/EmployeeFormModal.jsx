import { useEffect, useState, useMemo } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Select, App, Divider, Typography, DatePicker } from 'antd';
import dayjs from 'dayjs';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

const PAY_TYPE_OPTIONS = [
  { value: 'DAILY', label: 'รายวัน' },
  { value: 'MONTHLY', label: 'รายเดือน' },
];

export default function EmployeeFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [costCenters, setCostCenters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const payType = Form.useWatch('pay_type', form);
  const hireDateVal = Form.useWatch('hire_date', form);

  // Calculate tenure from hire_date
  const tenure = useMemo(() => {
    if (!hireDateVal) return null;
    const hd = dayjs.isDayjs(hireDateVal) ? hireDateVal : dayjs(hireDateVal);
    if (!hd.isValid()) return null;
    const now = dayjs();
    const years = now.diff(hd, 'year');
    const months = now.diff(hd.add(years, 'year'), 'month');
    const days = now.diff(hd.add(years, 'year').add(months, 'month'), 'day');
    const parts = [];
    if (years > 0) parts.push(`${years} ปี`);
    if (months > 0) parts.push(`${months} เดือน`);
    parts.push(`${days} วัน`);
    return parts.join(' ');
  }, [hireDateVal]);

  useEffect(() => {
    if (open) {
      Promise.all([
        api.get('/api/master/cost-centers', { params: { limit: 500, offset: 0 } }),
        api.get('/api/master/departments', { params: { limit: 500, offset: 0 } }),
        api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } }),
      ]).then(([ccRes, deptRes, empRes]) => {
        setCostCenters((ccRes.data.items || []).filter((c) => c.is_active));
        setDepartments((deptRes.data.items || []).filter((d) => d.is_active));
        setEmployees((empRes.data.items || []).filter((e) => e.is_active));
      }).catch(() => {});

      if (editItem) {
        form.setFieldsValue({
          employee_code: editItem.employee_code,
          full_name: editItem.full_name,
          position: editItem.position,
          hourly_rate: parseFloat(editItem.hourly_rate) || 0,
          daily_working_hours: parseFloat(editItem.daily_working_hours) || 8,
          cost_center_id: editItem.cost_center_id || undefined,
          department_id: editItem.department_id || undefined,
          supervisor_id: editItem.supervisor_id || undefined,
          pay_type: editItem.pay_type || 'DAILY',
          daily_rate: editItem.daily_rate ? parseFloat(editItem.daily_rate) : undefined,
          monthly_salary: editItem.monthly_salary ? parseFloat(editItem.monthly_salary) : undefined,
          is_active: editItem.is_active,
          hire_date: editItem.hire_date ? dayjs(editItem.hire_date) : undefined,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editItem]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // Convert dayjs hire_date to ISO string for API
      if (values.hire_date && dayjs.isDayjs(values.hire_date)) {
        values.hire_date = values.hire_date.format('YYYY-MM-DD');
      }
      setLoading(true);
      if (editItem) {
        const payload = { ...values };
        delete payload.employee_code;
        await api.put(`/api/hr/employees/${editItem.id}`, payload);
        message.success(`แก้ไขข้อมูล "${values.full_name}" สำเร็จ`);
      } else {
        await api.post('/api/hr/employees', values);
        message.success(`เพิ่มพนักงาน "${values.full_name}" สำเร็จ`);
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.toLowerCase().includes('unique')) {
          message.error('รหัสพนักงานนี้ถูกใช้แล้ว กรุณาใช้รหัสอื่น');
        } else {
          message.error(detail || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editItem ? `แก้ไขพนักงาน — ${editItem.employee_code}` : 'เพิ่มพนักงานใหม่'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={editItem ? 'บันทึก' : 'เพิ่มพนักงาน'}
      cancelText="ยกเลิก"
      width={600}
      destroyOnHidden
    >
      <Form form={form} layout="vertical"
        initialValues={{ hourly_rate: 0, daily_working_hours: 8, pay_type: 'DAILY' }}
        requiredMark={(label, { required }) => (
          <>{label}{required && <span style={{ color: COLORS.danger, marginLeft: 4 }}>*</span>}</>
        )}
      >
        <Form.Item name="employee_code" label="รหัสพนักงาน"
          rules={[{ required: true, message: 'กรุณากรอกรหัสพนักงาน' }]}
          extra={!editItem && <Text type="secondary" style={{ fontSize: 12 }}>รหัสจะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ</Text>}
        >
          <Input disabled={!!editItem} placeholder="เช่น EMP-001" style={{ fontFamily: 'monospace' }} />
        </Form.Item>

        <Form.Item name="full_name" label="ชื่อ-สกุล"
          rules={[{ required: true, message: 'กรุณากรอกชื่อ-สกุล' }]}>
          <Input placeholder="ชื่อ นามสกุล" />
        </Form.Item>

        <Form.Item name="position" label="ตำแหน่ง">
          <Input placeholder="เช่น ช่างเทคนิค, วิศวกร" />
        </Form.Item>

        <Form.Item name="hire_date" label="วันที่เข้างาน"
          rules={[{ required: !editItem, message: 'กรุณาเลือกวันที่เข้างาน' }]}
          extra={tenure && <Text type="secondary" style={{ fontSize: 12 }}>อายุงาน: {tenure}</Text>}
        >
          <DatePicker style={{ width: '100%' }} placeholder="เลือกวันที่" format="YYYY-MM-DD" />
        </Form.Item>

        <Divider style={{ margin: '12px 0', borderColor: COLORS.border }}>สังกัด</Divider>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="department_id" label="แผนก">
            <Select allowClear placeholder="เลือกแผนก" showSearch optionFilterProp="label"
              options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))} />
          </Form.Item>

          <Form.Item name="supervisor_id" label="หัวหน้างาน"
            extra={<Text type="secondary" style={{ fontSize: 12 }}>ผู้อนุมัติ Timesheet/OT เริ่มต้น</Text>}
          >
            <Select allowClear placeholder="เลือกหัวหน้างาน" showSearch optionFilterProp="label"
              options={employees
                .filter((e) => !editItem || e.id !== editItem.id)
                .map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.full_name}` }))} />
          </Form.Item>
        </div>

        <Divider style={{ margin: '12px 0', borderColor: COLORS.border }}>ค่าตอบแทน</Divider>

        <Form.Item name="pay_type" label="ประเภทค่าจ้าง"
          rules={[{ required: true, message: 'กรุณาเลือกประเภทค่าจ้าง' }]}>
          <Select options={PAY_TYPE_OPTIONS} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {payType === 'DAILY' && (
            <Form.Item name="daily_rate" label="ค่าแรง/วัน (บาท)">
              <InputNumber min={0} step={50} style={{ width: '100%' }}
                formatter={(v) => `฿ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => v.replace(/฿\s?|(,*)/g, '')} />
            </Form.Item>
          )}

          {payType === 'MONTHLY' && (
            <Form.Item name="monthly_salary" label="เงินเดือน (บาท)">
              <InputNumber min={0} step={500} style={{ width: '100%' }}
                formatter={(v) => `฿ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => v.replace(/฿\s?|(,*)/g, '')} />
            </Form.Item>
          )}

          <Form.Item name="hourly_rate" label="อัตรา/ชม. (Job Costing)"
            rules={[{ required: true, message: 'กรุณากรอกอัตราค่าจ้าง' }]}
            extra={<Text type="secondary" style={{ fontSize: 12 }}>ใช้คำนวณ ManHour Cost</Text>}
          >
            <InputNumber min={0} step={10} style={{ width: '100%' }}
              formatter={(v) => `฿ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => v.replace(/฿\s?|(,*)/g, '')} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="daily_working_hours" label="ชม.ทำงาน/วัน"
            rules={[{ required: true, message: 'กรุณากรอกชั่วโมงทำงาน' }]}>
            <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} suffix="ชม." />
          </Form.Item>

          <Form.Item name="cost_center_id" label="Cost Center"
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Override (ถ้าว่าง ใช้จากแผนก)</Text>}
          >
            <Select allowClear placeholder="เลือก Cost Center" showSearch
              optionFilterProp="label"
              options={costCenters.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))} />
          </Form.Item>
        </div>

        {editItem && (
          <Form.Item name="is_active" label="สถานะใช้งาน" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
