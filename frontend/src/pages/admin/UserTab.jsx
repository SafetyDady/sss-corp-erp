import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Tag, Select, Popconfirm, Tooltip } from 'antd';
import { RefreshCw } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { COLORS } from '../../utils/constants';

const ROLE_CONFIG = {
  owner:      { color: 'cyan',    label: 'Owner' },
  manager:    { color: 'blue',    label: 'Manager' },
  supervisor: { color: 'green',   label: 'Supervisor' },
  staff:      { color: 'default', label: 'Staff' },
  viewer:     { color: 'default', label: 'Viewer' },
};

const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, cfg]) => ({
  value, label: cfg.label,
}));

export default function UserTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [changingRole, setChangingRole] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/users', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRoleChange = async (userId, newRole, userName) => {
    setChangingRole(userId);
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role: newRole });
      message.success(`เปลี่ยนบทบาทของ "${userName}" เป็น ${ROLE_CONFIG[newRole]?.label || newRole} สำเร็จ`);
      fetchData();
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (detail.includes('BR#31')) {
        message.error('Owner ไม่สามารถลดบทบาทตัวเองได้ (BR#31)');
      } else {
        message.error(detail || 'ไม่สามารถเปลี่ยนบทบาทได้');
      }
    } finally {
      setChangingRole(null);
    }
  };

  const columns = [
    {
      title: 'Email', dataIndex: 'email', key: 'email',
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'ชื่อ-สกุล', dataIndex: 'full_name', key: 'full_name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'บทบาท', dataIndex: 'role', key: 'role', width: 180,
      render: (role, record) => {
        if (!can('admin.user.update') || role === 'owner') {
          const cfg = ROLE_CONFIG[role] || { color: 'default', label: role };
          return <Tag color={cfg.color}>{cfg.label}</Tag>;
        }
        return (
          <Popconfirm
            title="เปลี่ยนบทบาท?"
            description={`เปลี่ยนบทบาทของ "${record.full_name}"`}
            onConfirm={() => {}}
            disabled
          >
            <Select
              value={role}
              size="small"
              style={{ width: 140 }}
              loading={changingRole === record.id}
              onChange={(newRole) => handleRoleChange(record.id, newRole, record.full_name)}
              options={ROLE_OPTIONS}
            />
          </Popconfirm>
        );
      },
    },
    {
      title: 'สถานะ', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} />,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip title="รีเฟรชข้อมูล">
          <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>
            รีเฟรช
          </Button>
        </Tooltip>
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ยังไม่มีผู้ใช้งานในระบบ" /> }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} คน`,
        }}
        size="middle"
      />
    </div>
  );
}
