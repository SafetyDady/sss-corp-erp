"""
SSS Corp ERP — Purchasing Schemas (Pydantic v2)
PR/PO Redesign: PurchaseRequisition + PurchaseOrder + Lines + ConvertToPO
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================
# ENUMS (Schema-level, mirroring models)
# ============================================================

class PRStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    PO_CREATED = "PO_CREATED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class PRPriority(str, Enum):
    NORMAL = "NORMAL"
    URGENT = "URGENT"


class PRItemType(str, Enum):
    GOODS = "GOODS"
    SERVICE = "SERVICE"


class PRType(str, Enum):
    STANDARD = "STANDARD"
    BLANKET = "BLANKET"


class POStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


# ============================================================
# PR SCHEMAS
# ============================================================

class PRLineCreate(BaseModel):
    item_type: PRItemType
    product_id: Optional[UUID] = None
    description: Optional[str] = None
    quantity: int = Field(gt=0)
    unit: str = "PCS"
    estimated_unit_cost: Decimal = Field(ge=0, decimal_places=2, default=Decimal("0.00"))
    cost_element_id: UUID
    note: Optional[str] = None

    @model_validator(mode="after")
    def validate_item_type_fields(self):
        if self.item_type == PRItemType.GOODS and not self.product_id:
            raise ValueError("product_id is required for GOODS items")
        if self.item_type == PRItemType.SERVICE and not self.description and not self.product_id:
            raise ValueError("description or product_id is required for SERVICE items")
        return self


class PRLineResponse(BaseModel):
    id: UUID
    pr_id: UUID
    line_number: int
    item_type: str
    product_id: Optional[UUID] = None
    description: Optional[str] = None
    quantity: int
    unit: str
    estimated_unit_cost: Decimal
    cost_element_id: UUID
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PRCreate(BaseModel):
    pr_type: PRType = PRType.STANDARD
    cost_center_id: UUID
    department_id: Optional[UUID] = None
    required_date: date
    delivery_date: Optional[date] = None
    priority: PRPriority = PRPriority.NORMAL
    validity_start_date: Optional[date] = None
    validity_end_date: Optional[date] = None
    note: Optional[str] = None
    requested_approver_id: Optional[UUID] = None
    lines: list[PRLineCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_blanket_dates(self):
        if self.pr_type == PRType.BLANKET:
            if not self.validity_start_date or not self.validity_end_date:
                raise ValueError("validity_start_date and validity_end_date are required for BLANKET PR")
            if self.validity_end_date < self.validity_start_date:
                raise ValueError("validity_end_date must be >= validity_start_date")
        return self


class PRUpdate(BaseModel):
    pr_type: Optional[PRType] = None
    cost_center_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    required_date: Optional[date] = None
    delivery_date: Optional[date] = None
    priority: Optional[PRPriority] = None
    validity_start_date: Optional[date] = None
    validity_end_date: Optional[date] = None
    note: Optional[str] = None
    requested_approver_id: Optional[UUID] = None
    lines: Optional[list[PRLineCreate]] = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def validate_blanket_dates(self):
        if self.pr_type == PRType.BLANKET:
            if not self.validity_start_date or not self.validity_end_date:
                raise ValueError("validity_start_date and validity_end_date are required for BLANKET PR")
            if self.validity_end_date < self.validity_start_date:
                raise ValueError("validity_end_date must be >= validity_start_date")
        return self


class PRApproveRequest(BaseModel):
    action: str = Field(pattern=r"^(approve|reject)$")
    reason: Optional[str] = None

    @model_validator(mode="after")
    def validate_reject_reason(self):
        if self.action == "reject" and not self.reason:
            raise ValueError("reason is required when rejecting")
        return self


class PRResponse(BaseModel):
    id: UUID
    pr_number: str
    pr_type: str
    cost_center_id: UUID
    department_id: Optional[UUID] = None
    requester_id: Optional[UUID] = None
    status: PRStatus
    priority: str
    required_date: date
    delivery_date: Optional[date] = None
    validity_start_date: Optional[date] = None
    validity_end_date: Optional[date] = None
    total_estimated: Optional[Decimal] = None
    note: Optional[str] = None
    requested_approver_id: Optional[UUID] = None
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None
    created_by: UUID
    is_active: bool
    lines: list[PRLineResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PRListResponse(BaseModel):
    items: list[PRResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# CONVERT TO PO SCHEMAS
# ============================================================

class ConvertToPOLine(BaseModel):
    pr_line_id: UUID
    unit_cost: Decimal = Field(ge=0, decimal_places=2)


class ConvertToPORequest(BaseModel):
    supplier_name: str = Field(min_length=1, max_length=255)
    expected_date: Optional[date] = None
    note: Optional[str] = None
    lines: list[ConvertToPOLine] = Field(min_length=1)


# ============================================================
# PO SCHEMAS (Modified with PR reference)
# ============================================================

class POLineCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(gt=0)
    unit_cost: Decimal = Field(ge=0, decimal_places=2)


class POLineResponse(BaseModel):
    id: UUID
    po_id: UUID
    pr_line_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    item_type: str = "GOODS"
    description: Optional[str] = None
    quantity: int
    unit: str = "PCS"
    unit_cost: Decimal
    cost_element_id: Optional[UUID] = None
    received_qty: int
    received_by: Optional[UUID] = None
    received_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PurchaseOrderCreate(BaseModel):
    supplier_name: str = Field(min_length=1, max_length=255)
    order_date: date
    expected_date: Optional[date] = None
    note: Optional[str] = None
    requested_approver_id: Optional[UUID] = None
    lines: list[POLineCreate] = Field(min_length=1)


class PurchaseOrderUpdate(BaseModel):
    supplier_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    expected_date: Optional[date] = None
    note: Optional[str] = None


class PurchaseOrderResponse(BaseModel):
    id: UUID
    po_number: str
    pr_id: Optional[UUID] = None
    pr_number: Optional[str] = None
    supplier_name: str
    status: POStatus
    order_date: date
    expected_date: Optional[date] = None
    total_amount: Decimal
    cost_center_id: Optional[UUID] = None
    note: Optional[str] = None
    delivery_note_number: Optional[str] = None
    created_by: UUID
    approved_by: Optional[UUID] = None
    requested_approver_id: Optional[UUID] = None
    is_active: bool
    lines: list[POLineResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PurchaseOrderListResponse(BaseModel):
    items: list[PurchaseOrderResponse]
    total: int
    limit: int
    offset: int


# ============================================================
# GOODS RECEIPT SCHEMA (Enhanced)
# ============================================================

class GoodsReceiptLine(BaseModel):
    line_id: UUID
    received_qty: int = Field(gt=0)
    location_id: Optional[UUID] = None  # Receiving location (GOODS only)
    note: Optional[str] = None


class GoodsReceiptRequest(BaseModel):
    delivery_note_number: Optional[str] = Field(
        default=None, max_length=100, description="เลขใบวางของจากซัพพลายเออร์"
    )
    lines: list[GoodsReceiptLine] = Field(min_length=1)
