"""
SSS Corp ERP — Shared API Helpers
Data scope helpers for role-based data visibility (Phase 6)

Usage:
    from app.api._helpers import resolve_employee_id, resolve_employee, get_department_employee_ids
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hr import Employee


async def resolve_employee_id(
    db: AsyncSession, user_id: UUID
) -> Optional[UUID]:
    """Get employee_id linked to a user_id. Returns None if no employee linked."""
    result = await db.execute(
        select(Employee.id).where(
            Employee.user_id == user_id,
            Employee.is_active == True,
        )
    )
    row = result.one_or_none()
    return row[0] if row else None


async def resolve_employee(
    db: AsyncSession, user_id: UUID
) -> Optional[Employee]:
    """Get full Employee object linked to a user_id."""
    result = await db.execute(
        select(Employee).where(
            Employee.user_id == user_id,
            Employee.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def get_department_employee_ids(
    db: AsyncSession, department_id: UUID, org_id: UUID
) -> list[UUID]:
    """Get list of employee IDs in a department."""
    result = await db.execute(
        select(Employee.id).where(
            Employee.department_id == department_id,
            Employee.org_id == org_id,
            Employee.is_active == True,
        )
    )
    return [row[0] for row in result.all()]
