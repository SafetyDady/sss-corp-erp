import { useState, useEffect, useCallback } from 'react';
import { Table, Select, App, Button, Tag, Tooltip, Space, Typography } from 'antd';
import { Unlock, RefreshCw } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';
import dayjs from 'dayjs';

const { Text } = Typography;

const STATUS_COLORS = {
  SUCCESS: { color: COLORS.success, text: 'สำเร็จ' },
  FAILED: { color: COLORS.error, text: 'ล้มเหลว' },
  LOCKED: { color: COLORS.warning, text: 'ถูกล็อค' },
};

export default function LoginHistoryTab() {
  const { can } = usePermission();
  const { message, modal } = App.useApp();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [filterUserId, setFilterUserId] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchUsers = useCallback(async () => {
    try {
      const { data: res } = await api.get('/api/admin/users', { params: { limit: 500 } });
      setUsers(res.items || []);
    } catch { /* ignore */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
      };
      if (filterUserId) params.user_id = filterUserId;
      const { data: res } = await api.get('/api/admin/login-history', { params });
      setData(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดประวัติได้');
    } finally {
      setLoading(false);
    }
  }, [pagination, filterUserId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleUnlock = (userId, email) => {
    modal.confirm({
      title: 'ปลดล็อคบัญชี',
      content: `ยืนยันปลดล็อคบัญชี ${email} ?`,
      okText: 'ปลดล็อค',
      cancelText: 'ยกเลิก',
      okType: 'primary',
      onOk: async () => {
        try {
          await api.post(`/api/admin/users/${userId}/unlock`);
          message.success('ปลดล็อคบัญชีสำเร็จ');
          fetchHistory();
        } catch (err) {
          message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
        }
      },
    });
  };

  const columns = [
    {
      title: 'เวลา',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm:ss'),
    },
    {
      title: 'อีเมล',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const cfg = STATUS_COLORS[status] || { color: COLORS.textMuted, text: status };
        return <Tag color={cfg.color} style={{ fontWeight: 500 }}>{cfg.text}</Tag>;
      },
    },
    {
      title: 'สาเหตุ',
      dataIndex: 'failure_reason',
      key: 'failure_reason',
      width: 200,
      render: (v) => v ? <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{v}</Text> : '-',
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      responsive: ['md'],
      render: (v) => v ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> : '-',
    },
    {
      title: 'User Agent',
      dataIndex: 'user_agent',
      key: 'user_agent',
      responsive: ['lg'],
      ellipsis: true,
      render: (v) => v ? (
        <Tooltip title={v}>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>{v.substring(0, 60)}...</span>
        </Tooltip>
      ) : '-',
    },
    ...(can('admin.user.update') ? [{
      title: '',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        record.status === 'LOCKED' && record.user_id ? (
          <Button
            type="link"
            size="small"
            icon={<Unlock size={14} />}
            onClick={() => handleUnlock(record.user_id, record.email)}
            style={{ color: COLORS.warning }}
          >
            ปลดล็อค
          </Button>
        ) : null
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="กรองตามผู้ใช้"
            style={{ width: 260 }}
            value={filterUserId}
            onChange={(v) => { setFilterUserId(v); setPagination(p => ({ ...p, current: 1 })); }}
            options={users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.email})` }))}
            showSearch
            filterOption={(input, option) =>
              option.label.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Space>
        <Button
          icon={<RefreshCw size={14} />}
          onClick={fetchHistory}
          loading={loading}
        >
          รีเฟรช
        </Button>
      </div>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
        }}
        rowClassName={(record) =>
          record.status === 'FAILED' ? 'login-failed-row' :
          record.status === 'LOCKED' ? 'login-locked-row' : ''
        }
      />
    </div>
  );
}
