import { useState, useEffect, useCallback } from 'react';
import { Table, Select, App, Button, Tag, Tooltip, Space, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';
import dayjs from 'dayjs';

const { Text } = Typography;

const RESOURCE_TYPE_MAP = {
  products: { label: 'Products', color: COLORS.accent },
  employees: { label: 'Employees', color: COLORS.purple },
  payroll: { label: 'Payroll', color: COLORS.warning },
  work_orders: { label: 'Work Orders', color: COLORS.success },
  purchase_requisitions: { label: 'PR', color: '#f97316' },
  supplier_invoices: { label: 'AP Invoice', color: COLORS.danger },
  sales_orders: { label: 'Sales Order', color: '#3b82f6' },
  delivery_orders: { label: 'Delivery Order', color: '#8b5cf6' },
  finance_reports: { label: 'Finance Report', color: COLORS.textSecondary },
};

export default function ExportAuditTab() {
  const { message } = App.useApp();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [filterUserId, setFilterUserId] = useState(null);
  const [filterResourceType, setFilterResourceType] = useState(null);
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
      if (filterResourceType) params.resource_type = filterResourceType;
      const { data: res } = await api.get('/api/admin/export-audit', { params });
      setData(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [pagination, filterUserId, filterResourceType]);

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
      title: 'ประเภทข้อมูล',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 140,
      render: (v) => {
        const cfg = RESOURCE_TYPE_MAP[v] || { label: v, color: COLORS.textMuted };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'จำนวน',
      dataIndex: 'record_count',
      key: 'record_count',
      width: 80,
      align: 'right',
      render: (v) => v != null ? v.toLocaleString() : '-',
    },
    {
      title: 'รูปแบบ',
      dataIndex: 'file_format',
      key: 'file_format',
      width: 80,
      render: (v) => (
        <Tag style={{ textTransform: 'uppercase', fontSize: 10 }}>
          {v || 'xlsx'}
        </Tag>
      ),
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
    {
      title: 'Filters',
      dataIndex: 'filters_used',
      key: 'filters_used',
      responsive: ['lg'],
      ellipsis: true,
      render: (v) => {
        if (!v || Object.keys(v).length === 0) return '-';
        const str = JSON.stringify(v);
        return (
          <Tooltip title={<pre style={{ margin: 0, fontSize: 11 }}>{JSON.stringify(v, null, 2)}</pre>}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: 'monospace' }}>
              {str.length > 50 ? str.substring(0, 50) + '...' : str}
            </span>
          </Tooltip>
        );
      },
    },
  ];

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
            placeholder="ประเภทข้อมูล"
            style={{ width: 180 }}
            value={filterResourceType}
            onChange={(v) => { setFilterResourceType(v); setPagination(p => ({ ...p, current: 1 })); }}
            options={resourceTypeOptions}
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
