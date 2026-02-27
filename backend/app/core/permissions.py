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
]

assert len(ALL_PERMISSIONS) == 105, f"Expected 105 permissions, got {len(ALL_PERMISSIONS)}"
assert len(set(ALL_PERMISSIONS)) == 105, "Duplicate permissions found!"


# ============================================================
# ROLE → PERMISSION MAPPING  (matches plan v4 matrix)
# ============================================================
# Legend:  ✅ = granted  ❌ = denied

def _owner() -> set[str]:
    """Owner: ALL 105 permissions."""
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
