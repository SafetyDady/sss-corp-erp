import { useEffect, useState, useMemo } from 'react';
import { Modal, Form, Select, DatePicker, Input, App, Typography } from 'antd';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

export default function LeaveFormModal({ open, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);

  const [approvers, setApprovers] = useState([]);

  useEffect(() => {
    if (open) {
      form.resetFields();
      Promise.all([
        api.get('/api/hr/employees', { params: { limit: 200, offset: 0 } }),
        api.get('/api/admin/approvers', { params: { module: 'hr.leave' } }),
        api.get('/api/master/leave-types', { params: { limit: 50, offset: 0 } }),
      ]).then(([empRes, appRes, ltRes]) => {
        setEmployees((empRes.data.items || []).filter((e) => e.is_active));
        setApprovers(appRes.data);
        setLeaveTypes((ltRes.data.items || []).filter((lt) => lt.is_active));
      }).catch(() => {});
    }
  }, [open]);

  const selectedEmployeeId = Form.useWatch('employee_id', form);
  const selectedLeaveTypeId = Form.useWatch('leave_type_id', form);

  // Fetch leave balances when employee changes
  useEffect(() => {
    if (selectedEmployeeId) {
      api.get('/api/hr/leave-balances', {
        params: { employee_id: selectedEmployeeId, year: new Date().getFullYear() },
      }).then((res) => {
        setLeaveBalances(res.data.items || res.data || []);
      }).catch(() => {
        setLeaveBalances([]);
      });
    } else {
      setLeaveBalances([]);
    }
  }, [selectedEmployeeId]);

  const quotaInfo = useMemo(() => {
    if (!selectedLeaveTypeId || leaveBalances.length === 0) return null;
    const balance = leaveBalances.find((b) => b.leave_type_id === selectedLeaveTypeId);
    if (!balance) return null;
    const remaining = balance.quota - balance.used;
    return { quota: balance.quota, used: balance.used, remaining };
  }, [selectedLeaveTypeId, leaveBalances]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      // Find leave type code from selected leave_type_id
      const selectedType = leaveTypes.find((lt) => lt.id === values.leave_type_id);
      const payload = {
        ...values,
        leave_type: selectedType?.code || values.leave_type,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date.format('YYYY-MM-DD'),
      };
      await api.post('/api/hr/leave', payload);
      message.success('ยื่นคำขอลาหยุดสำเร็จ — รอการอนุมัติ');
      onSuccess();
    } catch (err) {
      if (err.response) {
        message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="ขอลาหยุด"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="ยื่นคำขอ"
      cancelText="ยกเลิก"
      width={500}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="employee_id" label="พนักงาน"
          rules={[{ required: true, message: 'กรุณาเลือกพนักงาน' }]}>
          <Select placeholder="เลือกพนักงาน" showSearch optionFilterProp="label"
            options={employees.map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.full_name}` }))} />
        </Form.Item>

        <Form.Item name="leave_type_id" label="ประเภทลา"
          rules={[{ required: true, message: 'กรุณาเลือกประเภทลา' }]}
          extra={quotaInfo && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              โควต้า: {quotaInfo.quota} วัน | ใช้ไป: {quotaInfo.used} วัน |{' '}
              <span style={{ color: quotaInfo.remaining > 0 ? COLORS.success : COLORS.danger, fontWeight: 600 }}>
                คงเหลือ: {quotaInfo.remaining} วัน
              </span>
            </Text>
          )}
        >
          <Select
            placeholder="เลือกประเภทลา"
            showSearch
            optionFilterProp="label"
            options={leaveTypes.map((lt) => ({
              value: lt.id,
              label: `${lt.code} — ${lt.name}`,
            }))}
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="start_date" label="วันเริ่มลา"
            rules={[{ required: true, message: 'กรุณาเลือกวันเริ่มลา' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="end_date" label="วันสิ้นสุด"
            rules={[
              { required: true, message: 'กรุณาเลือกวันสิ้นสุด' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || !getFieldValue('start_date')) return Promise.resolve();
                  if (value.isBefore(getFieldValue('start_date'))) {
                    return Promise.reject(new Error('วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Form.Item name="requested_approver_id" label="ผู้อนุมัติ">
          <Select
            showSearch optionFilterProp="label" allowClear
            placeholder="เลือกผู้อนุมัติ"
            options={approvers.map((a) => ({ value: a.id, label: a.full_name }))}
          />
        </Form.Item>

        <Form.Item name="reason" label="เหตุผล"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>ลาป่วยเกิน 3 วัน ต้องแนบใบรับรองแพทย์</Text>}
        >
          <Input.TextArea rows={3} placeholder="ระบุเหตุผลการลา (ถ้ามี)" maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
