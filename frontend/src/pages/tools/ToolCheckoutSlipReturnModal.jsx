import { useState, useEffect, useMemo } from 'react';
import { Modal, Table, Checkbox, Input, App } from 'antd';
import api from '../../services/api';
import { getApiErrorMsg, formatCurrency, formatDateTime } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function ToolCheckoutSlipReturnModal({ open, slip, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [selectedLineIds, setSelectedLineIds] = useState([]);
  const [returnNote, setReturnNote] = useState('');
  const { message } = App.useApp();

  // Only show unreturned lines
  const unreturnedLines = useMemo(() => {
    if (!slip?.lines) return [];
    return slip.lines.filter((l) => !l.is_returned);
  }, [slip?.lines]);

  // Reset when modal opens
  useEffect(() => {
    if (!open || !slip) return;
    // Select all unreturned lines by default
    setSelectedLineIds(unreturnedLines.map((l) => l.id));
    setReturnNote('');
  }, [open, slip?.id]);

  const handleToggle = (lineId) => {
    setSelectedLineIds((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId]
    );
  };

  const handleToggleAll = (checked) => {
    if (checked) {
      setSelectedLineIds(unreturnedLines.map((l) => l.id));
    } else {
      setSelectedLineIds([]);
    }
  };

  const handleSubmit = async () => {
    if (selectedLineIds.length === 0) {
      message.error('กรุณาเลือกอย่างน้อย 1 รายการ');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/api/tools/checkout-slips/${slip.id}/return`, {
        lines: selectedLineIds.map((line_id) => ({ line_id })),
        note: returnNote || undefined,
      });
      message.success('คืนเครื่องมือสำเร็จ');
      onSuccess();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  const allSelected = unreturnedLines.length > 0 && selectedLineIds.length === unreturnedLines.length;

  const columns = [
    {
      title: (
        <Checkbox
          checked={allSelected}
          indeterminate={selectedLineIds.length > 0 && !allSelected}
          onChange={(e) => handleToggleAll(e.target.checked)}
        />
      ),
      width: 50,
      align: 'center',
      render: (_, record) => (
        <Checkbox
          checked={selectedLineIds.includes(record.id)}
          onChange={() => handleToggle(record.id)}
        />
      ),
    },
    {
      title: '#', dataIndex: 'line_number', width: 50, align: 'center',
    },
    {
      title: 'เครื่องมือ', key: 'tool', ellipsis: true,
      render: (_, record) => (
        <div>
          <span style={{ fontFamily: 'monospace', color: COLORS.accent, fontSize: 12 }}>
            {record.tool_code || '-'}
          </span>
          {record.tool_name && (
            <span style={{ color: COLORS.text, marginLeft: 8 }}>{record.tool_name}</span>
          )}
        </div>
      ),
    },
    {
      title: 'ผู้ใช้', key: 'employee', width: 150,
      render: (_, record) => record.employee_name || '-',
    },
    {
      title: 'อัตรา/ชม.', key: 'rate', width: 100, align: 'right',
      render: (_, record) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {record.rate_per_hour ? formatCurrency(record.rate_per_hour) : '-'}
        </span>
      ),
    },
    {
      title: 'เบิกเมื่อ', key: 'checkout_at', width: 150,
      render: (_, record) => (
        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
          {record.created_at ? formatDateTime(record.created_at) : '-'}
        </span>
      ),
    },
  ];

  return (
    <Modal
      title="คืนเครื่องมือ / Return Tools"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={800}
      okText="ยืนยันคืนเครื่องมือ"
      okButtonProps={{ style: { background: COLORS.accent }, disabled: unreturnedLines.length === 0 }}
      destroyOnHidden
    >
      <p style={{ color: COLORS.textSecondary, marginBottom: 16, fontSize: 13 }}>
        เลือกเครื่องมือที่ต้องการคืน — ระบบจะคำนวณค่าใช้จ่ายอัตโนมัติ (ชั่วโมง × อัตรา/ชม.)
      </p>

      {unreturnedLines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: COLORS.textMuted }}>
          คืนเครื่องมือครบแล้ว
        </div>
      ) : (
        <>
          <Table
            dataSource={unreturnedLines}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8, color: COLORS.textSecondary, fontSize: 12 }}>
            เลือก {selectedLineIds.length} / {unreturnedLines.length} รายการ
          </div>
        </>
      )}

      {/* Return note */}
      <div>
        <label style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4, display: 'block' }}>
          หมายเหตุการคืน
        </label>
        <Input.TextArea
          rows={2}
          value={returnNote}
          onChange={(e) => setReturnNote(e.target.value)}
          placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
          maxLength={500}
        />
      </div>
    </Modal>
  );
}
