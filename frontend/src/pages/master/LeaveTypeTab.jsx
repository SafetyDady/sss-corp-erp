import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip, Tag } from 'antd';
import { Plus, Pencil, Trash2, CalendarOff } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LeaveTypeFormModal from './LeaveTypeFormModal';
import { COLORS } from '../../utils/constants';

export default function LeaveTypeTab() {
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
      const { data } = await api.get('/api/master/leave-types', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลประเภทลาได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/api/master/leave-types/${id}`);
      message.success(`ลบประเภทลา "${name}" สำเร็จ`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถลบได้ — อาจมี Leave ที่ผูกอยู่');
    }
  };

  const columns = [
    {
      title: 'รหัส', dataIndex: 'code', key: 'code', width: 120,
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.accent }}>
          {v}
        </span>
      ),
    },
    {
      title: 'ชื่อ', dataIndex: 'name', key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'ได้เงิน', dataIndex: 'is_paid', key: 'is_paid', width: 120,
      align: 'center',
      render: (v) => v
        ? <Tag color="green">ได้เงิน</Tag>
        : <Tag color="red">ไม่ได้เงิน</Tag>,
    },
    {
      title: 'โควต้า/ปี', dataIndex: 'default_quota', key: 'default_quota', width: 120,
      align: 'center',
      render: (v) => v != null
        ? <span style={{ fontWeight: 500 }}>{v} วัน</span>
        : <span style={{ color: COLORS.textMuted }}>ไม่จำกัด</span>,
    },
    {
      title: 'สถานะ', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('master.leavetype.update') && (
            <Tooltip title="แก้ไขประเภทลา">
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => { setEditItem(record); setModalOpen(true); }} />
            </Tooltip>
          )}
          {can('master.leavetype.delete') && (
            <Popconfirm
              title="ยืนยันการลบ"
              description={`ลบประเภทลา "${record.name}"?`}
              onConfirm={() => handleDelete(record.id, record.name)}
              okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
            >
              <Tooltip title="ลบประเภทลา">
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
        <SearchInput onSearch={setSearch} placeholder="ค้นหาประเภทลา..." />
        {can('master.leavetype.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setModalOpen(true); }}>
            เพิ่มประเภทลา
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState icon={CalendarOff} message="ยังไม่มีประเภทลา" hint="กดปุ่ม 'เพิ่มประเภทลา' เพื่อเริ่มต้น — เช่น ลาพักร้อน, ลาป่วย, ลากิจ" /> }}
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
      <LeaveTypeFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
