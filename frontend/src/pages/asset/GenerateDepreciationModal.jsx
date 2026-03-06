import { useState } from 'react';
import { Modal, Select, App, Alert } from 'antd';
import api from '../../services/api';

export default function GenerateDepreciationModal({ open, onClose, onSuccess }) {
  const { message } = App.useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);

  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => ({ label: String(currentYear - i), value: currentYear - i }));
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ label: `เดือน ${i + 1}`, value: i + 1 }));

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/asset/depreciation/generate', { year, month });
      message.success(res.data?.message || 'คำนวณค่าเสื่อมสำเร็จ');
      onSuccess();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="คำนวณค่าเสื่อมรายเดือน"
      open={open}
      onCancel={onClose}
      onOk={handleGenerate}
      confirmLoading={loading}
      okText="คำนวณ"
    >
      <Alert
        type="info"
        message="ระบบจะคำนวณค่าเสื่อมให้สินทรัพย์ที่ ACTIVE ทั้งหมดในเดือนที่เลือก (Straight-Line Method)"
        style={{ marginBottom: 16 }}
        showIcon
      />
      <div style={{ display: 'flex', gap: 12 }}>
        <Select value={year} onChange={setYear} options={yearOptions} style={{ width: 120 }} />
        <Select value={month} onChange={setMonth} options={monthOptions} style={{ width: 160 }} />
      </div>
    </Modal>
  );
}
