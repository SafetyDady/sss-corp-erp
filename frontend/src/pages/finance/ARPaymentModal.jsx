import { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Select, Input, DatePicker, Descriptions, App } from 'antd';
import dayjs from 'dayjs';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const PAYMENT_METHODS = [
  { value: 'TRANSFER', label: 'โอนเงิน (Transfer)' },
  { value: 'CHEQUE', label: 'เช็ค (Cheque)' },
  { value: 'CASH', label: 'เงินสด (Cash)' },
];

export default function ARPaymentModal({ open, onClose, onSuccess, invoice }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const remaining = invoice ? Number(invoice.total_amount) - Number(invoice.received_amount) : 0;

  useEffect(() => {
    if (open && invoice) {
      form.setFieldsValue({
        payment_date: dayjs(),
        amount: remaining > 0 ? remaining : 0,
        payment_method: 'TRANSFER',
        reference: '',
        note: '',
      });
    }
  }, [open, invoice]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await api.post(`/api/finance/ar/${invoice.id}/receive`, {
        ...values,
        payment_date: values.payment_date.format('YYYY-MM-DD'),
      });
      message.success('บันทึกการรับเงินสำเร็จ');
      onSuccess();
    } catch (err) {
      if (err.response?.data?.detail) {
        message.error(err.response.data.detail);
      } else if (!err.errorFields) {
        message.error('บันทึกการรับเงินล้มเหลว');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="บันทึกการรับเงิน"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="บันทึก"
      cancelText="ยกเลิก"
      confirmLoading={loading}
      destroyOnHidden
      width={520}
    >
      {invoice && (
        <>
          {/* Invoice Summary */}
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 20 }}>
            <Descriptions.Item label="เลขใบแจ้งหนี้">{invoice.invoice_number}</Descriptions.Item>
            <Descriptions.Item label="ลูกค้า">{invoice.customer_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="ยอดรวม">
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(invoice.total_amount)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="รับแล้ว">
              <span style={{ fontFamily: 'monospace', color: COLORS.success }}>{formatCurrency(invoice.received_amount)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="คงเหลือ" span={2}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: remaining > 0 ? COLORS.danger : COLORS.success, fontSize: 16 }}>
                {formatCurrency(remaining > 0 ? remaining : 0)}
              </span>
            </Descriptions.Item>
          </Descriptions>

          <Form form={form} layout="vertical" size="middle">
            <Form.Item
              name="payment_date"
              label="วันที่รับเงิน"
              rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}
            >
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item
              name="amount"
              label="ยอดรับ (บาท)"
              rules={[
                { required: true, message: 'กรุณากรอกยอดรับ' },
                { type: 'number', min: 0.01, message: 'ยอดรับต้องมากกว่า 0' },
              ]}
              extra={remaining > 0 ? `ยอดคงเหลือ: ${formatCurrency(remaining)}` : null}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0.01}
                max={remaining > 0 ? remaining : undefined}
                step={0.01}
                precision={2}
                formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                parser={(v) => v.replace(/,/g, '')}
              />
            </Form.Item>

            <Form.Item
              name="payment_method"
              label="วิธีรับเงิน"
              rules={[{ required: true, message: 'กรุณาเลือกวิธีรับเงิน' }]}
            >
              <Select options={PAYMENT_METHODS} />
            </Form.Item>

            <Form.Item name="reference" label="เลขอ้างอิง (Ref / เช็ค)">
              <Input placeholder="เลขอ้างอิงธนาคาร / เลขเช็ค" />
            </Form.Item>

            <Form.Item name="note" label="หมายเหตุ">
              <Input.TextArea rows={2} placeholder="หมายเหตุ (ถ้ามี)" />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
}
