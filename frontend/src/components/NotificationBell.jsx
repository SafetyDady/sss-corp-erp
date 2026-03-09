import { Badge, Button, Tooltip } from 'antd';
import { Bell } from 'lucide-react';
import useNotificationStore from '../stores/notificationStore';
import { COLORS } from '../utils/constants';

export default function NotificationBell({ onClick }) {
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <Tooltip title="การแจ้งเตือน">
      <Badge
        count={unreadCount}
        size="small"
        offset={[-2, 4]}
        style={{
          backgroundColor: COLORS.accent,
          fontSize: 10,
          height: 16,
          minWidth: 16,
          lineHeight: '16px',
          padding: '0 4px',
        }}
      >
        <Button
          type="text"
          size="small"
          icon={<Bell size={16} />}
          onClick={onClick}
          style={{ color: COLORS.textSecondary }}
        />
      </Badge>
    </Tooltip>
  );
}
