import { Table, Tag, Typography } from 'antd';
import { formatCurrency } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import EmptyState from '../../components/EmptyState';

const { Text } = Typography;

const MONTH_NAMES = [
  '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export default function RechargeEntryTable({ entries, loading, monthlyBudget }) {
  const columns = [
    {
      title: 'แผนก', dataIndex: 'target_department_name', key: 'dept',
      render: (v, r) => (
        <div>
          <span style={{ fontWeight: 500 }}>{v || '-'}</span>
          <br />
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
            {r.target_cost_center_code}
          </Text>
        </div>
      ),
    },
    {
      title: 'งวด', key: 'period', width: 100,
      render: (_, r) => (
        <Tag color="blue">{MONTH_NAMES[r.period_month]} {r.period_year}</Tag>
      ),
    },
    {
      title: 'จำนวนคน', dataIndex: 'headcount', key: 'headcount', width: 90,
      align: 'center',
      render: (v, r) => (
        <span style={{ fontFamily: 'monospace' }}>{v} / {r.total_headcount}</span>
      ),
    },
    {
      title: 'สัดส่วน', dataIndex: 'allocation_pct', key: 'pct', width: 100,
      align: 'right',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', color: COLORS.accent }}>
          {parseFloat(v).toFixed(2)}%
        </span>
      ),
    },
    {
      title: 'จำนวนเงิน (บาท)', dataIndex: 'amount', key: 'amount', width: 160,
      align: 'right',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: COLORS.warning }}>
          {formatCurrency(v)}
        </span>
      ),
    },
    {
      title: 'CC ต้นทาง', dataIndex: 'source_cost_center_name', key: 'source', width: 140,
      render: (v) => <Text type="secondary">{v || '-'}</Text>,
    },
  ];

  // Sum amounts for footer
  const totalAmount = entries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const totalHeadcount = entries.length > 0 ? entries[0].total_headcount : 0;

  return (
    <Table
      dataSource={entries}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="middle"
      pagination={false}
      locale={{
        emptyText: (
          <EmptyState
            message="ยังไม่มีรายการจัดสรร"
            hint="เลือกงบประมาณและเดือน แล้วกด 'สร้างรายการจัดสรร'"
          />
        ),
      }}
      summary={() => {
        if (entries.length === 0) return null;
        return (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>
                <span style={{ fontWeight: 600 }}>รวมทั้งหมด</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2} align="center">
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {totalHeadcount}
                </span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>100.00%</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: COLORS.accent, fontSize: 14 }}>
                  {formatCurrency(totalAmount)}
                </span>
                {monthlyBudget && (
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                    งบ/เดือน: {formatCurrency(monthlyBudget)}
                  </div>
                )}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} />
            </Table.Summary.Row>
          </Table.Summary>
        );
      }}
    />
  );
}
