import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Tooltip, Tag, Alert } from 'antd';
import { RefreshCw } from 'lucide-react';
import api from '../../services/api';
import EmptyState from '../../components/EmptyState';
import { formatDateTime } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const ROLE_COLORS = {
  owner: 'cyan', manager: 'blue', supervisor: 'green', staff: 'default', viewer: 'default',
};

export default function AuditLogTab() {
  const { message } = App.useApp();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/audit-log', { params: { limit: 50 } });
      setEntries(data.entries || []);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลด Audit Log ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      title: 'ผู้ใช้', dataIndex: 'email', key: 'email',
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'บทบาท', dataIndex: 'role', key: 'role', width: 120,
      render: (v) => <Tag color={ROLE_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'กิจกรรมล่าสุด', dataIndex: 'last_activity', key: 'last_activity', width: 180,
      render: (v) => v
        ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatDateTime(v)}</span>
        : <span style={{ color: COLORS.textMuted }}>ไม่มีข้อมูล</span>,
    },
    {
      title: 'User ID', dataIndex: 'user_id', key: 'user_id', width: 140,
      ellipsis: true,
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 11, color: COLORS.textMuted }}>{v?.slice(0, 12)}...</span>,
    },
  ];

  return (
    <div>
      <Alert
        type="info" showIcon
        message="Audit Log (Placeholder)"
        description="ตอนนี้แสดงกิจกรรมล่าสุดของผู้ใช้ — ระบบ Audit Log เต็มรูปแบบจะบันทึกทุก action ลง audit_logs table ในอนาคต"
        style={{ marginBottom: 16, background: COLORS.accentMuted, border: 'none' }}
      />
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip title="รีเฟรชข้อมูล">
          <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>
            รีเฟรช
          </Button>
        </Tooltip>
      </div>
      <Table
        loading={loading}
        dataSource={entries}
        columns={columns}
        rowKey="user_id"
        locale={{ emptyText: <EmptyState message="ยังไม่มีข้อมูล Audit Log" /> }}
        pagination={{ pageSize: 20, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
        size="middle"
      />
    </div>
  );
}
