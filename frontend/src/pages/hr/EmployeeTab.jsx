import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip, Tag } from 'antd';
import { Plus, Pencil, Trash2, Download } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import EmployeeFormModal from './EmployeeFormModal';
import { formatCurrency } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function EmployeeTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/hr/employees', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลพนักงานได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/hr/employees/${id}`);
      message.success('ลบพนักงานสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถลบได้ — อาจมีข้อมูลที่เกี่ยวข้อง');
    }
  };

  const columns = [
    {
      title: 'รหัสพนักงาน', dataIndex: 'employee_code', key: 'employee_code', width: 130,
      render: (v) => <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{v}</span>,
    },
    {
      title: 'ชื่อ-สกุล', dataIndex: 'full_name', key: 'full_name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'ตำแหน่ง', dataIndex: 'position', key: 'position',
      render: (v) => v ? <Tag>{v}</Tag> : <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'อัตราค่าจ้าง/ชม.', dataIndex: 'hourly_rate', key: 'hourly_rate',
      width: 150, align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'ชม.ทำงาน/วัน', dataIndex: 'daily_working_hours', key: 'daily_working_hours',
      width: 120, align: 'center',
      render: (v) => `${v} ชม.`,
    },
    {
      title: 'สถานะ', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('hr.employee.update') && (
            <Tooltip title="แก้ไขข้อมูลพนักงาน">
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => { setEditItem(record); setModalOpen(true); }} />
            </Tooltip>
          )}
          {can('hr.employee.delete') && (
            <Popconfirm
              title="ยืนยันการลบ"
              description={`ลบพนักงาน "${record.full_name}" (${record.employee_code})?`}
              onConfirm={() => handleDelete(record.id)}
              okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
            >
              <Tooltip title="ลบพนักงาน">
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
        <SearchInput onSearch={setSearch} placeholder="ค้นหาชื่อ, รหัส, ตำแหน่ง..." />
        <Space>
          {can('hr.employee.export') && (
            <Tooltip title="Export รายชื่อพนักงาน">
              <Button icon={<Download size={14} />}>Export</Button>
            </Tooltip>
          )}
          {can('hr.employee.create') && (
            <Button type="primary" icon={<Plus size={14} />}
              onClick={() => { setEditItem(null); setModalOpen(true); }}>
              เพิ่มพนักงาน
            </Button>
          )}
        </Space>
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ยังไม่มีข้อมูลพนักงาน" hint="กดปุ่ม 'เพิ่มพนักงาน' เพื่อเริ่มต้น" /> }}
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
      <EmployeeFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
