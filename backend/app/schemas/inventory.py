"""
SSS Corp ERP — Inventory Schemas (Pydantic v2)
Product CRUD + StockMovement
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================================
# ENUMS (mirror DB enums)
# ============================================================

class ProductType(str, Enum):
    MATERIAL = "MATERIAL"
    CONSUMABLE = "CONSUMABLE"


class MovementType(str, Enum):
    RECEIVE = "RECEIVE"
    ISSUE = "ISSUE"
    TRANSFER = "TRANSFER"
    ADJUST = "ADJUST"
    CONSUME = "CONSUME"
    REVERSAL = "REVERSAL"


# ============================================================
# PRODUCT SCHEMAS
# ============================================================

class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=50, description="Unique SKU code")
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    product_type: ProductType = ProductType.MATERIAL
    unit: str = Field(default="PCS", max_length=50)
    cost: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    min_stock: int = Field(default=0, ge=0)

    @field_validator("cost")
    @classmethod
    def validate_material_cost(cls, v, info):
        """MATERIAL cost must be >= 1.00 THB (Business Rule #1)"""
        # Note: we also validate at service layer with product_type context
        return v

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, v):
        return v.strip().upper()


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    product_type: Optional[ProductType] = None
    unit: Optional[str] = Field(default=None, max_length=50)
    cost: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    min_stock: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    # NOTE: SKU is NOT updatable if product has movements (Business Rule #3)
    sku: Optional[str] = Field(default=None, min_length=1, max_length=50)

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, v):
        if v is not None:
            return v.strip().upper()
        return v


class ProductResponse(BaseModel):
    id: UUID
    sku: str
    name: str
    description: Optional[str] = None
    product_type: ProductType
    unit: str
    cost: Decimal
    on_hand: int
    min_stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# STOCK MOVEMENT SCHEMAS
# ============================================================

class StockMovementCreate(BaseModel):
    product_id: UUID
    movement_type: MovementType
    quantity: int = Field(gt=0, description="Must be positive")
    unit_cost: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    reference: Optional[str] = Field(default=None, max_length=255)
    note: Optional[str] = None

    @field_validator("movement_type")
    @classmethod
    def disallow_reversal_direct(cls, v):
        """REVERSAL is not allowed via direct create — use /reverse endpoint"""
        if v == MovementType.REVERSAL:
            raise ValueError("Use POST /movements/{id}/reverse for reversals")
        return v


class StockMovementResponse(BaseModel):
    id: UUID
    product_id: UUID
    movement_type: MovementType
    quantity: int
    unit_cost: Decimal
    reference: Optional[str] = None
    note: Optional[str] = None
    created_by: UUID
    reversed_by_id: Optional[UUID] = None
    is_reversed: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StockMovementListResponse(BaseModel):
    items: list[StockMovementResponse]
    total: int
    limit: int
    offset: int
