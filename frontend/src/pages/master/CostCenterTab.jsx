import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import CostCenterFormModal from './CostCenterFormModal';
import { COLORS } from '../../utils/constants';

export default function CostCenterTab() {
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
      const { data } = await api.get('/api/master/cost-centers', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลศูนย์ต้นทุนได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/api/master/cost-centers/${id}`);
      message.success(`ลบศูนย์ต้นทุน "${name}" สำเร็จ`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถลบได้ — อาจมีพนักงานที่ผูกอยู่');
    }
  };

  const columns = [
    {
      title: 'รหัส', dataIndex: 'code', key: 'code', width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{v}</span>,
    },
    {
      title: 'ชื่อ', dataIndex: 'name', key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'รายละเอียด', dataIndex: 'description', key: 'description', ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'Overhead Rate', dataIndex: 'overhead_rate', key: 'overhead_rate', width: 130,
      align: 'right',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 500, color: parseFloat(v) > 0 ? COLORS.warning : COLORS.textMuted }}>
          {parseFloat(v).toFixed(2)}%
        </span>
      ),
    },
    {
      title: 'สถานะ', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {can('master.costcenter.update') && (
            <Tooltip title="แก้ไขศูนย์ต้นทุน">
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => { setEditItem(record); setModalOpen(true); }} />
            </Tooltip>
          )}
          {can('master.costcenter.delete') && (
            <Popconfirm
              title="ยืนยันการลบ"
              description={`ลบศูนย์ต้นทุน "${record.name}" (${record.code})?`}
              onConfirm={() => handleDelete(record.id, record.name)}
              okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
            >
              <Tooltip title="ลบศูนย์ต้นทุน">
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
        <SearchInput onSearch={setSearch} placeholder="ค้นหารหัส, ชื่อ..." />
        {can('master.costcenter.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setModalOpen(true); }}>
            เพิ่มศูนย์ต้นทุน
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ยังไม่มีศูนย์ต้นทุน" hint="กดปุ่ม 'เพิ่มศูนย์ต้นทุน' เพื่อเริ่มต้น" /> }}
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
      <CostCenterFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
