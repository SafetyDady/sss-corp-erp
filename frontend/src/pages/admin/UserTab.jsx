import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Tag, Select, Tooltip } from 'antd';
import { RefreshCw, Building2, UserPlus } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import UserFormModal from './UserFormModal';
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
  const [changingDept, setChangingDept] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch department list for dropdown
  useEffect(() => {
    api.get('/api/master/departments', { params: { limit: 500 } })
      .then(({ data }) => setDepartments(data.items || []))
      .catch(() => {});
  }, []);

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

  const handleDeptChange = async (userId, newDeptId, userName) => {
    setChangingDept(userId);
    try {
      await api.patch(`/api/admin/users/${userId}/department`, {
        department_id: newDeptId || null,
      });
      const deptLabel = newDeptId
        ? departments.find((d) => d.id === newDeptId)?.name || 'แผนกใหม่'
        : 'ไม่ระบุแผนก';
      message.success(`เปลี่ยนแผนกของ "${userName}" เป็น ${deptLabel} สำเร็จ`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถเปลี่ยนแผนกได้');
    } finally {
      setChangingDept(null);
    }
  };

  const deptOptions = departments.map((d) => ({
    value: d.id,
    label: `${d.code} — ${d.name}`,
  }));

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
      title: 'บทบาท', dataIndex: 'role', key: 'role', width: 160,
      render: (role, record) => {
        if (!can('admin.user.update') || role === 'owner') {
          const cfg = ROLE_CONFIG[role] || { color: 'default', label: role };
          return <Tag color={cfg.color}>{cfg.label}</Tag>;
        }
        return (
          <Select
            value={role}
            size="small"
            style={{ width: 140 }}
            loading={changingRole === record.id}
            onChange={(newRole) => handleRoleChange(record.id, newRole, record.full_name)}
            options={ROLE_OPTIONS}
          />
        );
      },
    },
    {
      title: (
        <span>
          <Building2 size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          แผนก
        </span>
      ),
      dataIndex: 'department_name',
      key: 'department',
      width: 200,
      render: (deptName, record) => {
        // No employee linked — show hint
        if (!record.employee_id) {
          return <span style={{ color: COLORS.textMuted, fontSize: 12 }}>ไม่มี Employee</span>;
        }
        // No edit permission — show text only
        if (!can('admin.user.update')) {
          return deptName || <span style={{ color: COLORS.textMuted }}>ไม่ระบุ</span>;
        }
        return (
          <Select
            value={record.department_id || undefined}
            size="small"
            style={{ width: 180 }}
            allowClear
            placeholder="เลือกแผนก"
            loading={changingDept === record.id}
            onChange={(val) => handleDeptChange(record.id, val, record.full_name)}
            options={deptOptions}
            showSearch
            optionFilterProp="label"
          />
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Tooltip title="รีเฟรชข้อมูล">
          <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>
            รีเฟรช
          </Button>
        </Tooltip>
        {can('admin.user.create') && (
          <Button type="primary" icon={<UserPlus size={14} />} onClick={() => setModalOpen(true)}>
            เพิ่มผู้ใช้
          </Button>
        )}
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
      <UserFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
