import { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select, InputNumber, Divider, Descriptions, App } from 'antd';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import dayjs from 'dayjs';

export default function ARFormModal({ open, onClose, onSuccess, editData }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [approvedSOs, setApprovedSOs] = useState([]);
  const [selectedSO, setSelectedSO] = useState(null);

  useEffect(() => {
    if (open) {
      fetchApprovedSOs();
      if (editData) {
        form.setFieldsValue({
          ...editData,
          invoice_date: editData.invoice_date ? dayjs(editData.invoice_date) : null,
          due_date: editData.due_date ? dayjs(editData.due_date) : null,
        });
      } else {
        form.resetFields();
        setSelectedSO(null);
      }
    }
  }, [open, editData]);

  const fetchApprovedSOs = async () => {
    try {
      const res = await api.get('/api/sales/orders', { params: { status: 'APPROVED', limit: 100 } });
      setApprovedSOs(res.data?.items || []);
    } catch {
      // silent
    }
  };

  const handleSOSelect = (soId) => {
    const so = approvedSOs.find((s) => s.id === soId);
    if (so) {
      setSelectedSO(so);
      form.setFieldsValue({
        subtotal_amount: Number(so.subtotal_amount) || 0,
        vat_rate: Number(so.vat_rate) || 0,
        vat_amount: Number(so.vat_amount) || 0,
        total_amount: Number(so.total_amount) || 0,
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
        // Auto-generate if empty — send null to backend
        invoice_number: values.invoice_number?.trim() || null,
      };

      if (editData) {
        await api.put(`/api/finance/ar/${editData.id}`, payload);
        message.success('แก้ไขใบแจ้งหนี้สำเร็จ');
      } else {
        await api.post('/api/finance/ar', payload);
        message.success('สร้างใบแจ้งหนี้สำเร็จ');
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
      title={editData ? 'แก้ไขใบแจ้งหนี้ลูกค้า' : 'สร้างใบแจ้งหนี้ลูกค้า'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {/* SO Picker */}
        {!editData && (
          <Form.Item name="so_id" label="เลือก SO (ที่อนุมัติแล้ว)" rules={[{ required: true, message: 'กรุณาเลือก SO' }]}>
            <Select
              showSearch
              placeholder="ค้นหาเลข SO..."
              optionFilterProp="label"
              onChange={handleSOSelect}
              options={approvedSOs.map((so) => ({
                value: so.id,
                label: `${so.so_number} — ${so.customer_name || 'N/A'} — ${formatCurrency(so.total_amount)}`,
              }))}
            />
          </Form.Item>
        )}

        {/* Selected SO info */}
        {selectedSO && (
          <Descriptions size="small" column={2} style={{ marginBottom: 16, background: COLORS.accentMuted, padding: 12, borderRadius: 8 }}>
            <Descriptions.Item label="ลูกค้า">{selectedSO.customer_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="ยอดรวม SO">{formatCurrency(selectedSO.total_amount)}</Descriptions.Item>
          </Descriptions>
        )}

        <Form.Item name="invoice_number" label="เลขใบแจ้งหนี้">
          <Input placeholder="ระบบสร้างอัตโนมัติ (INV-AR-{ปี}-{ลำดับ}) หรือกรอกเอง" maxLength={50} allowClear />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="invoice_date" label="วันที่ใบแจ้งหนี้" rules={[{ required: true }]} style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="due_date" label="ครบกำหนดชำระ" rules={[{ required: true }]} style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Divider orientation="left" plain style={{ fontSize: 13 }}>ยอดเงิน (จาก SO)</Divider>

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

        <Form.Item name="total_amount" label="ยอดรวม (ลูกค้าต้องจ่าย)" rules={[{ required: true }]}>
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
