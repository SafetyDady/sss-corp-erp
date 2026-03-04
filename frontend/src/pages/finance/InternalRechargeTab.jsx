import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Button, Select, Space, App, Card, Tag, Popconfirm, Tooltip, Spin, Divider } from 'antd';
import { Plus, Play, CheckCircle, Lock, Trash2, RefreshCw } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { formatCurrency } from '../../utils/formatters';
import { COLORS } from '../../utils/constants';
import RechargeBudgetFormModal from './RechargeBudgetFormModal';
import GenerateRechargeModal from './GenerateRechargeModal';
import RechargeEntryTable from './RechargeEntryTable';

const MONTHS = [
  { value: null, label: 'ทุกเดือน' },
  { value: 1, label: 'มกราคม' }, { value: 2, label: 'กุมภาพันธ์' },
  { value: 3, label: 'มีนาคม' }, { value: 4, label: 'เมษายน' },
  { value: 5, label: 'พฤษภาคม' }, { value: 6, label: 'มิถุนายน' },
  { value: 7, label: 'กรกฎาคม' }, { value: 8, label: 'สิงหาคม' },
  { value: 9, label: 'กันยายน' }, { value: 10, label: 'ตุลาคม' },
  { value: 11, label: 'พฤศจิกายน' }, { value: 12, label: 'ธันวาคม' },
];

export default function InternalRechargeTab() {
  const { can } = usePermission();
  const { message } = App.useApp();

  // State
  const [budgets, setBudgets] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [selectedBudgetId, setSelectedBudgetId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthlyBudget, setMonthlyBudget] = useState(null);

  // Modals
  const [budgetModal, setBudgetModal] = useState(false);
  const [editBudget, setEditBudget] = useState(null);
  const [generateModal, setGenerateModal] = useState(false);

  // Fetch budgets
  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/finance/recharge/budgets', {
        params: { fiscal_year: fiscalYear, limit: 50 },
      });
      setBudgets(res.data?.items || []);
    } catch (err) {
      message.error('ไม่สามารถโหลดงบประมาณได้');
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    if (!selectedBudgetId) {
      setEntries([]);
      setMonthlyBudget(null);
      return;
    }
    setEntriesLoading(true);
    try {
      const params = { budget_id: selectedBudgetId, limit: 200 };
      if (selectedMonth) params.month = selectedMonth;
      const res = await api.get('/api/finance/recharge/entries', { params });
      setEntries(res.data?.items || []);
      setMonthlyBudget(res.data?.monthly_budget || null);
    } catch (err) {
      message.error('ไม่สามารถโหลดรายการจัดสรรได้');
    } finally {
      setEntriesLoading(false);
    }
  }, [selectedBudgetId, selectedMonth]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Status actions
  const handleActivate = async (id) => {
    try {
      await api.post(`/api/finance/recharge/budgets/${id}/activate`);
      message.success('เปิดใช้งานงบประมาณสำเร็จ');
      fetchBudgets();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'ไม่สามารถเปิดใช้งานได้');
    }
  };

  const handleClose = async (id) => {
    try {
      await api.post(`/api/finance/recharge/budgets/${id}/close`);
      message.success('ปิดงบประมาณสำเร็จ');
      fetchBudgets();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'ไม่สามารถปิดได้');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/finance/recharge/budgets/${id}`);
      message.success('ลบงบประมาณสำเร็จ');
      if (selectedBudgetId === id) setSelectedBudgetId(null);
      fetchBudgets();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'ไม่สามารถลบได้');
    }
  };

  // Stats
  const activeBudgets = budgets.filter((b) => b.status === 'ACTIVE');
  const totalAnnual = budgets.reduce((s, b) => s + parseFloat(b.annual_budget || 0), 0);
  const totalEntryAmount = entries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  // Year options (current year ± 3)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i).map((y) => ({
    value: y, label: `${y}`,
  }));

  return (
    <div>
      {/* Header Controls */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <Select
            value={fiscalYear}
            onChange={(v) => { setFiscalYear(v); setSelectedBudgetId(null); }}
            options={yearOptions}
            style={{ width: 120 }}
            suffixIcon={null}
          />
          <Tooltip title="รีเฟรช">
            <Button icon={<RefreshCw size={14} />} onClick={fetchBudgets} loading={loading} />
          </Tooltip>
        </Space>
        <Space>
          {can('finance.recharge.execute') && (
            <Button icon={<Play size={14} />} onClick={() => setGenerateModal(true)}>
              สร้างรายการจัดสรร
            </Button>
          )}
          {can('finance.recharge.create') && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditBudget(null); setBudgetModal(true); }}>
              เพิ่มงบประมาณ
            </Button>
          )}
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* Summary Stat Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} sm={8}>
              <StatCard
                title="งบประมาณรวม/ปี"
                value={formatCurrency(totalAnnual)}
                color={COLORS.accent}
              />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard
                title="ACTIVE Budgets"
                value={activeBudgets.length}
                color={COLORS.success}
              />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard
                title="ยอดจัดสรรที่แสดง"
                value={formatCurrency(totalEntryAmount)}
                color={COLORS.warning}
              />
            </Col>
          </Row>

          {/* Budget Cards */}
          {budgets.length === 0 ? (
            <EmptyState
              message="ยังไม่มีงบประมาณ"
              hint="สร้างงบประมาณ Recharge เพื่อจัดสรรค่าใช้จ่ายส่วนกลางลงแต่ละแผนก"
            />
          ) : (
            <>
              <Divider orientation="left" style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                งบประมาณ Recharge ปี {fiscalYear}
              </Divider>
              <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                {budgets.map((b) => (
                  <Col key={b.id} xs={24} sm={12} lg={8}>
                    <Card
                      size="small"
                      hoverable
                      onClick={() => setSelectedBudgetId(b.id)}
                      style={{
                        border: selectedBudgetId === b.id
                          ? `2px solid ${COLORS.accent}`
                          : `1px solid ${COLORS.border}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                          {b.source_cost_center_code}
                        </span>
                        <StatusBadge status={b.status} />
                      </div>
                      <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 }}>
                        {b.source_cost_center_name}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 600, color: COLORS.accent, marginBottom: 8 }}>
                        {formatCurrency(b.annual_budget)}
                        <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 6 }}>/ปี</span>
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>
                        รายเดือน: {formatCurrency(b.monthly_budget)}
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {b.status === 'DRAFT' && can('finance.recharge.update') && (
                          <>
                            <Tooltip title="แก้ไข">
                              <Button
                                size="small" type="text"
                                onClick={() => { setEditBudget(b); setBudgetModal(true); }}
                              >
                                แก้ไข
                              </Button>
                            </Tooltip>
                            <Popconfirm
                              title="เปิดใช้งานงบประมาณนี้?"
                              description="เมื่อ ACTIVE แล้วจะแก้ไขงบประมาณไม่ได้"
                              onConfirm={() => handleActivate(b.id)}
                            >
                              <Button size="small" type="primary" icon={<CheckCircle size={12} />}>
                                Activate
                              </Button>
                            </Popconfirm>
                          </>
                        )}
                        {b.status === 'ACTIVE' && can('finance.recharge.update') && (
                          <Popconfirm
                            title="ปิดงบประมาณนี้?"
                            description="ปิดแล้วจะสร้างรายการจัดสรรเพิ่มไม่ได้"
                            onConfirm={() => handleClose(b.id)}
                          >
                            <Button size="small" icon={<Lock size={12} />}>
                              Close
                            </Button>
                          </Popconfirm>
                        )}
                        {b.status === 'DRAFT' && can('finance.recharge.delete') && (
                          <Popconfirm
                            title="ลบงบประมาณนี้?"
                            onConfirm={() => handleDelete(b.id)}
                          >
                            <Button size="small" danger type="text" icon={<Trash2 size={12} />} />
                          </Popconfirm>
                        )}
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}

          {/* Entry List Section */}
          {selectedBudgetId && (
            <>
              <Divider orientation="left" style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                รายการจัดสรร
              </Divider>
              <div style={{ marginBottom: 12 }}>
                <Space>
                  <Select
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    options={MONTHS}
                    style={{ width: 160 }}
                    placeholder="เลือกเดือน"
                  />
                </Space>
              </div>
              <RechargeEntryTable
                entries={entries}
                loading={entriesLoading}
                monthlyBudget={monthlyBudget}
              />
            </>
          )}
        </>
      )}

      {/* Modals */}
      <RechargeBudgetFormModal
        open={budgetModal}
        onClose={() => { setBudgetModal(false); setEditBudget(null); }}
        onSuccess={fetchBudgets}
        editBudget={editBudget}
      />
      <GenerateRechargeModal
        open={generateModal}
        onClose={() => setGenerateModal(false)}
        onSuccess={() => { fetchBudgets(); fetchEntries(); }}
        budgets={budgets}
      />
    </div>
  );
}
