"""
SSS Corp ERP — Customer Service (Business Logic)
"""

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer


async def create_customer(
    db: AsyncSession,
    *,
    code: str,
    name: str,
    contact_name: Optional[str],
    email: Optional[str],
    phone: Optional[str],
    address: Optional[str],
    tax_id: Optional[str],
    org_id: UUID,
) -> Customer:
    existing = await db.execute(
        select(Customer).where(Customer.org_id == org_id, Customer.code == code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Customer with code '{code}' already exists",
        )

    cust = Customer(
        code=code,
        name=name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        address=address,
        tax_id=tax_id,
        org_id=org_id,
    )
    db.add(cust)
    await db.commit()
    await db.refresh(cust)
    return cust


async def get_customer(db: AsyncSession, cust_id: UUID, *, org_id: Optional[UUID] = None) -> Customer:
    query = select(Customer).where(Customer.id == cust_id, Customer.is_active == True)
    if org_id:
        query = query.where(Customer.org_id == org_id)
    result = await db.execute(query)
    cust = result.scalar_one_or_none()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return cust


async def list_customers(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    org_id: Optional[UUID] = None,
) -> tuple[list[Customer], int]:
    query = select(Customer).where(Customer.is_active == True)
    if org_id:
        query = query.where(Customer.org_id == org_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Customer.code.ilike(pattern))
            | (Customer.name.ilike(pattern))
            | (Customer.contact_name.ilike(pattern))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Customer.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_customer(
    db: AsyncSession,
    cust_id: UUID,
    *,
    update_data: dict,
) -> Customer:
    cust = await get_customer(db, cust_id)
    for field, value in update_data.items():
        if value is not None:
            setattr(cust, field, value)
    await db.commit()
    await db.refresh(cust)
    return cust


async def delete_customer(db: AsyncSession, cust_id: UUID) -> None:
    cust = await get_customer(db, cust_id)
    cust.is_active = False
    await db.commit()
