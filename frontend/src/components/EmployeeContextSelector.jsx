import { useState, useEffect, useRef, useCallback } from 'react';
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
 * Features:
 *   - Manager/Owner: grouped by department (ฝ่ายบริหาร / ฝ่ายผลิต / ...)
 *   - Supervisor: flat list (แผนกเดียว)
 *   - Server-side search with debounce 300ms
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
  const [departments, setDepartments] = useState([]);
  const [searchText, setSearchText] = useState('');
  const debounceRef = useRef(null);
  const isManagerOrOwner = role === 'manager' || role === 'owner';

  // Fetch departments list (for grouping — manager/owner only)
  useEffect(() => {
    if (!isManagerOrOwner) return;
    api.get('/api/master/departments', { params: { limit: 100, offset: 0 } })
      .then((res) => {
        setDepartments(res.data.items || []);
      })
      .catch(() => {});
  }, [isManagerOrOwner]);

  // Fetch employees (initial + on search)
  const fetchEmployees = useCallback((search) => {
    const params = { limit: 200, offset: 0 };
    if (search && search.trim()) {
      params.search = search.trim();
    }
    api.get('/api/hr/employees', { params })
      .then((res) => {
        const active = (res.data.items || []).filter((e) => e.is_active);
        setEmployees(active);
        if (onEmployeesLoaded) onEmployeesLoaded(active);
      })
      .catch(() => {});
  }, [onEmployeesLoaded]);

  // Initial fetch
  useEffect(() => {
    fetchEmployees('');
  }, [fetchEmployees]);

  // Debounced server-side search
  const handleSearch = useCallback((val) => {
    setSearchText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchEmployees(val);
    }, 300);
  }, [fetchEmployees]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // staff/viewer → ไม่แสดง selector (เห็นเฉพาะของตัวเอง)
  if (role === 'staff' || role === 'viewer') return null;

  const placeholder = role === 'supervisor'
    ? `ทุกคนในแผนก${departmentName ? ` (${departmentName})` : ''}`
    : 'ทั้งหมด';

  // Build options — grouped for manager/owner, flat for supervisor
  const buildOptions = () => {
    if (!isManagerOrOwner || departments.length === 0) {
      // Supervisor or no departments → flat list
      return employees.map((e) => ({
        value: e.id,
        label: `${e.employee_code} — ${e.full_name}`,
      }));
    }

    // Manager/Owner → group by department
    const deptMap = new Map();
    departments.forEach((d) => {
      deptMap.set(d.id, { ...d, employees: [] });
    });

    const noDept = [];

    employees.forEach((e) => {
      if (e.department_id && deptMap.has(e.department_id)) {
        deptMap.get(e.department_id).employees.push(e);
      } else {
        noDept.push(e);
      }
    });

    const grouped = [];

    // Add department groups
    for (const dept of deptMap.values()) {
      if (dept.employees.length === 0) continue;
      grouped.push({
        label: dept.name,
        options: dept.employees.map((e) => ({
          value: e.id,
          label: `${e.employee_code} — ${e.full_name}`,
        })),
      });
    }

    // Add "no department" group if any
    if (noDept.length > 0) {
      grouped.push({
        label: 'ไม่ระบุแผนก',
        options: noDept.map((e) => ({
          value: e.id,
          label: `${e.employee_code} — ${e.full_name}`,
        })),
      });
    }

    return grouped;
  };

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
          filterOption={false}
          value={value}
          onChange={(val) => {
            onChange(val);
            setSearchText('');
          }}
          onSearch={handleSearch}
          style={{ width: 300 }}
          placeholder={placeholder}
          options={buildOptions()}
          notFoundContent={searchText ? 'ไม่พบพนักงาน' : 'ไม่มีข้อมูล'}
        />
      </div>
      {showBadge && <ScopeBadge style={{ marginTop: 18 }} />}
    </div>
  );
}
