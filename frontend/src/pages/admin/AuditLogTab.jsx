import { useState, useEffect, useCallback } from 'react';
import { Table, Select, App, Button, Tag, Tooltip, Space, Input, Typography, DatePicker } from 'antd';
import { RefreshCw, Search, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { COLORS } from '../../utils/constants';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const ACTION_MAP = {
  CREATE: { label: 'สร้าง', color: 'success' },
  UPDATE: { label: 'แก้ไข', color: 'processing' },
  DELETE: { label: 'ลบ/กลับรายการ', color: 'error' },
  STATUS_CHANGE: { label: 'เปลี่ยนสถานะ', color: 'warning' },
};

const RESOURCE_TYPE_MAP = {
  user: { label: 'ผู้ใช้งาน' },
  role_permissions: { label: 'สิทธิ์' },
  security_config: { label: 'นโยบายความปลอดภัย' },
  product: { label: 'สินค้า' },
  stock_movement: { label: 'เคลื่อนไหวสต็อก' },
  work_order: { label: 'ใบสั่งงาน' },
  purchase_requisition: { label: 'ใบขอซื้อ' },
  purchase_order: { label: 'ใบสั่งซื้อ' },
  employee: { label: 'พนักงาน' },
  supplier_invoice: { label: 'ใบแจ้งหนี้ AP' },
  customer_invoice: { label: 'ใบแจ้งหนี้ AR' },
  sales_order: { label: 'ใบสั่งขาย' },
  delivery_order: { label: 'ใบส่งของ' },
  withdrawal_slip: { label: 'ใบเบิกของ' },
  tool_checkout_slip: { label: 'ใบเบิกเครื่องมือ' },
  fixed_asset: { label: 'สินทรัพย์' },
  asset_category: { label: 'หมวดสินทรัพย์' },
  depreciation: { label: 'ค่าเสื่อมราคา' },
};

/* ── Changes Before/After Display ── */
function ChangesDisplay({ changes }) {
  if (!changes || Object.keys(changes).length === 0) {
    return <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>ไม่มีรายละเอียดการเปลี่ยนแปลง</Text>;
  }

  // Handle both formats: { field: { old, new } } and { field: value }
  const rows = Object.entries(changes).map(([key, val]) => {
    if (val && typeof val === 'object' && ('old' in val || 'new' in val)) {
      return { field: key, before: val.old, after: val.new };
    }
    return { field: key, before: null, after: val };
  });

  return (
    <div style={{ padding: '8px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <th style={{ textAlign: 'left', padding: '4px 12px', color: COLORS.textMuted, fontWeight: 500 }}>Field</th>
            <th style={{ textAlign: 'left', padding: '4px 12px', color: COLORS.textMuted, fontWeight: 500 }}>Before</th>
            <th style={{ width: 30, textAlign: 'center', padding: '4px 0' }}></th>
            <th style={{ textAlign: 'left', padding: '4px 12px', color: COLORS.textMuted, fontWeight: 500 }}>After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COLORS.borderLight}` }}>
              <td style={{ padding: '6px 12px', color: COLORS.accent, fontFamily: 'monospace' }}>
                {row.field}
              </td>
              <td style={{ padding: '6px 12px', color: COLORS.danger }}>
                {row.before != null ? formatValue(row.before) : <span style={{ color: COLORS.textMuted }}>-</span>}
              </td>
              <td style={{ padding: '6px 0', textAlign: 'center' }}>
                <ArrowRight size={12} color={COLORS.textMuted} />
              </td>
              <td style={{ padding: '6px 12px', color: COLORS.success }}>
                {row.after != null ? formatValue(row.after) : <span style={{ color: COLORS.textMuted }}>-</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(val) {
  if (typeof val === 'object') {
    return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{JSON.stringify(val)}</span>;
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

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
  const [dateRange, setDateRange] = useState(null);
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
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD');
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD');
      const { data: res } = await api.get('/api/admin/audit-log', { params });
      setData(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลด Audit Log ได้');
    } finally {
      setLoading(false);
    }
  }, [pagination, filterUserId, filterAction, filterResourceType, searchText, dateRange]);

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
        const cfg = RESOURCE_TYPE_MAP[v];
        return <Tag>{cfg ? cfg.label : v}</Tag>;
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
        if (!v || Object.keys(v).length === 0) return <span style={{ color: COLORS.textMuted }}>-</span>;
        return (
          <Tag style={{ cursor: 'pointer', fontSize: 11 }}>
            {Object.keys(v).length} fields
          </Tag>
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
            style={{ width: 200 }}
            value={filterResourceType}
            onChange={(v) => { setFilterResourceType(v); setPagination(p => ({ ...p, current: 1 })); }}
            options={resourceTypeOptions}
          />
          <RangePicker
            style={{ width: 260 }}
            value={dateRange}
            onChange={(v) => { setDateRange(v); setPagination(p => ({ ...p, current: 1 })); }}
            placeholder={['วันเริ่มต้น', 'วันสิ้นสุด']}
            format="DD/MM/YYYY"
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
        expandable={{
          expandedRowRender: (record) => <ChangesDisplay changes={record.changes} />,
          rowExpandable: (record) => record.changes && Object.keys(record.changes).length > 0,
        }}
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
