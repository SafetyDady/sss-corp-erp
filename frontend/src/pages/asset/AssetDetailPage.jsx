import { useState, useEffect, useCallback } from 'react';
import { Card, Descriptions, Table, Button, Space, Tag, Popconfirm, Modal, Form, InputNumber, DatePicker, App, Spin } from 'antd';
import { ArrowLeft, Edit, Trash2, Archive, TrendingDown } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import AssetFormModal from './AssetFormModal';
import dayjs from 'dayjs';

const COLORS = { cyan: '#06b6d4', cardBg: '#16161f', border: '#2a2a3a' };
const fmt = (v) => Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { message } = App.useApp();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [disposeModal, setDisposeModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [disposeForm] = Form.useForm();

  const fetchAsset = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/asset/assets/${id}`);
      setAsset(res.data);
    } catch {
      message.error('ไม่พบสินทรัพย์');
      navigate('/asset');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const res = await api.get('/api/asset/depreciation', { params: { asset_id: id, limit: 120 } });
      setEntries(res.data?.items || []);
    } catch { /* ignore */ }
    finally { setEntriesLoading(false); }
  }, [id]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/api/asset/categories');
      setCategories(res.data?.items || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAsset();
    fetchEntries();
    fetchCategories();
  }, [fetchAsset, fetchEntries, fetchCategories]);

  const handleDispose = async () => {
    try {
      const values = await disposeForm.validateFields();
      await api.post(`/api/asset/assets/${id}/dispose`, {
        disposed_date: values.disposed_date.format('YYYY-MM-DD'),
        disposal_amount: values.disposal_amount || 0,
      });
      message.success('จำหน่ายสินทรัพย์สำเร็จ');
      setDisposeModal(false);
      fetchAsset();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'เกิดข้อผิดพลาด');
    }
  };

  const handleRetire = async () => {
    try {
      await api.post(`/api/asset/assets/${id}/retire`);
      message.success('เปลี่ยนสถานะเป็น RETIRED สำเร็จ');
      fetchAsset();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'เกิดข้อผิดพลาด');
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!asset) return null;

  const entryColumns = [
    { title: 'ปี', dataIndex: 'period_year', width: 60 },
    { title: 'เดือน', dataIndex: 'period_month', width: 60 },
    { title: 'ค่าเสื่อม', dataIndex: 'depreciation_amount', width: 140, align: 'right', render: fmt },
    { title: 'ค่าเสื่อมสะสม', dataIndex: 'accumulated_depreciation', width: 140, align: 'right', render: fmt },
    { title: 'NBV', dataIndex: 'net_book_value', width: 140, align: 'right', render: (v) => <span style={{ fontWeight: 600 }}>{fmt(v)}</span> },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button type="text" icon={<ArrowLeft size={16} />} onClick={() => navigate('/asset')}>
          กลับ
        </Button>
        <Space>
          {can('asset.asset.update') && asset.status === 'ACTIVE' && (
            <Button icon={<Edit size={14} />} onClick={() => setEditModal(true)}>แก้ไข</Button>
          )}
          {can('asset.asset.update') && asset.status === 'ACTIVE' && (
            <Popconfirm title="ยืนยันเปลี่ยนสถานะเป็น RETIRED?" onConfirm={handleRetire} okText="ยืนยัน" cancelText="ยกเลิก">
              <Button icon={<Archive size={14} />}>เลิกใช้</Button>
            </Popconfirm>
          )}
          {can('asset.asset.delete') && (asset.status === 'ACTIVE' || asset.status === 'FULLY_DEPRECIATED') && (
            <Button danger icon={<Trash2 size={14} />} onClick={() => setDisposeModal(true)}>จำหน่าย</Button>
          )}
        </Space>
      </div>

      <Card style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ color: COLORS.cyan, margin: 0 }}>{asset.asset_code}</h3>
            <h2 style={{ color: '#e2e8f0', margin: '4px 0 0' }}>{asset.asset_name}</h2>
          </div>
          <StatusBadge status={asset.status} />
        </div>

        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" labelStyle={{ color: '#94a3b8' }} contentStyle={{ color: '#e2e8f0' }}>
          <Descriptions.Item label="หมวด">{asset.category_name}</Descriptions.Item>
          <Descriptions.Item label="วันที่ได้มา">{asset.acquisition_date}</Descriptions.Item>
          <Descriptions.Item label="Cost Center">{asset.cost_center_name}</Descriptions.Item>
          <Descriptions.Item label="ราคาทุน">{fmt(asset.acquisition_cost)} ฿</Descriptions.Item>
          <Descriptions.Item label="มูลค่าซาก">{fmt(asset.salvage_value)} ฿</Descriptions.Item>
          <Descriptions.Item label="อายุใช้งาน">{asset.useful_life_years} ปี</Descriptions.Item>
          <Descriptions.Item label="ค่าเสื่อมสะสม"><span style={{ color: '#f59e0b' }}>{fmt(asset.accumulated_depreciation)} ฿</span></Descriptions.Item>
          <Descriptions.Item label="มูลค่าตามบัญชี (NBV)"><span style={{ color: '#22c55e', fontWeight: 700 }}>{fmt(asset.net_book_value)} ฿</span></Descriptions.Item>
          <Descriptions.Item label="ค่าเสื่อม/เดือน">{fmt(asset.monthly_depreciation)} ฿</Descriptions.Item>
          <Descriptions.Item label="อายุคงเหลือ">{asset.remaining_life_months} เดือน</Descriptions.Item>
          <Descriptions.Item label="ที่ตั้ง">{asset.location || '-'}</Descriptions.Item>
          <Descriptions.Item label="ผู้รับผิดชอบ">{asset.responsible_employee_name || '-'}</Descriptions.Item>
          {asset.tool_code && <Descriptions.Item label="เครื่องมือ">{asset.tool_code}</Descriptions.Item>}
          {asset.po_number && <Descriptions.Item label="PO">{asset.po_number}</Descriptions.Item>}
          {asset.description && <Descriptions.Item label="รายละเอียด" span={3}>{asset.description}</Descriptions.Item>}
        </Descriptions>

        {asset.status === 'DISPOSED' && (
          <Card size="small" style={{ marginTop: 12, background: '#1e1e2a', border: '1px solid #ef4444' }}>
            <Descriptions size="small" column={3} labelStyle={{ color: '#94a3b8' }} contentStyle={{ color: '#e2e8f0' }}>
              <Descriptions.Item label="วันที่จำหน่าย">{asset.disposed_date}</Descriptions.Item>
              <Descriptions.Item label="ราคาจำหน่าย">{fmt(asset.disposal_amount)} ฿</Descriptions.Item>
              <Descriptions.Item label="กำไร/ขาดทุน">
                <span style={{ color: Number(asset.disposal_gain_loss || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                  {fmt(asset.disposal_gain_loss)} ฿
                </span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Card>

      <Card
        title={<span style={{ color: '#e2e8f0' }}><TrendingDown size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />ประวัติค่าเสื่อมราคา</span>}
        style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.border}` }}
      >
        <Table
          loading={entriesLoading}
          dataSource={entries}
          columns={entryColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 24, size: 'small' }}
        />
      </Card>

      {editModal && (
        <AssetFormModal
          open={editModal}
          onClose={() => setEditModal(false)}
          onSuccess={() => { setEditModal(false); fetchAsset(); }}
          categories={categories}
          asset={asset}
        />
      )}

      <Modal
        title="จำหน่ายสินทรัพย์"
        open={disposeModal}
        onCancel={() => setDisposeModal(false)}
        onOk={handleDispose}
        okText="ยืนยันจำหน่าย"
        okButtonProps={{ danger: true }}
      >
        <p style={{ color: '#94a3b8' }}>NBV ปัจจุบัน: <strong style={{ color: '#e2e8f0' }}>{fmt(asset.net_book_value)} ฿</strong></p>
        <Form form={disposeForm} layout="vertical" size="small">
          <Form.Item name="disposed_date" label="วันที่จำหน่าย" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="disposal_amount" label="ราคาจำหน่าย (บาท)" rules={[{ required: true }]} initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
