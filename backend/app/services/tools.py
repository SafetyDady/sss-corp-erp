"""
SSS Corp ERP — Tools Service (Business Logic)
Phase 2: Tool CRUD + Check-out/Check-in + Auto Recharge

Business Rules enforced:
  BR#16 — Tools Recharge = Σ(Hours × Tool Rate baht/hr)
  BR#27 — Tool checked out to 1 person at a time
  BR#28 — Auto charge on check-in (not check-out)
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tools import Tool, ToolCheckout, ToolStatus
from app.models.workorder import WorkOrder, WOStatus


# ============================================================
# TOOL CRUD
# ============================================================

async def create_tool(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    description: Optional[str],
    rate_per_hour: Decimal,
    org_id: UUID,
) -> Tool:
    existing = await db.execute(
        select(Tool).where(Tool.org_id == org_id, Tool.code == code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tool with code '{code}' already exists",
        )

    tool = Tool(
        code=code,
        name=name,
        description=description,
        rate_per_hour=rate_per_hour,
        org_id=org_id,
    )
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return tool


async def get_tool(db: AsyncSession, tool_id: UUID, *, org_id: Optional[UUID] = None) -> Tool:
    query = select(Tool).where(Tool.id == tool_id, Tool.is_active == True)
    if org_id:
        query = query.where(Tool.org_id == org_id)
    result = await db.execute(query)
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


async def list_tools(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[Tool], int]:
    query = select(Tool).where(Tool.is_active == True)
    if org_id:
        query = query.where(Tool.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Tool.code.ilike(pattern)) | (Tool.name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Tool.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_tool(
    db: AsyncSession,
    tool_id: UUID,
    *,
    update_data: dict,
) -> Tool:
    tool = await get_tool(db, tool_id)
    for field, value in update_data.items():
        if value is not None:
            setattr(tool, field, value)
    await db.commit()
    await db.refresh(tool)
    return tool


async def delete_tool(db: AsyncSession, tool_id: UUID) -> None:
    tool = await get_tool(db, tool_id)
    if tool.status == ToolStatus.CHECKED_OUT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot delete a tool that is currently checked out",
        )
    tool.is_active = False
    await db.commit()


# ============================================================
# CHECK-OUT / CHECK-IN  (BR#27, BR#28)
# ============================================================

async def checkout_tool(
    db: AsyncSession,
    tool_id: UUID,
    *,
    employee_id: UUID,
    work_order_id: UUID,
    checked_out_by: UUID,
    org_id: UUID,
) -> ToolCheckout:
    tool = await get_tool(db, tool_id)

    # BR#27: Tool checked out to 1 person at a time
    if tool.status == ToolStatus.CHECKED_OUT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tool is already checked out (BR#27)",
        )

    if tool.status != ToolStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Tool is not available (status: {tool.status.value})",
        )

    # Validate WO is OPEN
    wo_result = await db.execute(
        select(WorkOrder).where(WorkOrder.id == work_order_id)
    )
    wo = wo_result.scalar_one_or_none()
    if not wo or wo.status != WOStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tools can only be checked out for OPEN work orders",
        )

    now = datetime.now(timezone.utc)

    checkout = ToolCheckout(
        tool_id=tool_id,
        employee_id=employee_id,
        work_order_id=work_order_id,
        checkout_at=now,
        checked_out_by=checked_out_by,
        org_id=org_id,
    )
    db.add(checkout)

    tool.status = ToolStatus.CHECKED_OUT

    await db.commit()
    await db.refresh(checkout)
    return checkout


async def checkin_tool(
    db: AsyncSession,
    tool_id: UUID,
    *,
    checked_in_by: UUID,
) -> ToolCheckout:
    tool = await get_tool(db, tool_id)

    if tool.status != ToolStatus.CHECKED_OUT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tool is not currently checked out",
        )

    # Find active checkout
    result = await db.execute(
        select(ToolCheckout).where(
            ToolCheckout.tool_id == tool_id,
            ToolCheckout.checkin_at.is_(None),
        ).order_by(ToolCheckout.checkout_at.desc())
    )
    checkout = result.scalar_one_or_none()
    if not checkout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active checkout found for this tool",
        )

    now = datetime.now(timezone.utc)
    checkout.checkin_at = now
    checkout.checked_in_by = checked_in_by

    # BR#28: Auto charge on check-in
    hours_used = Decimal(str((now - checkout.checkout_at).total_seconds() / 3600))
    checkout.charge_amount = (hours_used * tool.rate_per_hour).quantize(Decimal("0.01"))

    tool.status = ToolStatus.AVAILABLE

    await db.commit()
    await db.refresh(checkout)
    return checkout


async def list_tool_checkouts(
    db: AsyncSession,
    tool_id: UUID,
    *,
    limit: int = 20,
    offset: int = 0,
    org_id: Optional[UUID] = None,
) -> tuple[list[ToolCheckout], int]:
    query = select(ToolCheckout).where(ToolCheckout.tool_id == tool_id)
    if org_id:
        query = query.where(ToolCheckout.org_id == org_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(ToolCheckout.checkout_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total
