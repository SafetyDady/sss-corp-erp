"""
SSS Corp ERP — Sales Service (Business Logic)
Phase 3: Sales Order CRUD + approve
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sales import SOStatus, SalesOrder, SalesOrderLine


async def _next_so_number(db: AsyncSession, org_id: UUID) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"SO-{year}-"
    result = await db.execute(
        select(func.count()).where(
            SalesOrder.org_id == org_id,
            SalesOrder.so_number.like(f"{prefix}%"),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


async def create_sales_order(
    db: AsyncSession,
    *,
    customer_id: UUID,
    order_date,
    note: Optional[str],
    lines: list[dict],
    created_by: UUID,
    org_id: UUID,
    requested_approver_id: Optional[UUID] = None,
) -> SalesOrder:
    so_number = await _next_so_number(db, org_id)

    total = sum(Decimal(str(l["quantity"])) * l["unit_price"] for l in lines)

    so = SalesOrder(
        so_number=so_number,
        customer_id=customer_id,
        order_date=order_date,
        note=note,
        total_amount=total,
        created_by=created_by,
        org_id=org_id,
        requested_approver_id=requested_approver_id,
    )
    db.add(so)
    await db.flush()

    for l in lines:
        line = SalesOrderLine(
            so_id=so.id,
            product_id=l["product_id"],
            quantity=l["quantity"],
            unit_price=l["unit_price"],
        )
        db.add(line)

    await db.commit()
    return await get_sales_order(db, so.id)


async def get_sales_order(db: AsyncSession, so_id: UUID, *, org_id: Optional[UUID] = None) -> SalesOrder:
    query = (
        select(SalesOrder)
        .options(selectinload(SalesOrder.lines))
        .where(SalesOrder.id == so_id, SalesOrder.is_active == True)
    )
    if org_id:
        query = query.where(SalesOrder.org_id == org_id)
    result = await db.execute(query)
    so = result.scalar_one_or_none()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    return so


async def list_sales_orders(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    so_status: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[SalesOrder], int]:
    query = select(SalesOrder).where(SalesOrder.is_active == True)
    if org_id:
        query = query.where(SalesOrder.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(SalesOrder.so_number.ilike(pattern))
    if so_status:
        query = query.where(SalesOrder.status == so_status)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.options(selectinload(SalesOrder.lines))
        .order_by(SalesOrder.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    items = list(result.scalars().unique().all())
    return items, total


async def update_sales_order(
    db: AsyncSession,
    so_id: UUID,
    *,
    update_data: dict,
) -> SalesOrder:
    so = await get_sales_order(db, so_id)

    if so.status not in (SOStatus.DRAFT, SOStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot edit SO in {so.status.value} status",
        )

    for field, value in update_data.items():
        if value is not None:
            setattr(so, field, value)

    await db.commit()
    return await get_sales_order(db, so_id)


async def delete_sales_order(db: AsyncSession, so_id: UUID) -> None:
    so = await get_sales_order(db, so_id)
    if so.status != SOStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Can only delete DRAFT sales orders",
        )
    so.is_active = False
    await db.commit()


async def approve_sales_order(
    db: AsyncSession,
    so_id: UUID,
    *,
    approved_by: UUID,
) -> SalesOrder:
    so = await get_sales_order(db, so_id)

    if so.status not in (SOStatus.DRAFT, SOStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot approve SO in {so.status.value} status",
        )

    so.status = SOStatus.APPROVED
    so.approved_by = approved_by
    await db.commit()
    return await get_sales_order(db, so_id)
