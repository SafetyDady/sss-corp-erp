import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, Tooltip } from 'antd';
import { Check, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function POApprovalTab({ onAction }) {
  const { can } = usePermission();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
        status: 'SUBMITTED',
      };
      const { data } = await api.get('/api/purchasing/po', { params });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await api.post(`/api/purchasing/po/${id}/approve`);
      message.success('อนุมัติใบสั่งซื้อสำเร็จ');
      fetchData();
      onAction?.();
    } catch (err) {
      message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      title: 'เลขที่ PO',
      dataIndex: 'po_number',
      key: 'po_number',
      width: 150,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'ผู้จำหน่าย',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      ellipsis: true,
    },
    {
      title: 'วันที่สั่ง',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: 'มูลค่ารวม',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right',
      render: (v) => (
        <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'SUBMITTED' && can('purchasing.po.approve') && (
            <Tooltip title="อนุมัติ">
              <Button
                type="text"
                size="small"
                icon={<Check size={14} />}
                loading={actionLoading === record.id}
                onClick={() => handleApprove(record.id)}
                style={{ color: COLORS.success }}
              />
            </Tooltip>
          )}
          <Tooltip title="ดูรายละเอียด">
            <Button
              type="text"
              size="small"
              icon={<Eye size={14} />}
              onClick={() => navigate(`/purchasing/${record.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{
          emptyText: (
            <EmptyState
              message="ไม่มีใบสั่งซื้อรออนุมัติ"
              hint="PO สถานะ SUBMITTED จะแสดงที่นี่"
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
    </div>
  );
}
