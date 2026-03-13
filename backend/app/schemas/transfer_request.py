"""
SSS Corp ERP — Transfer Request Schemas (Pydantic v2)
Multi-line transfer document: header (source/dest) + product lines
Status flow: DRAFT → PENDING → TRANSFERRED (+ CANCELLED)
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ============================================================
# CREATE / UPDATE SCHEMAS
# ============================================================

class TransferRequestLineCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(gt=0)
    note: Optional[str] = None


class TransferRequestCreate(BaseModel):
    source_warehouse_id: UUID
    source_location_id: Optional[UUID] = None
    dest_warehouse_id: UUID
    dest_location_id: Optional[UUID] = None
    requested_by: Optional[UUID] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    lines: list[TransferRequestLineCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_source_dest_different(self):
        """Source and destination must differ (at least warehouse or location)."""
        same_wh = self.source_warehouse_id == self.dest_warehouse_id
        same_loc = self.source_location_id == self.dest_location_id
        if same_wh and same_loc:
            raise ValueError(
                "Source and destination must be different "
                "(same warehouse AND same location)"
            )
        return self


class TransferRequestUpdate(BaseModel):
    source_warehouse_id: Optional[UUID] = None
    source_location_id: Optional[UUID] = None
    dest_warehouse_id: Optional[UUID] = None
    dest_location_id: Optional[UUID] = None
    requested_by: Optional[UUID] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    lines: Optional[list[TransferRequestLineCreate]] = None


# ============================================================
# EXECUTE SCHEMAS
# ============================================================

class TransferRequestExecuteLineInput(BaseModel):
    line_id: UUID
    transferred_qty: int = Field(ge=0)


class TransferRequestExecuteRequest(BaseModel):
    lines: list[TransferRequestExecuteLineInput] = Field(min_length=1)
    note: Optional[str] = None


# ============================================================
# RESPONSE SCHEMAS
# ============================================================

class TransferRequestLineResponse(BaseModel):
    id: UUID
    transfer_request_id: UUID
    line_number: int
    product_id: UUID
    product_sku: Optional[str] = None
    product_name: Optional[str] = None
    product_unit: Optional[str] = None
    quantity: int
    transferred_qty: int
    movement_id: Optional[UUID] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransferRequestResponse(BaseModel):
    id: UUID
    transfer_number: str
    status: str
    source_warehouse_id: UUID
    source_warehouse_name: Optional[str] = None
    source_location_id: Optional[UUID] = None
    source_location_name: Optional[str] = None
    dest_warehouse_id: UUID
    dest_warehouse_name: Optional[str] = None
    dest_location_id: Optional[UUID] = None
    dest_location_name: Optional[str] = None
    requested_by: Optional[UUID] = None
    requester_name: Optional[str] = None
    transferred_by: Optional[UUID] = None
    transferrer_name: Optional[str] = None
    transferred_at: Optional[datetime] = None
    note: Optional[str] = None
    reference: Optional[str] = None
    created_by: UUID
    is_active: bool
    lines: list[TransferRequestLineResponse] = []
    line_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransferRequestListResponse(BaseModel):
    items: list[TransferRequestResponse]
    total: int
    limit: int
    offset: int
