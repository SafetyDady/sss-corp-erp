import { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Button, Tag, App, Popconfirm, Spin, Space, Tooltip } from 'antd';
import { Monitor, Smartphone, Globe, LogOut, Trash2, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/th';

dayjs.extend(relativeTime);
dayjs.locale('th');

const { Title, Text } = Typography;

function getDeviceIcon(deviceName) {
  if (!deviceName) return <Globe size={20} />;
  const lower = deviceName.toLowerCase();
  if (lower.includes('iphone') || lower.includes('android') || lower.includes('mobile'))
    return <Smartphone size={20} />;
  return <Monitor size={20} />;
}

export default function SessionsSection() {
  const { message } = App.useApp();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/auth/sessions');
      setSessions(data.items || []);
    } catch {
      // silently fail — sessions may not be available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleRevoke = async (sessionId) => {
    setRevoking(sessionId);
    try {
      await api.delete(`/api/auth/sessions/${sessionId}`);
      message.success('ออกจากระบบอุปกรณ์นั้นแล้ว');
      fetchSessions();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      const { data } = await api.delete('/api/auth/sessions');
      message.success(`ออกจากระบบอุปกรณ์อื่น ${data.count} เซสชัน`);
      fetchSessions();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setRevokingAll(false);
    }
  };

  const otherSessions = sessions.filter((s) => !s.is_current);

  return (
    <Card
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        marginBottom: 24,
      }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={5} style={{ color: COLORS.text, margin: 0, fontSize: 14 }}>
          <Monitor size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          อุปกรณ์ที่เข้าสู่ระบบ
        </Title>
        <Space>
          <Button
            type="text"
            size="small"
            icon={<RefreshCw size={13} />}
            onClick={fetchSessions}
            loading={loading}
            style={{ color: COLORS.textMuted }}
          />
          {otherSessions.length > 0 && (
            <Popconfirm
              title="ออกจากระบบอุปกรณ์อื่นทั้งหมด"
              description={`ออกจากระบบ ${otherSessions.length} อุปกรณ์อื่น?`}
              okText="ยืนยัน"
              cancelText="ยกเลิก"
              onConfirm={handleRevokeAll}
            >
              <Button
                type="text"
                size="small"
                icon={<Trash2 size={13} />}
                loading={revokingAll}
                danger
              >
                ออกจากระบบอุปกรณ์อื่นทั้งหมด
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {loading && sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin size="small" />
        </div>
      ) : sessions.length === 0 ? (
        <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>ไม่มีข้อมูลเซสชัน</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: session.is_current ? `${COLORS.accent}08` : COLORS.surface,
                border: `1px solid ${session.is_current ? `${COLORS.accent}30` : COLORS.border}`,
                borderRadius: 8,
              }}
            >
              <div style={{
                color: session.is_current ? COLORS.accent : COLORS.textMuted,
                flexShrink: 0,
              }}>
                {getDeviceIcon(session.device_name)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: 500 }}>
                    {session.device_name || 'Unknown Device'}
                  </Text>
                  {session.is_current && (
                    <Tag color={COLORS.success} style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px' }}>
                      เซสชันนี้
                    </Tag>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {session.ip_address && (
                    <Text style={{ color: COLORS.textMuted, fontSize: 11, fontFamily: 'monospace' }}>
                      {session.ip_address}
                    </Text>
                  )}
                  <Tooltip title={session.last_used_at ? dayjs(session.last_used_at).format('DD/MM/YYYY HH:mm:ss') : ''}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
                      {session.last_used_at
                        ? `ใช้งานล่าสุด ${dayjs(session.last_used_at).fromNow()}`
                        : `สร้างเมื่อ ${dayjs(session.created_at).fromNow()}`
                      }
                    </Text>
                  </Tooltip>
                </div>
              </div>

              {!session.is_current && (
                <Popconfirm
                  title="ออกจากระบบอุปกรณ์นี้"
                  description="อุปกรณ์นี้จะถูกออกจากระบบทันที"
                  okText="ออกจากระบบ"
                  cancelText="ยกเลิก"
                  onConfirm={() => handleRevoke(session.id)}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<LogOut size={14} />}
                    loading={revoking === session.id}
                    style={{ color: COLORS.textMuted }}
                  >
                    ออกจากระบบ
                  </Button>
                </Popconfirm>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
