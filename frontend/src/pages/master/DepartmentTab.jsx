import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip, Tag } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import DepartmentFormModal from './DepartmentFormModal';
import { COLORS } from '../../utils/constants';

export default function DepartmentTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  // Lookup maps for display
  const [costCenterMap, setCostCenterMap] = useState({});
  const [employeeMap, setEmployeeMap] = useState({});

  const fetchLookups = useCallback(async () => {
    try {
      const promises = [
        api.get('/api/master/cost-centers', { params: { limit: 500, offset: 0 } }),
      ];
      // Only fetch employees if user has permission (staff doesn't have hr.employee.read)
      const hasEmpPerm = can('hr.employee.read');
      if (hasEmpPerm) {
        promises.push(api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } }));
      }
      const results = await Promise.all(promises);
      const ccMap = {};
      (results[0].data.items || []).forEach((c) => { ccMap[c.id] = c; });
      setCostCenterMap(ccMap);
      if (hasEmpPerm && results[1]) {
        const empMap = {};
        (results[1].data.items || []).forEach((e) => { empMap[e.id] = e; });
        setEmployeeMap(empMap);
      }
    } catch {
      // Silent fail — lookups are optional for display
    }
  }, [can]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/master/departments', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลแผนกได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchLookups(); }, [fetchLookups]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/api/master/departments/${id}`);
      message.success(`ลบแผนก "${name}" สำเร็จ`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถลบได้ — อาจมีพนักงานที่สังกัดอยู่');
    }
  };

  const columns = [
    {
      title: 'รหัส', dataIndex: 'code', key: 'code', width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{v}</span>,
    },
    {
      title: 'ชื่อแผนก', dataIndex: 'name', key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Cost Center', dataIndex: 'cost_center_id', key: 'cost_center_id',
      render: (id) => {
        const cc = costCenterMap[id];
        return cc ? <Tag>{cc.code} — {cc.name}</Tag> : <span style={{ color: COLORS.textMuted }}>-</span>;
      },
    },
    {
      title: 'หัวหน้าแผนก', dataIndex: 'head_id', key: 'head_id',
      render: (id) => {
        const emp = employeeMap[id];
        return emp ? `${emp.employee_code} ${emp.full_name}` : <span style={{ color: COLORS.textMuted }}>-</span>;
      },
    },
    {
      title: 'สถานะ', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('master.department.update') && (
            <Tooltip title="แก้ไขแผนก">
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => { setEditItem(record); setModalOpen(true); }} />
            </Tooltip>
          )}
          {can('master.department.delete') && (
            <Popconfirm
              title="ยืนยันการลบ"
              description={`ลบแผนก "${record.name}" (${record.code})?`}
              onConfirm={() => handleDelete(record.id, record.name)}
              okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
            >
              <Tooltip title="ลบแผนก">
                <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <SearchInput onSearch={setSearch} placeholder="ค้นหารหัส, ชื่อแผนก..." />
        {can('master.department.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setModalOpen(true); }}>
            เพิ่มแผนก
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ยังไม่มีข้อมูลแผนก" hint="กดปุ่ม 'เพิ่มแผนก' เพื่อเริ่มต้น" /> }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
        size="middle"
      />
      <DepartmentFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
