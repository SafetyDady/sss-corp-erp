"""
SSS Corp ERP — Customer API Routes
Phase 3: Customer CRUD

Endpoints (from CLAUDE.md):
  GET    /api/customers                       customer.customer.read
  POST   /api/customers                       customer.customer.create
  PUT    /api/customers/{id}                  customer.customer.update
  DELETE /api/customers/{id}                  customer.customer.delete
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.customer import (
    CustomerCreate,
    CustomerListResponse,
    CustomerResponse,
    CustomerUpdate,
)
from app.services.customer import (
    create_customer,
    delete_customer,
    get_customer,
    list_customers,
    update_customer,
)

customer_router = APIRouter(prefix="/api/customers", tags=["customers"])


@customer_router.get(
    "",
    response_model=CustomerListResponse,
    dependencies=[Depends(require("customer.customer.read"))],
)
async def api_list_customers(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_customers(db, limit=limit, offset=offset, search=search)
    return CustomerListResponse(items=items, total=total, limit=limit, offset=offset)


@customer_router.post(
    "",
    response_model=CustomerResponse,
    status_code=201,
    dependencies=[Depends(require("customer.customer.create"))],
)
async def api_create_customer(
    body: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    return await create_customer(
        db,
        code=body.code,
        name=body.name,
        contact_name=body.contact_name,
        email=body.email,
        phone=body.phone,
        address=body.address,
        tax_id=body.tax_id,
        org_id=org_id,
    )


@customer_router.get(
    "/{cust_id}",
    response_model=CustomerResponse,
    dependencies=[Depends(require("customer.customer.read"))],
)
async def api_get_customer(
    cust_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await get_customer(db, cust_id)


@customer_router.put(
    "/{cust_id}",
    response_model=CustomerResponse,
    dependencies=[Depends(require("customer.customer.update"))],
)
async def api_update_customer(
    cust_id: UUID,
    body: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    return await update_customer(db, cust_id, update_data=update_data)


@customer_router.delete(
    "/{cust_id}",
    status_code=204,
    dependencies=[Depends(require("customer.customer.delete"))],
)
async def api_delete_customer(
    cust_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    await delete_customer(db, cust_id)
