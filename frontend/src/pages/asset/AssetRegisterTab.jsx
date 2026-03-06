import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Space, App } from 'antd';
import { Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import AssetFormModal from './AssetFormModal';

const COLORS = { cyan: '#06b6d4', cardBg: '#16161f', border: '#2a2a3a' };

export default function AssetRegisterTab({ onRefresh }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/api/asset/categories');
      setCategories(res.data?.items || []);
    } catch { /* ignore */ }
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 20, offset: (page - 1) * 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category_id = categoryFilter;
      const res = await api.get('/api/asset/assets', { params });
      setAssets(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      message.error('ไม่สามารถโหลดรายการสินทรัพย์');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, categoryFilter]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const columns = [
    { title: 'รหัส', dataIndex: 'asset_code', width: 110, render: (v) => <span style={{ color: COLORS.cyan, fontWeight: 600 }}>{v}</span> },
    { title: 'ชื่อสินทรัพย์', dataIndex: 'asset_name', ellipsis: true },
    { title: 'หมวด', dataIndex: 'category_name', width: 140 },
    { title: 'วันที่ได้มา', dataIndex: 'acquisition_date', width: 120 },
    { title: 'ราคาทุน', dataIndex: 'acquisition_cost', width: 140, align: 'right', render: (v) => Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2 }) },
    { title: 'ค่าเสื่อมสะสม', dataIndex: 'accumulated_depreciation', width: 140, align: 'right', render: (v) => Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2 }) },
    { title: 'NBV', dataIndex: 'net_book_value', width: 140, align: 'right', render: (v) => <span style={{ fontWeight: 600 }}>{Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span> },
    { title: 'สถานะ', dataIndex: 'status', width: 140, render: (v) => <StatusBadge status={v} /> },
  ];

  const handleSuccess = () => {
    setModalOpen(false);
    fetchAssets();
    onRefresh?.();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Input
            placeholder="ค้นหารหัส/ชื่อ..."
            prefix={<Search size={14} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="สถานะ"
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            allowClear
            style={{ width: 160 }}
            options={[
              { label: 'ใช้งาน', value: 'ACTIVE' },
              { label: 'หมดค่าเสื่อม', value: 'FULLY_DEPRECIATED' },
              { label: 'จำหน่ายแล้ว', value: 'DISPOSED' },
              { label: 'เลิกใช้', value: 'RETIRED' },
            ]}
          />
          <Select
            placeholder="หมวด"
            value={categoryFilter}
            onChange={(v) => { setCategoryFilter(v); setPage(1); }}
            allowClear
            style={{ width: 160 }}
            options={categories.map((c) => ({ label: c.name, value: c.id }))}
          />
        </Space>
        {can('asset.asset.create') && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
            ลงทะเบียนสินทรัพย์
          </Button>
        )}
      </div>

      <Table
        loading={loading}
        dataSource={assets}
        columns={columns}
        rowKey="id"
        size="small"
        onRow={(record) => ({
          onClick: () => navigate(`/asset/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: setPage,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          size: 'small',
        }}
      />

      {modalOpen && (
        <AssetFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
          categories={categories}
        />
      )}
    </div>
  );
}
