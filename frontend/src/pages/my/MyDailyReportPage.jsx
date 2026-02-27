import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Divider, Form, Input, Row, Select,
  Space, Table, TimePicker, App, Typography, Popconfirm,
} from 'antd';
import {
  ChevronLeft, ChevronRight, Plus, Save, Send, Trash2, FileText, Clock,
} from 'lucide-react';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { COLORS } from '../../utils/constants';

const { Text } = Typography;
const { TextArea } = Input;

/**
 * MyDailyReportPage — Staff กรอก Daily Work Report ประจำวัน
 * Route: /my/daily-report
 */
export default function MyDailyReportPage() {
  const { message } = App.useApp();
  const employeeId = useAuthStore((s) => s.employeeId);

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lookup data
  const [workOrders, setWorkOrders] = useState([]);
  const [otTypes, setOtTypes] = useState([]);

  // Form lines
  const [regularLines, setRegularLines] = useState([]);
  const [otLines, setOtLines] = useState([]);
  const [note, setNote] = useState('');

  // Load lookups
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [woRes, otRes] = await Promise.all([
          api.get('/api/work-orders', { params: { limit: 500, offset: 0 } }).catch(() => ({ data: { items: [] } })),
          api.get('/api/master/ot-types', { params: { limit: 100, offset: 0 } }).catch(() => ({ data: { items: [] } })),
        ]);
        setWorkOrders(woRes.data.items || []);
        setOtTypes(otRes.data.items || []);
      } catch {
        // silently fail
      }
    };
    loadLookups();
  }, []);

  // Load report for selected date
  const loadReport = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const res = await api.get('/api/daily-report', {
        params: {
          employee_id: employeeId,
          date_from: dateStr,
          date_to: dateStr,
          limit: 1,
          offset: 0,
        },
      });
      const items = res.data.items || [];
      if (items.length > 0) {
        const r = items[0];
        setReport(r);
        setRegularLines(
          (r.lines || [])
            .filter((l) => l.line_type === 'REGULAR')
            .map((l, i) => ({
              key: i,
              start_time: l.start_time,
              end_time: l.end_time,
              work_order_id: l.work_order_id || null,
              note: l.note || '',
            }))
        );
        setOtLines(
          (r.lines || [])
            .filter((l) => l.line_type === 'OT')
            .map((l, i) => ({
              key: i,
              start_time: l.start_time,
              end_time: l.end_time,
              work_order_id: l.work_order_id || null,
              ot_type_id: l.ot_type_id || null,
              note: l.note || '',
            }))
        );
        setNote(r.note || '');
      } else {
        setReport(null);
        setRegularLines([]);
        setOtLines([]);
        setNote('');
      }
    } catch {
      message.error('โหลดข้อมูลผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedDate, message]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Calc hours helper
  const calcHours = (start, end) => {
    if (!start || !end) return 0;
    const s = dayjs(start, 'HH:mm:ss');
    const e = dayjs(end, 'HH:mm:ss');
    const diff = e.diff(s, 'minute');
    return diff > 0 ? +(diff / 60).toFixed(2) : 0;
  };

  const totalRegular = useMemo(
    () => regularLines.reduce((sum, l) => sum + calcHours(l.start_time, l.end_time), 0),
    [regularLines]
  );
  const totalOT = useMemo(
    () => otLines.reduce((sum, l) => sum + calcHours(l.start_time, l.end_time), 0),
    [otLines]
  );

  // Status helpers
  const status = report?.status || null;
  const isReadOnly = status === 'SUBMITTED' || status === 'APPROVED';
  const isRejected = status === 'REJECTED';

  // Build lines payload
  const buildLines = () => {
    const lines = [];
    regularLines.forEach((l) => {
      if (l.start_time && l.end_time) {
        lines.push({
          line_type: 'REGULAR',
          start_time: l.start_time,
          end_time: l.end_time,
          work_order_id: l.work_order_id || null,
          note: l.note || null,
        });
      }
    });
    otLines.forEach((l) => {
      if (l.start_time && l.end_time) {
        lines.push({
          line_type: 'OT',
          start_time: l.start_time,
          end_time: l.end_time,
          work_order_id: l.work_order_id || null,
          ot_type_id: l.ot_type_id || null,
          note: l.note || null,
        });
      }
    });
    return lines;
  };

  // Save draft
  const handleSave = async () => {
    const lines = buildLines();
    if (lines.length === 0) {
      message.warning('กรุณาเพิ่มอย่างน้อย 1 บรรทัด');
      return;
    }
    setSaving(true);
    try {
      if (report && report.id) {
        await api.put(`/api/daily-report/${report.id}`, { lines, note: note || null });
        message.success('บันทึกสำเร็จ');
      } else {
        await api.post('/api/daily-report', {
          report_date: selectedDate.format('YYYY-MM-DD'),
          lines,
          note: note || null,
        });
        message.success('สร้างรายงานสำเร็จ');
      }
      await loadReport();
    } catch (err) {
      message.error(err.response?.data?.detail || 'บันทึกผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  // Submit
  const handleSubmit = async () => {
    // Save first if needed
    const lines = buildLines();
    if (lines.length === 0) {
      message.warning('กรุณาเพิ่มอย่างน้อย 1 บรรทัด');
      return;
    }
    setSaving(true);
    try {
      let reportId = report?.id;
      if (!reportId) {
        const res = await api.post('/api/daily-report', {
          report_date: selectedDate.format('YYYY-MM-DD'),
          lines,
          note: note || null,
        });
        reportId = res.data.id;
      } else {
        await api.put(`/api/daily-report/${reportId}`, { lines, note: note || null });
      }
      await api.post(`/api/daily-report/${reportId}/submit`);
      message.success('ส่งรายงานสำเร็จ');
      await loadReport();
    } catch (err) {
      message.error(err.response?.data?.detail || 'ส่งรายงานผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  // Line handlers
  const addRegularLine = () => {
    setRegularLines((prev) => [
      ...prev,
      { key: Date.now(), start_time: null, end_time: null, work_order_id: null, note: '' },
    ]);
  };
  const addOtLine = () => {
    setOtLines((prev) => [
      ...prev,
      { key: Date.now(), start_time: null, end_time: null, work_order_id: null, ot_type_id: null, note: '' },
    ]);
  };
  const updateRegularLine = (idx, field, value) => {
    setRegularLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };
  const updateOtLine = (idx, field, value) => {
    setOtLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };
  const removeRegularLine = (idx) => {
    setRegularLines((prev) => prev.filter((_, i) => i !== idx));
  };
  const removeOtLine = (idx) => {
    setOtLines((prev) => prev.filter((_, i) => i !== idx));
  };

  // No employee linked
  if (!employeeId) {
    return (
      <div>
        <PageHeader title="รายงานประจำวัน" subtitle="Daily Work Report" />
        <EmptyState
          message="ไม่พบข้อมูลพนักงาน"
          hint="กรุณาติดต่อ HR เพื่อเชื่อมบัญชีกับข้อมูลพนักงาน"
        />
      </div>
    );
  }

  const woOptions = workOrders.map((wo) => ({
    value: wo.id,
    label: `${wo.wo_number} — ${wo.description || ''}`.trim(),
  }));
  const otTypeOptions = otTypes.map((ot) => ({
    value: ot.id,
    label: ot.name,
  }));

  const timePickerProps = {
    format: 'HH:mm',
    minuteStep: 15,
    style: { width: 100 },
    disabled: isReadOnly,
    needConfirm: false,
  };

  return (
    <div>
      <PageHeader title="รายงานประจำวัน" subtitle="Daily Work Report" />

      {/* Date Navigation */}
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
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
            style={{ width: 200, textAlign: 'center' }}
          />
          <Button
            type="text"
            icon={<ChevronRight size={16} />}
            onClick={() => setSelectedDate((d) => d.add(1, 'day'))}
          />
          {status && (
            <span style={{ marginLeft: 16 }}>
              สถานะ: <StatusBadge status={status} />
            </span>
          )}
        </div>
        {isRejected && report?.reject_reason && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: COLORS.danger + '18',
              borderRadius: 6,
              color: COLORS.danger,
              fontSize: 13,
            }}
          >
            เหตุผลที่ปฏิเสธ: {report.reject_reason}
          </div>
        )}
        {status === 'APPROVED' && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: COLORS.success + '18',
              borderRadius: 6,
              color: COLORS.success,
              fontSize: 13,
            }}
          >
            อนุมัติแล้ว
            {report?.approved_at && ` — ${dayjs(report.approved_at).format('DD/MM/YYYY HH:mm')}`}
          </div>
        )}
        {status === 'SUBMITTED' && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: COLORS.accent + '18',
              borderRadius: 6,
              color: COLORS.accent,
              fontSize: 13,
            }}
          >
            รอหัวหน้าอนุมัติ
          </div>
        )}
      </Card>

      {/* Regular Lines */}
      <Card
        title={<span><Clock size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />เวลาปกติ</span>}
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}
        loading={loading}
      >
        {regularLines.map((line, idx) => (
          <Row key={line.key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
            <Col flex="none">
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>#{idx + 1}</Text>
            </Col>
            <Col flex="none">
              <TimePicker
                {...timePickerProps}
                value={line.start_time ? dayjs(line.start_time, 'HH:mm:ss') : null}
                onChange={(v) => updateRegularLine(idx, 'start_time', v ? v.format('HH:mm:ss') : null)}
                placeholder="เริ่ม"
              />
            </Col>
            <Col flex="none">
              <TimePicker
                {...timePickerProps}
                value={line.end_time ? dayjs(line.end_time, 'HH:mm:ss') : null}
                onChange={(v) => updateRegularLine(idx, 'end_time', v ? v.format('HH:mm:ss') : null)}
                placeholder="สิ้นสุด"
              />
            </Col>
            <Col flex="auto">
              <Select
                options={woOptions}
                value={line.work_order_id}
                onChange={(v) => updateRegularLine(idx, 'work_order_id', v)}
                placeholder="Work Order (ถ้ามี)"
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                disabled={isReadOnly}
              />
            </Col>
            <Col flex="none">
              <Text style={{ color: COLORS.accent, fontWeight: 600, minWidth: 50, textAlign: 'right', display: 'inline-block' }}>
                {calcHours(line.start_time, line.end_time).toFixed(2)} ชม.
              </Text>
            </Col>
            <Col flex="none">
              {!isReadOnly && (
                <Button
                  type="text"
                  danger
                  icon={<Trash2 size={14} />}
                  onClick={() => removeRegularLine(idx)}
                />
              )}
            </Col>
          </Row>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          {!isReadOnly && (
            <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={addRegularLine}>
              เพิ่มบรรทัด
            </Button>
          )}
          <Text strong style={{ color: COLORS.accent }}>
            รวม: {totalRegular.toFixed(2)} ชม.
          </Text>
        </div>
      </Card>

      {/* OT Lines */}
      <Card
        title={<span><Clock size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />OT</span>}
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}
        loading={loading}
      >
        {otLines.map((line, idx) => (
          <Row key={line.key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
            <Col flex="none">
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>#{idx + 1}</Text>
            </Col>
            <Col flex="none">
              <TimePicker
                {...timePickerProps}
                value={line.start_time ? dayjs(line.start_time, 'HH:mm:ss') : null}
                onChange={(v) => updateOtLine(idx, 'start_time', v ? v.format('HH:mm:ss') : null)}
                placeholder="เริ่ม"
              />
            </Col>
            <Col flex="none">
              <TimePicker
                {...timePickerProps}
                value={line.end_time ? dayjs(line.end_time, 'HH:mm:ss') : null}
                onChange={(v) => updateOtLine(idx, 'end_time', v ? v.format('HH:mm:ss') : null)}
                placeholder="สิ้นสุด"
              />
            </Col>
            <Col flex="auto">
              <Select
                options={woOptions}
                value={line.work_order_id}
                onChange={(v) => updateOtLine(idx, 'work_order_id', v)}
                placeholder="Work Order (ถ้ามี)"
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                disabled={isReadOnly}
              />
            </Col>
            <Col flex="none">
              <Select
                options={otTypeOptions}
                value={line.ot_type_id}
                onChange={(v) => updateOtLine(idx, 'ot_type_id', v)}
                placeholder="OT Type"
                style={{ width: 130 }}
                disabled={isReadOnly}
              />
            </Col>
            <Col flex="none">
              <Text style={{ color: COLORS.warning, fontWeight: 600, minWidth: 50, textAlign: 'right', display: 'inline-block' }}>
                {calcHours(line.start_time, line.end_time).toFixed(2)} ชม.
              </Text>
            </Col>
            <Col flex="none">
              {!isReadOnly && (
                <Button
                  type="text"
                  danger
                  icon={<Trash2 size={14} />}
                  onClick={() => removeOtLine(idx)}
                />
              )}
            </Col>
          </Row>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          {!isReadOnly && (
            <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={addOtLine}>
              เพิ่มบรรทัด
            </Button>
          )}
          <Text strong style={{ color: COLORS.warning }}>
            รวม: {totalOT.toFixed(2)} ชม.
          </Text>
        </div>
      </Card>

      {/* Note */}
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
        <Text style={{ color: COLORS.textSecondary, marginBottom: 8, display: 'block' }}>หมายเหตุ</Text>
        <TextArea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          disabled={isReadOnly}
        />
      </Card>

      {/* Summary + Actions */}
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text style={{ color: COLORS.textSecondary }}>สรุป: </Text>
            <Text strong style={{ color: COLORS.accent }}>ปกติ {totalRegular.toFixed(2)} ชม.</Text>
            <Text style={{ color: COLORS.textSecondary }}> + </Text>
            <Text strong style={{ color: COLORS.warning }}>OT {totalOT.toFixed(2)} ชม.</Text>
            <Text style={{ color: COLORS.textSecondary }}> = </Text>
            <Text strong style={{ color: COLORS.text }}>{(totalRegular + totalOT).toFixed(2)} ชม.</Text>
          </div>
          {!isReadOnly && (
            <Space>
              <Button
                icon={<Save size={14} />}
                onClick={handleSave}
                loading={saving}
              >
                บันทึกฉบับร่าง
              </Button>
              <Button
                type="primary"
                icon={<Send size={14} />}
                onClick={handleSubmit}
                loading={saving}
              >
                ส่งให้หัวหน้าอนุมัติ
              </Button>
            </Space>
          )}
        </div>
      </Card>
    </div>
  );
}
