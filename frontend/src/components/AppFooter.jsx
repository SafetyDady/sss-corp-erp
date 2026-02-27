/**
 * AppFooter — SSS Corp ERP
 * Design: Dark theme, COLORS tokens, Lucide icons, Thai-English mixed
 * Two modes: full (main layout) and compact (login page)
 */
import { useState } from 'react';
import { Typography, Modal } from 'antd';
import { Shield, FileText, Headphones } from 'lucide-react';
import { COLORS } from '../utils/constants';

const { Text, Paragraph, Title } = Typography;

const APP_VERSION = 'v1.0.0';
const COMPANY_NAME = 'SSS Intelligence & Solutions Co., Ltd.';

/* ---- placeholder modal content ---- */
const MODAL_CONTENT = {
  privacy: {
    title: 'นโยบายความเป็นส่วนตัว',
    icon: <Shield size={18} style={{ color: COLORS.accent, marginRight: 8, verticalAlign: 'middle' }} />,
    body: (
      <>
        <Paragraph style={{ color: COLORS.textSecondary, fontSize: 13 }}>
          บริษัท {COMPANY_NAME} ให้ความสำคัญกับการปกป้องข้อมูลส่วนบุคคลของผู้ใช้งาน
          ระบบ ERP นี้จัดเก็บเฉพาะข้อมูลที่จำเป็นต่อการดำเนินงานเท่านั้น
        </Paragraph>
        <Paragraph style={{ color: COLORS.textMuted, fontSize: 12 }}>
          เอกสารฉบับเต็มอยู่ระหว่างจัดทำ — กรุณาติดต่อ IT Support หากมีข้อสงสัย
        </Paragraph>
      </>
    ),
  },
  terms: {
    title: 'เงื่อนไขการใช้งาน',
    icon: <FileText size={18} style={{ color: COLORS.accent, marginRight: 8, verticalAlign: 'middle' }} />,
    body: (
      <>
        <Paragraph style={{ color: COLORS.textSecondary, fontSize: 13 }}>
          ระบบ SSS Corp ERP สงวนไว้สำหรับพนักงานและบุคลากรที่ได้รับอนุญาตเท่านั้น
          การเข้าถึงโดยไม่ได้รับอนุญาตถือเป็นการละเมิดนโยบายบริษัท
        </Paragraph>
        <Paragraph style={{ color: COLORS.textMuted, fontSize: 12 }}>
          เอกสารฉบับเต็มอยู่ระหว่างจัดทำ — กรุณาติดต่อ IT Support หากมีข้อสงสัย
        </Paragraph>
      </>
    ),
  },
  support: {
    title: 'ติดต่อ IT Support',
    icon: <Headphones size={18} style={{ color: COLORS.accent, marginRight: 8, verticalAlign: 'middle' }} />,
    body: (
      <>
        <Paragraph style={{ color: COLORS.textSecondary, fontSize: 13 }}>
          <strong style={{ color: COLORS.text }}>Email:</strong> it-support@sss-corp.com
        </Paragraph>
        <Paragraph style={{ color: COLORS.textSecondary, fontSize: 13 }}>
          <strong style={{ color: COLORS.text }}>โทรศัพท์:</strong> 02-XXX-XXXX ต่อ 9999
        </Paragraph>
        <Paragraph style={{ color: COLORS.textSecondary, fontSize: 13 }}>
          <strong style={{ color: COLORS.text }}>เวลาทำการ:</strong> จันทร์ - ศุกร์ 08:00 - 17:00 น.
        </Paragraph>
        <Paragraph style={{ color: COLORS.textMuted, fontSize: 12 }}>
          สำหรับปัญหาเร่งด่วนนอกเวลาทำการ กรุณาติดต่อหัวหน้าแผนก IT โดยตรง
        </Paragraph>
      </>
    ),
  },
};

/* ---- reusable link style ---- */
function FooterLink({ icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: hovered ? COLORS.accent : COLORS.textMuted,
        fontSize: 11,
        cursor: 'pointer',
        transition: 'color 0.2s ease',
        userSelect: 'none',
      }}
    >
      {icon}
      {label}
    </span>
  );
}

export default function AppFooter({ compact = false }) {
  const [modal, setModal] = useState(null);
  const year = new Date().getFullYear();

  const openModal = (key) => setModal(key);
  const closeModal = () => setModal(null);

  const currentModal = modal ? MODAL_CONTENT[modal] : null;

  /* ---- Compact mode for Login page ---- */
  if (compact) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px 16px' }}>
        <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
          SSS Corp ERP {APP_VERSION} &nbsp;&copy; {year} {COMPANY_NAME}
        </Text>
      </div>
    );
  }

  /* ---- Full mode for main layout ---- */
  return (
    <>
      <footer
        style={{
          textAlign: 'center',
          padding: '14px 24px',
          borderTop: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          flexShrink: 0,
        }}
      >
        {/* Line 1: version + copyright */}
        <div style={{ marginBottom: 6 }}>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
            SSS Corp ERP {APP_VERSION} &nbsp;&copy; {year} {COMPANY_NAME} สงวนลิขสิทธิ์
          </Text>
        </div>

        {/* Line 2: links */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <FooterLink
            icon={<Shield size={12} />}
            label="นโยบายความเป็นส่วนตัว"
            onClick={() => openModal('privacy')}
          />
          <Text style={{ color: COLORS.border, fontSize: 11, lineHeight: 1 }}>|</Text>
          <FooterLink
            icon={<FileText size={12} />}
            label="เงื่อนไขการใช้งาน"
            onClick={() => openModal('terms')}
          />
          <Text style={{ color: COLORS.border, fontSize: 11, lineHeight: 1 }}>|</Text>
          <FooterLink
            icon={<Headphones size={12} />}
            label="ติดต่อ IT Support"
            onClick={() => openModal('support')}
          />
        </div>
      </footer>

      {/* Shared modal */}
      <Modal
        open={!!modal}
        onCancel={closeModal}
        footer={null}
        centered
        width={480}
        styles={{
          content: { background: COLORS.card, border: `1px solid ${COLORS.border}` },
          header: { background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` },
        }}
      >
        {currentModal && (
          <div style={{ padding: '8px 0' }}>
            <Title level={5} style={{ color: COLORS.text, marginBottom: 16 }}>
              {currentModal.icon}
              {currentModal.title}
            </Title>
            {currentModal.body}
          </div>
        )}
      </Modal>
    </>
  );
}
