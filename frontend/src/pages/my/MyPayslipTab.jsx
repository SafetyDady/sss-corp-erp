import { useState, useEffect, useCallback } from 'react';
import { Table, Select, Modal, Descriptions, App, Typography } from 'antd';
import { Receipt } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import dayjs from 'dayjs';

const { Text } = Typography;

const currentYear = dayjs().year();
const yearOptions = Array.from({ length: 5 }, (_, i) => ({
  value: currentYear - i,
  label: `${currentYear - i}`,
}));

export default function MyPayslipTab() {
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [detailRecord, setDetailRecord] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/hr/payslips/me', {
        params: { limit: 50, offset: 0 },
      });
      setItems(data.items || []);
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูล Payslip ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side year filter
  const filteredItems = items.filter((slip) => {
    if (!slip.period_start) return true;
    return dayjs(slip.period_start).year() === selectedYear;
  });

  const columns = [
    {
      title: 'งวด',
      key: 'period',
      width: 220,
      render: (_, r) => (
        <span style={{ fontFamily: 'monospace' }}>
          {formatDate(r.period_start)} — {formatDate(r.period_end)}
        </span>
      ),
    },
    {
      title: 'เงินเดือนพื้นฐาน',
      dataIndex: 'base_salary',
      key: 'base_salary',
      width: 150,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'OT',
      dataIndex: 'ot_amount',
      key: 'ot_amount',
      width: 120,
      align: 'right',
      render: (v) => {
        const num = parseFloat(v) || 0;
        return (
          <span style={{ fontFamily: 'monospace', color: num > 0 ? COLORS.success : COLORS.textMuted }}>
            {formatCurrency(v)}
          </span>
        );
      },
    },
    {
      title: 'รายได้รวม',
      dataIndex: 'gross_amount',
      key: 'gross_amount',
      width: 150,
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{formatCurrency(v)}</span>,
    },
    {
      title: 'หักรวม',
      dataIndex: 'deductions',
      key: 'deductions',
      width: 120,
      align: 'right',
      render: (v) => {
        const num = parseFloat(v) || 0;
        return (
          <span style={{ fontFamily: 'monospace', color: num > 0 ? COLORS.error : COLORS.textMuted }}>
            {formatCurrency(v)}
          </span>
        );
      },
    },
    {
      title: 'รับสุทธิ',
      dataIndex: 'net_amount',
      key: 'net_amount',
      width: 150,
      align: 'right',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.accent }}>
          {formatCurrency(v)}
        </span>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) => <StatusBadge status={v} />,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>ปี:</Text>
        <Select
          value={selectedYear}
          onChange={setSelectedYear}
          options={yearOptions}
          style={{ width: 100 }}
          size="small"
        />
        <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
          แสดง {filteredItems.length} รายการ
        </Text>
      </div>

      <Table
        loading={loading}
        dataSource={filteredItems}
        columns={columns}
        rowKey="id"
        size="middle"
        pagination={false}
        locale={{
          emptyText: (
            <EmptyState
              message="ยังไม่มี Payslip"
              hint="Payslip จะแสดงเมื่อ HR ประมวลผลและเผยแพร่ Payroll แล้ว"
            />
          ),
        }}
        onRow={(record) => ({
          onClick: () => setDetailRecord(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* Detail Modal */}
      <Modal
        title={
          <span>
            <Receipt size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            รายละเอียด Payslip
          </span>
        }
        open={!!detailRecord}
        onCancel={() => setDetailRecord(null)}
        footer={null}
        width={520}
        destroyOnHidden
      >
        {detailRecord && (
          <Descriptions
            column={2}
            size="small"
            bordered
            style={{ marginTop: 16 }}
            labelStyle={{ background: COLORS.surface, color: COLORS.textSecondary, width: 140 }}
          >
            <Descriptions.Item label="งวด" span={2}>
              <span style={{ fontFamily: 'monospace' }}>
                {formatDate(detailRecord.period_start)} — {formatDate(detailRecord.period_end)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="ชั่วโมงปกติ">
              {parseFloat(detailRecord.regular_hours || 0).toFixed(2)} ชม.
            </Descriptions.Item>
            <Descriptions.Item label="ชั่วโมง OT">
              {parseFloat(detailRecord.ot_hours || 0).toFixed(2)} ชม.
            </Descriptions.Item>
            <Descriptions.Item label="เงินเดือนพื้นฐาน">
              <span style={{ fontFamily: 'monospace' }}>{formatCurrency(detailRecord.base_salary)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="ค่า OT">
              <span style={{ fontFamily: 'monospace', color: COLORS.success }}>
                {formatCurrency(detailRecord.ot_amount)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="รายได้รวม (Gross)">
              <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                {formatCurrency(detailRecord.gross_amount)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="หักรวม">
              <span style={{ fontFamily: 'monospace', color: COLORS.error }}>
                {formatCurrency(detailRecord.deductions)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="รับสุทธิ (Net)" span={2}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.accent, fontSize: 16 }}>
                {formatCurrency(detailRecord.net_amount)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="สถานะ" span={2}>
              <StatusBadge status={detailRecord.status} />
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
