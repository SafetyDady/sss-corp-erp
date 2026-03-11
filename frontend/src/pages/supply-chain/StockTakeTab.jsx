import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Select, Space, Popconfirm, message } from 'antd';
import { Plus, Eye, Trash2, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { usePermission } from '../../hooks/usePermission';
import StatusBadge from '../../components/StatusBadge';
import SearchInput from '../../components/SearchInput';
import StockTakeFormModal from './StockTakeFormModal';
import { COLORS } from '../../utils/constants';

const STATUS_OPTIONS = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'DRAFT', label: 'DRAFT' },
  { value: 'SUBMITTED', label: 'SUBMITTED' },
  { value: 'APPROVED', label: 'APPROVED' },
  { value: 'CANCELLED', label: 'CANCELLED' },
];

export default function StockTakeTab() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const { data } = await api.get('/api/inventory/stock-take', { params });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      message.error('ไม่สามารถโหลดรายการตรวจนับสต็อกได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/inventory/stock-take/${id}`);
      message.success('ลบเรียบร้อย');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ลบไม่สำเร็จ');
    }
  };

  const columns = [
    {
      title: 'เลขที่',
      dataIndex: 'stocktake_number',
      width: 140,
      render: (v) => <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{v}</span>,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'คลังสินค้า',
      dataIndex: 'warehouse_name',
      width: 160,
    },
    {
      title: 'ตำแหน่ง',
      dataIndex: 'location_name',
      width: 140,
      render: (v) => v || '-',
    },
    {
      title: 'ผู้นับ',
      dataIndex: 'counter_name',
      width: 140,
      render: (v) => v || '-',
    },
    {
      title: 'รายการ',
      dataIndex: 'line_count',
      width: 80,
      align: 'center',
    },
    {
      title: 'วันที่',
      dataIndex: 'created_at',
      width: 110,
      render: (v) => v ? new Date(v).toLocaleDateString('th-TH') : '-',
    },
    {
      title: '',
      width: 80,
      render: (_, r) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<Eye size={14} />}
            onClick={() => navigate(`/stock-take/${r.id}`)}
          />
          {r.status === 'DRAFT' && can('inventory.stocktake.delete') && (
            <Popconfirm title="ลบใบนับนี้?" onConfirm={() => handleDelete(r.id)}>
              <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <SearchInput
            placeholder="ค้นหาเลขที่..."
            onSearch={setSearch}
            style={{ width: 220 }}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            style={{ width: 140 }}
          />
        </Space>
        {can('inventory.stocktake.create') && (
          <Button
            type="primary"
            icon={<ClipboardCheck size={14} />}
            onClick={() => setModalOpen(true)}
          >
            สร้าง Stock Take
          </Button>
        )}
      </div>

      <Table
        dataSource={items}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
        }}
        onRow={(r) => ({
          onClick: () => navigate(`/stock-take/${r.id}`),
          style: { cursor: 'pointer' },
        })}
      />

      <StockTakeFormModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
