"""
RBAC Permission System — SSS Corp ERP
11 modules × 7 actions = 105 permissions (explicit allow only)

Permission format: module.resource.action (3-part always)
Actions: create / read / update / delete / approve / export / execute

Phase 4.1: Added 16 new permissions (department, leavetype, plan, reservation, config)
Synced with plan v4 — 2026-02-27
"""

from functools import wraps
from typing import Any

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_token_payload


# ============================================================
# ALL 105 PERMISSIONS  (89 original + 16 new in Phase 4.1)
# ============================================================

ALL_PERMISSIONS: list[str] = [
    # --- inventory (9) ---
    "inventory.product.create",
    "inventory.product.read",
    "inventory.product.update",
    "inventory.product.delete",
    "inventory.product.export",
    "inventory.movement.create",
    "inventory.movement.read",
    "inventory.movement.delete",    # reverse movement
    "inventory.movement.export",

    # --- warehouse (12) ---
    "warehouse.warehouse.create",
    "warehouse.warehouse.read",
    "warehouse.warehouse.update",
    "warehouse.warehouse.delete",
    "warehouse.zone.create",
    "warehouse.zone.read",
    "warehouse.zone.update",
    "warehouse.zone.delete",
    "warehouse.location.create",
    "warehouse.location.read",
    "warehouse.location.update",
    "warehouse.location.delete",

    # --- workorder (6 + 6 = 12) ---
    "workorder.order.create",
    "workorder.order.read",
    "workorder.order.update",
    "workorder.order.delete",
    "workorder.order.approve",
    "workorder.order.export",
    # Phase 4.5: Planning
    "workorder.plan.create",
    "workorder.plan.read",
    "workorder.plan.update",
    "workorder.plan.delete",
    "workorder.reservation.create",
    "workorder.reservation.read",

    # --- purchasing (6) ---
    "purchasing.po.create",
    "purchasing.po.read",
    "purchasing.po.update",
    "purchasing.po.delete",
    "purchasing.po.approve",
    "purchasing.po.export",

    # --- sales (6) ---
    "sales.order.create",
    "sales.order.read",
    "sales.order.update",
    "sales.order.delete",
    "sales.order.approve",
    "sales.order.export",

    # --- finance (2) ---
    "finance.report.read",
    "finance.report.export",

    # --- master data (12 + 8 = 20) ---
    "master.costcenter.create",
    "master.costcenter.read",
    "master.costcenter.update",
    "master.costcenter.delete",
    "master.costelement.create",
    "master.costelement.read",
    "master.costelement.update",
    "master.costelement.delete",
    "master.ottype.create",
    "master.ottype.read",
    "master.ottype.update",
    "master.ottype.delete",
    # Phase 4.1: Department
    "master.department.create",
    "master.department.read",
    "master.department.update",
    "master.department.delete",
    # Phase 4.3: Leave Type
    "master.leavetype.create",
    "master.leavetype.read",
    "master.leavetype.update",
    "master.leavetype.delete",

    # --- admin (8 + 2 = 10) ---
    "admin.role.create",
    "admin.role.read",
    "admin.role.update",
    "admin.role.delete",
    "admin.user.create",
    "admin.user.read",
    "admin.user.update",
    "admin.user.delete",
    # Phase 4.1: Org config
    "admin.config.read",
    "admin.config.update",

    # --- customer (5) ---
    "customer.customer.create",
    "customer.customer.read",
    "customer.customer.update",
    "customer.customer.delete",
    "customer.customer.export",

    # --- tools (6) ---
    "tools.tool.create",
    "tools.tool.read",
    "tools.tool.update",
    "tools.tool.delete",
    "tools.tool.execute",       # check-in/out + auto charge
    "tools.tool.export",

    # --- hr (17) ---
    "hr.employee.create",
    "hr.employee.read",
    "hr.employee.update",
    "hr.employee.delete",
    "hr.employee.export",
    "hr.timesheet.create",
    "hr.timesheet.read",
    "hr.timesheet.update",
    "hr.timesheet.approve",
    "hr.timesheet.execute",     # final approve + unlock
    "hr.payroll.create",
    "hr.payroll.read",
    "hr.payroll.execute",       # payroll run
    "hr.payroll.export",
    "hr.leave.create",
    "hr.leave.read",
    "hr.leave.approve",
    # --- hr.dailyreport (3) --- Phase 5
    "hr.dailyreport.create",
    "hr.dailyreport.read",
    "hr.dailyreport.approve",
]

assert len(ALL_PERMISSIONS) == 108, f"Expected 108 permissions, got {len(ALL_PERMISSIONS)}"
assert len(set(ALL_PERMISSIONS)) == 108, "Duplicate permissions found!"


# ============================================================
# PERMISSION DESCRIPTIONS (Thai) — for Admin UI
# ============================================================

PERMISSION_DESCRIPTIONS: dict[str, str] = {
    # --- inventory (9) ---
    "inventory.product.create": "สร้างสินค้า/วัตถุดิบใหม่ในระบบ",
    "inventory.product.read": "ดูรายการสินค้าและรายละเอียด",
    "inventory.product.update": "แก้ไขข้อมูลสินค้า เช่น ชื่อ ราคา ประเภท",
    "inventory.product.delete": "ลบสินค้าที่ไม่มี movement (Owner เท่านั้น)",
    "inventory.product.export": "ส่งออกรายการสินค้าเป็นไฟล์",
    "inventory.movement.create": "สร้างรายการเคลื่อนไหว (รับเข้า/เบิกออก/ใช้งาน)",
    "inventory.movement.read": "ดูประวัติรายการเคลื่อนไหวสินค้า",
    "inventory.movement.delete": "กลับรายการเคลื่อนไหว (Reversal — Owner เท่านั้น)",
    "inventory.movement.export": "ส่งออกรายการเคลื่อนไหวเป็นไฟล์",
    # --- warehouse (12) ---
    "warehouse.warehouse.create": "สร้างคลังสินค้าใหม่",
    "warehouse.warehouse.read": "ดูข้อมูลคลังสินค้า",
    "warehouse.warehouse.update": "แก้ไขข้อมูลคลังสินค้า",
    "warehouse.warehouse.delete": "ลบคลังสินค้า (Owner เท่านั้น)",
    "warehouse.zone.create": "สร้างโซนในคลังสินค้า",
    "warehouse.zone.read": "ดูโซนในคลังสินค้า",
    "warehouse.zone.update": "แก้ไขโซนในคลังสินค้า",
    "warehouse.zone.delete": "ลบโซนในคลังสินค้า (Owner เท่านั้น)",
    "warehouse.location.create": "สร้างตำแหน่งจัดเก็บในคลัง",
    "warehouse.location.read": "ดูตำแหน่งจัดเก็บในคลัง",
    "warehouse.location.update": "แก้ไขตำแหน่งจัดเก็บ",
    "warehouse.location.delete": "ลบตำแหน่งจัดเก็บ (Owner เท่านั้น)",
    # --- workorder (12) ---
    "workorder.order.create": "สร้างใบสั่งงาน (Work Order) ใหม่",
    "workorder.order.read": "ดูรายการใบสั่งงานและรายละเอียด",
    "workorder.order.update": "แก้ไขข้อมูลใบสั่งงาน / เปิดงาน",
    "workorder.order.delete": "ลบใบสั่งงาน DRAFT (Owner เท่านั้น)",
    "workorder.order.approve": "ปิดใบสั่งงาน (Close WO)",
    "workorder.order.export": "ส่งออกข้อมูลใบสั่งงาน",
    "workorder.plan.create": "สร้างแผนงาน (Master Plan / Daily Plan)",
    "workorder.plan.read": "ดูแผนงานและตารางงานประจำวัน",
    "workorder.plan.update": "แก้ไขแผนงาน",
    "workorder.plan.delete": "ลบแผนงาน (Owner เท่านั้น)",
    "workorder.reservation.create": "จองวัสดุหรือเครื่องมือสำหรับใบสั่งงาน",
    "workorder.reservation.read": "ดูรายการจองวัสดุ/เครื่องมือ",
    # --- purchasing (6) ---
    "purchasing.po.create": "สร้างใบสั่งซื้อ (PO) ใหม่",
    "purchasing.po.read": "ดูรายการใบสั่งซื้อและรายละเอียด",
    "purchasing.po.update": "แก้ไขใบสั่งซื้อ / รับสินค้า (GR)",
    "purchasing.po.delete": "ลบใบสั่งซื้อ (Owner เท่านั้น)",
    "purchasing.po.approve": "อนุมัติใบสั่งซื้อ",
    "purchasing.po.export": "ส่งออกข้อมูลใบสั่งซื้อ",
    # --- sales (6) ---
    "sales.order.create": "สร้างใบสั่งขาย (SO) ใหม่",
    "sales.order.read": "ดูรายการใบสั่งขายและรายละเอียด",
    "sales.order.update": "แก้ไขข้อมูลใบสั่งขาย",
    "sales.order.delete": "ลบใบสั่งขาย (Owner เท่านั้น)",
    "sales.order.approve": "อนุมัติใบสั่งขาย",
    "sales.order.export": "ส่งออกข้อมูลใบสั่งขาย",
    # --- finance (2) ---
    "finance.report.read": "ดูรายงานการเงิน (สรุปรายได้/ต้นทุน)",
    "finance.report.export": "ส่งออกรายงานการเงินเป็น CSV (Owner เท่านั้น)",
    # --- master (20) ---
    "master.costcenter.create": "สร้าง Cost Center ใหม่",
    "master.costcenter.read": "ดูรายการ Cost Center",
    "master.costcenter.update": "แก้ไข Cost Center / ตั้ง Overhead Rate",
    "master.costcenter.delete": "ลบ Cost Center (Owner เท่านั้น)",
    "master.costelement.create": "สร้าง Cost Element ใหม่",
    "master.costelement.read": "ดูรายการ Cost Element",
    "master.costelement.update": "แก้ไข Cost Element",
    "master.costelement.delete": "ลบ Cost Element (Owner เท่านั้น)",
    "master.ottype.create": "สร้างประเภท OT ใหม่ (ตั้งตัวคูณ/เพดาน)",
    "master.ottype.read": "ดูรายการประเภท OT",
    "master.ottype.update": "แก้ไขตัวคูณ OT / เพดานสูงสุด",
    "master.ottype.delete": "ลบประเภท OT (Owner เท่านั้น)",
    "master.department.create": "สร้างแผนกใหม่",
    "master.department.read": "ดูรายการแผนก",
    "master.department.update": "แก้ไขข้อมูลแผนก",
    "master.department.delete": "ลบแผนก (Owner เท่านั้น)",
    "master.leavetype.create": "สร้างประเภทการลาใหม่ (กำหนดโควต้า/สี)",
    "master.leavetype.read": "ดูรายการประเภทการลา",
    "master.leavetype.update": "แก้ไขประเภทการลา",
    "master.leavetype.delete": "ลบประเภทการลา (Owner เท่านั้น)",
    # --- admin (10) ---
    "admin.role.create": "สร้างบทบาทใหม่ (สำรองสำหรับอนาคต)",
    "admin.role.read": "ดูรายการบทบาทและสิทธิ์ทั้งหมด",
    "admin.role.update": "แก้ไขสิทธิ์ของแต่ละบทบาท",
    "admin.role.delete": "ลบบทบาท (สำรองสำหรับอนาคต)",
    "admin.user.create": "สร้างผู้ใช้งานใหม่ (ลงทะเบียน)",
    "admin.user.read": "ดูรายชื่อผู้ใช้งานในระบบ",
    "admin.user.update": "เปลี่ยนบทบาทของผู้ใช้งาน",
    "admin.user.delete": "ลบผู้ใช้งานออกจากระบบ",
    "admin.config.read": "ดูการตั้งค่าองค์กร (เวลาทำงาน/อนุมัติ)",
    "admin.config.update": "แก้ไขการตั้งค่าองค์กร",
    # --- customer (5) ---
    "customer.customer.create": "สร้างข้อมูลลูกค้าใหม่",
    "customer.customer.read": "ดูรายชื่อลูกค้าและรายละเอียด",
    "customer.customer.update": "แก้ไขข้อมูลลูกค้า",
    "customer.customer.delete": "ลบข้อมูลลูกค้า (Owner เท่านั้น)",
    "customer.customer.export": "ส่งออกรายชื่อลูกค้า",
    # --- tools (6) ---
    "tools.tool.create": "สร้างเครื่องมือใหม่ในระบบ",
    "tools.tool.read": "ดูรายการเครื่องมือและสถานะ",
    "tools.tool.update": "แก้ไขข้อมูลเครื่องมือ",
    "tools.tool.delete": "ลบเครื่องมือ (Owner เท่านั้น)",
    "tools.tool.execute": "เบิก/คืนเครื่องมือ (Check-out / Check-in)",
    "tools.tool.export": "ส่งออกรายการเครื่องมือ",
    # --- hr (20) ---
    "hr.employee.create": "สร้างข้อมูลพนักงานใหม่",
    "hr.employee.read": "ดูข้อมูลพนักงาน (ตาม Data Scope)",
    "hr.employee.update": "แก้ไขข้อมูลพนักงาน / โควต้าลา",
    "hr.employee.delete": "ลบข้อมูลพนักงาน (Owner เท่านั้น)",
    "hr.employee.export": "ส่งออกข้อมูลพนักงาน",
    "hr.timesheet.create": "กรอก Timesheet / บันทึกเวลาทำงาน",
    "hr.timesheet.read": "ดู Timesheet (ตาม Data Scope)",
    "hr.timesheet.update": "แก้ไข Timesheet / Supervisor กรอกแทน",
    "hr.timesheet.approve": "อนุมัติ Timesheet (Supervisor Approve)",
    "hr.timesheet.execute": "Final Approve / Unlock Timesheet (HR)",
    "hr.payroll.create": "สร้างรอบ Payroll ใหม่",
    "hr.payroll.read": "ดูข้อมูล Payroll",
    "hr.payroll.execute": "รัน Payroll (คำนวณเงินเดือน)",
    "hr.payroll.export": "ส่งออกข้อมูล Payroll เป็น CSV",
    "hr.leave.create": "ยื่นคำขอลา",
    "hr.leave.read": "ดูรายการลา/ยอดคงเหลือ (ตาม Data Scope)",
    "hr.leave.approve": "อนุมัติ/ปฏิเสธคำขอลา",
    "hr.dailyreport.create": "สร้าง/แก้ไข Daily Work Report",
    "hr.dailyreport.read": "ดู Daily Work Report (ตาม Data Scope)",
    "hr.dailyreport.approve": "อนุมัติ/ปฏิเสธ Daily Work Report",
}

assert set(PERMISSION_DESCRIPTIONS.keys()) == set(ALL_PERMISSIONS), \
    f"PERMISSION_DESCRIPTIONS keys mismatch ALL_PERMISSIONS"


# ============================================================
# ROLE → PERMISSION MAPPING  (matches plan v4 matrix)
# ============================================================
# Legend:  ✅ = granted  ❌ = denied

def _owner() -> set[str]:
    """Owner: ALL 108 permissions."""
    return set(ALL_PERMISSIONS)


def _manager() -> set[str]:
    """Manager: everything except admin.role.*, admin.user.*, all deletes, finance.report.export."""
    result = set(ALL_PERMISSIONS)
    result -= {
        # Admin: manager gets NONE of admin.role.* / admin.user.*
        "admin.role.create",
        "admin.role.read",
        "admin.role.update",
        "admin.role.delete",
        "admin.user.create",
        "admin.user.read",
        "admin.user.update",
        "admin.user.delete",
        # Deletes that only owner has
        "inventory.product.delete",
        "inventory.movement.delete",
        "warehouse.warehouse.delete",
        "warehouse.zone.delete",
        "warehouse.location.delete",
        "workorder.order.delete",
        "workorder.plan.delete",
        "purchasing.po.delete",
        "sales.order.delete",
        "master.costcenter.delete",
        "master.costelement.delete",
        "master.ottype.delete",
        "master.department.delete",
        "master.leavetype.delete",
        "customer.customer.delete",
        "tools.tool.delete",
        "hr.employee.delete",
        # Finance export: owner only
        "finance.report.export",
    }
    return result


def _supervisor() -> set[str]:
    """Supervisor: read + approve + export + limited create/update."""
    return {
        # Inventory
        "inventory.product.create",
        "inventory.product.read",
        "inventory.product.update",
        "inventory.product.export",
        "inventory.movement.create",
        "inventory.movement.read",
        "inventory.movement.export",
        # Warehouse
        "warehouse.warehouse.create",
        "warehouse.warehouse.read",
        "warehouse.warehouse.update",
        "warehouse.zone.create",
        "warehouse.zone.read",
        "warehouse.zone.update",
        "warehouse.location.create",
        "warehouse.location.read",
        "warehouse.location.update",
        # Work Order
        "workorder.order.create",
        "workorder.order.read",
        "workorder.order.update",
        "workorder.order.approve",
        "workorder.order.export",
        # Planning (supervisor can plan)
        "workorder.plan.create",
        "workorder.plan.read",
        "workorder.plan.update",
        "workorder.reservation.create",
        "workorder.reservation.read",
        # Purchasing
        "purchasing.po.create",
        "purchasing.po.read",
        "purchasing.po.update",
        "purchasing.po.approve",
        "purchasing.po.export",
        # Sales
        "sales.order.create",
        "sales.order.read",
        "sales.order.update",
        "sales.order.approve",
        "sales.order.export",
        # Finance
        "finance.report.read",
        # Master Data
        "master.costcenter.create",
        "master.costcenter.read",
        "master.costcenter.update",
        "master.costelement.create",
        "master.costelement.read",
        "master.costelement.update",
        "master.ottype.read",
        "master.department.read",
        "master.leavetype.read",
        # Customer
        "customer.customer.create",
        "customer.customer.read",
        "customer.customer.update",
        "customer.customer.export",
        # Tools
        "tools.tool.create",
        "tools.tool.read",
        "tools.tool.update",
        "tools.tool.execute",
        "tools.tool.export",
        # HR
        "hr.employee.read",
        "hr.timesheet.create",
        "hr.timesheet.read",
        "hr.timesheet.update",
        "hr.timesheet.approve",
        "hr.leave.create",
        "hr.leave.read",
        "hr.leave.approve",
        # Daily Report (Phase 5)
        "hr.dailyreport.create",
        "hr.dailyreport.read",
        "hr.dailyreport.approve",
    }


def _staff() -> set[str]:
    """Staff: read (limited) + own create."""
    return {
        # Inventory
        "inventory.product.read",
        "inventory.movement.create",
        "inventory.movement.read",
        "inventory.movement.export",
        # Warehouse
        "warehouse.warehouse.read",
        "warehouse.zone.read",
        "warehouse.location.create",
        "warehouse.location.read",
        # Work Order
        "workorder.order.create",
        "workorder.order.read",
        "workorder.order.update",
        "workorder.order.export",
        # Planning (staff can view plans)
        "workorder.plan.read",
        "workorder.reservation.read",
        # Purchasing
        "purchasing.po.create",
        "purchasing.po.read",
        # Sales
        "sales.order.create",
        "sales.order.read",
        # Finance
        "finance.report.read",
        # Master Data
        "master.costcenter.read",
        "master.costelement.read",
        "master.ottype.read",
        "master.department.read",
        "master.leavetype.read",
        # Customer
        "customer.customer.read",
        # Tools
        "tools.tool.read",
        "tools.tool.execute",
        # HR
        "hr.timesheet.create",
        "hr.timesheet.read",
        "hr.leave.create",
        "hr.leave.read",
        # Daily Report (Phase 5)
        "hr.dailyreport.create",
        "hr.dailyreport.read",
    }


def _viewer() -> set[str]:
    """Viewer: read + selected export only."""
    return {
        # Inventory
        "inventory.product.read",
        "inventory.product.export",
        "inventory.movement.read",
        # Warehouse
        "warehouse.warehouse.read",
        "warehouse.zone.read",
        "warehouse.location.read",
        # Work Order
        "workorder.order.read",
        "workorder.plan.read",
        "workorder.reservation.read",
        # Purchasing
        "purchasing.po.read",
        "purchasing.po.export",
        # Sales
        "sales.order.read",
        "sales.order.export",
        # Finance
        "finance.report.read",
        # Master Data
        "master.costcenter.read",
        "master.costelement.read",
        "master.ottype.read",
        "master.department.read",
        "master.leavetype.read",
        # Customer
        "customer.customer.read",
        "customer.customer.export",
        # Tools
        "tools.tool.read",
        "tools.tool.export",
        # Daily Report (Phase 5)
        "hr.dailyreport.read",
    }


ROLE_PERMISSIONS: dict[str, set[str]] = {
    "owner": _owner(),
    "manager": _manager(),
    "supervisor": _supervisor(),
    "staff": _staff(),
    "viewer": _viewer(),
}


# ============================================================
# PERMISSION CHECK DEPENDENCY
# ============================================================

class PermissionChecker:
    """
    FastAPI dependency for checking permissions.

    Usage:
        @router.get("/products", dependencies=[Depends(require("inventory.product.read"))])
        async def list_products(...):
            ...
    """

    def __init__(self, permission: str):
        if permission not in ALL_PERMISSIONS:
            raise ValueError(f"Unknown permission: {permission}")
        self.permission = permission

    async def __call__(
        self,
        token_payload: dict[str, Any] = Depends(get_token_payload),
        db: AsyncSession = Depends(get_db),
    ):
        user_id = token_payload.get("sub")
        role = token_payload.get("role")

        if not user_id or not role:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        # Check permission against role
        role_perms = ROLE_PERMISSIONS.get(role, set())
        if self.permission not in role_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {self.permission}",
            )

        return token_payload


def require(permission: str) -> PermissionChecker:
    """Shortcut to create a permission dependency."""
    return PermissionChecker(permission)
