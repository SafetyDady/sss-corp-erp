import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Select, InputNumber, Tag, Card, Typography } from 'antd';
import { Save } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import EmptyState from '../../components/EmptyState';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

const LEAVE_TYPE_COLORS = {
  ANNUAL:    '#06b6d4',
  SICK:      '#ef4444',
  PERSONAL:  '#f97316',
  MATERNITY: '#ec4899',
  UNPAID:    '#6b7280',
};

export default function LeaveBalanceTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(undefined);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingQuota, setEditingQuota] = useState({});
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } })
      .then((res) => setEmployees((res.data.items || []).filter((e) => e.is_active)))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/hr/leave-balance', {
        params: {
          employee_id: selectedEmployee || undefined,
          year: selectedYear || undefined,
        },
      });
      setItems(data.items || []);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveQuota = async (record) => {
    const newQuota = editingQuota[record.id];
    if (newQuota === undefined || newQuota === record.quota) return;
    setSaving(record.id);
    try {
      await api.put(`/api/hr/leave-balance/${record.id}`, { quota: newQuota });
      message.success('อัปเดตโควต้าสำเร็จ');
      setEditingQuota((prev) => {
        const copy = { ...prev };
        delete copy[record.id];
        return copy;
      });
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(null);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => ({
    value: currentYear - 2 + i,
    label: `${currentYear - 2 + i}`,
  }));

  const columns = [
    {
      title: 'พนักงาน', dataIndex: 'employee_name', key: 'employee_name', width: 180,
      render: (v, r) => v || <Text type="secondary" style={{ fontSize: 12 }}>{r.employee_id?.slice(0, 8)}...</Text>,
    },
    {
      title: 'ประเภทลา', key: 'leave_type', width: 140,
      render: (_, r) => {
        const color = LEAVE_TYPE_COLORS[r.leave_type_code] || COLORS.textMuted;
        return <Tag color={color}>{r.leave_type_name || r.leave_type_code || '-'}</Tag>;
      },
    },
    {
      title: 'ปี', dataIndex: 'year', key: 'year', width: 80, align: 'center',
    },
    {
      title: 'โควต้า (วัน)', key: 'quota', width: 140, align: 'center',
      render: (_, r) => {
        if (!can('hr.employee.update')) {
          return <span style={{ fontWeight: 600 }}>{r.quota}</span>;
        }
        return (
          <InputNumber
            size="small"
            min={0}
            max={365}
            value={editingQuota[r.id] !== undefined ? editingQuota[r.id] : r.quota}
            onChange={(val) => setEditingQuota((prev) => ({ ...prev, [r.id]: val }))}
            style={{ width: 80 }}
          />
        );
      },
    },
    {
      title: 'ใช้แล้ว', dataIndex: 'used', key: 'used', width: 90, align: 'center',
      render: (v) => <span style={{ color: v > 0 ? COLORS.warning : COLORS.textMuted }}>{v}</span>,
    },
    {
      title: 'คงเหลือ', key: 'remaining', width: 90, align: 'center',
      render: (_, r) => {
        const remaining = r.quota - r.used;
        return (
          <span style={{ fontWeight: 600, color: remaining <= 0 ? COLORS.error : COLORS.success }}>
            {remaining}
          </span>
        );
      },
    },
    ...(can('hr.employee.update') ? [{
      title: '', key: 'actions', width: 60, align: 'center',
      render: (_, r) => (
        editingQuota[r.id] !== undefined && editingQuota[r.id] !== r.quota ? (
          <Button
            type="text"
            size="small"
            icon={<Save size={14} />}
            loading={saving === r.id}
            onClick={() => handleSaveQuota(r)}
            style={{ color: COLORS.accent }}
          />
        ) : null
      ),
    }] : []),
  ];

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>พนักงาน</Text>
            <Select
              allowClear showSearch optionFilterProp="label"
              value={selectedEmployee} onChange={setSelectedEmployee}
              style={{ width: 280 }} placeholder="ทั้งหมด"
              options={employees.map((e) => ({
                value: e.id, label: `${e.employee_code} — ${e.full_name}`,
              }))}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>ปี</Text>
            <Select
              value={selectedYear} onChange={setSelectedYear}
              style={{ width: 100 }}
              options={yearOptions}
            />
          </div>
        </div>
      </Card>

      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{
          emptyText: (
            <EmptyState
              message="ยังไม่มีข้อมูล Leave Balance"
              hint="Leave Balance จะถูกสร้างอัตโนมัติเมื่อพนักงานขอลา"
            />
          ),
        }}
        pagination={false}
        size="middle"
      />
    </div>
  );
}
