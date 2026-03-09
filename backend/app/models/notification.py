"""
SSS Corp ERP — Notification Center Models
Phase 9: In-app notifications for approval requests, status changes, stock alerts.

No new permissions — JWT-only auth, filtered by user_id + org_id.
"""

import enum
import uuid

from sqlalchemy import (
    Boolean,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin, OrgMixin


# ============================================================
# Enums
# ============================================================

class NotificationType(str, enum.Enum):
    """10 notification event types."""
    APPROVAL_REQUEST = "APPROVAL_REQUEST"       # เอกสารรออนุมัติ
    DOCUMENT_APPROVED = "DOCUMENT_APPROVED"     # เอกสารอนุมัติแล้ว
    DOCUMENT_REJECTED = "DOCUMENT_REJECTED"     # เอกสารถูกปฏิเสธ
    LOW_STOCK_ALERT = "LOW_STOCK_ALERT"         # สินค้าใกล้หมด
    LEAVE_APPROVED = "LEAVE_APPROVED"           # ลาอนุมัติแล้ว
    LEAVE_REJECTED = "LEAVE_REJECTED"           # ลาถูกปฏิเสธ
    TIMESHEET_APPROVED = "TIMESHEET_APPROVED"   # Timesheet อนุมัติ
    TIMESHEET_FINAL = "TIMESHEET_FINAL"         # Timesheet HR สรุปแล้ว
    PO_RECEIVED = "PO_RECEIVED"                 # PO รับของแล้ว
    SYSTEM = "SYSTEM"                           # ระบบ


# ============================================================
# NOTIFICATION MODEL
# ============================================================

class Notification(Base, TimestampMixin, OrgMixin):
    """
    In-app notification — one per user per event.
    Queried primarily by (user_id, is_read) and sorted by created_at DESC.
    """
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type_enum"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False
    )
    message: Mapped[str] = mapped_column(
        Text, nullable=False
    )
    link: Mapped[str | None] = mapped_column(
        String(500), nullable=True  # relative URL e.g. "/purchasing/pr/{id}"
    )

    # Entity dedup — prevents duplicate unread alerts for same document
    entity_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True  # "PR", "SO", "Leave", "Product" etc.
    )
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True  # document ID
    )

    # Actor — who triggered the notification (denormalized for display)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    actor_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    __table_args__ = (
        # Primary query: user's unread notifications
        Index("ix_notif_user_read", "user_id", "is_read"),
        # Sort: user's notifications by date
        Index("ix_notif_user_created", "user_id", "created_at"),
        # Multi-tenant
        Index("ix_notif_org", "org_id"),
        # Dedup: check existing unread notification for same entity
        Index("ix_notif_entity", "entity_type", "entity_id"),
    )
