import { useState, useEffect } from 'react';
import { Modal, Table, InputNumber, Input, App } from 'antd';
import api from '../../services/api';
import { getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

/**
 * TransferRequestExecuteModal — Execute a PENDING transfer request
 * Per-line transferred_qty input (default = requested qty)
 * Creates TRANSFER movements on submit
 */
export default function TransferRequestExecuteModal({ open, tf, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [transferredQtys, setTransferredQtys] = useState({});
  const [executeNote, setExecuteNote] = useState('');
  const { message } = App.useApp();

  // Reset state when modal opens with new tf
  useEffect(() => {
    if (!open || !tf) return;
    const defaultQtys = {};
    (tf.lines || []).forEach((line) => {
      defaultQtys[line.id] = line.quantity;
    });
    setTransferredQtys(defaultQtys);
    setExecuteNote('');
  }, [open, tf?.id]);

  const handleSubmit = async () => {
    const lines = (tf?.lines || []).map((line) => ({
      line_id: line.id,
      transferred_qty: transferredQtys[line.id] ?? line.quantity,
    }));

    const hasQty = lines.some((l) => l.transferred_qty > 0);
    if (!hasQty) {
      message.error('กรุณาระบุจำนวนโอนย้ายอย่างน้อย 1 รายการ');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/api/inventory/transfer-requests/${tf.id}/execute`, {
        lines,
        note: executeNote || undefined,
      });
      message.success('ดำเนินการโอนย้ายสินค้าสำเร็จ');
      onSuccess();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'สินค้า', key: 'product', ellipsis: true,
      render: (_, record) => (
        <div>
          <span style={{ fontFamily: 'monospace', color: COLORS.accent, fontSize: 12 }}>
            {record.product_sku || '-'}
          </span>
          {record.product_name && (
            <span style={{ color: COLORS.text, marginLeft: 8 }}>{record.product_name}</span>
          )}
        </div>
      ),
    },
    {
      title: 'หน่วย', key: 'unit', width: 80,
      render: (_, record) => record.product_unit || '-',
    },
    {
      title: 'จำนวนขอ', dataIndex: 'quantity', key: 'quantity', width: 90, align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'จำนวนโอน', key: 'transferred_qty', width: 120,
      render: (_, record) => (
        <InputNumber
          min={0}
          max={record.quantity}
          value={transferredQtys[record.id] ?? record.quantity}
          onChange={(val) => setTransferredQtys((prev) => ({ ...prev, [record.id]: val }))}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
  ];

  return (
    <Modal
      title="ดำเนินการโอนย้ายสินค้า / Execute Transfer"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={700}
      okText="ยืนยันโอนย้าย"
      okButtonProps={{ style: { background: COLORS.success } }}
      destroyOnHidden
    >
      <div style={{ marginBottom: 12 }}>
        <span style={{ color: COLORS.textSecondary, fontSize: 13 }}>
          ต้นทาง: <strong style={{ color: COLORS.text }}>{tf?.source_warehouse_name}</strong>
          {tf?.source_location_name && ` (${tf.source_location_name})`}
        </span>
        <span style={{ color: COLORS.textMuted, margin: '0 12px' }}>&rarr;</span>
        <span style={{ color: COLORS.textSecondary, fontSize: 13 }}>
          ปลายทาง: <strong style={{ color: COLORS.accent }}>{tf?.dest_warehouse_name}</strong>
          {tf?.dest_location_name && ` (${tf.dest_location_name})`}
        </span>
      </div>

      <p style={{ color: COLORS.textSecondary, marginBottom: 16, fontSize: 13 }}>
        ตรวจสอบจำนวนที่ต้องการโอนย้ายแต่ละรายการ ระบบจะสร้าง Movement ให้อัตโนมัติ
      </p>

      <Table
        dataSource={tf?.lines || []}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
        style={{ marginBottom: 16 }}
      />

      <div>
        <label style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4, display: 'block' }}>
          หมายเหตุการโอนย้าย
        </label>
        <Input.TextArea
          rows={2}
          value={executeNote}
          onChange={(e) => setExecuteNote(e.target.value)}
          placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
          maxLength={500}
        />
      </div>
    </Modal>
  );
}
