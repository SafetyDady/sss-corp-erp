import { useCallback, useEffect, useState } from 'react';
import { Card, Col, Row, Typography, App, Empty, Tag, Button } from 'antd';
import { ChevronLeft, ChevronRight, Wrench, Package, MapPin, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { COLORS } from '../../utils/constants';

const { Text, Title } = Typography;

/**
 * MyTasksPage — งานของฉันวันนี้ (จาก Daily Plan)
 * Route: /my/tasks
 */
export default function MyTasksPage({ embedded = false }) {
  const { message } = App.useApp();
  const employeeId = useAuthStore((s) => s.employeeId);

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const res = await api.get('/api/planning/daily', {
        params: { date: dateStr, employee_id: employeeId, limit: 50, offset: 0 },
      });
      setTasks(res.data.items || res.data || []);
    } catch {
      // Endpoint might not exist yet — silently handle
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedDate]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  if (!employeeId) {
    return (
      <div>
        {!embedded && <PageHeader title="งานของฉันวันนี้" subtitle="My Tasks" />}
        <EmptyState
          message="ไม่พบข้อมูลพนักงาน"
          hint="กรุณาติดต่อ HR เพื่อเชื่อมบัญชีกับข้อมูลพนักงาน"
        />
      </div>
    );
  }

  return (
    <div>
      {!embedded && <PageHeader title="งานของฉันวันนี้" subtitle="My Tasks" />}

      {/* Date Navigation */}
      <Card style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Button
            type="text"
            icon={<ChevronLeft size={16} />}
            onClick={() => setSelectedDate((d) => d.subtract(1, 'day'))}
          />
          <Text strong style={{ color: COLORS.text, fontSize: 16 }}>
            {selectedDate.format('DD MMMM YYYY')}
          </Text>
          <Button
            type="text"
            icon={<ChevronRight size={16} />}
            onClick={() => setSelectedDate((d) => d.add(1, 'day'))}
          />
        </div>
      </Card>

      {/* Task Cards */}
      {loading ? (
        <Card loading style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} />
      ) : tasks.length === 0 ? (
        <EmptyState
          message="ไม่มีงานที่ได้รับมอบหมาย"
          hint={`วันที่ ${selectedDate.format('DD/MM/YYYY')} — ยังไม่มีการวางแผนงาน`}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {tasks.map((task) => (
            <Col xs={24} md={12} key={task.id}>
              <Card
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderLeft: `3px solid ${COLORS.accent}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <Text strong style={{ color: COLORS.accent, fontSize: 15 }}>
                      <Wrench size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      {task.wo_number || task.work_order_number || 'WO'}
                    </Text>
                    <div style={{ color: COLORS.text, marginTop: 4 }}>
                      {task.wo_description || task.work_order_description || task.description || 'ไม่มีรายละเอียด'}
                    </div>
                  </div>
                  <StatusBadge status={task.wo_status || task.work_order_status || 'OPEN'} />
                </div>

                {/* Meta info */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: COLORS.textSecondary, fontSize: 13 }}>
                  {task.planned_hours && (
                    <span>
                      <Clock size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      วางแผน: {task.planned_hours} ชม.
                    </span>
                  )}
                  {task.department_name && (
                    <span>
                      <MapPin size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {task.department_name}
                    </span>
                  )}
                </div>

                {/* Tools */}
                {task.tools && task.tools.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>เครื่องมือ:</Text>
                    <div style={{ marginTop: 4 }}>
                      {task.tools.map((t, i) => (
                        <Tag key={i} color="cyan" style={{ marginBottom: 4 }}>
                          {t.name || t.tool_name || t}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}

                {/* Materials */}
                {task.materials && task.materials.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>วัสดุ:</Text>
                    <div style={{ marginTop: 4 }}>
                      {task.materials.map((m, i) => (
                        <Tag key={i} color="blue" style={{ marginBottom: 4 }}>
                          {m.name || m.product_name || m} {m.quantity ? `x${m.quantity}` : ''}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}

                {/* Note */}
                {task.note && (
                  <div style={{ marginTop: 8, color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic' }}>
                    {task.note}
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
