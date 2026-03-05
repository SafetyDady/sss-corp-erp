import { useEffect } from 'react';
import { Modal, Form, Input, Switch, App } from 'antd';
import api from '../../services/api';

export default function CompanyFormModal({ open, editItem, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const isEdit = !!editItem;

  useEffect(() => {
    if (open) {
      if (editItem) {
        form.setFieldsValue({
          code: editItem.code,
          name: editItem.name,
          tax_id: editItem.tax_id || '',
          address: editItem.address || '',
          is_active: editItem.is_active,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editItem]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        tax_id: values.tax_id?.trim() || null,
        address: values.address?.trim() || null,
      };

      if (isEdit) {
        const { code, ...updatePayload } = payload;
        await api.put(`/api/master/companies/${editItem.id}`, updatePayload);
        message.success('แก้ไขบริษัทสำเร็จ');
      } else {
        await api.post('/api/master/companies', payload);
        message.success('เพิ่มบริษัทสำเร็จ');
      }
      onSuccess();
    } catch (err) {
      if (err.errorFields) return; // form validation error
      const detail = err.response?.data?.detail || '';
      if (detail.includes('already exists')) {
        message.error('รหัสบริษัทนี้ถูกใช้แล้ว');
      } else {
        message.error(detail || 'เกิดข้อผิดพลาด');
      }
    }
  };

  return (
    <Modal
      title={isEdit ? 'แก้ไขบริษัท' : 'เพิ่มบริษัทในเครือ'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={isEdit ? 'บันทึก' : 'สร้าง'}
      cancelText="ยกเลิก"
      width={560}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          label="รหัสบริษัท"
          name="code"
          rules={[
            { required: true, message: 'กรุณากรอกรหัสบริษัท' },
            { max: 50, message: 'ไม่เกิน 50 ตัวอักษร' },
          ]}
        >
          <Input placeholder="เช่น SSS-A, SSS-B" disabled={isEdit} style={{ textTransform: 'uppercase' }} />
        </Form.Item>

        <Form.Item
          label="ชื่อบริษัท"
          name="name"
          rules={[
            { required: true, message: 'กรุณากรอกชื่อบริษัท' },
            { max: 255, message: 'ไม่เกิน 255 ตัวอักษร' },
          ]}
        >
          <Input placeholder="เช่น บริษัท เอสเอสเอส ก จำกัด" />
        </Form.Item>

        <Form.Item
          label="เลขประจำตัวผู้เสียภาษี"
          name="tax_id"
          rules={[{ max: 20, message: 'ไม่เกิน 20 ตัวอักษร' }]}
        >
          <Input placeholder="เช่น 0105556000001" />
        </Form.Item>

        <Form.Item
          label="ที่อยู่"
          name="address"
        >
          <Input.TextArea rows={3} placeholder="ที่อยู่สำหรับเอกสาร (PO/SO/ใบแจ้งหนี้)" />
        </Form.Item>

        {isEdit && (
          <Form.Item
            label="สถานะ"
            name="is_active"
            valuePropName="checked"
          >
            <Switch checkedChildren="เปิดใช้งาน" unCheckedChildren="ปิดใช้งาน" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
