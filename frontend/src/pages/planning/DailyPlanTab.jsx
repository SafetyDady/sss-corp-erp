import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Popconfirm, DatePicker, Select, Tooltip, Typography } from 'antd';
import { Plus, Eye, Trash2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import EmptyState from '../../components/EmptyState';
import DailyPlanFormModal from './DailyPlanFormModal';
import { formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const { RangePicker } = DatePicker;
const { Text } = Typography;

export default function DailyPlanTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [dateRange, setDateRange] = useState(null);
  const [woFilter, setWoFilter] = useState(undefined);
  const [workOrders, setWorkOrders] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  useEffect(() => {
    api.get('/api/work-orders', { params: { limit: 500, offset: 0 } })
      .then((res) => setWorkOrders(res.data.items || []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
      };
      if (dateRange && dateRange[0]) {
        params.date = dateRange[0].format('YYYY-MM-DD');
      }
      if (dateRange && dateRange[1]) {
        params.date_end = dateRange[1].format('YYYY-MM-DD');
      }
      if (woFilter) {
        params.work_order_id = woFilter;
      }
      const { data } = await api.get('/api/planning/daily', { params });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลแผนงานได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, dateRange, woFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/planning/daily/${id}`);
      message.success('ลบแผนงานสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถลบแผนงานได้');
    }
  };

  const getWOLabel = (woId) => {
    const wo = workOrders.find((w) => w.id === woId);
    return wo ? wo.wo_number : woId?.slice(0, 8) + '...';
  };

  const columns = [
    {
      title: 'วันที่', dataIndex: 'plan_date', key: 'plan_date', width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatDate(v)}</span>,
    },
    {
      title: 'Work Order', dataIndex: 'work_order_id', key: 'work_order_id', width: 160,
      render: (v) => (
        <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>
          {getWOLabel(v)}
        </span>
      ),
    },
    {
      title: 'หมายเหตุ', dataIndex: 'note', key: 'note', ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: 'พนักงาน', dataIndex: 'workers', key: 'workers_count', width: 100,
      align: 'center',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {Array.isArray(v) ? v.length : 0} คน
        </span>
      ),
    },
    {
      title: 'เครื่องมือ', dataIndex: 'tools', key: 'tools_count', width: 100,
      align: 'center',
      render: (v) => (
        <span style={{ fontFamily: 'monospace' }}>
          {Array.isArray(v) ? v.length : 0} รายการ
        </span>
      ),
    },
    {
      title: 'วัสดุ', dataIndex: 'materials', key: 'materials_count', width: 100,
      align: 'center',
      render: (v) => (
        <span style={{ fontFamily: 'monospace' }}>
          {Array.isArray(v) ? v.length : 0} รายการ
        </span>
      ),
    },
    {
      title: 'สร้างโดย', dataIndex: 'created_by_name', key: 'created_by_name', width: 140,
      ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="ดูรายละเอียด / แก้ไข">
            <Button
              type="text" size="small"
              icon={<Eye size={14} />}
              style={{ color: COLORS.accent }}
              onClick={() => { setEditItem(record); setModalOpen(true); }}
            />
          </Tooltip>
          {can('workorder.plan.delete') && (
            <Popconfirm
              title="ยืนยันการลบ"
              description="ลบแผนงานรายวันนี้?"
              onConfirm={() => handleDelete(record.id)}
              okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
            >
              <Tooltip title="ลบแผนงาน">
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <RangePicker
            format="DD/MM/YYYY"
            placeholder={['วันเริ่ม', 'วันสิ้นสุด']}
            value={dateRange}
            onChange={(dates) => {
              setDateRange(dates);
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
            style={{ width: 260 }}
          />
          <Select
            allowClear
            placeholder="กรอง Work Order"
            showSearch
            optionFilterProp="label"
            value={woFilter}
            onChange={(v) => {
              setWoFilter(v);
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
            options={workOrders.map((w) => ({ value: w.id, label: `${w.wo_number} — ${w.description || ''}` }))}
            style={{ width: 240 }}
          />
        </div>
        {can('workorder.plan.create') && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => { setEditItem(null); setModalOpen(true); }}
          >
            สร้างแผนรายวัน
          </Button>
        )}
      </div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{
          emptyText: (
            <EmptyState
              message="ยังไม่มีแผนงานรายวัน"
              hint="กดปุ่ม 'สร้างแผนรายวัน' เพื่อเริ่มวางแผน"
            />
          ),
        }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
        size="middle"
        onRow={(record) => ({
          style: { cursor: 'pointer' },
          onDoubleClick: () => { setEditItem(record); setModalOpen(true); },
        })}
      />
      <DailyPlanFormModal
        open={modalOpen}
        editItem={editItem}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        onSuccess={() => { setModalOpen(false); setEditItem(null); fetchData(); }}
      />
    </div>
  );
}
