"""
SSS Corp ERP — Audit Log Pydantic Schemas
Phase 13.1: Enhanced Audit Trail
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AuditLogResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    user_email: str | None = None
    user_name: str | None = None
    action: str
    resource_type: str
    resource_id: str | None = None
    description: str
    changes: dict | None = None
    ip_address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int = Field(ge=0)
