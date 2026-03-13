/**
 * CopyRoleModal — Copy permissions from one role to another
 *
 * Creates pending changes (doesn't save immediately).
 * User can review the diff before saving.
 */

import { useState } from 'react';
import { Modal, Select, App } from 'antd';
import { Copy } from 'lucide-react';
import { COLORS } from '../../utils/constants';

const ROLES = ['manager', 'supervisor', 'staff', 'viewer'];
const ROLE_LABELS = {
  manager: 'Manager', supervisor: 'Supervisor', staff: 'Staff', viewer: 'Viewer',
};

export default function CopyRoleModal({ open, onClose, onCopy }) {
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const { message } = App.useApp();

  const handleOk = () => {
    if (!source || !target) {
      message.warning('กรุณาเลือก role ต้นทางและปลายทาง');
      return;
    }
    if (source === target) {
      message.warning('ต้นทางและปลายทางต้องไม่เหมือนกัน');
      return;
    }
    onCopy(source, target);
    setSource(null);
    setTarget(null);
    onClose();
  };

  const handleCancel = () => {
    setSource(null);
    setTarget(null);
    onClose();
  };

  const roleOptions = ROLES.map((r) => ({
    value: r,
    label: ROLE_LABELS[r],
  }));

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Copy size={16} color={COLORS.accent} />
          คัดลอกสิทธิ์
        </span>
      }
      okText="คัดลอก"
      cancelText="ยกเลิก"
      width={420}
      okButtonProps={{ disabled: !source || !target || source === target }}
    >
      <div style={{ padding: '12px 0' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12,
            color: COLORS.textSecondary,
            marginBottom: 6,
          }}>
            คัดลอกจาก (ต้นทาง)
          </div>
          <Select
            value={source}
            onChange={setSource}
            options={roleOptions}
            placeholder="เลือก role ต้นทาง"
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{
            fontSize: 12,
            color: COLORS.textSecondary,
            marginBottom: 6,
          }}>
            ไปยัง (ปลายทาง)
          </div>
          <Select
            value={target}
            onChange={setTarget}
            options={roleOptions.filter((r) => r.value !== source)}
            placeholder="เลือก role ปลายทาง"
            style={{ width: '100%' }}
          />
        </div>
        <div style={{
          fontSize: 11,
          color: COLORS.textMuted,
          marginTop: 12,
          padding: '8px 10px',
          background: COLORS.surface,
          borderRadius: 6,
          border: `1px solid ${COLORS.borderLight}`,
        }}>
          สิทธิ์จะถูกคัดลอกเป็น "การเปลี่ยนแปลงที่รอบันทึก" — คุณสามารถตรวจสอบและแก้ไขก่อนบันทึกจริง
        </div>
      </div>
    </Modal>
  );
}
