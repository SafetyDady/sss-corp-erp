"""
SSS Corp ERP — Notification Service
Phase 9: Notification Center — CRUD + event helpers

Pattern: all notification creation is fire-and-forget (wrapped in try/except, never blocks business logic).
"""

import logging
import uuid as uuid_mod
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType
from app.core.permissions import ROLE_PERMISSIONS

logger = logging.getLogger(__name__)


# ============================================================
# CRUD
# ============================================================

async def create_notification(
    db: AsyncSession,
    *,
    user_id: UUID,
    org_id: UUID,
    notification_type: NotificationType,
    title: str,
    message: str,
    link: str | None = None,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    actor_id: UUID | None = None,
    actor_name: str | None = None,
) -> Notification:
    """Create a single notification."""
    notif = Notification(
        id=uuid_mod.uuid4(),
        user_id=user_id,
        org_id=org_id,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        actor_name=actor_name,
        is_read=False,
    )
    db.add(notif)
    return notif


async def create_notifications_bulk(
    db: AsyncSession,
    *,
    user_ids: list[UUID],
    org_id: UUID,
    notification_type: NotificationType,
    title: str,
    message: str,
    link: str | None = None,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    actor_id: UUID | None = None,
    actor_name: str | None = None,
) -> list[Notification]:
    """Create notifications for multiple users at once."""
    notifications = []
    for uid in user_ids:
        notif = Notification(
            id=uuid_mod.uuid4(),
            user_id=uid,
            org_id=org_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_id=actor_id,
            actor_name=actor_name,
            is_read=False,
        )
        db.add(notif)
        notifications.append(notif)
    return notifications


async def list_notifications(
    db: AsyncSession,
    user_id: UUID,
    org_id: UUID,
    *,
    is_read: bool | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Notification], int, int]:
    """
    List notifications for a user.
    Returns (items, total, unread_count).
    """
    base = select(Notification).where(
        Notification.user_id == user_id,
        Notification.org_id == org_id,
    )

    # Count total
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Count unread
    unread_q = select(func.count()).where(
        Notification.user_id == user_id,
        Notification.org_id == org_id,
        Notification.is_read == False,  # noqa: E712
    )
    unread_count = (await db.execute(unread_q)).scalar() or 0

    # Filter by is_read
    query = base
    if is_read is not None:
        query = query.where(Notification.is_read == is_read)

    # Sort + paginate
    query = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total, unread_count


async def get_unread_count(
    db: AsyncSession,
    user_id: UUID,
    org_id: UUID,
) -> int:
    """Lightweight count for polling badge."""
    q = select(func.count()).where(
        Notification.user_id == user_id,
        Notification.org_id == org_id,
        Notification.is_read == False,  # noqa: E712
    )
    return (await db.execute(q)).scalar() or 0


async def mark_as_read(
    db: AsyncSession,
    notification_id: UUID,
    user_id: UUID,
    org_id: UUID,
) -> Notification | None:
    """Mark a single notification as read. Returns None if not found or not owned."""
    q = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == user_id,
        Notification.org_id == org_id,
    )
    result = await db.execute(q)
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.flush()
    return notif


async def mark_all_as_read(
    db: AsyncSession,
    user_id: UUID,
    org_id: UUID,
) -> int:
    """Mark all unread notifications as read. Returns count updated."""
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.org_id == org_id,
            Notification.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount


async def delete_notification(
    db: AsyncSession,
    notification_id: UUID,
    user_id: UUID,
    org_id: UUID,
) -> bool:
    """Delete a single notification. Returns True if deleted."""
    stmt = (
        delete(Notification)
        .where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
            Notification.org_id == org_id,
        )
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount > 0


# ============================================================
# Utility Helpers
# ============================================================

async def get_user_display_name(db: AsyncSession, user_id: UUID) -> str:
    """Fetch user's full_name for notification messages."""
    from app.models.user import User
    result = await db.execute(select(User.full_name).where(User.id == user_id))
    name = result.scalar_one_or_none()
    return name or "ผู้ใช้งาน"


async def get_employee_user_id(db: AsyncSession, employee_id: UUID) -> UUID | None:
    """Find the User ID associated with an Employee (for notifications to employees)."""
    from app.models.hr import Employee
    result = await db.execute(select(Employee.user_id).where(Employee.id == employee_id))
    return result.scalar_one_or_none()


# ============================================================
# Event Helpers — called after db.commit() in service files
# ============================================================

async def get_approver_user_ids(
    db: AsyncSession,
    org_id: UUID,
    permission: str,
    exclude_user_id: UUID | None = None,
) -> list[UUID]:
    """
    Get user IDs in an org whose role grants a specific permission.
    Uses ROLE_PERMISSIONS dict from permissions.py.
    """
    from app.models.user import User

    # Find which roles have this permission
    eligible_roles = [
        role for role, perms in ROLE_PERMISSIONS.items()
        if permission in perms
    ]
    if not eligible_roles:
        return []

    q = select(User.id).where(
        User.org_id == org_id,
        User.role.in_(eligible_roles),
        User.is_active == True,  # noqa: E712
    )
    if exclude_user_id:
        q = q.where(User.id != exclude_user_id)

    result = await db.execute(q)
    return list(result.scalars().all())


async def notify_approval_request(
    db: AsyncSession,
    *,
    org_id: UUID,
    permission: str,
    entity_type: str,
    entity_id: UUID,
    doc_number: str,
    doc_type_thai: str,
    link: str,
    actor_id: UUID,
    actor_name: str,
    exclude_user_id: UUID | None = None,
) -> None:
    """
    Create APPROVAL_REQUEST notifications for all users with a specific approve permission.
    Also triggers email notification if EMAIL_ENABLED.
    """
    try:
        user_ids = await get_approver_user_ids(db, org_id, permission, exclude_user_id)
        if not user_ids:
            return

        title = f"{doc_type_thai} รออนุมัติ"
        message = f"{doc_type_thai} {doc_number} ส่งโดย {actor_name}"

        await create_notifications_bulk(
            db,
            user_ids=user_ids,
            org_id=org_id,
            notification_type=NotificationType.APPROVAL_REQUEST,
            title=title,
            message=message,
            link=link,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_id=actor_id,
            actor_name=actor_name,
        )
        await db.commit()

        # Dual channel: also send email if enabled
        try:
            from app.services.email import send_approval_request, build_detail_url
            from app.models.user import User

            for uid in user_ids:
                user_q = select(User).where(User.id == uid)
                user_result = await db.execute(user_q)
                user = user_result.scalar_one_or_none()
                if user and user.email:
                    await send_approval_request(
                        to_email=user.email,
                        approver_name=user.full_name or user.email,
                        document_type=doc_type_thai,
                        document_number=doc_number,
                        requester_name=actor_name,
                        detail_url=build_detail_url(doc_type_thai, str(entity_id)),
                    )
        except Exception:
            logger.warning("Email notification failed for %s %s", entity_type, doc_number, exc_info=True)

    except Exception:
        logger.warning("Failed to create approval notifications for %s %s", entity_type, doc_number, exc_info=True)


async def notify_status_change(
    db: AsyncSession,
    *,
    org_id: UUID,
    user_id: UUID,
    notification_type: NotificationType,
    entity_type: str,
    entity_id: UUID,
    doc_number: str,
    doc_type_thai: str,
    link: str,
    actor_id: UUID,
    actor_name: str,
    reason: str | None = None,
) -> None:
    """
    Create a DOCUMENT_APPROVED/REJECTED notification for a specific user (document creator).
    """
    try:
        type_labels = {
            NotificationType.DOCUMENT_APPROVED: "อนุมัติแล้ว",
            NotificationType.DOCUMENT_REJECTED: "ถูกปฏิเสธ",
        }
        action_label = type_labels.get(notification_type, "อัปเดต")

        title = f"{doc_type_thai} {action_label}"
        message = f"{doc_type_thai} {doc_number} {action_label}โดย {actor_name}"
        if reason:
            message += f": {reason}"

        await create_notification(
            db,
            user_id=user_id,
            org_id=org_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_id=actor_id,
            actor_name=actor_name,
        )
        await db.commit()
    except Exception:
        logger.warning("Failed to create status change notification for %s %s", entity_type, doc_number, exc_info=True)


async def notify_low_stock(
    db: AsyncSession,
    *,
    org_id: UUID,
    product_id: UUID,
    product_sku: str,
    product_name: str,
    on_hand: int | float,
    min_stock: int | float,
) -> None:
    """
    Create LOW_STOCK_ALERT for supervisor+ users.
    Dedup: skip if unread alert exists for same product.
    """
    try:
        # Check for existing unread alert for this product
        existing_q = select(func.count()).where(
            Notification.org_id == org_id,
            Notification.notification_type == NotificationType.LOW_STOCK_ALERT,
            Notification.entity_type == "Product",
            Notification.entity_id == product_id,
            Notification.is_read == False,  # noqa: E712
        )
        existing = (await db.execute(existing_q)).scalar() or 0
        if existing > 0:
            return  # Already have unread low-stock alert for this product

        # Get supervisor+ users
        user_ids = await get_approver_user_ids(
            db, org_id, "inventory.product.read"
        )
        # Filter to supervisor+ (not staff/viewer) to avoid spamming
        from app.models.user import User
        q = select(User.id).where(
            User.id.in_(user_ids),
            User.role.in_(["owner", "manager", "supervisor"]),
        )
        result = await db.execute(q)
        target_ids = list(result.scalars().all())
        if not target_ids:
            return

        title = "สินค้าใกล้หมด"
        message = f"{product_sku} ({product_name}) คงเหลือ {on_hand} (ต่ำกว่ากำหนด {min_stock})"

        await create_notifications_bulk(
            db,
            user_ids=target_ids,
            org_id=org_id,
            notification_type=NotificationType.LOW_STOCK_ALERT,
            title=title,
            message=message,
            link="/supply-chain",
            entity_type="Product",
            entity_id=product_id,
        )
        await db.commit()
    except Exception:
        logger.warning("Failed to create low stock notification for %s", product_sku, exc_info=True)


async def notify_leave_decision(
    db: AsyncSession,
    *,
    org_id: UUID,
    user_id: UUID,
    notification_type: NotificationType,
    leave_dates: str,
    link: str = "/my/leave",
    actor_id: UUID | None = None,
    actor_name: str | None = None,
    reason: str | None = None,
) -> None:
    """Create LEAVE_APPROVED or LEAVE_REJECTED notification for the employee."""
    try:
        type_labels = {
            NotificationType.LEAVE_APPROVED: ("ลาอนุมัติแล้ว", "อนุมัติแล้ว"),
            NotificationType.LEAVE_REJECTED: ("ลาถูกปฏิเสธ", "ถูกปฏิเสธ"),
        }
        title, action = type_labels.get(notification_type, ("ลา", "อัปเดต"))
        message = f"คำขอลา {leave_dates} {action}"
        if actor_name:
            message += f"โดย {actor_name}"
        if reason:
            message += f": {reason}"

        await create_notification(
            db,
            user_id=user_id,
            org_id=org_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            actor_id=actor_id,
            actor_name=actor_name,
        )
        await db.commit()
    except Exception:
        logger.warning("Failed to create leave notification for user %s", user_id, exc_info=True)


async def notify_timesheet_decision(
    db: AsyncSession,
    *,
    org_id: UUID,
    user_id: UUID,
    notification_type: NotificationType,
    timesheet_date: str,
    link: str = "/my/timesheet",
    actor_id: UUID | None = None,
    actor_name: str | None = None,
) -> None:
    """Create TIMESHEET_APPROVED or TIMESHEET_FINAL notification for the employee."""
    try:
        type_labels = {
            NotificationType.TIMESHEET_APPROVED: "Timesheet อนุมัติ",
            NotificationType.TIMESHEET_FINAL: "Timesheet สรุปแล้ว",
        }
        title = type_labels.get(notification_type, "Timesheet")
        action = "อนุมัติ" if notification_type == NotificationType.TIMESHEET_APPROVED else "HR สรุปเรียบร้อย"
        message = f"Timesheet {timesheet_date} {action}"
        if actor_name:
            message += f"โดย {actor_name}"

        await create_notification(
            db,
            user_id=user_id,
            org_id=org_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            actor_id=actor_id,
            actor_name=actor_name,
        )
        await db.commit()
    except Exception:
        logger.warning("Failed to create timesheet notification for user %s", user_id, exc_info=True)


async def notify_po_received(
    db: AsyncSession,
    *,
    org_id: UUID,
    user_id: UUID,
    po_number: str,
    po_id: UUID,
    link: str,
    actor_id: UUID | None = None,
    actor_name: str | None = None,
) -> None:
    """Create PO_RECEIVED notification for the PR creator."""
    try:
        await create_notification(
            db,
            user_id=user_id,
            org_id=org_id,
            notification_type=NotificationType.PO_RECEIVED,
            title="PO รับของแล้ว",
            message=f"ใบสั่งซื้อ {po_number} รับของครบแล้ว",
            link=link,
            entity_type="PO",
            entity_id=po_id,
            actor_id=actor_id,
            actor_name=actor_name,
        )
        await db.commit()
    except Exception:
        logger.warning("Failed to create PO received notification for %s", po_number, exc_info=True)
