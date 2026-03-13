"""
SSS Corp ERP — Delivery Order Schemas
Phase C3: Delivery Order (DO) — from SO to stock issue
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# Line schemas
# ============================================================

class DOLineCreate(BaseModel):
    product_id: UUID
    ordered_qty: int = Field(gt=0)
    so_line_id: Optional[UUID] = None
    location_id: Optional[UUID] = None
    note: Optional[str] = None


class DOShipLineRequest(BaseModel):
    line_id: UUID
    shipped_qty: int = Field(ge=0)
    location_id: Optional[UUID] = None
    batch_number: Optional[str] = Field(default=None, max_length=50)  # Phase 11.12


class DOLineResponse(BaseModel):
    id: UUID
    do_id: UUID
    so_line_id: Optional[UUID] = None
    product_id: UUID
    product_sku: Optional[str] = None
    product_name: Optional[str] = None
    product_unit: Optional[str] = None
    line_number: int
    ordered_qty: int
    shipped_qty: int
    location_id: Optional[UUID] = None
    location_name: Optional[str] = None
    warehouse_name: Optional[str] = None
    movement_id: Optional[UUID] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# DO CRUD schemas
# ============================================================

class DeliveryOrderCreate(BaseModel):
    so_id: UUID
    delivery_date: date
    shipping_address: Optional[str] = None
    shipping_method: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = None
    company_id: Optional[UUID] = None  # C11: Multi-Company
    lines: list[DOLineCreate] = Field(min_length=1)


class DeliveryOrderUpdate(BaseModel):
    delivery_date: Optional[date] = None
    shipping_address: Optional[str] = None
    shipping_method: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = None
    lines: Optional[list[DOLineCreate]] = None


class DOShipRequest(BaseModel):
    lines: list[DOShipLineRequest] = Field(min_length=1)
    note: Optional[str] = None


# ============================================================
# Response schemas
# ============================================================

class DeliveryOrderResponse(BaseModel):
    id: UUID
    do_number: str
    so_id: UUID
    so_number: Optional[str] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_code: Optional[str] = None
    delivery_date: date
    shipping_address: Optional[str] = None
    shipping_method: Optional[str] = None
    note: Optional[str] = None
    status: str
    shipped_by: Optional[UUID] = None
    shipped_by_name: Optional[str] = None
    shipped_at: Optional[datetime] = None
    created_by: UUID
    creator_name: Optional[str] = None
    is_active: bool
    org_id: UUID
    company_id: Optional[UUID] = None  # C11: Multi-Company
    company_code: Optional[str] = None  # C11: Multi-Company enrichment
    company_name: Optional[str] = None  # C11: Multi-Company enrichment
    lines: Optional[list[DOLineResponse]] = None
    line_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeliveryOrderListResponse(BaseModel):
    items: list[DeliveryOrderResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# Remaining qty response (for partial delivery)
# ============================================================

class RemainingQtyLine(BaseModel):
    so_line_id: UUID
    product_id: UUID
    product_sku: Optional[str] = None
    product_name: Optional[str] = None
    product_unit: Optional[str] = None
    so_qty: int
    shipped_qty: int
    remaining_qty: int


class RemainingQtyResponse(BaseModel):
    so_id: UUID
    so_number: Optional[str] = None
    lines: list[RemainingQtyLine]
