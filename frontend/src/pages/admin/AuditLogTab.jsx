import { useState, useEffect, useCallback } from 'react';
import { Table, Select, App, Button, Tag, Tooltip, Space, Input, Typography } from 'antd';
import { RefreshCw, Search } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';
import dayjs from 'dayjs';

const { Text } = Typography;

const ACTION_MAP = {
  CREATE: { label: 'สร้าง', color: 'success' },
  UPDATE: { label: 'แก้ไข', color: 'processing' },
  DELETE: { label: 'ลบ/กลับรายการ', color: 'error' },
  STATUS_CHANGE: { label: 'เปลี่ยนสถานะ', color: 'cyan' },
};

const RESOURCE_TYPE_MAP = {
  user: { label: 'ผู้ใช้งาน', color: COLORS.purple },
  role_permissions: { label: 'สิทธิ์', color: COLORS.warning },
  security_config: { label: 'นโยบายความปลอดภัย', color: COLORS.danger },
  work_order: { label: 'ใบสั่งงาน', color: COLORS.accent },
  purchase_requisition: { label: 'ใบขอซื้อ', color: '#f97316' },
  purchase_order: { label: 'ใบสั่งซื้อ', color: '#f97316' },
  supplier_invoice: { label: 'ใบแจ้งหนี้ AP', color: COLORS.danger },
  customer_invoice: { label: 'ใบแจ้งหนี้ AR', color: '#3b82f6' },
  stock_movement: { label: 'เคลื่อนไหวสต็อก', color: COLORS.success },
};

export default function AuditLogTab() {
  const { message } = App.useApp();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [filterUserId, setFilterUserId] = useState(null);
  const [filterAction, setFilterAction] = useState(null);
  const [filterResourceType, setFilterResourceType] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchUsers = useCallback(async () => {
    try {
      const { data: res } = await api.get('/api/admin/users', { params: { limit: 500 } });
      setUsers(res.items || []);
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
      };
      if (filterUserId) params.user_id = filterUserId;
      if (filterAction) params.action = filterAction;
      if (filterResourceType) params.resource_type = filterResourceType;
      if (searchText.trim()) params.search = searchText.trim();
      const { data: res } = await api.get('/api/admin/audit-log', { params });
      setData(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลด Audit Log ได้');
    } finally {
      setLoading(false);
    }
  }, [pagination, filterUserId, filterAction, filterResourceType, searchText]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      title: 'เวลา',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm:ss'),
    },
    {
      title: 'ผู้ใช้',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <div>
          <Text style={{ color: COLORS.text, fontSize: 13 }}>
            {record.user_name || '-'}
          </Text>
          {record.user_email && (
            <div>
              <Text style={{ color: COLORS.textMuted, fontSize: 11, fontFamily: 'monospace' }}>
                {record.user_email}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'การกระทำ',
      dataIndex: 'action',
      key: 'action',
      width: 130,
      render: (v) => {
        const cfg = ACTION_MAP[v] || { label: v, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'ประเภท',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 150,
      render: (v) => {
        const cfg = RESOURCE_TYPE_MAP[v] || { label: v, color: COLORS.textMuted };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'รายละเอียด',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v) => (
        <Tooltip title={v}>
          <span style={{ fontSize: 13 }}>{v}</span>
        </Tooltip>
      ),
    },
    {
      title: 'การเปลี่ยนแปลง',
      dataIndex: 'changes',
      key: 'changes',
      width: 120,
      responsive: ['lg'],
      render: (v) => {
        if (!v || Object.keys(v).length === 0) return '-';
        return (
          <Tooltip
            title={
              <pre style={{ margin: 0, fontSize: 11, maxHeight: 300, overflow: 'auto' }}>
                {JSON.stringify(v, null, 2)}
              </pre>
            }
          >
            <Tag style={{ cursor: 'pointer', fontSize: 11 }}>
              {Object.keys(v).length} fields
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      responsive: ['md'],
      render: (v) => v ? (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>
      ) : '-',
    },
  ];

  const actionOptions = Object.entries(ACTION_MAP).map(([key, val]) => ({
    value: key,
    label: val.label,
  }));

  const resourceTypeOptions = Object.entries(RESOURCE_TYPE_MAP).map(([key, val]) => ({
    value: key,
    label: val.label,
  }));

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
          <Select
            allowClear
            placeholder="การกระทำ"
            style={{ width: 160 }}
            value={filterAction}
            onChange={(v) => { setFilterAction(v); setPagination(p => ({ ...p, current: 1 })); }}
            options={actionOptions}
          />
          <Select
            allowClear
            placeholder="ประเภท"
            style={{ width: 180 }}
            value={filterResourceType}
            onChange={(v) => { setFilterResourceType(v); setPagination(p => ({ ...p, current: 1 })); }}
            options={resourceTypeOptions}
          />
          <Input
            allowClear
            placeholder="ค้นหารายละเอียด..."
            prefix={<Search size={14} color={COLORS.textMuted} />}
            style={{ width: 220 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={() => setPagination(p => ({ ...p, current: 1 }))}
          />
        </Space>
        <Button
          icon={<RefreshCw size={14} />}
          onClick={fetchData}
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
      />
    </div>
  );
}
