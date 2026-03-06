import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Space, App, Popconfirm } from 'antd';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import AssetCategoryFormModal from './AssetCategoryFormModal';

export default function AssetCategoryTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/asset/categories');
      setCategories(res.data?.items || []);
    } catch {
      message.error('ไม่สามารถโหลดหมวดสินทรัพย์');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/asset/categories/${id}`);
      message.success('ลบหมวดสินทรัพย์สำเร็จ');
      fetchCategories();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'ไม่สามารถลบได้');
    }
  };

  const columns = [
    { title: 'รหัส', dataIndex: 'code', width: 80 },
    { title: 'ชื่อหมวด', dataIndex: 'name' },
    { title: 'อายุใช้งาน (ปี)', dataIndex: 'useful_life_years', width: 130, align: 'center' },
    { title: 'อัตราเสื่อม (%/ปี)', dataIndex: 'depreciation_rate', width: 140, align: 'right', render: (v) => `${Number(v).toFixed(2)}%` },
    { title: 'วิธี', dataIndex: 'depreciation_method', width: 120, render: () => 'เส้นตรง' },
    {
      title: '',
      width: 80,
      render: (_, record) => (
        <Space size="small">
          {can('asset.category.update') && (
            <Button size="small" type="text" icon={<Edit size={14} />} onClick={() => { setEditCategory(record); setModalOpen(true); }} />
          )}
          {can('asset.category.delete') && (
            <Popconfirm title="ยืนยันลบหมวดนี้?" onConfirm={() => handleDelete(record.id)} okText="ลบ" cancelText="ยกเลิก">
              <Button size="small" type="text" danger icon={<Trash2 size={14} />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {can('asset.category.create') && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditCategory(null); setModalOpen(true); }}>
            เพิ่มหมวด
          </Button>
        </div>
      )}

      <Table
        loading={loading}
        dataSource={categories}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
      />

      {modalOpen && (
        <AssetCategoryFormModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditCategory(null); }}
          onSuccess={() => { setModalOpen(false); setEditCategory(null); fetchCategories(); }}
          category={editCategory}
        />
      )}
    </div>
  );
}
