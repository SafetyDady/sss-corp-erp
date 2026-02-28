import { useState, useEffect } from 'react';
import { Select, Typography } from 'antd';
import { Users } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import api from '../services/api';
import { COLORS } from '../utils/constants';
import ScopeBadge from './ScopeBadge';

const { Text } = Typography;

/**
 * EmployeeContextSelector — context switcher สำหรับ HR pages
 *
 * Props:
 *   value             — employee_id ที่เลือก (undefined = ทั้งหมดตาม scope)
 *   onChange           — (employee_id | undefined) => void
 *   style              — optional wrapper style
 *   showBadge          — แสดง ScopeBadge ข้างๆ dropdown (default: true)
 *   onEmployeesLoaded  — optional callback เมื่อโหลดรายชื่อเสร็จ
 */
export default function EmployeeContextSelector({
  value, onChange, style, showBadge = true, onEmployeesLoaded,
}) {
  const role = useAuthStore((s) => s.user?.role);
  const departmentName = useAuthStore((s) => s.departmentName);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    // Backend auto-filter ตาม role: supervisor → dept only, manager/owner → all
    api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } })
      .then((res) => {
        const active = (res.data.items || []).filter((e) => e.is_active);
        setEmployees(active);
        if (onEmployeesLoaded) onEmployeesLoaded(active);
      })
      .catch(() => {});
  }, []);

  // staff/viewer → ไม่แสดง selector (เห็นเฉพาะของตัวเอง)
  if (role === 'staff' || role === 'viewer') return null;

  const placeholder = role === 'supervisor'
    ? `ทุกคนในแผนก${departmentName ? ` (${departmentName})` : ''}`
    : 'ทั้งหมด';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', ...style }}>
      <div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          <Users size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          ดูข้อมูลพนักงาน
        </Text>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          value={value}
          onChange={onChange}
          style={{ width: 280 }}
          placeholder={placeholder}
          options={employees.map((e) => ({
            value: e.id,
            label: `${e.employee_code} — ${e.full_name}`,
          }))}
        />
      </div>
      {showBadge && <ScopeBadge style={{ marginTop: 18 }} />}
    </div>
  );
}
