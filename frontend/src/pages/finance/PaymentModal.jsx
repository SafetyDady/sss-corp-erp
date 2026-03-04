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

export default function PaymentModal({ open, onClose, onSuccess, invoice }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const remaining = invoice ? Number(invoice.net_payment) - Number(invoice.paid_amount) : 0;
  const whtRate = invoice ? Number(invoice.wht_rate) : 0;

  useEffect(() => {
    if (open && invoice) {
      const suggestedWht = whtRate > 0
        ? Math.round((remaining / (1 + (Number(invoice.vat_rate) / 100))) * (whtRate / 100) * 100) / 100
        : 0;
      form.setFieldsValue({
        payment_date: dayjs(),
        amount: remaining > 0 ? remaining : 0,
        wht_deducted: suggestedWht,
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
      await api.post(`/api/finance/invoices/${invoice.id}/pay`, {
        ...values,
        payment_date: values.payment_date.format('YYYY-MM-DD'),
      });
      message.success('บันทึกการจ่ายเงินสำเร็จ');
      onSuccess();
    } catch (err) {
      if (err.response?.data?.detail) {
        message.error(err.response.data.detail);
      } else if (!err.errorFields) {
        message.error('บันทึกการจ่ายเงินล้มเหลว');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="บันทึกการจ่ายเงิน"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="บันทึก"
      cancelText="ยกเลิก"
      confirmLoading={loading}
      destroyOnHidden
      width={560}
    >
      {invoice && (
        <>
          {/* Invoice Summary */}
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 20 }}>
            <Descriptions.Item label="เลขใบแจ้งหนี้">{invoice.invoice_number}</Descriptions.Item>
            <Descriptions.Item label="Supplier">{invoice.supplier_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="ยอดชำระสุทธิ">
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(invoice.net_payment)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="จ่ายแล้ว">
              <span style={{ fontFamily: 'monospace', color: COLORS.success }}>{formatCurrency(invoice.paid_amount)}</span>
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
              label="วันที่จ่ายเงิน"
              rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}
            >
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item
              name="amount"
              label="ยอดจ่าย (บาท)"
              rules={[
                { required: true, message: 'กรุณากรอกยอดจ่าย' },
                { type: 'number', min: 0.01, message: 'ยอดจ่ายต้องมากกว่า 0' },
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
              name="wht_deducted"
              label={`หัก ณ ที่จ่าย (WHT ${whtRate}%)`}
              rules={[{ type: 'number', min: 0, message: 'ยอด WHT ต้อง >= 0' }]}
              extra={whtRate > 0 ? `อัตรา WHT: ${whtRate}%` : 'ไม่มี WHT'}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={0.01}
                precision={2}
                formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                parser={(v) => v.replace(/,/g, '')}
              />
            </Form.Item>

            <Form.Item
              name="payment_method"
              label="วิธีจ่ายเงิน"
              rules={[{ required: true, message: 'กรุณาเลือกวิธีจ่ายเงิน' }]}
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
