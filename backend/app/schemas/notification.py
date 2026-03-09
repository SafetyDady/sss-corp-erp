"""
SSS Corp ERP — Notification Schemas
Phase 9: Notification Center
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    notification_type: str
    title: str
    message: str
    link: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    actor_id: Optional[UUID] = None
    actor_name: Optional[str] = None
    is_read: bool
    org_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    count: int
