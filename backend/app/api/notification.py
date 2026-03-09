"""
SSS Corp ERP — Notification API
Phase 9: Notification Center — 5 endpoints (JWT-only, no permissions)

All endpoints filter by user_id + org_id from JWT token.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_token_payload
from app.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services.notification import (
    delete_notification,
    get_unread_count,
    list_notifications,
    mark_all_as_read,
    mark_as_read,
)

notification_router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ── List notifications ──
@notification_router.get(
    "",
    response_model=NotificationListResponse,
)
async def api_list_notifications(
    is_read: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"])

    items, total, unread_count = await list_notifications(
        db, user_id, org_id, is_read=is_read, limit=limit, offset=offset
    )
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        unread_count=unread_count,
    )


# ── Unread count (lightweight polling) ──
@notification_router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
)
async def api_unread_count(
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"])
    count = await get_unread_count(db, user_id, org_id)
    return UnreadCountResponse(count=count)


# ── Mark single as read ──
@notification_router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
async def api_mark_as_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"])
    notif = await mark_as_read(db, notification_id, user_id, org_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.commit()
    return NotificationResponse.model_validate(notif)


# ── Mark all as read ──
@notification_router.post(
    "/read-all",
)
async def api_mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"])
    count = await mark_all_as_read(db, user_id, org_id)
    await db.commit()
    return {"updated": count}


# ── Delete notification ──
@notification_router.delete(
    "/{notification_id}",
)
async def api_delete_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    user_id = UUID(token["sub"])
    org_id = UUID(token["org_id"])
    deleted = await delete_notification(db, notification_id, user_id, org_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.commit()
    return {"deleted": True}
