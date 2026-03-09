import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Button, List, Typography, Empty } from 'antd';
import {
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle,
  CalendarCheck, CalendarOff, Clock, FileCheck, Package, Info,
} from 'lucide-react';
import useNotificationStore from '../stores/notificationStore';
import { COLORS } from '../utils/constants';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/th';

dayjs.extend(relativeTime);
dayjs.locale('th');

const { Text } = Typography;

// ── Type → Icon mapping ──
const TYPE_ICONS = {
  APPROVAL_REQUEST: ClipboardCheck,
  DOCUMENT_APPROVED: CheckCircle,
  DOCUMENT_REJECTED: XCircle,
  LOW_STOCK_ALERT: AlertTriangle,
  LEAVE_APPROVED: CalendarCheck,
  LEAVE_REJECTED: CalendarOff,
  TIMESHEET_APPROVED: Clock,
  TIMESHEET_FINAL: FileCheck,
  PO_RECEIVED: Package,
  SYSTEM: Info,
};

// ── Type → Color mapping ──
const TYPE_COLORS = {
  APPROVAL_REQUEST: COLORS.accent,
  DOCUMENT_APPROVED: COLORS.success,
  DOCUMENT_REJECTED: COLORS.danger,
  LOW_STOCK_ALERT: COLORS.warning,
  LEAVE_APPROVED: COLORS.success,
  LEAVE_REJECTED: COLORS.danger,
  TIMESHEET_APPROVED: COLORS.accent,
  TIMESHEET_FINAL: COLORS.purple,
  PO_RECEIVED: COLORS.success,
  SYSTEM: COLORS.textSecondary,
};

export default function NotificationDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const {
    notifications, total, unreadCount, isLoading,
    fetchNotifications, markAsRead, markAllAsRead,
  } = useNotificationStore();
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (open) {
      setOffset(0);
      fetchNotifications({ limit: PAGE_SIZE, offset: 0 });
    }
  }, [open]);

  const handleClick = async (notif) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
      onClose();
    }
  };

  const handleLoadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchNotifications({ limit: PAGE_SIZE, offset: newOffset });
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>การแจ้งเตือน {unreadCount > 0 && `(${unreadCount})`}</span>
          {unreadCount > 0 && (
            <Button type="link" size="small" onClick={handleMarkAllRead}>
              อ่านทั้งหมด
            </Button>
          )}
        </div>
      }
      placement="right"
      width={400}
      open={open}
      onClose={onClose}
      styles={{
        header: { borderBottom: `1px solid ${COLORS.border}` },
        body: { padding: 0 },
      }}
    >
      {notifications.length === 0 && !isLoading ? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Empty description="ไม่มีการแจ้งเตือน" />
        </div>
      ) : (
        <List
          loading={isLoading}
          dataSource={notifications}
          renderItem={(notif) => {
            const Icon = TYPE_ICONS[notif.notification_type] || Info;
            const color = TYPE_COLORS[notif.notification_type] || COLORS.textSecondary;

            return (
              <List.Item
                onClick={() => handleClick(notif)}
                style={{
                  padding: '12px 16px',
                  cursor: notif.link ? 'pointer' : 'default',
                  background: notif.is_read ? 'transparent' : `${COLORS.accent}08`,
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                <div style={{ display: 'flex', gap: 12, width: '100%', alignItems: 'flex-start' }}>
                  <div style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: `${color}18`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      strong={!notif.is_read}
                      style={{
                        fontSize: 13,
                        color: notif.is_read ? COLORS.textSecondary : COLORS.text,
                        display: 'block',
                      }}
                    >
                      {notif.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: COLORS.textMuted,
                        display: 'block',
                        marginTop: 2,
                      }}
                      ellipsis={{ rows: 2 }}
                    >
                      {notif.message}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: COLORS.textMuted,
                        display: 'block',
                        marginTop: 4,
                      }}
                    >
                      {dayjs(notif.created_at).fromNow()}
                    </Text>
                  </div>
                  {!notif.is_read && (
                    <div style={{
                      flexShrink: 0,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: COLORS.accent,
                      marginTop: 6,
                    }} />
                  )}
                </div>
              </List.Item>
            );
          }}
        />
      )}
      {notifications.length < total && (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Button type="link" onClick={handleLoadMore} loading={isLoading}>
            โหลดเพิ่ม
          </Button>
        </div>
      )}
    </Drawer>
  );
}
