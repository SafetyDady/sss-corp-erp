import { useState, useEffect, useMemo } from 'react';
import { Modal, Table, Checkbox, Input, App } from 'antd';
import api from '../../services/api';
import { getApiErrorMsg, formatCurrency } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function ToolCheckoutSlipIssueModal({ open, slip, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [selectedLineIds, setSelectedLineIds] = useState([]);
  const [issueNote, setIssueNote] = useState('');
  const { message } = App.useApp();

  // Filter out already-issued lines (those with a checkout_id)
  const unissuedLines = useMemo(() => {
    if (!slip?.lines) return [];
    return slip.lines.filter((l) => !l.checkout_id);
  }, [slip?.lines]);

  // Reset when modal opens
  useEffect(() => {
    if (!open || !slip) return;
    // Select all un-issued lines by default
    setSelectedLineIds(unissuedLines.map((l) => l.id));
    setIssueNote('');
  }, [open, slip?.id, unissuedLines]);

  const handleToggle = (lineId) => {
    setSelectedLineIds((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId]
    );
  };

  const handleToggleAll = (checked) => {
    if (checked) {
      setSelectedLineIds(unissuedLines.map((l) => l.id));
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
      await api.post(`/api/tools/checkout-slips/${slip.id}/issue`, {
        lines: selectedLineIds.map((line_id) => ({ line_id })),
        note: issueNote || undefined,
      });
      message.success('จ่ายเครื่องมือสำเร็จ');
      onSuccess();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  const allSelected = unissuedLines.length > 0 && selectedLineIds.length === unissuedLines.length;

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
      title: 'ผู้ใช้', key: 'employee', width: 160,
      render: (_, record) => record.employee_name || '-',
    },
    {
      title: 'อัตรา/ชม.', key: 'rate', width: 120, align: 'right',
      render: (_, record) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {record.rate_per_hour ? formatCurrency(record.rate_per_hour) : '-'}
        </span>
      ),
    },
  ];

  return (
    <Modal
      title="จ่ายเครื่องมือ / Issue Tools"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={750}
      okText="ยืนยันจ่ายเครื่องมือ"
      okButtonProps={{
        style: { background: COLORS.success },
        disabled: unissuedLines.length === 0,
      }}
      destroyOnHidden
    >
      {unissuedLines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: COLORS.textSecondary }}>
          จ่ายเครื่องมือครบแล้ว
        </div>
      ) : (
        <>
          <p style={{ color: COLORS.textSecondary, marginBottom: 16, fontSize: 13 }}>
            เลือกรายการเครื่องมือที่ต้องการจ่าย — เครื่องมือจะถูก checkout ให้พนักงานที่ระบุ
          </p>

          <Table
            dataSource={unissuedLines}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8, color: COLORS.textSecondary, fontSize: 12 }}>
            เลือก {selectedLineIds.length} / {unissuedLines.length} รายการ
          </div>

          {/* Issue note */}
          <div>
            <label style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4, display: 'block' }}>
              หมายเหตุการจ่าย
            </label>
            <Input.TextArea
              rows={2}
              value={issueNote}
              onChange={(e) => setIssueNote(e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
              maxLength={500}
            />
          </div>
        </>
      )}
    </Modal>
  );
}
