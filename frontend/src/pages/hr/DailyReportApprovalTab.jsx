import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Checkbox, Col, Collapse, DatePicker, Input, Modal,
  Row, Select, Space, Table, Typography, App,
} from 'antd';
import { Check, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import EmployeeContextSelector from '../../components/EmployeeContextSelector';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;
const { TextArea } = Input;

/**
 * DailyReportApprovalTab — Supervisor/Manager อนุมัติ/ปฏิเสธ Daily Reports
 * ใช้ใน HRPage tab
 */
export default function DailyReportApprovalTab() {
  const { message } = App.useApp();

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [employeeFilter, setEmployeeFilter] = useState(undefined);
  const [approving, setApproving] = useState(false);

  // Reject modal
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const params = {
        date_from: dateStr,
        date_to: dateStr,
        limit: 100,
        offset: 0,
      };
      if (statusFilter) params.status = statusFilter;
      if (employeeFilter) params.employee_id = employeeFilter;
      const res = await api.get('/api/daily-report', { params });
      setReports(res.data.items || []);
      setSelectedIds([]);
    } catch {
      message.error('โหลดข้อมูลผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statusFilter, employeeFilter, message]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const submittedReports = reports.filter((r) => r.status === 'SUBMITTED');
  const allSubmittedSelected =
    submittedReports.length > 0 && submittedReports.every((r) => selectedIds.includes(r.id));

  const toggleSelectAll = () => {
    if (allSubmittedSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(submittedReports.map((r) => r.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Batch approve
  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) {
      message.warning('กรุณาเลือกรายงานที่จะอนุมัติ');
      return;
    }
    setApproving(true);
    try {
      await api.post('/api/daily-report/batch-approve', { report_ids: selectedIds });
      message.success(`อนุมัติสำเร็จ ${selectedIds.length} รายการ`);
      loadReports();
    } catch (err) {
      message.error(err.response?.data?.detail || 'อนุมัติผิดพลาด');
    } finally {
      setApproving(false);
    }
  };

  // Reject
  const handleRejectOpen = () => {
    if (selectedIds.length === 0) {
      message.warning('กรุณาเลือกรายงานที่จะปฏิเสธ');
      return;
    }
    setRejectReason('');
    setRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      message.warning('กรุณาระบุเหตุผล');
      return;
    }
    setRejecting(true);
    try {
      // Reject each report one by one
      for (const id of selectedIds) {
        await api.post(`/api/daily-report/${id}/reject`, { reason: rejectReason });
      }
      message.success(`ปฏิเสธสำเร็จ ${selectedIds.length} รายการ`);
      setRejectModal(false);
      loadReports();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ปฏิเสธผิดพลาด');
    } finally {
      setRejecting(false);
    }
  };

  // Line columns for expand
  const lineColumns = [
    {
      title: 'เวลา',
      key: 'time',
      width: 120,
      render: (_, l) => `${l.start_time?.substring(0, 5) || ''} — ${l.end_time?.substring(0, 5) || ''}`,
    },
    {
      title: 'Work Order',
      key: 'wo',
      render: (_, l) => l.wo_number || l.work_order_id?.substring(0, 8) || '—',
    },
    {
      title: 'ประเภท',
      dataIndex: 'line_type',
      key: 'line_type',
      width: 80,
      render: (v) => (v === 'OT' ? <span style={{ color: COLORS.warning }}>OT</span> : 'ปกติ'),
    },
    {
      title: 'ชั่วโมง',
      dataIndex: 'hours',
      key: 'hours',
      width: 70,
      align: 'right',
      render: (v) => `${Number(v || 0).toFixed(2)} ชม.`,
    },
    {
      title: 'OT Type',
      key: 'ot_type',
      width: 100,
      render: (_, l) => l.ot_type_name || '—',
    },
  ];

  return (
    <div>
      {/* Date Navigation + Filter */}
      <Card
        size="small"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              type="text"
              icon={<ChevronLeft size={16} />}
              onClick={() => setSelectedDate((d) => d.subtract(1, 'day'))}
            />
            <DatePicker
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              format="DD MMMM YYYY"
              allowClear={false}
              style={{ width: 200 }}
            />
            <Button
              type="text"
              icon={<ChevronRight size={16} />}
              onClick={() => setSelectedDate((d) => d.add(1, 'day'))}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <EmployeeContextSelector
              value={employeeFilter}
              onChange={setEmployeeFilter}
              showBadge={false}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="ทุกสถานะ"
              allowClear
              style={{ width: 150 }}
              options={[
                { value: 'SUBMITTED', label: 'SUBMITTED' },
                { value: 'APPROVED', label: 'APPROVED' },
                { value: 'REJECTED', label: 'REJECTED' },
                { value: 'DRAFT', label: 'DRAFT' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Select All + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Checkbox
          checked={allSubmittedSelected}
          indeterminate={selectedIds.length > 0 && !allSubmittedSelected}
          onChange={toggleSelectAll}
          disabled={submittedReports.length === 0}
        >
          <Text style={{ color: COLORS.textSecondary }}>
            เลือกทั้งหมด (เฉพาะ SUBMITTED — {submittedReports.length} รายการ)
          </Text>
        </Checkbox>
        <Space>
          <Button
            type="primary"
            icon={<Check size={14} />}
            onClick={handleBatchApprove}
            loading={approving}
            disabled={selectedIds.length === 0}
          >
            อนุมัติที่เลือก ({selectedIds.length})
          </Button>
          <Button
            danger
            icon={<X size={14} />}
            onClick={handleRejectOpen}
            disabled={selectedIds.length === 0}
          >
            ปฏิเสธที่เลือก
          </Button>
        </Space>
      </div>

      {/* Report Cards */}
      {loading ? (
        <Card loading style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} />
      ) : reports.length === 0 ? (
        <EmptyState
          message="ไม่มีรายงานในวันนี้"
          hint={`วันที่ ${selectedDate.format('DD/MM/YYYY')}`}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.map((report) => {
            const isSubmitted = report.status === 'SUBMITTED';
            const isApproved = report.status === 'APPROVED';
            const isRejected = report.status === 'REJECTED';

            let borderColor = COLORS.border;
            let bgColor = COLORS.card;
            if (isApproved) {
              borderColor = COLORS.success + '60';
              bgColor = COLORS.success + '08';
            } else if (isRejected) {
              borderColor = COLORS.danger + '60';
              bgColor = COLORS.danger + '08';
            }

            return (
              <Card
                key={report.id}
                size="small"
                style={{ background: bgColor, border: `1px solid ${borderColor}` }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {isSubmitted && (
                    <Checkbox
                      checked={selectedIds.includes(report.id)}
                      onChange={() => toggleSelect(report.id)}
                      style={{ marginTop: 4 }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text strong style={{ color: COLORS.text }}>
                        {report.employee_name || 'ไม่ระบุชื่อ'}{' '}
                        <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>
                          ({report.employee_code || '—'})
                        </span>
                      </Text>
                      <StatusBadge status={report.status} />
                    </div>

                    <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                      <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      ปกติ {Number(report.total_regular_hours || 0).toFixed(2)} ชม.
                      {Number(report.total_ot_hours || 0) > 0 && (
                        <span style={{ color: COLORS.warning }}>
                          {' '}| OT {Number(report.total_ot_hours).toFixed(2)} ชม.
                        </span>
                      )}
                      {' '}| {(report.lines || []).length} บรรทัด
                    </Text>

                    {isApproved && report.approved_at && (
                      <div style={{ marginTop: 4, fontSize: 12, color: COLORS.success }}>
                        อนุมัติเมื่อ {dayjs(report.approved_at).format('DD/MM/YYYY HH:mm')}
                      </div>
                    )}
                    {isRejected && report.reject_reason && (
                      <div style={{ marginTop: 4, fontSize: 12, color: COLORS.danger }}>
                        เหตุผลที่ปฏิเสธ: {report.reject_reason}
                      </div>
                    )}

                    {/* Expandable line details */}
                    {(report.lines || []).length > 0 && (
                      <Collapse
                        ghost
                        size="small"
                        style={{ marginTop: 8 }}
                        items={[
                          {
                            key: 'lines',
                            label: <Text style={{ color: COLORS.accent, fontSize: 12 }}>รายละเอียด</Text>,
                            children: (
                              <Table
                                dataSource={report.lines}
                                columns={lineColumns}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                style={{ marginTop: -8 }}
                              />
                            ),
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        title="ปฏิเสธรายงาน"
        open={rejectModal}
        onCancel={() => setRejectModal(false)}
        onOk={handleReject}
        confirmLoading={rejecting}
        okText="ปฏิเสธ"
        okButtonProps={{ danger: true }}
        cancelText="ยกเลิก"
        destroyOnHidden
      >
        <div style={{ marginBottom: 8 }}>
          <Text style={{ color: COLORS.textSecondary }}>
            กำลังปฏิเสธ {selectedIds.length} รายงาน
          </Text>
        </div>
        <TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="ระบุเหตุผลที่ปฏิเสธ (จำเป็น)"
        />
      </Modal>
    </div>
  );
}
