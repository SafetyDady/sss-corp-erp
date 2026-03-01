"""
SSS Corp ERP — Inventory Schemas (Pydantic v2)
Product CRUD + StockMovement
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================
# ENUMS (mirror DB enums)
# ============================================================

class ProductType(str, Enum):
    MATERIAL = "MATERIAL"
    CONSUMABLE = "CONSUMABLE"
    SERVICE = "SERVICE"


class MovementType(str, Enum):
    RECEIVE = "RECEIVE"
    ISSUE = "ISSUE"
    TRANSFER = "TRANSFER"
    ADJUST = "ADJUST"
    CONSUME = "CONSUME"
    RETURN = "RETURN"
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
    is_low_stock: bool = False
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
    location_id: Optional[UUID] = None  # Source location (or general location)

    # Scenario-specific fields
    work_order_id: Optional[UUID] = None     # Required for CONSUME, RETURN
    cost_center_id: Optional[UUID] = None    # Required for ISSUE
    cost_element_id: Optional[UUID] = None   # Optional for ISSUE
    to_location_id: Optional[UUID] = None    # Required for TRANSFER (destination)
    adjust_type: Optional[Literal["INCREASE", "DECREASE"]] = None  # Required for ADJUST

    @field_validator("movement_type")
    @classmethod
    def disallow_reversal_direct(cls, v):
        """REVERSAL is not allowed via direct create — use /reverse endpoint"""
        if v == MovementType.REVERSAL:
            raise ValueError("Use POST /movements/{id}/reverse for reversals")
        return v

    @model_validator(mode="after")
    def validate_scenario_fields(self):
        mt = self.movement_type

        # CONSUME: work_order_id required
        if mt == MovementType.CONSUME and not self.work_order_id:
            raise ValueError("work_order_id is required for CONSUME movements")

        # RETURN: work_order_id required
        if mt == MovementType.RETURN and not self.work_order_id:
            raise ValueError("work_order_id is required for RETURN movements")

        # ISSUE: cost_center_id required
        if mt == MovementType.ISSUE and not self.cost_center_id:
            raise ValueError("cost_center_id is required for ISSUE movements")

        # TRANSFER: location_id (source) + to_location_id (dest) required
        if mt == MovementType.TRANSFER:
            if not self.location_id:
                raise ValueError("location_id (source) is required for TRANSFER movements")
            if not self.to_location_id:
                raise ValueError("to_location_id (destination) is required for TRANSFER movements")
            if self.location_id == self.to_location_id:
                raise ValueError("Source and destination locations must be different")

        # ADJUST: adjust_type required
        if mt == MovementType.ADJUST and not self.adjust_type:
            raise ValueError("adjust_type (INCREASE/DECREASE) is required for ADJUST movements")

        return self


class StockMovementResponse(BaseModel):
    id: UUID
    product_id: UUID
    movement_type: MovementType
    quantity: int
    unit_cost: Decimal
    reference: Optional[str] = None
    note: Optional[str] = None
    location_id: Optional[UUID] = None
    location_name: Optional[str] = None
    warehouse_name: Optional[str] = None
    work_order_id: Optional[UUID] = None
    work_order_number: Optional[str] = None
    cost_center_id: Optional[UUID] = None
    cost_center_name: Optional[str] = None
    cost_element_id: Optional[UUID] = None
    cost_element_name: Optional[str] = None
    to_location_id: Optional[UUID] = None
    to_location_name: Optional[str] = None
    to_warehouse_name: Optional[str] = None
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


# ============================================================
# STOCK BY LOCATION SCHEMAS
# ============================================================

class StockByLocationResponse(BaseModel):
    id: UUID
    product_id: UUID
    location_id: UUID
    location_code: str = ""
    location_name: str = ""
    warehouse_id: Optional[UUID] = None
    warehouse_name: str = ""
    zone_type: str = ""
    on_hand: int

    class Config:
        from_attributes = True


class StockByLocationListResponse(BaseModel):
    items: list[StockByLocationResponse]
    total: int


class LowStockCountResponse(BaseModel):
    count: int
