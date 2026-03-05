import { useEffect, useState } from 'react';
import { Modal, Form, DatePicker, InputNumber, App, Alert } from 'antd';
import api from '../../services/api';
import SearchSelect from '../../components/SearchSelect';

const { RangePicker } = DatePicker;

export default function ReservationFormModal({ open, type, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const isMaterial = type === 'material';

  useEffect(() => {
    if (open) {
      form.resetFields();
      setSubmitError('');
    }
  }, [open, type]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isMaterial) {
        const payload = {
          work_order_id: values.work_order_id,
          product_id: values.product_id,
          quantity: values.quantity,
          reserved_date: values.reserved_date.format('YYYY-MM-DD'),
        };
        await api.post('/api/planning/reservations/material', payload);
        message.success('จองวัสดุสำเร็จ');
      } else {
        const payload = {
          work_order_id: values.work_order_id,
          tool_id: values.tool_id,
          start_date: values.date_range[0].format('YYYY-MM-DD'),
          end_date: values.date_range[1].format('YYYY-MM-DD'),
        };
        await api.post('/api/planning/reservations/tool', payload);
        message.success('จองเครื่องมือสำเร็จ');
      }
      onSuccess();
    } catch (err) {
      if (err.response) {
        const errMsg = err.response?.data?.detail || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
        setSubmitError(errMsg);
        message.error(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isMaterial ? 'จองวัสดุ' : 'จองเครื่องมือ'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="จอง"
      cancelText="ยกเลิก"
      width={520}
      destroyOnHidden
    >
      {submitError && (
        <Alert type="error" showIcon message={submitError} closable onClose={() => setSubmitError('')} style={{ marginBottom: 12 }} />
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          name="work_order_id"
          label="Work Order (เฉพาะ OPEN)"
          rules={[{ required: true, message: 'กรุณาเลือก Work Order' }]}
        >
          <SearchSelect
            apiUrl="/api/work-orders"
            labelRender={(item) => `${item.wo_number} — ${item.description || ''}`}
            extraParams={{ status: 'OPEN' }}
            placeholder="เลือก Work Order"
          />
        </Form.Item>

        {isMaterial ? (
          <>
            <Form.Item
              name="product_id"
              label="สินค้า"
              rules={[{ required: true, message: 'กรุณาเลือกสินค้า' }]}
            >
              <SearchSelect
                apiUrl="/api/inventory/products"
                labelRender={(item) => `${item.sku} — ${item.name}`}
                placeholder="เลือกสินค้า"
              />
            </Form.Item>

            <Form.Item
              name="quantity"
              label="จำนวน"
              rules={[{ required: true, message: 'กรุณากรอกจำนวน' }]}
            >
              <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="จำนวนที่ต้องการจอง" />
            </Form.Item>

            <Form.Item
              name="reserved_date"
              label="วันที่จอง"
              rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}
            >
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item
              name="tool_id"
              label="เครื่องมือ"
              rules={[{ required: true, message: 'กรุณาเลือกเครื่องมือ' }]}
            >
              <SearchSelect
                apiUrl="/api/tools"
                labelRender={(item) => `${item.code} — ${item.name}`}
                placeholder="เลือกเครื่องมือ"
              />
            </Form.Item>

            <Form.Item
              name="date_range"
              label="วันเริ่ม - วันสิ้นสุด"
              rules={[{ required: true, message: 'กรุณาเลือกช่วงวันที่' }]}
            >
              <RangePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder={['วันเริ่ม', 'วันสิ้นสุด']}
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
