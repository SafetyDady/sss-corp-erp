import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, Tooltip, Modal, Timeline, Spin } from 'antd';
import { Plus, Pencil, Trash2, LogIn, LogOut, History } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import SearchInput from '../../components/SearchInput';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import ToolFormModal from './ToolFormModal';
import ToolCheckoutModal from './ToolCheckoutModal';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function ToolListPage({ embedded = false }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutTool, setCheckoutTool] = useState(null);
  const [historyModal, setHistoryModal] = useState({ open: false, tool: null, data: [], loading: false });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/tools', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลเครื่องมือได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/api/tools/${id}`);
      message.success(`ลบเครื่องมือ "${name}" สำเร็จ`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถลบได้ — อาจมีประวัติการเบิกอยู่');
    }
  };

  const handleCheckin = async (id) => {
    setActionLoading(id);
    try {
      await api.post(`/api/tools/${id}/checkin`);
      message.success('คืนเครื่องมือสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถคืนเครื่องมือได้');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewHistory = async (tool) => {
    setHistoryModal({ open: true, tool, data: [], loading: true });
    try {
      const { data } = await api.get(`/api/tools/${tool.id}/history`, { params: { limit: 50 } });
      setHistoryModal((prev) => ({ ...prev, data: data.items || [], loading: false }));
    } catch (err) {
      message.error('ไม่สามารถโหลดประวัติได้');
      setHistoryModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const columns = [
    {
      title: 'รหัส', dataIndex: 'code', key: 'code', width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>{v}</span>,
    },
    {
      title: 'ชื่อเครื่องมือ', dataIndex: 'name', key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'รายละเอียด', dataIndex: 'description', key: 'description', ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'อัตรา/ชม.', dataIndex: 'rate_per_hour', key: 'rate_per_hour', width: 130,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}/ชม.</span>,
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 130,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'ใช้งาน', dataIndex: 'is_active', key: 'is_active', width: 90,
      render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      title: '', key: 'actions', width: 180, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'AVAILABLE' && can('tools.tool.execute') && (
            <Tooltip title="เบิกเครื่องมือ (Checkout)">
              <Button type="text" size="small"
                icon={<LogOut size={14} />} style={{ color: COLORS.accent }}
                onClick={() => { setCheckoutTool(record); setCheckoutModalOpen(true); }} />
            </Tooltip>
          )}
          {record.status === 'CHECKED_OUT' && can('tools.tool.execute') && (
            <Popconfirm
              title="คืนเครื่องมือ?"
              description={`คืน "${record.name}" (${record.code}) — ระบบจะคำนวณค่าใช้จ่ายอัตโนมัติ`}
              onConfirm={() => handleCheckin(record.id)}
              okText="คืน" cancelText="ยกเลิก"
            >
              <Tooltip title="คืนเครื่องมือ (Check-in)">
                <Button type="text" size="small" loading={actionLoading === record.id}
                  icon={<LogIn size={14} />} style={{ color: COLORS.success }} />
              </Tooltip>
            </Popconfirm>
          )}
          {can('tools.tool.read') && (
            <Tooltip title="ดูประวัติการเบิก-คืน">
              <Button type="text" size="small"
                icon={<History size={14} />} style={{ color: COLORS.purple }}
                onClick={() => handleViewHistory(record)} />
            </Tooltip>
          )}
          {can('tools.tool.update') && (
            <Tooltip title="แก้ไขเครื่องมือ">
              <Button type="text" size="small" icon={<Pencil size={14} />}
                onClick={() => { setEditItem(record); setFormModalOpen(true); }} />
            </Tooltip>
          )}
          {can('tools.tool.delete') && (
            <Popconfirm
              title="ยืนยันการลบ"
              description={`ลบเครื่องมือ "${record.name}" (${record.code})?`}
              onConfirm={() => handleDelete(record.id, record.name)}
              okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
            >
              <Tooltip title="ลบเครื่องมือ">
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
      {!embedded && <PageHeader title="เครื่องมือ" subtitle="จัดการเครื่องมือ — เบิก, คืน, ดูประวัติ" />}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <SearchInput onSearch={setSearch} placeholder="ค้นหารหัส, ชื่อเครื่องมือ..." />
        {can('tools.tool.create') && (
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setFormModalOpen(true); }}>
            เพิ่มเครื่องมือ
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{ emptyText: <EmptyState message="ยังไม่มีเครื่องมือ" hint="กดปุ่ม 'เพิ่มเครื่องมือ' เพื่อเริ่มต้น" /> }}
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

      {/* Form Modal */}
      <ToolFormModal
        open={formModalOpen}
        editItem={editItem}
        onClose={() => setFormModalOpen(false)}
        onSuccess={() => { setFormModalOpen(false); fetchData(); }}
      />

      {/* Checkout Modal */}
      <ToolCheckoutModal
        open={checkoutModalOpen}
        tool={checkoutTool}
        onClose={() => setCheckoutModalOpen(false)}
        onSuccess={() => { setCheckoutModalOpen(false); fetchData(); }}
      />

      {/* History Modal */}
      <Modal
        title={`ประวัติเบิก-คืน — ${historyModal.tool?.name || ''}`}
        open={historyModal.open}
        onCancel={() => setHistoryModal({ open: false, tool: null, data: [], loading: false })}
        footer={null}
        width={560}
      >
        {historyModal.loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        ) : historyModal.data.length === 0 ? (
          <EmptyState message="ยังไม่มีประวัติการเบิก-คืน" />
        ) : (
          <Timeline
            items={historyModal.data.map((h) => ({
              color: h.checkin_at ? COLORS.success : COLORS.warning,
              children: (
                <div>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>
                    {h.checkin_at ? 'คืนแล้ว' : 'กำลังเบิก'}
                    {h.charge_amount > 0 && (
                      <span style={{ marginLeft: 8, color: COLORS.accent, fontFamily: 'monospace' }}>
                        {formatCurrency(h.charge_amount)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
                    เบิก: {formatDateTime(h.checkout_at)}
                    {h.checkin_at && <> | คืน: {formatDateTime(h.checkin_at)}</>}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: 'monospace' }}>
                    Employee: {h.employee_id?.slice(0, 8)}... | WO: {h.work_order_id?.slice(0, 8)}...
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Modal>
    </div>
  );
}
