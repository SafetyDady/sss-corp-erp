import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Button, App, Space, Popconfirm, Tabs, Tooltip, Typography } from 'antd';
import { Plus, Ban, Package, Wrench } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import ReservationFormModal from './ReservationFormModal';
import { formatDate, formatNumber } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;

function MaterialReservationTable({ onRefreshRef }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/planning/reservations/material', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
        },
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลการจองวัสดุได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (onRefreshRef) onRefreshRef.current = fetchData;
  }, [fetchData, onRefreshRef]);

  const handleCancel = async (id) => {
    try {
      await api.put(`/api/planning/reservations/${id}/cancel`);
      message.success('ยกเลิกการจองสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถยกเลิกการจองได้');
    }
  };

  const columns = [
    {
      title: 'สินค้า', dataIndex: 'product_name', key: 'product_name', width: 200,
      render: (v, record) => (
        <span style={{ fontWeight: 500 }}>
          {v || (
            <Text style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.textSecondary }}>
              {record.product_id?.slice(0, 8)}...
            </Text>
          )}
        </span>
      ),
    },
    {
      title: 'Work Order', dataIndex: 'wo_number', key: 'wo_number', width: 150,
      render: (v, record) => (
        <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>
          {v || record.work_order_id?.slice(0, 8) + '...'}
        </span>
      ),
    },
    {
      title: 'จำนวน', dataIndex: 'quantity', key: 'quantity', width: 100,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{formatNumber(v)}</span>,
    },
    {
      title: 'วันที่จอง', dataIndex: 'reserved_date', key: 'reserved_date', width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatDate(v)}</span>,
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '', key: 'actions', width: 80, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'RESERVED' && can('workorder.reservation.create') && (
            <Popconfirm
              title="ยกเลิกการจองวัสดุ?"
              description={`ยกเลิกการจอง ${record.product_name || ''}`}
              onConfirm={() => handleCancel(record.id)}
              okText="ยกเลิก" cancelText="ไม่"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="ยกเลิกการจอง">
                <Button type="text" size="small" danger icon={<Ban size={14} />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table
      loading={loading}
      dataSource={items}
      columns={columns}
      rowKey="id"
      locale={{
        emptyText: (
          <EmptyState
            message="ยังไม่มีการจองวัสดุ"
            hint="กดปุ่ม 'จองวัสดุ' เพื่อจองวัสดุสำหรับ Work Order"
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
    />
  );
}

function ToolReservationTable({ onRefreshRef }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/planning/reservations/tool', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
        },
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลการจองเครื่องมือได้');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (onRefreshRef) onRefreshRef.current = fetchData;
  }, [fetchData, onRefreshRef]);

  const handleCancel = async (id) => {
    try {
      await api.put(`/api/planning/reservations/${id}/cancel`);
      message.success('ยกเลิกการจองสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถยกเลิกการจองได้');
    }
  };

  const columns = [
    {
      title: 'เครื่องมือ', dataIndex: 'tool_name', key: 'tool_name', width: 200,
      render: (v, record) => (
        <span style={{ fontWeight: 500 }}>
          {v || (
            <Text style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.textSecondary }}>
              {record.tool_id?.slice(0, 8)}...
            </Text>
          )}
        </span>
      ),
    },
    {
      title: 'Work Order', dataIndex: 'wo_number', key: 'wo_number', width: 150,
      render: (v, record) => (
        <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>
          {v || record.work_order_id?.slice(0, 8) + '...'}
        </span>
      ),
    },
    {
      title: 'วันเริ่ม', dataIndex: 'start_date', key: 'start_date', width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatDate(v)}</span>,
    },
    {
      title: 'วันสิ้นสุด', dataIndex: 'end_date', key: 'end_date', width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatDate(v)}</span>,
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '', key: 'actions', width: 80, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'RESERVED' && can('workorder.reservation.create') && (
            <Popconfirm
              title="ยกเลิกการจองเครื่องมือ?"
              description={`ยกเลิกการจอง ${record.tool_name || ''}`}
              onConfirm={() => handleCancel(record.id)}
              okText="ยกเลิก" cancelText="ไม่"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="ยกเลิกการจอง">
                <Button type="text" size="small" danger icon={<Ban size={14} />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table
      loading={loading}
      dataSource={items}
      columns={columns}
      rowKey="id"
      locale={{
        emptyText: (
          <EmptyState
            message="ยังไม่มีการจองเครื่องมือ"
            hint="กดปุ่ม 'จองเครื่องมือ' เพื่อจองเครื่องมือสำหรับ Work Order"
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
    />
  );
}

const subTabLabel = (Icon, text) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <Icon size={14} /> {text}
  </span>
);

export default function ReservationTab() {
  const { can } = usePermission();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('material');
  const materialRefreshRef = useRef(null);
  const toolRefreshRef = useRef(null);

  const handleOpenModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    setModalOpen(false);
    if (materialRefreshRef.current) materialRefreshRef.current();
    if (toolRefreshRef.current) toolRefreshRef.current();
  };

  const subItems = [
    {
      key: 'material',
      label: subTabLabel(Package, 'จองวัสดุ'),
      children: (
        <div>
          {can('workorder.reservation.create') && (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => handleOpenModal('material')}>
                จองวัสดุ
              </Button>
            </div>
          )}
          <MaterialReservationTable onRefreshRef={materialRefreshRef} />
        </div>
      ),
    },
    {
      key: 'tool',
      label: subTabLabel(Wrench, 'จองเครื่องมือ'),
      children: (
        <div>
          {can('workorder.reservation.create') && (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => handleOpenModal('tool')}>
                จองเครื่องมือ
              </Button>
            </div>
          )}
          <ToolReservationTable onRefreshRef={toolRefreshRef} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="material" items={subItems} size="small" />
      <ReservationFormModal
        open={modalOpen}
        type={modalType}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
