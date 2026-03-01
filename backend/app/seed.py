"""
Seed script — Create full org structure for development/testing.
Run: python -m app.seed

Creates:
  - 1 Organization (SSS Corp)
  - 3 Cost Centers (ADMIN, PROD, SALES)
  - 3 Departments (ADMIN, PROD, SALES)
  - 3 OT Types (weekday 1.5x, weekend 2.0x, holiday 3.0x)
  - 5 Leave Types (ANNUAL, SICK, PERSONAL, MATERNITY, UNPAID)
  - 5 Users (owner, manager, supervisor, staff, viewer)
  - 5 Employees (linked to users + departments)
  - Department heads (ADMIN→owner, PROD→supervisor)
  - 20 Leave Balances (5 employees × 4 leave types with quota)
  - 6 Shift Types + 4 Work Schedules
  - 1 Warehouse (WH-MAIN) + 3 Locations (RECEIVING, STORAGE, SHIPPING)
  - 5 Products (3 MATERIAL + 1 CONSUMABLE + 1 SERVICE)
  - 3 Tools (สว่าน, เครื่องเชื่อม, เครื่องตัดเลเซอร์)
"""

import asyncio
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.config import DEFAULT_ORG_ID
from app.core.security import hash_password
from app.models import User, Organization
from app.models.master import CostCenter, OTType, LeaveType, ShiftType, WorkSchedule, ScheduleType, Supplier
from app.models.organization import Department
from app.models.hr import Employee, LeaveBalance, PayType
from app.models.warehouse import Warehouse, Location
from app.models.inventory import Product, ProductType
from app.models.tools import Tool, ToolStatus


# ============================================================
# FIXED UUIDs (deterministic, idempotent)
# ============================================================

# Cost Centers
CC_ADMIN_ID = UUID("00000000-0000-0000-0001-000000000001")
CC_PROD_ID  = UUID("00000000-0000-0000-0001-000000000002")
CC_SALES_ID = UUID("00000000-0000-0000-0001-000000000003")

# Departments
DEPT_ADMIN_ID = UUID("00000000-0000-0000-0002-000000000001")
DEPT_PROD_ID  = UUID("00000000-0000-0000-0002-000000000002")
DEPT_SALES_ID = UUID("00000000-0000-0000-0002-000000000003")

# OT Types
OT_WEEKDAY_ID = UUID("00000000-0000-0000-0003-000000000001")
OT_WEEKEND_ID = UUID("00000000-0000-0000-0003-000000000002")
OT_HOLIDAY_ID = UUID("00000000-0000-0000-0003-000000000003")

# Leave Types
LT_ANNUAL_ID    = UUID("00000000-0000-0000-0004-000000000001")
LT_SICK_ID      = UUID("00000000-0000-0000-0004-000000000002")
LT_PERSONAL_ID  = UUID("00000000-0000-0000-0004-000000000003")
LT_MATERNITY_ID = UUID("00000000-0000-0000-0004-000000000004")
LT_UNPAID_ID    = UUID("00000000-0000-0000-0004-000000000005")

# Employees
EMP_OWNER_ID      = UUID("00000000-0000-0000-0005-000000000001")
EMP_MANAGER_ID    = UUID("00000000-0000-0000-0005-000000000002")
EMP_SUPERVISOR_ID = UUID("00000000-0000-0000-0005-000000000003")
EMP_STAFF_ID      = UUID("00000000-0000-0000-0005-000000000004")
EMP_VIEWER_ID     = UUID("00000000-0000-0000-0005-000000000005")

# Shift Types (Phase 4.9)
ST_REGULAR_ID   = UUID("00000000-0000-0000-0006-000000000001")
ST_MORNING_ID   = UUID("00000000-0000-0000-0006-000000000002")
ST_AFTERNOON_ID = UUID("00000000-0000-0000-0006-000000000003")
ST_NIGHT_ID     = UUID("00000000-0000-0000-0006-000000000004")
ST_DAY12_ID     = UUID("00000000-0000-0000-0006-000000000005")
ST_NIGHT12_ID   = UUID("00000000-0000-0000-0006-000000000006")

# Work Schedules (Phase 4.9)
WS_REGULAR_MF_ID    = UUID("00000000-0000-0000-0007-000000000001")
WS_ROTATING_3S_ID   = UUID("00000000-0000-0000-0007-000000000002")
WS_ROTATING_12H_ID  = UUID("00000000-0000-0000-0007-000000000003")
WS_MANUAL_ID        = UUID("00000000-0000-0000-0007-000000000004")

# Warehouses
WH_MAIN_ID = UUID("00000000-0000-0000-0008-000000000001")

# Locations
LOC_RECEIVING_ID = UUID("00000000-0000-0000-0009-000000000001")
LOC_STORAGE_ID   = UUID("00000000-0000-0000-0009-000000000002")
LOC_SHIPPING_ID  = UUID("00000000-0000-0000-0009-000000000003")

# Products
PROD_STEEL_ID    = UUID("00000000-0000-0000-000a-000000000001")
PROD_PVC_ID      = UUID("00000000-0000-0000-000a-000000000002")
PROD_BOLT_ID     = UUID("00000000-0000-0000-000a-000000000003")
PROD_GLOVE_ID    = UUID("00000000-0000-0000-000a-000000000004")
PROD_QC_ID       = UUID("00000000-0000-0000-000a-000000000005")

# Tools
TOOL_DRILL_ID   = UUID("00000000-0000-0000-000b-000000000001")
TOOL_WELDER_ID  = UUID("00000000-0000-0000-000b-000000000002")
TOOL_LASER_ID   = UUID("00000000-0000-0000-000b-000000000003")

# Suppliers
SUP_STEEL_ID    = UUID("00000000-0000-0000-000c-000000000001")
SUP_ELEC_ID     = UUID("00000000-0000-0000-000c-000000000002")
SUP_BOLT_ID     = UUID("00000000-0000-0000-000c-000000000003")
SUP_CHEM_ID     = UUID("00000000-0000-0000-000c-000000000004")
SUP_PROTECH_ID  = UUID("00000000-0000-0000-000c-000000000005")


# ============================================================
# SEED DATA
# ============================================================

TEST_USERS = [
    {"email": "owner@sss-corp.com", "password": "owner123", "full_name": "Owner Admin", "role": "owner"},
    {"email": "manager@sss-corp.com", "password": "manager123", "full_name": "Manager User", "role": "manager"},
    {"email": "supervisor@sss-corp.com", "password": "supervisor123", "full_name": "Supervisor User", "role": "supervisor"},
    {"email": "staff@sss-corp.com", "password": "staff123", "full_name": "Staff User", "role": "staff"},
    {"email": "viewer@sss-corp.com", "password": "viewer123", "full_name": "Viewer User", "role": "viewer"},
]

COST_CENTERS = [
    {"id": CC_ADMIN_ID, "code": "CC-ADMIN", "name": "ฝ่ายบริหาร", "overhead_rate": Decimal("15.00")},
    {"id": CC_PROD_ID, "code": "CC-PROD", "name": "ฝ่ายผลิต", "overhead_rate": Decimal("25.00")},
    {"id": CC_SALES_ID, "code": "CC-SALES", "name": "ฝ่ายขาย", "overhead_rate": Decimal("10.00")},
]

DEPARTMENTS = [
    {"id": DEPT_ADMIN_ID, "code": "ADMIN", "name": "ฝ่ายบริหาร", "cost_center_id": CC_ADMIN_ID},
    {"id": DEPT_PROD_ID, "code": "PROD", "name": "ฝ่ายผลิต", "cost_center_id": CC_PROD_ID},
    {"id": DEPT_SALES_ID, "code": "SALES", "name": "ฝ่ายขาย", "cost_center_id": CC_SALES_ID},
]

OT_TYPES = [
    {"id": OT_WEEKDAY_ID, "name": "ล่วงเวลาวันธรรมดา", "factor": Decimal("1.50"), "max_ceiling": Decimal("3.00")},
    {"id": OT_WEEKEND_ID, "name": "ล่วงเวลาวันหยุด", "factor": Decimal("2.00"), "max_ceiling": Decimal("3.00")},
    {"id": OT_HOLIDAY_ID, "name": "ล่วงเวลาวันนักขัตฤกษ์", "factor": Decimal("3.00"), "max_ceiling": Decimal("3.00")},
]

LEAVE_TYPES = [
    {"id": LT_ANNUAL_ID, "code": "ANNUAL", "name": "ลาพักร้อน", "is_paid": True, "default_quota": 6},
    {"id": LT_SICK_ID, "code": "SICK", "name": "ลาป่วย", "is_paid": True, "default_quota": 30},
    {"id": LT_PERSONAL_ID, "code": "PERSONAL", "name": "ลากิจ", "is_paid": True, "default_quota": 3},
    {"id": LT_MATERNITY_ID, "code": "MATERNITY", "name": "ลาคลอด", "is_paid": True, "default_quota": 98},
    {"id": LT_UNPAID_ID, "code": "UNPAID", "name": "ลาไม่รับเงิน", "is_paid": False, "default_quota": None},
]

# Employee data — linked after users are created
# hourly_rate: MONTHLY = salary / (26 days × 8 hrs), DAILY = daily_rate / 8 hrs
EMPLOYEES = [
    {
        "id": EMP_OWNER_ID,
        "employee_code": "EMP-001",
        "full_name": "Owner Admin",
        "position": "เจ้าของกิจการ",
        "pay_type": PayType.MONTHLY,
        "monthly_salary": Decimal("80000.00"),
        "daily_rate": None,
        "hourly_rate": Decimal("384.62"),  # 80000 / (26 × 8)
        "department_id": DEPT_ADMIN_ID,
        "cost_center_id": CC_ADMIN_ID,
        "supervisor_id": None,
        "email": "owner@sss-corp.com",
    },
    {
        "id": EMP_MANAGER_ID,
        "employee_code": "EMP-002",
        "full_name": "Manager User",
        "position": "ผู้จัดการทั่วไป",
        "pay_type": PayType.MONTHLY,
        "monthly_salary": Decimal("60000.00"),
        "daily_rate": None,
        "hourly_rate": Decimal("288.46"),  # 60000 / (26 × 8)
        "department_id": DEPT_ADMIN_ID,
        "cost_center_id": CC_ADMIN_ID,
        "supervisor_id": EMP_OWNER_ID,
        "email": "manager@sss-corp.com",
    },
    {
        "id": EMP_SUPERVISOR_ID,
        "employee_code": "EMP-003",
        "full_name": "Supervisor User",
        "position": "หัวหน้าแผนกผลิต",
        "pay_type": PayType.MONTHLY,
        "monthly_salary": Decimal("40000.00"),
        "daily_rate": None,
        "hourly_rate": Decimal("192.31"),  # 40000 / (26 × 8)
        "department_id": DEPT_PROD_ID,
        "cost_center_id": CC_PROD_ID,
        "supervisor_id": EMP_MANAGER_ID,
        "email": "supervisor@sss-corp.com",
    },
    {
        "id": EMP_STAFF_ID,
        "employee_code": "EMP-004",
        "full_name": "Staff User",
        "position": "พนักงานผลิต",
        "pay_type": PayType.DAILY,
        "monthly_salary": None,
        "daily_rate": Decimal("500.00"),
        "hourly_rate": Decimal("62.50"),  # 500 / 8
        "department_id": DEPT_PROD_ID,
        "cost_center_id": CC_PROD_ID,
        "supervisor_id": EMP_SUPERVISOR_ID,
        "email": "staff@sss-corp.com",
    },
    {
        "id": EMP_VIEWER_ID,
        "employee_code": "EMP-005",
        "full_name": "Viewer User",
        "position": "พนักงานธุรการ",
        "pay_type": PayType.DAILY,
        "monthly_salary": None,
        "daily_rate": Decimal("400.00"),
        "hourly_rate": Decimal("50.00"),  # 400 / 8
        "department_id": DEPT_ADMIN_ID,
        "cost_center_id": CC_ADMIN_ID,
        "supervisor_id": EMP_MANAGER_ID,
        "email": "viewer@sss-corp.com",
    },
]

# Department heads — set after employees exist
DEPT_HEADS = {
    DEPT_ADMIN_ID: EMP_OWNER_ID,      # owner heads ADMIN
    DEPT_PROD_ID: EMP_SUPERVISOR_ID,   # supervisor heads PROD
    # SALES has no head yet
}


WAREHOUSES = [
    {"id": WH_MAIN_ID, "code": "WH-MAIN", "name": "คลังสินค้าหลัก", "description": "คลังสินค้าหลัก สำนักงานใหญ่"},
]

LOCATIONS = [
    {"id": LOC_RECEIVING_ID, "warehouse_id": WH_MAIN_ID, "code": "RECV-01", "name": "จุดรับสินค้า", "zone_type": "RECEIVING", "description": "จุดรับสินค้าเข้า"},
    {"id": LOC_STORAGE_ID, "warehouse_id": WH_MAIN_ID, "code": "STOR-01", "name": "พื้นที่จัดเก็บ", "zone_type": "STORAGE", "description": "พื้นที่จัดเก็บสินค้า"},
    {"id": LOC_SHIPPING_ID, "warehouse_id": WH_MAIN_ID, "code": "SHIP-01", "name": "จุดจัดส่ง", "zone_type": "SHIPPING", "description": "จุดจัดส่งสินค้าออก"},
]

PRODUCTS = [
    {"id": PROD_STEEL_ID, "sku": "MAT-001", "name": "เหล็กแผ่น SS400", "product_type": ProductType.MATERIAL,
     "unit": "แผ่น", "cost": Decimal("850.00"), "on_hand": 100, "min_stock": 20,
     "description": "เหล็กแผ่น SS400 ขนาด 4x8 ฟุต หนา 6mm"},
    {"id": PROD_PVC_ID, "sku": "MAT-002", "name": "ท่อ PVC 4 นิ้ว", "product_type": ProductType.MATERIAL,
     "unit": "เส้น", "cost": Decimal("120.00"), "on_hand": 50, "min_stock": 15,
     "description": "ท่อ PVC ชั้น 13.5 ขนาด 4 นิ้ว ยาว 4 เมตร"},
    {"id": PROD_BOLT_ID, "sku": "MAT-003", "name": "น็อตสแตนเลส M10", "product_type": ProductType.MATERIAL,
     "unit": "ตัว", "cost": Decimal("5.00"), "on_hand": 500, "min_stock": 100,
     "description": "น็อตสแตนเลส 304 M10x30mm"},
    {"id": PROD_GLOVE_ID, "sku": "CON-001", "name": "ถุงมือยาง", "product_type": ProductType.CONSUMABLE,
     "unit": "คู่", "cost": Decimal("25.00"), "on_hand": 10, "min_stock": 50,
     "description": "ถุงมือยางไนไตรล์ ไซส์ L"},
    {"id": PROD_QC_ID, "sku": "SVC-001", "name": "บริการตรวจสอบคุณภาพ", "product_type": ProductType.SERVICE,
     "unit": "ครั้ง", "cost": Decimal("0.00"), "on_hand": 0, "min_stock": 0,
     "description": "บริการตรวจสอบคุณภาพงานเชื่อม/งานโลหะ"},
]

TOOLS = [
    {"id": TOOL_DRILL_ID, "code": "TL-001", "name": "สว่านไฟฟ้า Bosch GSB 13RE",
     "rate_per_hour": Decimal("200.00"), "description": "สว่านไฟฟ้ากระแทก 600W"},
    {"id": TOOL_WELDER_ID, "code": "TL-002", "name": "เครื่องเชื่อม Lincoln V270-T",
     "rate_per_hour": Decimal("350.00"), "description": "เครื่องเชื่อม MIG/MAG 270A"},
    {"id": TOOL_LASER_ID, "code": "TL-003", "name": "เครื่องตัดเลเซอร์ Trumpf",
     "rate_per_hour": Decimal("500.00"), "description": "เครื่องตัดเลเซอร์ไฟเบอร์ 3kW"},
]

SUPPLIERS = [
    {
        "id": SUP_STEEL_ID, "code": "SUP-001",
        "name": "Thai Steel Supply Co., Ltd.",
        "contact_name": "คุณสมชาย เหล็กดี",
        "email": "sales@thaisteel.co.th",
        "phone": "02-123-4567",
        "address": "123 ถ.พระราม 3 แขวงบางโพงพาง เขตยานนาวา กรุงเทพฯ 10120",
        "tax_id": "0105548012345",
    },
    {
        "id": SUP_ELEC_ID, "code": "SUP-002",
        "name": "Bangkok Electrical Parts",
        "contact_name": "คุณวิชัย ไฟฟ้า",
        "email": "info@bkkelec.com",
        "phone": "02-234-5678",
        "address": "456 ซ.สุขุมวิท 71 แขวงพระโขนง เขตวัฒนา กรุงเทพฯ 10110",
        "tax_id": "0105551023456",
    },
    {
        "id": SUP_BOLT_ID, "code": "SUP-003",
        "name": "Fast Bolt & Nut Trading",
        "contact_name": "คุณประพันธ์ น็อตดี",
        "email": "order@fastbolt.co.th",
        "phone": "02-345-6789",
        "address": "789 ถ.เพชรเกษม แขวงบางแค เขตบางแค กรุงเทพฯ 10160",
        "tax_id": "0105553034567",
    },
    {
        "id": SUP_CHEM_ID, "code": "SUP-004",
        "name": "Siam Chemical Industries",
        "contact_name": "คุณนภา เคมี",
        "email": "purchase@siamchem.com",
        "phone": "02-456-7890",
        "address": "321 นิคมอุตสาหกรรมบางปู ถ.สุขุมวิท สมุทรปราการ 10280",
        "tax_id": "0105555045678",
    },
    {
        "id": SUP_PROTECH_ID, "code": "SUP-005",
        "name": "ProTech Engineering Services",
        "contact_name": "คุณธีรศักดิ์ เทค",
        "email": "service@protech-eng.com",
        "phone": "02-567-8901",
        "address": "654 ถ.ศรีนครินทร์ แขวงหนองบอน เขตประเวศ กรุงเทพฯ 10250",
        "tax_id": "0105557056789",
    },
]


# ============================================================
# HELPER
# ============================================================

async def _check_exists(db, model, **filters):
    """Check if a record exists by given filters."""
    stmt = select(model)
    for key, value in filters.items():
        stmt = stmt.where(getattr(model, key) == value)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# ============================================================
# SEED FUNCTION
# ============================================================

async def seed():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        print("\n=== SSS Corp ERP — Seed Data ===\n")

        # ----- 1. Organization -----
        org = await _check_exists(db, Organization, id=DEFAULT_ORG_ID)
        if not org:
            org = Organization(id=DEFAULT_ORG_ID, code="SSS", name="SSS Corp")
            db.add(org)
            print("  [Org]  SSS Corp")
        else:
            print("  [Org]  SSS Corp (exists)")

        # ----- 2. Cost Centers -----
        print()
        for cc_data in COST_CENTERS:
            existing = await _check_exists(db, CostCenter, id=cc_data["id"])
            if not existing:
                cc = CostCenter(
                    id=cc_data["id"],
                    code=cc_data["code"],
                    name=cc_data["name"],
                    overhead_rate=cc_data["overhead_rate"],
                    org_id=DEFAULT_ORG_ID,
                )
                db.add(cc)
                print(f"  [CC]   {cc_data['code']} — {cc_data['name']} ({cc_data['overhead_rate']}%)")
            else:
                print(f"  [CC]   {cc_data['code']} (exists)")

        await db.flush()  # CostCenter IDs needed for Departments

        # ----- 3. Departments -----
        print()
        for dept_data in DEPARTMENTS:
            existing = await _check_exists(db, Department, id=dept_data["id"])
            if not existing:
                dept = Department(
                    id=dept_data["id"],
                    code=dept_data["code"],
                    name=dept_data["name"],
                    cost_center_id=dept_data["cost_center_id"],
                    org_id=DEFAULT_ORG_ID,
                )
                db.add(dept)
                print(f"  [Dept] {dept_data['code']} — {dept_data['name']}")
            else:
                print(f"  [Dept] {dept_data['code']} (exists)")

        await db.flush()  # Department IDs needed for Employees

        # ----- 4. OT Types -----
        print()
        for ot_data in OT_TYPES:
            existing = await _check_exists(db, OTType, id=ot_data["id"])
            if not existing:
                ot = OTType(
                    id=ot_data["id"],
                    name=ot_data["name"],
                    factor=ot_data["factor"],
                    max_ceiling=ot_data["max_ceiling"],
                    org_id=DEFAULT_ORG_ID,
                )
                db.add(ot)
                print(f"  [OT]   {ot_data['name']} ({ot_data['factor']}x)")
            else:
                print(f"  [OT]   {ot_data['name']} (exists)")

        # ----- 5. Leave Types -----
        print()
        for lt_data in LEAVE_TYPES:
            existing = await _check_exists(db, LeaveType, id=lt_data["id"])
            if not existing:
                lt = LeaveType(
                    id=lt_data["id"],
                    code=lt_data["code"],
                    name=lt_data["name"],
                    is_paid=lt_data["is_paid"],
                    default_quota=lt_data["default_quota"],
                    org_id=DEFAULT_ORG_ID,
                )
                db.add(lt)
                quota_str = f"quota={lt_data['default_quota']}" if lt_data["default_quota"] else "no quota"
                print(f"  [Leave] {lt_data['code']} — {lt_data['name']} ({quota_str})")
            else:
                print(f"  [Leave] {lt_data['code']} (exists)")

        await db.flush()  # LeaveType IDs needed for LeaveBalances

        # ----- 6. Users -----
        print()
        user_map = {}  # email → User object (for linking to Employees)
        for user_data in TEST_USERS:
            existing = await _check_exists(db, User, email=user_data["email"])
            if existing:
                if not existing.org_id:
                    existing.org_id = DEFAULT_ORG_ID
                    print(f"  [User] {user_data['email']} (org_id updated)")
                else:
                    print(f"  [User] {user_data['email']} (exists)")
                user_map[user_data["email"]] = existing
                continue

            user = User(
                email=user_data["email"],
                hashed_password=hash_password(user_data["password"]),
                full_name=user_data["full_name"],
                role=user_data["role"],
                org_id=DEFAULT_ORG_ID,
            )
            db.add(user)
            user_map[user_data["email"]] = user
            print(f"  [User] {user_data['email']} ({user_data['role']})")

        await db.flush()  # User IDs needed for Employee.user_id

        # ----- 7. Employees (link to Users + Departments) -----
        print()
        for emp_data in EMPLOYEES:
            existing = await _check_exists(db, Employee, id=emp_data["id"])
            if not existing:
                user_obj = user_map.get(emp_data["email"])
                emp = Employee(
                    id=emp_data["id"],
                    employee_code=emp_data["employee_code"],
                    full_name=emp_data["full_name"],
                    position=emp_data["position"],
                    pay_type=emp_data["pay_type"],
                    monthly_salary=emp_data["monthly_salary"],
                    daily_rate=emp_data["daily_rate"],
                    hourly_rate=emp_data["hourly_rate"],
                    daily_working_hours=Decimal("8.00"),
                    department_id=emp_data["department_id"],
                    cost_center_id=emp_data["cost_center_id"],
                    supervisor_id=emp_data["supervisor_id"],
                    user_id=user_obj.id if user_obj else None,
                    hire_date=date(2024, 1, 15),
                    org_id=DEFAULT_ORG_ID,
                )
                db.add(emp)
                print(f"  [Emp]  {emp_data['employee_code']} — {emp_data['full_name']} ({emp_data['position']})")
            else:
                print(f"  [Emp]  {emp_data['employee_code']} (exists)")

        await db.flush()  # Employee IDs needed for dept heads + leave balances

        # ----- 8. Department Heads -----
        print()
        for dept_id, head_id in DEPT_HEADS.items():
            dept = await _check_exists(db, Department, id=dept_id)
            if dept and dept.head_id != head_id:
                dept.head_id = head_id
                print(f"  [Head] Dept {dept.code} → head set")
            elif dept:
                print(f"  [Head] Dept {dept.code} (already set)")

        # ----- 9. Leave Balances (employees × leave types with quota) -----
        print()
        current_year = date.today().year
        leave_types_with_quota = [lt for lt in LEAVE_TYPES if lt["default_quota"] is not None]
        emp_ids = [e["id"] for e in EMPLOYEES]

        lb_count = 0
        for emp_id in emp_ids:
            for lt_data in leave_types_with_quota:
                existing = await _check_exists(
                    db, LeaveBalance,
                    employee_id=emp_id,
                    leave_type_id=lt_data["id"],
                    year=current_year,
                )
                if not existing:
                    lb = LeaveBalance(
                        employee_id=emp_id,
                        leave_type_id=lt_data["id"],
                        year=current_year,
                        quota=lt_data["default_quota"],
                        used=0,
                        org_id=DEFAULT_ORG_ID,
                    )
                    db.add(lb)
                    lb_count += 1
        if lb_count > 0:
            print(f"  [LB]   {lb_count} leave balances created ({current_year})")
        else:
            print(f"  [LB]   All leave balances exist ({current_year})")

        # ── 10. Shift Types (Phase 4.9) ──────────────────────
        from datetime import time as time_type
        SHIFT_TYPES = [
            {"id": ST_REGULAR_ID, "code": "REGULAR", "name": "กะปกติ",
             "start_time": time_type(8, 0), "end_time": time_type(17, 0),
             "break_minutes": 60, "working_hours": Decimal("8.00"), "is_overnight": False},
            {"id": ST_MORNING_ID, "code": "MORNING", "name": "กะเช้า",
             "start_time": time_type(6, 0), "end_time": time_type(14, 0),
             "break_minutes": 30, "working_hours": Decimal("7.50"), "is_overnight": False},
            {"id": ST_AFTERNOON_ID, "code": "AFTERNOON", "name": "กะบ่าย",
             "start_time": time_type(14, 0), "end_time": time_type(22, 0),
             "break_minutes": 30, "working_hours": Decimal("7.50"), "is_overnight": False},
            {"id": ST_NIGHT_ID, "code": "NIGHT", "name": "กะดึก",
             "start_time": time_type(22, 0), "end_time": time_type(6, 0),
             "break_minutes": 30, "working_hours": Decimal("7.50"), "is_overnight": True},
            {"id": ST_DAY12_ID, "code": "DAY12", "name": "กะกลางวัน 12ชม.",
             "start_time": time_type(6, 0), "end_time": time_type(18, 0),
             "break_minutes": 60, "working_hours": Decimal("11.00"), "is_overnight": False},
            {"id": ST_NIGHT12_ID, "code": "NIGHT12", "name": "กะกลางคืน 12ชม.",
             "start_time": time_type(18, 0), "end_time": time_type(6, 0),
             "break_minutes": 60, "working_hours": Decimal("11.00"), "is_overnight": True},
        ]
        st_count = 0
        for st_data in SHIFT_TYPES:
            existing = await db.execute(
                select(ShiftType).where(ShiftType.id == st_data["id"])
            )
            if not existing.scalar_one_or_none():
                st_obj = ShiftType(org_id=DEFAULT_ORG_ID, **st_data)
                db.add(st_obj)
                st_count += 1
        if st_count > 0:
            await db.flush()
            print(f"  [ST]   {st_count} shift types created")
        else:
            print(f"  [ST]   All shift types exist")

        # ── 11. Work Schedules (Phase 4.9) ──────────────────
        WORK_SCHEDULES = [
            {"id": WS_REGULAR_MF_ID, "code": "REGULAR-MF", "name": "ปกติ จ-ศ",
             "schedule_type": ScheduleType.FIXED,
             "working_days": [1, 2, 3, 4, 5],
             "default_shift_type_id": ST_REGULAR_ID},
            {"id": WS_ROTATING_3S_ID, "code": "ROTATING-3SHIFT", "name": "3กะหมุน 8วัน",
             "schedule_type": ScheduleType.ROTATING,
             "rotation_pattern": ["MORNING", "MORNING", "AFTERNOON", "AFTERNOON", "NIGHT", "NIGHT", "OFF", "OFF"],
             "cycle_start_date": date(2026, 1, 1)},
            {"id": WS_ROTATING_12H_ID, "code": "ROTATING-12H", "name": "2กะ 12ชม. ทำ4หยุด2",
             "schedule_type": ScheduleType.ROTATING,
             "rotation_pattern": ["DAY12", "DAY12", "NIGHT12", "NIGHT12", "OFF", "OFF"],
             "cycle_start_date": date(2026, 1, 1)},
            {"id": WS_MANUAL_ID, "code": "MANUAL", "name": "ตามตกลง (Manual)",
             "schedule_type": ScheduleType.FIXED,
             "working_days": [1, 2, 3, 4, 5, 6, 7],
             "default_shift_type_id": ST_REGULAR_ID},
        ]
        ws_count = 0
        for ws_data in WORK_SCHEDULES:
            existing = await db.execute(
                select(WorkSchedule).where(WorkSchedule.id == ws_data["id"])
            )
            if not existing.scalar_one_or_none():
                ws_obj = WorkSchedule(org_id=DEFAULT_ORG_ID, **ws_data)
                db.add(ws_obj)
                ws_count += 1
        if ws_count > 0:
            await db.flush()
            print(f"  [WS]   {ws_count} work schedules created")
        else:
            print(f"  [WS]   All work schedules exist")

        # ── 12. Warehouses ─────────────────────────────
        print()
        for wh_data in WAREHOUSES:
            existing = await _check_exists(db, Warehouse, id=wh_data["id"])
            if not existing:
                wh = Warehouse(org_id=DEFAULT_ORG_ID, **wh_data)
                db.add(wh)
                print(f"  [WH]   {wh_data['code']} — {wh_data['name']}")
            else:
                print(f"  [WH]   {wh_data['code']} (exists)")

        await db.flush()  # Warehouse IDs needed for Locations

        # ── 13. Locations ─────────────────────────────
        for loc_data in LOCATIONS:
            existing = await _check_exists(db, Location, id=loc_data["id"])
            if not existing:
                loc = Location(org_id=DEFAULT_ORG_ID, **loc_data)
                db.add(loc)
                print(f"  [Loc]  {loc_data['code']} — {loc_data['name']} ({loc_data['zone_type']})")
            else:
                print(f"  [Loc]  {loc_data['code']} (exists)")

        await db.flush()  # Location IDs needed for StockByLocation

        # ── 14. Products ──────────────────────────────
        print()
        for prod_data in PRODUCTS:
            existing = await _check_exists(db, Product, id=prod_data["id"])
            if not existing:
                # Also check by SKU to avoid unique constraint violation
                existing_by_sku = await _check_exists(db, Product, sku=prod_data["sku"])
                if existing_by_sku:
                    print(f"  [Prod] {prod_data['sku']} (exists with different ID, skipping)")
                    continue
                prod = Product(org_id=DEFAULT_ORG_ID, **prod_data)
                db.add(prod)
                type_str = prod_data["product_type"].value
                print(f"  [Prod] {prod_data['sku']} — {prod_data['name']} ({type_str})")
            else:
                print(f"  [Prod] {prod_data['sku']} (exists)")

        # ── 15. Tools ─────────────────────────────────
        print()
        for tool_data in TOOLS:
            existing = await _check_exists(db, Tool, id=tool_data["id"])
            if not existing:
                tool = Tool(
                    org_id=DEFAULT_ORG_ID,
                    status=ToolStatus.AVAILABLE,
                    **tool_data,
                )
                db.add(tool)
                print(f"  [Tool] {tool_data['code']} — {tool_data['name']} ({tool_data['rate_per_hour']} ฿/hr)")
            else:
                print(f"  [Tool] {tool_data['code']} (exists)")

        # ── 16. Suppliers ───────────────────────────────
        print()
        for sup_data in SUPPLIERS:
            existing = await _check_exists(db, Supplier, id=sup_data["id"])
            if not existing:
                supplier = Supplier(org_id=DEFAULT_ORG_ID, **sup_data)
                db.add(supplier)
                print(f"  [Sup]  {sup_data['code']} — {sup_data['name']}")
            else:
                print(f"  [Sup]  {sup_data['code']} (exists)")

        # ----- COMMIT -----
        await db.commit()

    print("\n=== Seed complete! ===\n")
    print("  Test accounts:")
    print("  owner@sss-corp.com / owner123")
    print("  manager@sss-corp.com / manager123")
    print("  supervisor@sss-corp.com / supervisor123")
    print("  staff@sss-corp.com / staff123")
    print("  viewer@sss-corp.com / viewer123")
    print()


if __name__ == "__main__":
    asyncio.run(seed())
