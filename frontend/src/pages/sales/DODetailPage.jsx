import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Descriptions, Button, App, Space, Popconfirm, Spin, Modal } from 'antd';
import { ArrowLeft, Pencil, Truck, X, Printer, Trash2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import PageHeader from '../../components/PageHeader';
import DOFormModal from './DOFormModal';
import DOShipModal from './DOShipModal';
import DOPrintView from './DOPrintView';
import { formatDate, formatDateTime, getApiErrorMsg } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';

export default function DODetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { message } = App.useApp();
  const [doData, setDoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/sales/delivery/${id}`);
      setDoData(data);
    } catch {
      message.error('ไม่พบข้อมูลใบส่งของ');
      navigate('/sales?tab=do');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/sales/delivery/${id}/cancel`);
      message.success('ยกเลิกใบส่งของสำเร็จ');
      fetchData();
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถยกเลิกได้'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/sales/delivery/${id}`);
      message.success('ลบใบส่งของสำเร็จ');
      navigate('/sales?tab=do');
    } catch (err) {
      message.error(getApiErrorMsg(err, 'ไม่สามารถลบได้'));
    }
  };

  const handlePrint = () => {
    setPrintModalOpen(true);
    setTimeout(() => { window.print(); }, 400);
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!doData) return null;

  const isDraft = doData.status === 'DRAFT';
  const isShipped = doData.status === 'SHIPPED';

  const lineColumns = [
    {
      title: '#', dataIndex: 'line_number', key: 'line_number', width: 50, align: 'center',
      render: (v, _, idx) => v ?? idx + 1,
    },
    {
      title: 'สินค้า', key: 'product', ellipsis: true,
      render: (_, record) => (
        <div>
          <span style={{ fontFamily: 'monospace', color: COLORS.accent, fontSize: 12 }}>
            {record.product_sku || '-'}
          </span>
          {record.product_name && (
            <span style={{ color: COLORS.text, marginLeft: 8 }}>{record.product_name}</span>
          )}
        </div>
      ),
    },
    {
      title: 'หน่วย', key: 'unit', width: 80,
      render: (_, record) => record.product_unit || '-',
    },
    {
      title: 'จำนวนสั่ง', dataIndex: 'ordered_qty', key: 'ordered_qty', width: 100, align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'จำนวนส่ง', dataIndex: 'shipped_qty', key: 'shipped_qty', width: 100, align: 'right',
      render: (v, record) => {
        if (v === 0 && doData.status === 'DRAFT') return <span style={{ color: COLORS.textMuted }}>-</span>;
        const color = v >= record.ordered_qty ? COLORS.success : COLORS.warning;
        return <span style={{ color, fontWeight: 600 }}>{v}</span>;
      },
    },
    {
      title: 'ตำแหน่ง', key: 'location', width: 180,
      render: (_, record) => {
        if (!record.location_name) return <span style={{ color: COLORS.textMuted }}>-</span>;
        return (
          <span style={{ fontSize: 12 }}>
            {record.warehouse_name && <span style={{ color: COLORS.textMuted }}>{record.warehouse_name} / </span>}
            {record.location_name}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {doData.do_number}
            <StatusBadge status={doData.status} />
          </span>
        }
        subtitle="รายละเอียดใบส่งของ"
        actions={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/sales?tab=do')}>
              กลับ
            </Button>

            {/* DRAFT actions */}
            {isDraft && can('sales.delivery.update') && (
              <Button
                icon={<Pencil size={14} />}
                onClick={() => setEditModalOpen(true)}
              >
                แก้ไข
              </Button>
            )}
            {isDraft && can('sales.delivery.approve') && (
              <Button
                type="primary"
                icon={<Truck size={14} />}
                onClick={() => setShipModalOpen(true)}
                style={{ background: COLORS.success }}
              >
                ยืนยันจัดส่ง
              </Button>
            )}
            {isDraft && can('sales.delivery.update') && (
              <Popconfirm title="ยกเลิกใบส่งของ?" onConfirm={handleCancel}>
                <Button danger icon={<X size={14} />} loading={actionLoading}>
                  ยกเลิก
                </Button>
              </Popconfirm>
            )}
            {isDraft && can('sales.delivery.delete') && (
              <Popconfirm title="ลบใบส่งของ?" onConfirm={handleDelete} okButtonProps={{ danger: true }}>
                <Button danger icon={<Trash2 size={14} />}>
                  ลบ
                </Button>
              </Popconfirm>
            )}

            {/* Print — always visible */}
            <Button icon={<Printer size={14} />} onClick={handlePrint}>
              พิมพ์
            </Button>
          </Space>
        }
      />

      {/* Info Card */}
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="เลขที่ DO">
            <span style={{ fontFamily: 'monospace' }}>{doData.do_number}</span>
          </Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            <StatusBadge status={doData.status} />
          </Descriptions.Item>
          <Descriptions.Item label="SO">
            {doData.so_number ? (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontFamily: 'monospace' }}
                onClick={() => navigate(`/sales/${doData.so_id}`)}
              >
                {doData.so_number}
              </Button>
            ) : (
              <span style={{ color: COLORS.textMuted }}>-</span>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="ลูกค้า">
            {doData.customer_name || <span style={{ color: COLORS.textMuted }}>-</span>}
            {doData.customer_code && (
              <span style={{ color: COLORS.textMuted, marginLeft: 4 }}>({doData.customer_code})</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="วันที่ส่ง">
            {formatDate(doData.delivery_date)}
          </Descriptions.Item>
          <Descriptions.Item label="ผู้สร้าง">
            {doData.creator_name || <span style={{ color: COLORS.textMuted }}>-</span>}
          </Descriptions.Item>

          {doData.shipping_address && (
            <Descriptions.Item label="ที่อยู่จัดส่ง" span={3}>
              {doData.shipping_address}
            </Descriptions.Item>
          )}
          {doData.shipping_method && (
            <Descriptions.Item label="วิธีการส่ง">
              {doData.shipping_method}
            </Descriptions.Item>
          )}

          {doData.shipped_at && (
            <Descriptions.Item label="จัดส่งเมื่อ">
              <span style={{ color: COLORS.success }}>{formatDateTime(doData.shipped_at)}</span>
            </Descriptions.Item>
          )}
          {doData.shipped_by_name && (
            <Descriptions.Item label="ผู้จัดส่ง">
              {doData.shipped_by_name}
            </Descriptions.Item>
          )}

          {doData.note && (
            <Descriptions.Item label="หมายเหตุ" span={3}>
              {doData.note}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Lines Table */}
      <h3 style={{ color: COLORS.text, marginBottom: 16 }}>รายการสินค้า</h3>
      <Table
        dataSource={doData.lines || []}
        columns={lineColumns}
        rowKey="id"
        pagination={false}
        size="small"
      />

      {/* Edit Modal (reopen DOFormModal in edit mode — but for now navigate) */}
      {editModalOpen && (
        <DOFormModal
          open={editModalOpen}
          editRecord={doData}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => { setEditModalOpen(false); fetchData(); }}
        />
      )}

      {/* Ship Modal */}
      <DOShipModal
        open={shipModalOpen}
        doData={doData}
        onClose={() => setShipModalOpen(false)}
        onSuccess={() => { setShipModalOpen(false); fetchData(); }}
      />

      {/* Print Modal */}
      <Modal
        open={printModalOpen}
        onCancel={() => setPrintModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPrintModalOpen(false)}>ปิด</Button>,
          <Button
            key="print"
            type="primary"
            icon={<Printer size={14} />}
            onClick={() => window.print()}
          >
            พิมพ์
          </Button>,
        ]}
        title="ใบส่งของ / Delivery Order"
        width={700}
        destroyOnHidden
      >
        <DOPrintView doData={doData} />
      </Modal>
    </div>
  );
}
