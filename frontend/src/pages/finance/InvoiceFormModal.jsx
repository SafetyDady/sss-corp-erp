import { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select, InputNumber, Divider, Descriptions, App } from 'antd';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import dayjs from 'dayjs';

export default function InvoiceFormModal({ open, onClose, onSuccess, editData }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [receivedPOs, setReceivedPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);

  useEffect(() => {
    if (open) {
      fetchReceivedPOs();
      if (editData) {
        form.setFieldsValue({
          ...editData,
          invoice_date: editData.invoice_date ? dayjs(editData.invoice_date) : null,
          due_date: editData.due_date ? dayjs(editData.due_date) : null,
        });
      } else {
        form.resetFields();
        setSelectedPO(null);
      }
    }
  }, [open, editData]);

  const fetchReceivedPOs = async () => {
    try {
      const res = await api.get('/api/purchasing/po', { params: { status: 'RECEIVED', limit: 100 } });
      setReceivedPOs(res.data?.items || []);
    } catch {
      // silent
    }
  };

  const handlePOSelect = (poId) => {
    const po = receivedPOs.find((p) => p.id === poId);
    if (po) {
      setSelectedPO(po);
      form.setFieldsValue({
        subtotal_amount: Number(po.subtotal_amount) || 0,
        vat_rate: Number(po.vat_rate) || 0,
        vat_amount: Number(po.vat_amount) || 0,
        total_amount: Number(po.total_amount) || 0,
        wht_rate: Number(po.wht_rate) || 0,
        wht_amount: Number(po.wht_amount) || 0,
        net_payment: Number(po.net_payment) || Number(po.total_amount) || 0,
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        ...values,
        invoice_date: values.invoice_date?.format('YYYY-MM-DD'),
        due_date: values.due_date?.format('YYYY-MM-DD'),
      };

      if (editData) {
        await api.put(`/api/finance/invoices/${editData.id}`, payload);
        message.success('แก้ไขใบวางบิลสำเร็จ');
      } else {
        await api.post('/api/finance/invoices', payload);
        message.success('สร้างใบวางบิลสำเร็จ');
      }
      onSuccess();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editData ? 'แก้ไขใบวางบิล' : 'สร้างใบวางบิล'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {/* PO Picker */}
        {!editData && (
          <Form.Item name="po_id" label="เลือก PO (ที่รับของแล้ว)" rules={[{ required: true, message: 'กรุณาเลือก PO' }]}>
            <Select
              showSearch
              placeholder="ค้นหาเลข PO..."
              optionFilterProp="label"
              onChange={handlePOSelect}
              options={receivedPOs.map((po) => ({
                value: po.id,
                label: `${po.po_number} — ${po.supplier_name || 'N/A'} — ${formatCurrency(po.net_payment || po.total_amount)}`,
              }))}
            />
          </Form.Item>
        )}

        {/* Selected PO info */}
        {selectedPO && (
          <Descriptions size="small" column={2} style={{ marginBottom: 16, background: COLORS.accentMuted, padding: 12, borderRadius: 8 }}>
            <Descriptions.Item label="Supplier">{selectedPO.supplier_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="ยอดรวม PO">{formatCurrency(selectedPO.net_payment || selectedPO.total_amount)}</Descriptions.Item>
          </Descriptions>
        )}

        <Form.Item name="invoice_number" label="เลขใบแจ้งหนี้ (ของ Supplier)" rules={[{ required: true, message: 'กรุณากรอกเลขใบแจ้งหนี้' }]}>
          <Input placeholder="เช่น INV-2026-001" maxLength={50} />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="invoice_date" label="วันที่ใบแจ้งหนี้" rules={[{ required: true }]} style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="due_date" label="ครบกำหนดชำระ" rules={[{ required: true }]} style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Divider orientation="left" plain style={{ fontSize: 13 }}>ยอดเงิน (จาก PO)</Divider>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="subtotal_amount" label="ยอดก่อนภาษี" rules={[{ required: true }]} style={{ flex: 1 }}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="vat_rate" label="VAT %" style={{ flex: 0.5 }}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} />
          </Form.Item>
          <Form.Item name="vat_amount" label="VAT" style={{ flex: 1 }}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="total_amount" label="ยอดรวม (รวม VAT)" rules={[{ required: true }]} style={{ flex: 1 }}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="wht_rate" label="WHT %" style={{ flex: 0.5 }}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} />
          </Form.Item>
          <Form.Item name="wht_amount" label="WHT" style={{ flex: 1 }}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
        </div>

        <Form.Item name="net_payment" label="ยอดชำระสุทธิ (Total - WHT)" rules={[{ required: true }]}>
          <InputNumber
            style={{ width: '100%', fontWeight: 600 }}
            min={0}
            precision={2}
          />
        </Form.Item>

        <Form.Item name="note" label="หมายเหตุ">
          <Input.TextArea rows={2} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
