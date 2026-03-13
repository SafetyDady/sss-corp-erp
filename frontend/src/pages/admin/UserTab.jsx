import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Tag, Select, Tooltip, Modal, Typography } from 'antd';
import { RefreshCw, Building2, UserPlus, Link2 } from 'lucide-react';
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
  const [linkCodeModal, setLinkCodeModal] = useState({ open: false, code: '', expiresAt: '', userName: '' });
  const [generatingLink, setGeneratingLink] = useState(null);

  const handleGenerateLinkCode = async (userId, userName) => {
    setGeneratingLink(userId);
    try {
      const { data } = await api.post('/api/auth/line/generate-link-code', { user_id: userId });
      setLinkCodeModal({
        open: true,
        code: data.link_code,
        expiresAt: data.expires_at,
        userName,
      });
    } catch (err) {
      if (err.response?.status === 404 && err.response?.data?.detail?.includes('LINE Login')) {
        message.warning('LINE Login ยังไม่ได้ตั้งค่า');
      } else {
        message.error(err.response?.data?.detail || 'ไม่สามารถสร้างรหัสเชื่อมต่อได้');
      }
    } finally {
      setGeneratingLink(null);
    }
  };

  // Fetch department list for dropdown
  useEffect(() => {
    api.get('/api/master/departments', { params: { limit: 50 } })
      .then(({ data }) => setDepartments(data.items || []))
      .catch((err) => console.warn('[UserTab] load:', err?.response?.status));
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
    can('admin.user.update') && {
      title: 'LINE', key: 'line_link', width: 120,
      render: (_, record) => (
        <Tooltip title="สร้างรหัสเชื่อมต่อ LINE">
          <Button
            type="text"
            size="small"
            icon={<Link2 size={14} />}
            loading={generatingLink === record.id}
            onClick={() => handleGenerateLinkCode(record.id, record.full_name)}
            style={{ color: '#06C755' }}
          >
            Link Code
          </Button>
        </Tooltip>
      ),
    },
  ].filter(Boolean);

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

      {/* LINE Link Code Modal */}
      <Modal
        open={linkCodeModal.open}
        title={<span><Link2 size={16} style={{ marginRight: 8, verticalAlign: 'middle', color: '#06C755' }} />รหัสเชื่อมต่อ LINE</span>}
        onCancel={() => setLinkCodeModal({ ...linkCodeModal, open: false })}
        footer={[
          <Button key="close" onClick={() => setLinkCodeModal({ ...linkCodeModal, open: false })}>
            ปิด
          </Button>,
        ]}
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Typography.Text style={{ color: COLORS.textSecondary, display: 'block', marginBottom: 8 }}>
            รหัสเชื่อมต่อสำหรับ <strong>{linkCodeModal.userName}</strong>
          </Typography.Text>
          <div
            style={{
              fontSize: 36,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: 12,
              color: '#06C755',
              background: `${COLORS.bg}`,
              border: `2px dashed #06C755`,
              borderRadius: 12,
              padding: '16px 24px',
              margin: '12px 0',
            }}
          >
            {linkCodeModal.code}
          </div>
          <Typography.Text style={{ color: COLORS.textMuted, fontSize: 12, display: 'block' }}>
            รหัสนี้ใช้ได้ครั้งเดียว หมดอายุใน 24 ชั่วโมง
          </Typography.Text>
          <Typography.Text style={{ color: COLORS.textMuted, fontSize: 11, display: 'block', marginTop: 4 }}>
            ให้พนักงานกด "เข้าสู่ระบบด้วย LINE" แล้วกรอกรหัสนี้
          </Typography.Text>
        </div>
      </Modal>
    </div>
  );
}
