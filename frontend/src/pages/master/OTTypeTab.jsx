import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip, Alert } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import OTTypeFormModal from './OTTypeFormModal';
import { COLORS } from '../../utils/constants';

export default function OTTypeTab() {
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
      const { data } = await api.get('/api/master/ot-types', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลประเภท OT ได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/api/master/ot-types/${id}`);
      message.success(`ลบประเภท OT "${name}" สำเร็จ`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถลบได้ — อาจมี Timesheet ที่ผูกอยู่');
    }
  };

  const columns = [
    {
      title: 'ชื่อ', dataIndex: 'name', key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'ตัวคูณ OT', dataIndex: 'factor', key: 'factor', width: 120,
      align: 'center',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.accent }}>
          x{parseFloat(v).toFixed(2)}
        </span>
      ),
    },
    {
      title: 'เพดานสูงสุด', dataIndex: 'max_ceiling', key: 'max_ceiling', width: 120,
      align: 'center',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 500, color: COLORS.warning }}>
          x{parseFloat(v).toFixed(2)}
        </span>
      ),
    },
    {
      title: 'รายละเอียด', dataIndex: 'description', key: 'description', ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'สถานะ', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('master.ottype.update') && (
            <Tooltip title="แก้ไขประเภท OT">
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => { setEditItem(record); setModalOpen(true); }} />
            </Tooltip>
          )}
          {can('master.ottype.delete') && (
            <Popconfirm
              title="ยืนยันการลบ"
              description={`ลบประเภท OT "${record.name}"?`}
              onConfirm={() => handleDelete(record.id, record.name)}
              okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
            >
              <Tooltip title="ลบประเภท OT">
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
      <Alert
        type="warning" showIcon
        message="BR#24 — ตัวคูณ OT (Factor) ต้องไม่เกินเพดานสูงสุด (Max Ceiling)"
        style={{ marginBottom: 16, border: 'none' }}
      />
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <SearchInput onSearch={setSearch} placeholder="ค้นหาชื่อ..." />
        {can('master.ottype.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setModalOpen(true); }}>
            เพิ่มประเภท OT
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ยังไม่มีประเภท OT" hint="กดปุ่ม 'เพิ่มประเภท OT' เพื่อเริ่มต้น — ค่าเริ่มต้น: วันธรรมดา 1.5x, วันหยุด 2.0x, นักขัตฤกษ์ 3.0x" /> }}
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
      <OTTypeFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
