"""
SSS Corp ERP -- Transfer Request Service (Business Logic)
Multi-line stock transfer document with 2-step flow:
  1. Create request (DRAFT) -> Submit (PENDING)
  2. Authorized user executes (PENDING -> TRANSFERRED) -> generates TRANSFER movements

Source/Destination at header level (Warehouse + optional Location).
Execute calls existing create_movement(type=TRANSFER) per line.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import (
    Product,
    ProductType,
    StockMovement,
    TransferRequest,
    TransferRequestLine,
    TransferRequestStatus,
)
from app.models.hr import Employee
from app.models.user import User
from app.models.warehouse import Location, Warehouse
from app.services.inventory import create_movement


# ============================================================
# TRANSFER NUMBER GENERATOR
# ============================================================

async def _next_transfer_number(db: AsyncSession, org_id: UUID) -> str:
    """Generate next transfer number: TF-YYYYMMDD-NNN."""
    today = datetime.now(timezone.utc)
    prefix = f"TF-{today.strftime('%Y%m%d')}-"
    result = await db.execute(
        select(func.count()).where(
            TransferRequest.org_id == org_id,
            TransferRequest.transfer_number.like(f"{prefix}%"),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:03d}"


# ============================================================
# VALIDATION HELPERS
# ============================================================

async def _validate_warehouse(
    db: AsyncSession, warehouse_id: UUID, org_id: UUID, label: str = "Warehouse",
) -> Warehouse:
    """Validate warehouse exists, is active, belongs to org."""
    result = await db.execute(
        select(Warehouse).where(
            Warehouse.id == warehouse_id,
            Warehouse.org_id == org_id,
            Warehouse.is_active == True,
        )
    )
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{label} not found or inactive",
        )
    return wh


async def _validate_location(
    db: AsyncSession, location_id: UUID, warehouse_id: UUID, label: str = "Location",
) -> Location:
    """Validate location exists, is active, belongs to the specified warehouse."""
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.warehouse_id == warehouse_id,
            Location.is_active == True,
        )
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} not found or does not belong to the warehouse",
        )
    return loc


async def _validate_products(
    db: AsyncSession, product_ids: list[UUID],
) -> dict[UUID, Product]:
    """Validate all products exist and are not SERVICE type."""
    result = await db.execute(
        select(Product).where(Product.id.in_(product_ids))
    )
    products = {p.id: p for p in result.scalars().all()}

    for pid in product_ids:
        if pid not in products:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {pid} not found",
            )
        p = products[pid]
        if p.product_type == ProductType.SERVICE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot transfer SERVICE product: {p.sku}",
            )
        if not p.is_active:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Product {p.sku} is inactive",
            )
    return products


# ============================================================
# CREATE
# ============================================================

async def create_transfer_request(
    db: AsyncSession,
    *,
    body: dict,
    created_by: UUID,
    org_id: UUID,
) -> TransferRequest:
    """Create a new transfer request with lines."""
    # Validate warehouses
    await _validate_warehouse(db, body["source_warehouse_id"], org_id, "Source warehouse")
    await _validate_warehouse(db, body["dest_warehouse_id"], org_id, "Destination warehouse")

    # Validate optional locations
    if body.get("source_location_id"):
        await _validate_location(
            db, body["source_location_id"], body["source_warehouse_id"],
            "Source location",
        )
    if body.get("dest_location_id"):
        await _validate_location(
            db, body["dest_location_id"], body["dest_warehouse_id"],
            "Destination location",
        )

    # Validate products
    product_ids = [line["product_id"] for line in body["lines"]]
    await _validate_products(db, product_ids)

    # Generate transfer number
    tf_number = await _next_transfer_number(db, org_id)

    tf = TransferRequest(
        transfer_number=tf_number,
        status=TransferRequestStatus.DRAFT,
        source_warehouse_id=body["source_warehouse_id"],
        source_location_id=body.get("source_location_id"),
        dest_warehouse_id=body["dest_warehouse_id"],
        dest_location_id=body.get("dest_location_id"),
        requested_by=body.get("requested_by"),
        note=body.get("note"),
        reference=body.get("reference"),
        created_by=created_by,
        org_id=org_id,
    )
    db.add(tf)
    await db.flush()

    for idx, line_data in enumerate(body["lines"], 1):
        line = TransferRequestLine(
            transfer_request_id=tf.id,
            line_number=idx,
            product_id=line_data["product_id"],
            quantity=line_data["quantity"],
            note=line_data.get("note"),
        )
        db.add(line)

    await db.commit()
    return await get_transfer_request(db, tf.id, org_id=org_id)


# ============================================================
# READ
# ============================================================

async def get_transfer_request(
    db: AsyncSession, tf_id: UUID, org_id: UUID,
) -> TransferRequest:
    """Get a single transfer request with lines loaded."""
    result = await db.execute(
        select(TransferRequest)
        .options(selectinload(TransferRequest.lines))
        .where(
            TransferRequest.id == tf_id,
            TransferRequest.org_id == org_id,
            TransferRequest.is_active == True,
        )
    )
    tf = result.scalar_one_or_none()
    if not tf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transfer request not found",
        )
    return tf


async def list_transfer_requests(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    tf_status: Optional[str] = None,
    org_id: UUID,
) -> tuple[list[TransferRequest], int]:
    """List transfer requests with pagination, search, and filters."""
    query = select(TransferRequest).where(
        TransferRequest.org_id == org_id,
        TransferRequest.is_active == True,
    )
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            TransferRequest.transfer_number.ilike(pattern),
            TransferRequest.reference.ilike(pattern),
            TransferRequest.note.ilike(pattern),
        ))
    if tf_status:
        query = query.where(TransferRequest.status == tf_status)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.options(selectinload(TransferRequest.lines))
        .order_by(TransferRequest.created_at.desc())
        .limit(limit).offset(offset)
    )
    result = await db.execute(query)
    items = list(result.scalars().unique().all())
    return items, total


# ============================================================
# UPDATE
# ============================================================

async def update_transfer_request(
    db: AsyncSession, tf_id: UUID, *, body: dict, org_id: UUID,
) -> TransferRequest:
    """Update a DRAFT transfer request. Replace lines if provided."""
    tf = await get_transfer_request(db, tf_id, org_id=org_id)
    if tf.status != TransferRequestStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only edit DRAFT requests (current: {tf.status.value})",
        )

    new_lines = body.pop("lines", None)

    # Validate warehouse/location changes
    src_wh = body.get("source_warehouse_id") or tf.source_warehouse_id
    dst_wh = body.get("dest_warehouse_id") or tf.dest_warehouse_id
    if body.get("source_warehouse_id"):
        await _validate_warehouse(db, body["source_warehouse_id"], org_id, "Source warehouse")
    if body.get("dest_warehouse_id"):
        await _validate_warehouse(db, body["dest_warehouse_id"], org_id, "Destination warehouse")
    if body.get("source_location_id"):
        await _validate_location(db, body["source_location_id"], src_wh, "Source location")
    if body.get("dest_location_id"):
        await _validate_location(db, body["dest_location_id"], dst_wh, "Destination location")

    for field, value in body.items():
        if value is not None:
            setattr(tf, field, value)

    if new_lines is not None:
        product_ids = [line["product_id"] for line in new_lines]
        await _validate_products(db, product_ids)
        for old_line in tf.lines:
            await db.delete(old_line)
        await db.flush()
        for idx, line_data in enumerate(new_lines, 1):
            line = TransferRequestLine(
                transfer_request_id=tf.id,
                line_number=idx,
                product_id=line_data["product_id"],
                quantity=line_data["quantity"],
                note=line_data.get("note"),
            )
            db.add(line)

    await db.commit()
    return await get_transfer_request(db, tf_id, org_id=org_id)


# ============================================================
# DELETE
# ============================================================

async def delete_transfer_request(
    db: AsyncSession, tf_id: UUID, org_id: UUID,
) -> None:
    """Soft-delete a DRAFT transfer request."""
    tf = await get_transfer_request(db, tf_id, org_id=org_id)
    if tf.status != TransferRequestStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only delete DRAFT requests (current: {tf.status.value})",
        )
    tf.is_active = False
    await db.commit()


# ============================================================
# STATUS TRANSITIONS
# ============================================================

async def submit_transfer_request(
    db: AsyncSession, tf_id: UUID, org_id: UUID,
) -> TransferRequest:
    """Submit a DRAFT request for approval (DRAFT -> PENDING)."""
    tf = await get_transfer_request(db, tf_id, org_id=org_id)
    if tf.status != TransferRequestStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only submit DRAFT requests (current: {tf.status.value})",
        )
    tf.status = TransferRequestStatus.PENDING
    await db.commit()

    # Notification — APPROVAL_REQUEST for transfer approvers
    try:
        from app.services.notification import notify_approval_request, get_user_display_name
        _name = await get_user_display_name(db, tf.created_by)
        await notify_approval_request(
            db, org_id=org_id, permission="inventory.withdrawal.approve",
            entity_type="TransferRequest", entity_id=tf.id,
            doc_number=tf.transfer_number,
            doc_type_thai="ใบขอโอนย้ายสินค้า",
            link=f"/transfer-requests/{tf.id}",
            actor_id=tf.created_by, actor_name=_name,
            exclude_user_id=tf.created_by,
        )
    except Exception:
        import logging
        logging.getLogger(__name__).warning(
            "Notification failed for transfer submit %s",
            tf.transfer_number, exc_info=True,
        )

    return await get_transfer_request(db, tf_id, org_id=org_id)


async def cancel_transfer_request(
    db: AsyncSession, tf_id: UUID, org_id: UUID,
) -> TransferRequest:
    """Cancel a DRAFT or PENDING request."""
    tf = await get_transfer_request(db, tf_id, org_id=org_id)
    if tf.status not in (TransferRequestStatus.DRAFT, TransferRequestStatus.PENDING):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only cancel DRAFT or PENDING requests (current: {tf.status.value})",
        )
    tf.status = TransferRequestStatus.CANCELLED
    await db.commit()
    return await get_transfer_request(db, tf_id, org_id=org_id)


# ============================================================
# EXECUTE (creates TRANSFER movements)
# ============================================================

async def execute_transfer_request(
    db: AsyncSession,
    tf_id: UUID,
    *,
    execute_data: dict,
    transferred_by: UUID,
    org_id: UUID,
) -> TransferRequest:
    """
    Execute a PENDING request — creates TRANSFER movements per line.
    Uses existing create_movement(type=TRANSFER) for atomic stock ops:
      - source StockByLocation.on_hand -= qty
      - dest StockByLocation.on_hand += qty
      - Product.on_hand unchanged
    """
    try:
        tf = await get_transfer_request(db, tf_id, org_id=org_id)
        if tf.status != TransferRequestStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Can only execute PENDING requests (current: {tf.status.value})",
            )

        lines_by_id = {line.id: line for line in tf.lines}
        exec_lines = execute_data.get("lines", [])
        exec_note = execute_data.get("note")

        for exec_line in exec_lines:
            line_id = exec_line["line_id"]
            transferred_qty = exec_line["transferred_qty"]
            line = lines_by_id.get(line_id)
            if not line:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Transfer line {line_id} not found",
                )

            line.transferred_qty = transferred_qty

            if transferred_qty > 0:
                # Lookup product cost
                prod_result = await db.execute(
                    select(Product).where(Product.id == line.product_id)
                )
                product = prod_result.scalar_one_or_none()
                unit_cost = product.cost if product else Decimal("0.00")

                # Create TRANSFER movement via existing service
                movement = await create_movement(
                    db,
                    product_id=line.product_id,
                    movement_type="TRANSFER",
                    quantity=transferred_qty,
                    unit_cost=unit_cost,
                    reference=f"TF {tf.transfer_number} line #{line.line_number}",
                    note=exec_note or line.note,
                    created_by=transferred_by,
                    org_id=org_id,
                    location_id=tf.source_location_id,
                    to_location_id=tf.dest_location_id,
                    batch_number=exec_line.get("batch_number"),  # Phase 11.12
                )
                line.movement_id = movement.id

        tf.status = TransferRequestStatus.TRANSFERRED
        tf.transferred_by = transferred_by
        tf.transferred_at = datetime.now(timezone.utc)
        await db.commit()

    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        raise

    # Notification — DOCUMENT_APPROVED (transferred) for creator
    try:
        from app.services.notification import notify_status_change, get_user_display_name
        from app.models.notification import NotificationType
        _name = await get_user_display_name(db, transferred_by)
        if tf.created_by and tf.created_by != transferred_by:
            await notify_status_change(
                db, org_id=org_id, user_id=tf.created_by,
                notification_type=NotificationType.DOCUMENT_APPROVED,
                entity_type="TransferRequest", entity_id=tf.id,
                doc_number=tf.transfer_number,
                doc_type_thai="ใบขอโอนย้ายสินค้า",
                link=f"/transfer-requests/{tf.id}",
                actor_id=transferred_by, actor_name=_name,
            )
    except Exception:
        import logging
        logging.getLogger(__name__).warning(
            "Notification failed for transfer execute %s",
            tf.transfer_number, exc_info=True,
        )

    return await get_transfer_request(db, tf_id, org_id=org_id)


# ============================================================
# ENRICHMENT HELPERS
# ============================================================

async def get_tf_enrichment_info(
    db: AsyncSession, transfers: list[TransferRequest],
) -> dict:
    """Batch-fetch related entity names for a list of transfer requests."""
    if not transfers:
        return {}

    wh_ids = set()
    loc_ids = set()
    emp_ids = set()
    user_ids = set()

    for t in transfers:
        wh_ids.add(t.source_warehouse_id)
        wh_ids.add(t.dest_warehouse_id)
        if t.source_location_id:
            loc_ids.add(t.source_location_id)
        if t.dest_location_id:
            loc_ids.add(t.dest_location_id)
        if t.requested_by:
            emp_ids.add(t.requested_by)
        if t.transferred_by:
            user_ids.add(t.transferred_by)

    wh_names: dict[UUID, str] = {}
    loc_names: dict[UUID, str] = {}
    emp_names: dict[UUID, str] = {}
    user_names: dict[UUID, str] = {}

    if wh_ids:
        result = await db.execute(
            select(Warehouse.id, Warehouse.name).where(Warehouse.id.in_(wh_ids))
        )
        wh_names = {row[0]: row[1] for row in result.all()}
    if loc_ids:
        result = await db.execute(
            select(Location.id, Location.name).where(Location.id.in_(loc_ids))
        )
        loc_names = {row[0]: row[1] for row in result.all()}
    if emp_ids:
        result = await db.execute(
            select(Employee.id, Employee.full_name).where(Employee.id.in_(emp_ids))
        )
        emp_names = {row[0]: row[1] for row in result.all()}
    if user_ids:
        result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(user_ids))
        )
        user_names = {row[0]: row[1] for row in result.all()}

    enrichment = {}
    for t in transfers:
        enrichment[t.id] = {
            "source_warehouse_name": wh_names.get(t.source_warehouse_id),
            "dest_warehouse_name": wh_names.get(t.dest_warehouse_id),
            "source_location_name": loc_names.get(t.source_location_id) if t.source_location_id else None,
            "dest_location_name": loc_names.get(t.dest_location_id) if t.dest_location_id else None,
            "requester_name": emp_names.get(t.requested_by) if t.requested_by else None,
            "transferrer_name": user_names.get(t.transferred_by) if t.transferred_by else None,
        }
    return enrichment


async def get_tf_line_enrichment_info(
    db: AsyncSession, lines: list[TransferRequestLine],
) -> dict:
    """Batch-fetch product info for transfer request lines."""
    if not lines:
        return {}

    product_ids = {l.product_id for l in lines}

    product_info: dict[UUID, dict] = {}
    if product_ids:
        result = await db.execute(
            select(Product.id, Product.sku, Product.name, Product.unit).where(
                Product.id.in_(product_ids)
            )
        )
        for row in result.all():
            product_info[row[0]] = {
                "product_sku": row[1],
                "product_name": row[2],
                "product_unit": row[3],
            }

    enrichment = {}
    for l in lines:
        p = product_info.get(l.product_id, {})
        enrichment[l.id] = {
            "product_sku": p.get("product_sku"),
            "product_name": p.get("product_name"),
            "product_unit": p.get("product_unit"),
        }
    return enrichment
