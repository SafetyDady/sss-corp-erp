import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Space, Select, Card, App } from 'antd';
import { Play } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import GenerateDepreciationModal from './GenerateDepreciationModal';

const fmt = (v) => Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });

export default function DepreciationTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState(null);
  const [generateModal, setGenerateModal] = useState(false);
  const [summary, setSummary] = useState([]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50, offset: (page - 1) * 50 };
      if (yearFilter) params.year = yearFilter;
      if (monthFilter) params.month = monthFilter;
      const res = await api.get('/api/asset/depreciation', { params });
      setEntries(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch {
      message.error('ไม่สามารถโหลดข้อมูลค่าเสื่อม');
    } finally {
      setLoading(false);
    }
  }, [page, yearFilter, monthFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      const params = {};
      if (yearFilter) params.year = yearFilter;
      const res = await api.get('/api/asset/depreciation/summary', { params });
      setSummary(res.data?.items || []);
    } catch { /* ignore */ }
  }, [yearFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => ({
    label: String(currentYear - i),
    value: currentYear - i,
  }));

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1}`.padStart(2, '0'),
    value: i + 1,
  }));

  const columns = [
    { title: 'รหัส', dataIndex: 'asset_code', width: 100 },
    { title: 'ชื่อสินทรัพย์', dataIndex: 'asset_name', ellipsis: true },
    { title: 'หมวด', dataIndex: 'category_name', width: 120 },
    { title: 'ปี', dataIndex: 'period_year', width: 60 },
    { title: 'เดือน', dataIndex: 'period_month', width: 60 },
    { title: 'ค่าเสื่อม', dataIndex: 'depreciation_amount', width: 140, align: 'right', render: fmt },
    { title: 'สะสม', dataIndex: 'accumulated_depreciation', width: 140, align: 'right', render: fmt },
    { title: 'NBV', dataIndex: 'net_book_value', width: 140, align: 'right', render: (v) => <span style={{ fontWeight: 600 }}>{fmt(v)}</span> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Select value={yearFilter} onChange={(v) => { setYearFilter(v); setPage(1); }} options={yearOptions} style={{ width: 100 }} />
          <Select value={monthFilter} onChange={(v) => { setMonthFilter(v); setPage(1); }} allowClear placeholder="เดือน" options={monthOptions} style={{ width: 100 }} />
        </Space>
        {can('asset.depreciation.execute') && (
          <Button type="primary" icon={<Play size={14} />} onClick={() => setGenerateModal(true)}>
            คำนวณค่าเสื่อม
          </Button>
        )}
      </div>

      <Table
        loading={loading}
        dataSource={entries}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{
          current: page,
          total,
          pageSize: 50,
          onChange: setPage,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          size: 'small',
        }}
      />

      {generateModal && (
        <GenerateDepreciationModal
          open={generateModal}
          onClose={() => setGenerateModal(false)}
          onSuccess={() => { setGenerateModal(false); fetchEntries(); fetchSummary(); }}
        />
      )}
    </div>
  );
}
