# Phase 6 Frontend — Data Scope UI ✅ COMPLETED

> **Scope Document สำหรับ Opus 4.6 Co-pilot** — ✅ IMPLEMENTED 2026-02-28
> อ้างอิง: CLAUDE.md, UI_GUIDELINES.md, PHASE6_DATA_SCOPE.md (backend เสร็จแล้ว)

---

## สรุปงาน

Phase 6 Backend เสร็จแล้ว — backend enforce 3-tier data scope:
- **staff** → เห็นเฉพาะข้อมูลของตัวเอง
- **supervisor** → เห็นข้อมูลแผนกตัวเอง
- **manager/owner** → เห็นทั้ง org

**งาน Frontend นี้**: ปรับ UI ให้สะท้อน data scope ที่ backend ทำไว้

**Total: 8 Steps, 14 ไฟล์ (2 สร้างใหม่, 12 แก้ไข) — ✅ ALL DONE**

---

## Step 1: Backend — เพิ่ม department_name ใน /api/auth/me

### 1.1 แก้ Schema

**ไฟล์:** `backend/app/schemas/auth.py` — line 52

เพิ่ม field `department_name` หลัง `hire_date`:

```python
# BEFORE (line 46-52)
class UserMe(UserResponse):
    permissions: list[str]
    employee_id: Optional[UUID] = None
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_id: Optional[UUID] = None
    hire_date: Optional[date] = None

# AFTER
class UserMe(UserResponse):
    permissions: list[str]
    employee_id: Optional[UUID] = None
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None      # ← เพิ่มบรรทัดนี้
    hire_date: Optional[date] = None
```

### 1.2 แก้ API Route

**ไฟล์:** `backend/app/api/auth.py` — lines 147-170

เพิ่ม query Department เพื่อดึง name:

```python
# BEFORE (lines 147-170)
    # Phase 5: Query linked employee for Staff Portal
    from app.models.hr import Employee
    emp_result = await db.execute(
        select(Employee).where(
            Employee.user_id == user.id,
            Employee.is_active == True,
        )
    )
    employee = emp_result.scalar_one_or_none()

    return UserMe(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        permissions=permissions,
        employee_id=employee.id if employee else None,
        employee_name=employee.full_name if employee else None,
        employee_code=employee.employee_code if employee else None,
        department_id=employee.department_id if employee else None,
        hire_date=employee.hire_date if employee else None,
    )

# AFTER
    # Phase 5: Query linked employee for Staff Portal
    from app.models.hr import Employee
    from app.models.organization import Department
    emp_result = await db.execute(
        select(Employee).where(
            Employee.user_id == user.id,
            Employee.is_active == True,
        )
    )
    employee = emp_result.scalar_one_or_none()

    # Phase 6: Query department name
    department_name = None
    if employee and employee.department_id:
        dept_result = await db.execute(
            select(Department).where(Department.id == employee.department_id)
        )
        dept = dept_result.scalar_one_or_none()
        department_name = dept.name if dept else None

    return UserMe(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        permissions=permissions,
        employee_id=employee.id if employee else None,
        employee_name=employee.full_name if employee else None,
        employee_code=employee.employee_code if employee else None,
        department_id=employee.department_id if employee else None,
        department_name=department_name,                               # ← เพิ่ม
        hire_date=employee.hire_date if employee else None,
    )
```

### 1.3 แก้ authStore

**ไฟล์:** `frontend/src/stores/authStore.js`

**3 จุดที่ต้องแก้:**

**(A) State — line 24, เพิ่มหลัง `hireDate: null`:**
```javascript
// BEFORE (lines 19-24)
      employeeId: null,
      employeeName: null,
      employeeCode: null,
      departmentId: null,
      hireDate: null,

// AFTER
      employeeId: null,
      employeeName: null,
      employeeCode: null,
      departmentId: null,
      departmentName: null,    // ← เพิ่ม
      hireDate: null,
```

**(B) fetchMe — line 62, เพิ่มหลัง `departmentId`:**
```javascript
// BEFORE (lines 58-63)
            employeeId: data.employee_id || null,
            employeeName: data.employee_name || null,
            employeeCode: data.employee_code || null,
            departmentId: data.department_id || null,
            hireDate: data.hire_date || null,

// AFTER
            employeeId: data.employee_id || null,
            employeeName: data.employee_name || null,
            employeeCode: data.employee_code || null,
            departmentId: data.department_id || null,
            departmentName: data.department_name || null,    // ← เพิ่ม
            hireDate: data.hire_date || null,
```

**(C) logout — line 84, เพิ่มหลัง `departmentId: null`:**
```javascript
// BEFORE (lines 81-85)
          employeeId: null,
          employeeName: null,
          employeeCode: null,
          departmentId: null,
          hireDate: null,

// AFTER
          employeeId: null,
          employeeName: null,
          employeeCode: null,
          departmentId: null,
          departmentName: null,    // ← เพิ่ม
          hireDate: null,
```

**(D) partialize — line 124, เพิ่มหลัง `departmentId`:**
```javascript
// BEFORE (lines 121-125)
        employeeId: state.employeeId,
        employeeName: state.employeeName,
        employeeCode: state.employeeCode,
        departmentId: state.departmentId,
        hireDate: state.hireDate,

// AFTER
        employeeId: state.employeeId,
        employeeName: state.employeeName,
        employeeCode: state.employeeCode,
        departmentId: state.departmentId,
        departmentName: state.departmentName,    // ← เพิ่ม
        hireDate: state.hireDate,
```

---

## Step 2: Fix MePage Bug — เพิ่ม employee_id

**ไฟล์:** `frontend/src/pages/my/MePage.jsx`

**ปัญหา:** Lines 29-33 fetch 3 APIs โดยไม่ส่ง `employee_id` → อาจได้ข้อมูลคนอื่น (ถ้า role เป็น supervisor+)

**แก้ไข:**

**(A) เพิ่ม employeeId จาก store — line 19, มีอยู่แล้ว:**
`employeeId` ถูก import ทางอ้อมจาก authStore ผ่าน line 4 แต่ไม่ได้ extract ใน component
เพิ่มหลัง line 21:
```javascript
// BEFORE (lines 18-22)
  const user = useAuthStore((s) => s.user);
  const employeeName = useAuthStore((s) => s.employeeName);
  const employeeCode = useAuthStore((s) => s.employeeCode);
  const hireDate = useAuthStore((s) => s.hireDate);

// AFTER
  const user = useAuthStore((s) => s.user);
  const employeeName = useAuthStore((s) => s.employeeName);
  const employeeCode = useAuthStore((s) => s.employeeCode);
  const employeeId = useAuthStore((s) => s.employeeId);    // ← เพิ่ม
  const hireDate = useAuthStore((s) => s.hireDate);
```

**(B) Guard + เพิ่ม employee_id — lines 25-47:**
```javascript
// BEFORE (lines 25-47)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = dayjs().format('YYYY-MM-DD');
        const [tasksRes, leaveRes, reportRes] = await Promise.allSettled([
          api.get('/api/planning/daily', { params: { date_from: today, date_to: today, limit: 100 } }),
          api.get('/api/hr/leave', { params: { limit: 100 } }),
          api.get('/api/daily-report', { params: { date_from: today, date_to: today, limit: 1 } }),
        ]);
        ...
      } catch { /* ignore */ }
    };
    fetchStats();
  }, []);

// AFTER
  useEffect(() => {
    if (!employeeId) return;    // ← Guard
    const fetchStats = async () => {
      try {
        const today = dayjs().format('YYYY-MM-DD');
        const [tasksRes, leaveRes, reportRes] = await Promise.allSettled([
          api.get('/api/planning/daily', { params: { date_from: today, date_to: today, limit: 100, employee_id: employeeId } }),
          api.get('/api/hr/leave', { params: { limit: 100, employee_id: employeeId } }),
          api.get('/api/daily-report', { params: { date_from: today, date_to: today, limit: 1, employee_id: employeeId } }),
        ]);
        ...
      } catch { /* ignore */ }
    };
    fetchStats();
  }, [employeeId]);    // ← เพิ่ม dependency
```

---

## Step 3: สร้าง ScopeBadge Component

**ไฟล์ใหม่:** `frontend/src/components/ScopeBadge.jsx`

สร้างไฟล์ใหม่ทั้งหมด:

```jsx
import { Eye } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import { COLORS } from '../utils/constants';

const SCOPE_CONFIG = {
  staff:      { label: 'ข้อมูลของฉัน',     color: COLORS.accent },
  viewer:     { label: 'ข้อมูลของฉัน',     color: COLORS.accent },
  supervisor: { label: null,                 color: COLORS.purple },
  manager:    { label: 'ทั้งองค์กร',        color: COLORS.success },
  owner:      { label: 'ทั้งองค์กร',        color: COLORS.success },
};

export default function ScopeBadge({ style }) {
  const role = useAuthStore((s) => s.user?.role);
  const departmentName = useAuthStore((s) => s.departmentName);

  if (!role) return null;

  const config = SCOPE_CONFIG[role] || SCOPE_CONFIG.staff;
  let label = config.label;
  if (role === 'supervisor') {
    label = departmentName ? `แผนก: ${departmentName}` : 'แผนกของฉัน';
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: `${config.color}18`,
      color: config.color,
      padding: '3px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.3,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      <Eye size={12} />
      {label}
    </span>
  );
}
```

**Design notes:**
- Styling เหมือน `StatusBadge.jsx` เป๊ะ (bg opacity `18`, borderRadius 6, fontSize 11, fontWeight 600)
- Icon: Lucide `Eye` (ไม่ใช้ emoji)
- staff/viewer → cyan "ข้อมูลของฉัน"
- supervisor → purple "แผนก: {departmentName}"
- manager/owner → green "ทั้งองค์กร"

---

## Step 4: สร้าง SupervisorDashboard

**ไฟล์:** `frontend/src/pages/DashboardPage.jsx`

### 4.1 เพิ่ม imports — line 7

เพิ่ม icon ที่ต้องใช้ ใน import ที่ line 4-7:
```javascript
// BEFORE (lines 4-7)
import {
  FileText, Package, Users, Wrench, ClipboardList, CalendarOff,
  CalendarCheck, Clock, ArrowRight, Edit,
} from 'lucide-react';

// AFTER
import {
  FileText, Package, Users, Wrench, ClipboardList, CalendarOff,
  CalendarCheck, Clock, ArrowRight, Edit, CheckCircle,
} from 'lucide-react';
```

เพิ่ม import ScopeBadge หลัง line 14:
```javascript
import ScopeBadge from '../components/ScopeBadge';
```

### 4.2 สร้าง SupervisorDashboard component

เพิ่มระหว่าง `StaffDashboard` (line 229) กับ `AdminDashboard` (line 234):

```jsx
// ============================================================
// Supervisor Dashboard
// ============================================================
function SupervisorDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const employeeId = useAuthStore((s) => s.employeeId);
  const employeeName = useAuthStore((s) => s.employeeName);
  const departmentName = useAuthStore((s) => s.departmentName);
  const { can } = usePermission();

  const [stats, setStats] = useState({
    deptEmployees: 0, todayReports: 0, pendingApprovals: 0, workOrders: 0,
  });
  const [myReport, setMyReport] = useState(null);
  const [myLeaveBalance, setMyLeaveBalance] = useState(null);

  useEffect(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const year = dayjs().year();
    const requests = [];

    // Department stats
    if (can('hr.employee.read')) {
      requests.push(
        api.get('/api/hr/employees', { params: { limit: 1, offset: 0 } })
          .then((r) => ({ key: 'deptEmployees', value: r.data.total || 0 }))
          .catch(() => ({ key: 'deptEmployees', value: 0 }))
      );
    }
    requests.push(
      api.get('/api/daily-report', { params: { date_from: today, date_to: today, limit: 1, offset: 0 } })
        .then((r) => ({ key: 'todayReports', value: r.data.total || 0 }))
        .catch(() => ({ key: 'todayReports', value: 0 }))
    );
    requests.push(
      api.get('/api/daily-report', { params: { status: 'SUBMITTED', limit: 1, offset: 0 } })
        .then((r) => ({ key: 'pendingApprovals', value: r.data.total || 0 }))
        .catch(() => ({ key: 'pendingApprovals', value: 0 }))
    );
    if (can('workorder.order.read')) {
      requests.push(
        api.get('/api/work-orders', { params: { limit: 1, offset: 0 } })
          .then((r) => ({ key: 'workOrders', value: r.data.total || 0 }))
          .catch(() => ({ key: 'workOrders', value: 0 }))
      );
    }

    // Personal data
    if (employeeId) {
      requests.push(
        api.get('/api/daily-report', { params: { employee_id: employeeId, date_from: today, date_to: today, limit: 1 } })
          .then((r) => ({ key: '_myReport', value: (r.data.items || [])[0] || null }))
          .catch(() => ({ key: '_myReport', value: null }))
      );
      requests.push(
        api.get('/api/hr/leave-balance', { params: { employee_id: employeeId, year, limit: 100 } })
          .then((r) => ({ key: '_myBalance', value: r.data.items || r.data || [] }))
          .catch(() => ({ key: '_myBalance', value: [] }))
      );
    }

    Promise.all(requests).then((results) => {
      const newStats = { ...stats };
      results.forEach((r) => {
        if (r.key === '_myReport') setMyReport(r.value);
        else if (r.key === '_myBalance') {
          const annual = r.value.find((b) => b.leave_type_code === 'ANNUAL');
          setMyLeaveBalance(annual || (r.value.length > 0 ? r.value[0] : null));
        }
        else newStats[r.key] = r.value;
      });
      setStats(newStats);
    });
  }, [employeeId]);

  const deptCards = [
    { title: 'พนักงานในแผนก', value: stats.deptEmployees, icon: <Users size={20} />, color: COLORS.purple },
    { title: 'รายงานวันนี้', value: stats.todayReports, icon: <ClipboardList size={20} />, color: COLORS.accent },
    { title: 'รอการอนุมัติ', value: stats.pendingApprovals, icon: <CheckCircle size={20} />, color: COLORS.warning },
    { title: 'Work Orders', value: stats.workOrders, icon: <FileText size={20} />, color: '#3b82f6' },
  ];

  return (
    <div>
      <PageHeader
        title={`สวัสดี, ${employeeName || user?.full_name || 'User'}!`}
        subtitle={<span>ภาพรวมแผนก <ScopeBadge /></span>}
      />

      {/* Department Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {deptCards.map((card, i) => (
          <Col xs={12} sm={12} md={6} key={i}>
            <StatCard title={card.title} value={card.value} icon={card.icon} color={card.color} />
          </Col>
        ))}
      </Row>

      {/* Quick Actions */}
      <Card
        size="small"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}
      >
        <Space wrap>
          {can('hr.dailyreport.approve') && (
            <Button type="primary" icon={<CheckCircle size={14} />} onClick={() => navigate('/hr')}>
              อนุมัติรายงาน
            </Button>
          )}
          {can('workorder.plan.create') && (
            <Button icon={<CalendarCheck size={14} />} onClick={() => navigate('/planning')}>
              วางแผนงาน
            </Button>
          )}
          <Button icon={<Users size={14} />} onClick={() => navigate('/hr')}>
            จัดการพนักงาน
          </Button>
        </Space>
      </Card>

      {/* Personal Section */}
      <Card
        title={<Text style={{ fontSize: 14 }}>ข้อมูลของฉัน</Text>}
        size="small"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        extra={<Button type="link" size="small" onClick={() => navigate('/me')}>ดูทั้งหมด <ArrowRight size={12} /></Button>}
      >
        <Row gutter={[12, 12]}>
          <Col xs={12}>
            <StatCard
              title="Report วันนี้"
              value={myReport ? myReport.status : 'ยังไม่กรอก'}
              icon={<ClipboardList size={20} />}
              color={myReport ? COLORS.success : COLORS.warning}
            />
          </Col>
          <Col xs={12}>
            <StatCard
              title="วันลาเหลือ"
              value={myLeaveBalance ? `${Number(myLeaveBalance.quota || 0) - Number(myLeaveBalance.used || 0)}` : '—'}
              subtitle={myLeaveBalance ? 'วัน' : ''}
              icon={<CalendarOff size={20} />}
              color={COLORS.accent}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
}
```

### 4.3 เปลี่ยน routing logic — lines 314-325

```javascript
// BEFORE (lines 314-325)
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  // Staff and Viewer get the personal/staff dashboard
  if (role === 'staff' || role === 'viewer') {
    return <StaffDashboard />;
  }

  // Manager, Supervisor, Owner get admin dashboard
  return <AdminDashboard />;
}

// AFTER
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  if (role === 'staff' || role === 'viewer') {
    return <StaffDashboard />;
  }
  if (role === 'supervisor') {
    return <SupervisorDashboard />;
  }
  return <AdminDashboard />;
}
```

---

## Step 5: สร้าง EmployeeContextSelector Component

**ไฟล์ใหม่:** `frontend/src/components/EmployeeContextSelector.jsx`

```jsx
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
```

**Key:**
- staff/viewer → return null (ไม่แสดง)
- Backend `/api/hr/employees` auto-filter ตาม role (Phase 6 backend ทำไว้แล้ว)
- `onEmployeesLoaded` callback สำหรับ WOTimeEntryForm ที่ต้องใช้ employees list ทำ lookup

---

## Step 6: เพิ่ม Scope UI ใน HR Pages

### 6.1 HRPage.jsx — เพิ่ม ScopeBadge

**ไฟล์:** `frontend/src/pages/hr/HRPage.jsx`

**เพิ่ม import — line 3:**
```javascript
// BEFORE (line 3)
import PageHeader from '../../components/PageHeader';

// AFTER
import PageHeader from '../../components/PageHeader';
import ScopeBadge from '../../components/ScopeBadge';
```

**เปลี่ยน PageHeader subtitle — line 71:**
```javascript
// BEFORE (lines 69-72)
      <PageHeader
        title="HR"
        subtitle="บริหารจัดการทรัพยากรบุคคล — พนักงาน, Timesheet, ลาหยุด, Payroll"
      />

// AFTER
      <PageHeader
        title="HR"
        subtitle={<span>บริหารจัดการทรัพยากรบุคคล <ScopeBadge /></span>}
      />
```

### 6.2 TimesheetTab.jsx — เพิ่ม EmployeeContextSelector

**ไฟล์:** `frontend/src/pages/hr/TimesheetTab.jsx`

**เพิ่ม import — หลัง line 9:**
```javascript
import EmployeeContextSelector from '../../components/EmployeeContextSelector';
```

**เพิ่ม state — หลัง line 27:**
```javascript
  const [selectedEmployee, setSelectedEmployee] = useState(undefined);
```

**เพิ่ม employee_id ใน fetchData — line 33-38:**
```javascript
// BEFORE (lines 32-38)
      const { data } = await api.get('/api/hr/timesheet', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
        },
      });

// AFTER
      const { data } = await api.get('/api/hr/timesheet', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
          employee_id: selectedEmployee || undefined,    // ← เพิ่ม
        },
      });
```

**เพิ่ม `selectedEmployee` ใน dependency array — line 47:**
```javascript
// BEFORE
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

// AFTER
  }, [pagination.current, pagination.pageSize, search, statusFilter, selectedEmployee]);
```

**เพิ่ม EmployeeContextSelector ใน render — ก่อน line 143:**
```jsx
// BEFORE (line 142)
    <div>
      <div style={{ marginBottom: 16, ...

// AFTER
    <div>
      <div style={{ marginBottom: 16 }}>
        <EmployeeContextSelector
          value={selectedEmployee}
          onChange={(val) => { setSelectedEmployee(val); setPagination((p) => ({ ...p, current: 1 })); }}
        />
      </div>
      <div style={{ marginBottom: 16, ...
```

### 6.3 LeaveTab.jsx — เพิ่ม EmployeeContextSelector

**ไฟล์:** `frontend/src/pages/hr/LeaveTab.jsx`

**เพิ่ม import — หลัง line 9:**
```javascript
import EmployeeContextSelector from '../../components/EmployeeContextSelector';
```

**เพิ่ม state — หลัง line 38:**
```javascript
  const [selectedEmployee, setSelectedEmployee] = useState(undefined);
```

**เพิ่ม employee_id ใน fetchData — line 43-48:**
```javascript
// BEFORE (lines 43-48)
      const { data } = await api.get('/api/hr/leave', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          status: statusFilter || undefined,
        },
      });

// AFTER
      const { data } = await api.get('/api/hr/leave', {
        params: {
          limit: pagination.pageSize,
          offset: (pagination.current - 1) * pagination.pageSize,
          status: statusFilter || undefined,
          employee_id: selectedEmployee || undefined,    // ← เพิ่ม
        },
      });
```

**เพิ่ม `selectedEmployee` ใน dependency array — line 57:**
```javascript
// BEFORE
  }, [pagination.current, pagination.pageSize, statusFilter]);

// AFTER
  }, [pagination.current, pagination.pageSize, statusFilter, selectedEmployee]);
```

**เพิ่ม EmployeeContextSelector ใน render — ก่อน line 137:**
```jsx
// BEFORE (line 136)
    <div>
      <div style={{ marginBottom: 16, ...

// AFTER
    <div>
      <div style={{ marginBottom: 16 }}>
        <EmployeeContextSelector
          value={selectedEmployee}
          onChange={(val) => { setSelectedEmployee(val); setPagination((p) => ({ ...p, current: 1 })); }}
        />
      </div>
      <div style={{ marginBottom: 16, ...
```

### 6.4 StandardTimesheetView.jsx — แทนที่ Select เดิม

**ไฟล์:** `frontend/src/pages/hr/StandardTimesheetView.jsx`

**เพิ่ม import — หลัง line 6:**
```javascript
import EmployeeContextSelector from '../../components/EmployeeContextSelector';
```

**ลบ employees state + fetch (lines 28-36):**
```javascript
// DELETE lines 28-36:
  const [employees, setEmployees] = useState([]);
  ...
  useEffect(() => {
    api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } })
      .then((res) => setEmployees((res.data.items || []).filter((e) => e.is_active)))
      .catch(() => {});
  }, []);
```

**เก็บ employees state สำหรับ empMap (line 81-82) — ใช้ onEmployeesLoaded:**
```javascript
  const [employees, setEmployees] = useState([]);    // เก็บไว้สำหรับ empMap
```

**แทนที่ Select ในส่วน render (lines 124-133):**
```jsx
// BEFORE (lines 122-134)
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>พนักงาน</Text>
            <Select
              allowClear showSearch optionFilterProp="label"
              value={selectedEmployee} onChange={setSelectedEmployee}
              style={{ width: 280 }} placeholder="ทั้งหมด"
              options={employees.map((e) => ({
                value: e.id, label: `${e.employee_code} — ${e.full_name}`,
              }))}
            />
          </div>
          <div>

// AFTER
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <EmployeeContextSelector
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            showBadge={false}
            onEmployeesLoaded={setEmployees}
          />
          <div>
```

**ลบ** `useEffect` ที่ fetch employees (lines 32-36) — EmployeeContextSelector จะ fetch แทน

### 6.5 LeaveBalanceTab.jsx — แทนที่ Select เดิม

**ไฟล์:** `frontend/src/pages/hr/LeaveBalanceTab.jsx`

**เพิ่ม import — หลัง line 6:**
```javascript
import EmployeeContextSelector from '../../components/EmployeeContextSelector';
```

**ลบ employees fetch (lines 30-34):**
```javascript
// DELETE lines 30-34:
  useEffect(() => {
    api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } })
      .then((res) => setEmployees((res.data.items || []).filter((e) => e.is_active)))
      .catch(() => {});
  }, []);
```

**แทนที่ Select ในส่วน render (lines 148-160):**
```jsx
// BEFORE (lines 148-160)
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>พนักงาน</Text>
            <Select
              allowClear showSearch optionFilterProp="label"
              value={selectedEmployee} onChange={setSelectedEmployee}
              style={{ width: 280 }} placeholder="ทั้งหมด"
              options={employees.map((e) => ({
                value: e.id, label: `${e.employee_code} — ${e.full_name}`,
              }))}
            />
          </div>
          <div>

// AFTER
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <EmployeeContextSelector
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            showBadge={false}
          />
          <div>
```

**ลบ** `const [employees, setEmployees] = useState([]);` (line 24) — ไม่ต้องใช้แล้ว

### 6.6 WOTimeEntryForm.jsx — แทนที่ employee Select

**ไฟล์:** `frontend/src/pages/hr/WOTimeEntryForm.jsx`

**เพิ่ม import — หลัง line 4:**
```javascript
import EmployeeContextSelector from '../../components/EmployeeContextSelector';
```

**แก้ไข Promise.all — line 23-34:**

ลบ employees fetch ออกจาก Promise.all:
```javascript
// BEFORE (lines 22-34)
  useEffect(() => {
    Promise.all([
      api.get('/api/hr/employees', { params: { limit: 500, offset: 0 } }),
      api.get('/api/work-orders', { params: { limit: 500, offset: 0, status: 'OPEN' } }),
      api.get('/api/master/ot-types', { params: { limit: 50, offset: 0 } }),
      api.get('/api/admin/approvers', { params: { module: 'hr.timesheet' } }),
    ]).then(([empRes, woRes, otRes, appRes]) => {
      setEmployees((empRes.data.items || []).filter((e) => e.is_active));
      setWorkOrders(woRes.data.items || []);
      setOtTypes((otRes.data.items || []).filter((t) => t.is_active));
      setApprovers(appRes.data);
    }).catch(() => {});
  }, []);

// AFTER
  useEffect(() => {
    Promise.all([
      api.get('/api/work-orders', { params: { limit: 500, offset: 0, status: 'OPEN' } }),
      api.get('/api/master/ot-types', { params: { limit: 50, offset: 0 } }),
      api.get('/api/admin/approvers', { params: { module: 'hr.timesheet' } }),
    ]).then(([woRes, otRes, appRes]) => {
      setWorkOrders(woRes.data.items || []);
      setOtTypes((otRes.data.items || []).filter((t) => t.is_active));
      setApprovers(appRes.data);
    }).catch(() => {});
  }, []);
```

**แทนที่ employee Select ใน render (lines 211-221):**
```jsx
// BEFORE (lines 210-221)
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>พนักงาน</Text>
            <Select
              showSearch optionFilterProp="label" value={selectedEmployee}
              onChange={setSelectedEmployee} style={{ width: 280 }}
              placeholder="เลือกพนักงาน"
              options={employees.map((e) => ({
                value: e.id, label: `${e.employee_code} — ${e.full_name}`,
              }))}
            />
          </div>

// AFTER
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <EmployeeContextSelector
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            showBadge={false}
            onEmployeesLoaded={setEmployees}
          />
```

**หมายเหตุ:** ใช้ `onEmployeesLoaded={setEmployees}` เพื่อ populate `employees` state ที่ `empInfo` ใช้ (line 54-57)

---

## Step 7: แก้ MePage สำหรับ Viewer

### 7.1 MePage.jsx — filter tabs ตาม permission

**ไฟล์:** `frontend/src/pages/my/MePage.jsx`

**เพิ่ม import — line 1:**
```javascript
// BEFORE (line 1)
import { useState, useEffect } from 'react';

// AFTER
import { useState, useEffect, useMemo } from 'react';
```

**เพิ่ม import usePermission — หลัง line 4:**
```javascript
import { usePermission } from '../../hooks/usePermission';
```

**เพิ่ม import EmptyState — หลัง line 6:**
```javascript
import EmptyState from '../../components/EmptyState';
```

**ใช้ usePermission hook — หลัง line ที่ extract hireDate (ใน function MePage):**
```javascript
  const { can } = usePermission();
```

**Filter stat cards ตาม permission — lines 100-137:**

แก้ stat cards section ให้ permission-aware:
```jsx
      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard
            title="งานวันนี้"
            value={stats.tasks}
            subtitle="Work Orders"
            icon={<Briefcase size={20} />}
            color={COLORS.accent}
          />
        </Col>
        {can('hr.dailyreport.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="รายงานวันนี้"
              value={stats.reports > 0 ? 'กรอกแล้ว' : 'ยังไม่กรอก'}
              icon={<ClipboardList size={20} />}
              color={stats.reports > 0 ? COLORS.success : COLORS.warning}
            />
          </Col>
        )}
        {can('hr.leave.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="ใบลารออนุมัติ"
              value={stats.pendingLeave}
              subtitle="Pending"
              icon={<FileText size={20} />}
              color={COLORS.warning}
            />
          </Col>
        )}
        {can('hr.timesheet.read') && (
          <Col xs={12} sm={6}>
            <StatCard
              title="Timesheet"
              value="—"
              subtitle="สัปดาห์นี้"
              icon={<Clock size={20} />}
              color={COLORS.purple}
            />
          </Col>
        )}
      </Row>
```

**Guard API calls ตาม permission — lines 29-33:**
```javascript
// BEFORE (lines 29-33)
        const [tasksRes, leaveRes, reportRes] = await Promise.allSettled([
          api.get('/api/planning/daily', { params: { ... employee_id: employeeId } }),
          api.get('/api/hr/leave', { params: { ... employee_id: employeeId } }),
          api.get('/api/daily-report', { params: { ... employee_id: employeeId } }),
        ]);

// AFTER — ใช้ can() check จาก closure
        const requests = [
          api.get('/api/planning/daily', { params: { date_from: today, date_to: today, limit: 100, employee_id: employeeId } }),
        ];
        // Only call HR APIs if user has permission
        const hasLeave = can('hr.leave.read');
        const hasReport = can('hr.dailyreport.read');
        if (hasLeave) requests.push(api.get('/api/hr/leave', { params: { limit: 100, employee_id: employeeId } }));
        if (hasReport) requests.push(api.get('/api/daily-report', { params: { date_from: today, date_to: today, limit: 1, employee_id: employeeId } }));

        const results = await Promise.allSettled(requests);

        const tasks = results[0].status === 'fulfilled' ? (results[0].value.data?.total || results[0].value.data?.items?.length || 0) : 0;
        let pending = 0;
        let report = 0;
        let idx = 1;
        if (hasLeave) {
          pending = results[idx]?.status === 'fulfilled'
            ? (results[idx].value.data?.items || []).filter((l) => l.status === 'PENDING').length
            : 0;
          idx++;
        }
        if (hasReport) {
          report = results[idx]?.status === 'fulfilled' ? (results[idx].value.data?.total || 0) : 0;
        }

        setStats({ tasks, pendingLeave: pending, todayHours: 0, reports: report });
```

**Filter tabs ตาม permission — lines 139-173:**
```jsx
// BEFORE (lines 139-173)
      <Tabs
        defaultActiveKey="tasks"
        type="card"
        items={[
          { key: 'tasks', label: ..., children: <MyTasksPage embedded /> },
          { key: 'timesheet', label: ..., children: <MyTimesheetPage embedded /> },
          { key: 'leave', label: ..., children: <MyLeavePage embedded /> },
          { key: 'daily-report', label: ..., children: <MyDailyReportPage embedded /> },
        ]}
      />

// AFTER
      {(() => {
        const tabItems = [
          can('workorder.plan.read') && {
            key: 'tasks',
            label: (<span><CalendarCheck size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />งานของฉัน</span>),
            children: <MyTasksPage embedded />,
          },
          can('hr.timesheet.read') && {
            key: 'timesheet',
            label: (<span><Clock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Timesheet</span>),
            children: <MyTimesheetPage embedded />,
          },
          can('hr.leave.read') && {
            key: 'leave',
            label: (<span><FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />ใบลา</span>),
            children: <MyLeavePage embedded />,
          },
          can('hr.dailyreport.read') && {
            key: 'daily-report',
            label: (<span><ClipboardList size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />รายงานประจำวัน</span>),
            children: <MyDailyReportPage embedded />,
          },
        ].filter(Boolean);

        if (tabItems.length === 0) {
          return <EmptyState message="ไม่มีข้อมูลที่แสดง" hint="บัญชีของคุณไม่มีสิทธิ์เข้าถึงส่วนนี้" />;
        }
        return <Tabs defaultActiveKey={tabItems[0].key} type="card" items={tabItems} />;
      })()}
```

### 7.2 App.jsx — ME menu permission check

**ไฟล์:** `frontend/src/App.jsx`

**แก้ MY_MENU_ITEMS — line 47-49:**
```javascript
// BEFORE (lines 47-49)
const MY_MENU_ITEMS = [
  { key: '/me', icon: <User size={18} />, label: 'ME', permission: null },
];

// AFTER
const MY_MENU_ITEMS = [
  { key: '/me', icon: <User size={18} />, label: 'ME', permission: '_me_check' },
];
```

**แก้ filtering logic — lines 81-87:**
```javascript
// BEFORE (lines 81-87)
  const myItems = MY_MENU_ITEMS.filter(
    (item) => !item.permission || can(item.permission)
  ).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));

// AFTER
  const myItems = MY_MENU_ITEMS.filter((item) => {
    if (item.permission === '_me_check') {
      // Show ME if user has at least one MY-page feature
      return can('workorder.plan.read') || can('hr.timesheet.read') ||
             can('hr.leave.read') || can('hr.dailyreport.read');
    }
    return !item.permission || can(item.permission);
  }).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));
```

---

## Step 8: ทดสอบ E2E

### Test Matrix

| Role | Dashboard | ME Tabs | HR Page | Employee Selector | ScopeBadge |
|------|-----------|---------|---------|-------------------|------------|
| staff | StaffDashboard (ของตัวเอง) | 4 tabs | ❌ (no perm) | ❌ (ไม่แสดง) | "ข้อมูลของฉัน" (cyan) |
| viewer | StaffDashboard (ของตัวเอง) | 1 tab (tasks only) | ❌ (no perm) | ❌ (ไม่แสดง) | "ข้อมูลของฉัน" (cyan) |
| supervisor | **SupervisorDashboard** | 4 tabs | Dept data | Dept employees only | "แผนก: {name}" (purple) |
| manager | AdminDashboard | 4 tabs | All data | All employees | "ทั้งองค์กร" (green) |
| owner | AdminDashboard | 4 tabs | All data | All employees | "ทั้งองค์กร" (green) |

### Test Scenarios

1. **Login staff** → Dashboard = StaffDashboard → MePage stats ส่ง employee_id (ดู Network tab)
2. **Login viewer** → ME page แสดง 1 tab "งานของฉัน" (ไม่มี Timesheet/ใบลา/Report)
3. **Login supervisor** → Dashboard = **SupervisorDashboard** → เห็นจำนวนพนักงานในแผนก
4. **Login supervisor** → HR > Timesheet → EmployeeContextSelector แสดงคนในแผนกเท่านั้น
5. **Login supervisor** → HR > EmployeeContextSelector เลือกคน → table filter ตาม employee
6. **Login manager** → HR > EmployeeContextSelector แสดง "ทั้งหมด" + ทุกคน
7. **Login manager** → HR ScopeBadge = "ทั้งองค์กร" (สีเขียว)
8. **Login supervisor** → HR ScopeBadge = "แผนก: {name}" (สีม่วง)

### Credentials

| Email | Password | Role |
|-------|----------|------|
| owner@sss-corp.com | owner123 | owner |
| manager@sss-corp.com | manager123 | manager |
| supervisor@sss-corp.com | supervisor123 | supervisor |
| staff@sss-corp.com | staff123 | staff |
| viewer@sss-corp.com | viewer123 | viewer |

---

## Dependency Graph

```
Step 1 (Backend: department_name)
   ↓
Step 3 (ScopeBadge)
   ↓
Step 4 (SupervisorDashboard) ← ต้องการ ScopeBadge
Step 5 (EmployeeContextSelector) ← ต้องการ ScopeBadge
   ↓
Step 6 (HR Page tabs) ← ต้องการ EmployeeContextSelector

Step 2 (MePage bug) → ทำพร้อมกับ Step 1 ได้
Step 7 (Viewer fix) → ทำพร้อมกับ Step 3-6 ได้
Step 8 (Testing) → หลังทุก step
```

## ไฟล์ทั้งหมด

| # | ไฟล์ | Action | Step |
|---|------|--------|------|
| 1 | `backend/app/schemas/auth.py` | แก้ไข — เพิ่ม department_name field | 1 |
| 2 | `backend/app/api/auth.py` | แก้ไข — query department, pass name | 1 |
| 3 | `frontend/src/stores/authStore.js` | แก้ไข — เพิ่ม departmentName (4 จุด) | 1 |
| 4 | `frontend/src/pages/my/MePage.jsx` | แก้ไข — fix bug + viewer tabs | 2, 7 |
| 5 | `frontend/src/components/ScopeBadge.jsx` | **สร้างใหม่** | 3 |
| 6 | `frontend/src/pages/DashboardPage.jsx` | แก้ไข — เพิ่ม SupervisorDashboard | 4 |
| 7 | `frontend/src/components/EmployeeContextSelector.jsx` | **สร้างใหม่** | 5 |
| 8 | `frontend/src/pages/hr/HRPage.jsx` | แก้ไข — เพิ่ม ScopeBadge | 6 |
| 9 | `frontend/src/pages/hr/TimesheetTab.jsx` | แก้ไข — เพิ่ม EmployeeContextSelector | 6 |
| 10 | `frontend/src/pages/hr/LeaveTab.jsx` | แก้ไข — เพิ่ม EmployeeContextSelector | 6 |
| 11 | `frontend/src/pages/hr/StandardTimesheetView.jsx` | แก้ไข — แทนที่ Select เดิม | 6 |
| 12 | `frontend/src/pages/hr/LeaveBalanceTab.jsx` | แก้ไข — แทนที่ Select เดิม | 6 |
| 13 | `frontend/src/pages/hr/WOTimeEntryForm.jsx` | แก้ไข — แทนที่ Select เดิม | 6 |
| 14 | `frontend/src/App.jsx` | แก้ไข — ME menu permission check | 7 |

---

## IMPORTANT — Rules ที่ต้องปฏิบัติตาม

1. **ห้ามใช้ emoji** — ใช้ Lucide icons เท่านั้น
2. **ห้ามใช้ Ant Design Icons** — ใช้ Lucide icons เท่านั้น
3. **Full Dark theme** — ใช้ COLORS จาก utils/constants.js
4. **Thai labels, English data/menu** — ตาม UI_GUIDELINES.md
5. **Permission checks ใช้ `can()` hook** — ห้ามใช้ role === 'xxx' (ยกเว้น DashboardPage routing)
6. **ScopeBadge styling ต้องตรงกับ StatusBadge** — bg opacity `18`, fontSize 11, fontWeight 600
