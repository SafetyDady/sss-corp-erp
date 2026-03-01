"""
SSS Corp ERP -- Stock Withdrawal Slip Service (Business Logic)
Multi-line stock withdrawal document with 2-step flow:
  1. Create slip (DRAFT) -> Submit (PENDING)
  2. Store officer issues (PENDING -> ISSUED) -> generates StockMovements

Types:
  - WO_CONSUME: Withdraw for Work Order -> CONSUME movements
  - CC_ISSUE: Withdraw for Cost Center -> ISSUE movements
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
    StockWithdrawalSlip,
    StockWithdrawalSlipLine,
    WithdrawalStatus,
    WithdrawalType,
)
from app.models.workorder import WorkOrder, WOStatus
from app.models.master import CostCenter, CostElement
from app.models.hr import Employee
from app.models.user import User
from app.models.warehouse import Location, Warehouse
from app.services.inventory import create_movement


# ============================================================
# SLIP NUMBER GENERATOR
# ============================================================

async def _next_slip_number(db: AsyncSession, org_id: UUID) -> str:
    """Generate next slip number in format SW-{YYYY}-{NNNN}."""
    year = datetime.now(timezone.utc).year
    prefix = f"SW-{year}-"
    result = await db.execute(
        select(func.count()).where(
            StockWithdrawalSlip.org_id == org_id,
            StockWithdrawalSlip.slip_number.like(f"{prefix}%"),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


# ============================================================
# VALIDATION HELPERS
# ============================================================

async def _validate_work_order(
    db: AsyncSession, work_order_id: UUID, org_id: UUID
) -> WorkOrder:
    """Validate WO exists, is active, belongs to org, and is OPEN."""
    result = await db.execute(
        select(WorkOrder).where(
            WorkOrder.id == work_order_id,
            WorkOrder.org_id == org_id,
            WorkOrder.is_active == True,
        )
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found",
        )
    if wo.status != WOStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Work order must be OPEN (current: {wo.status.value})",
        )
    return wo


async def _validate_cost_center(
    db: AsyncSession, cost_center_id: UUID, org_id: UUID
) -> CostCenter:
    """Validate CostCenter exists, is active, belongs to org."""
    result = await db.execute(
        select(CostCenter).where(
            CostCenter.id == cost_center_id,
            CostCenter.org_id == org_id,
            CostCenter.is_active == True,
        )
    )
    cc = result.scalar_one_or_none()
    if not cc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cost center not found or inactive",
        )
    return cc


async def _validate_products(
    db: AsyncSession, product_ids: list[UUID]
) -> dict[UUID, Product]:
    """Validate all products exist and are MATERIAL/CONSUMABLE (not SERVICE)."""
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
                detail=f"Cannot withdraw SERVICE product: {p.sku}",
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

async def create_withdrawal_slip(
    db: AsyncSession,
    *,
    body: dict,
    created_by: UUID,
    org_id: UUID,
) -> StockWithdrawalSlip:
    """Create a new withdrawal slip with lines."""
    withdrawal_type = body["withdrawal_type"]

    if withdrawal_type == "WO_CONSUME":
        await _validate_work_order(db, body["work_order_id"], org_id)
    elif withdrawal_type == "CC_ISSUE":
        await _validate_cost_center(db, body["cost_center_id"], org_id)

    product_ids = [line["product_id"] for line in body["lines"]]
    await _validate_products(db, product_ids)

    slip_number = await _next_slip_number(db, org_id)

    slip = StockWithdrawalSlip(
        slip_number=slip_number,
        withdrawal_type=WithdrawalType(withdrawal_type),
        status=WithdrawalStatus.DRAFT,
        work_order_id=body.get("work_order_id"),
        cost_center_id=body.get("cost_center_id"),
        cost_element_id=body.get("cost_element_id"),
        requested_by=body.get("requested_by"),
        note=body.get("note"),
        reference=body.get("reference"),
        created_by=created_by,
        org_id=org_id,
    )
    db.add(slip)
    await db.flush()

    for idx, line_data in enumerate(body["lines"], 1):
        line = StockWithdrawalSlipLine(
            slip_id=slip.id,
            line_number=idx,
            product_id=line_data["product_id"],
            quantity=line_data["quantity"],
            location_id=line_data.get("location_id"),
            note=line_data.get("note"),
        )
        db.add(line)

    await db.commit()
    return await get_withdrawal_slip(db, slip.id, org_id=org_id)


# ============================================================
# READ
# ============================================================

async def get_withdrawal_slip(
    db: AsyncSession, slip_id: UUID, org_id: UUID,
) -> StockWithdrawalSlip:
    """Get a single withdrawal slip with lines loaded."""
    result = await db.execute(
        select(StockWithdrawalSlip)
        .options(selectinload(StockWithdrawalSlip.lines))
        .where(
            StockWithdrawalSlip.id == slip_id,
            StockWithdrawalSlip.org_id == org_id,
            StockWithdrawalSlip.is_active == True,
        )
    )
    slip = result.scalar_one_or_none()
    if not slip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Withdrawal slip not found")
    return slip


async def list_withdrawal_slips(
    db: AsyncSession, *, limit: int = 20, offset: int = 0,
    search: Optional[str] = None, slip_status: Optional[str] = None,
    withdrawal_type: Optional[str] = None, org_id: UUID,
) -> tuple[list[StockWithdrawalSlip], int]:
    """List withdrawal slips with pagination, search, and filters."""
    query = select(StockWithdrawalSlip).where(
        StockWithdrawalSlip.org_id == org_id, StockWithdrawalSlip.is_active == True,
    )
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            StockWithdrawalSlip.slip_number.ilike(pattern),
            StockWithdrawalSlip.reference.ilike(pattern),
            StockWithdrawalSlip.note.ilike(pattern),
        ))
    if slip_status:
        query = query.where(StockWithdrawalSlip.status == slip_status)
    if withdrawal_type:
        query = query.where(StockWithdrawalSlip.withdrawal_type == withdrawal_type)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.options(selectinload(StockWithdrawalSlip.lines))
        .order_by(StockWithdrawalSlip.created_at.desc())
        .limit(limit).offset(offset)
    )
    result = await db.execute(query)
    items = list(result.scalars().unique().all())
    return items, total


# ============================================================
# UPDATE
# ============================================================

async def update_withdrawal_slip(
    db: AsyncSession, slip_id: UUID, *, body: dict, org_id: UUID,
) -> StockWithdrawalSlip:
    """Update a DRAFT withdrawal slip. Replace lines if provided."""
    slip = await get_withdrawal_slip(db, slip_id, org_id=org_id)
    if slip.status != WithdrawalStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only edit DRAFT slips (current: {slip.status.value})",
        )
    new_lines = body.pop("lines", None)
    for field, value in body.items():
        if value is not None:
            setattr(slip, field, value)
    if new_lines is not None:
        product_ids = [line["product_id"] for line in new_lines]
        await _validate_products(db, product_ids)
        for old_line in slip.lines:
            await db.delete(old_line)
        await db.flush()
        for idx, line_data in enumerate(new_lines, 1):
            line = StockWithdrawalSlipLine(
                slip_id=slip.id, line_number=idx,
                product_id=line_data["product_id"], quantity=line_data["quantity"],
                location_id=line_data.get("location_id"), note=line_data.get("note"),
            )
            db.add(line)
    await db.commit()
    return await get_withdrawal_slip(db, slip_id, org_id=org_id)


# ============================================================
# DELETE
# ============================================================

async def delete_withdrawal_slip(db: AsyncSession, slip_id: UUID, org_id: UUID) -> None:
    """Soft-delete a DRAFT withdrawal slip."""
    slip = await get_withdrawal_slip(db, slip_id, org_id=org_id)
    if slip.status != WithdrawalStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only delete DRAFT slips (current: {slip.status.value})",
        )
    slip.is_active = False
    await db.commit()


# ============================================================
# STATUS TRANSITIONS
# ============================================================

async def submit_withdrawal_slip(db: AsyncSession, slip_id: UUID, org_id: UUID) -> StockWithdrawalSlip:
    """Submit a DRAFT slip for issuing (DRAFT -> PENDING)."""
    slip = await get_withdrawal_slip(db, slip_id, org_id=org_id)
    if slip.status != WithdrawalStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only submit DRAFT slips (current: {slip.status.value})",
        )
    slip.status = WithdrawalStatus.PENDING
    await db.commit()
    return await get_withdrawal_slip(db, slip_id, org_id=org_id)


async def cancel_withdrawal_slip(db: AsyncSession, slip_id: UUID, org_id: UUID) -> StockWithdrawalSlip:
    """Cancel a DRAFT or PENDING slip."""
    slip = await get_withdrawal_slip(db, slip_id, org_id=org_id)
    if slip.status not in (WithdrawalStatus.DRAFT, WithdrawalStatus.PENDING):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only cancel DRAFT or PENDING slips (current: {slip.status.value})",
        )
    slip.status = WithdrawalStatus.CANCELLED
    await db.commit()
    return await get_withdrawal_slip(db, slip_id, org_id=org_id)


# ============================================================
# ISSUE (creates stock movements)
# ============================================================

async def issue_withdrawal_slip(
    db: AsyncSession, slip_id: UUID, *,
    issue_data: dict, issued_by: UUID, org_id: UUID,
) -> StockWithdrawalSlip:
    """
    Issue a PENDING slip -- creates stock movements for each line.
    WO_CONSUME -> movement_type=CONSUME, work_order_id from slip
    CC_ISSUE   -> movement_type=ISSUE, cost_center_id from slip
    """
    slip = await get_withdrawal_slip(db, slip_id, org_id=org_id)
    if slip.status != WithdrawalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only issue PENDING slips (current: {slip.status.value})",
        )

    # For WO_CONSUME, validate WO is still OPEN
    if slip.withdrawal_type == WithdrawalType.WO_CONSUME:
        await _validate_work_order(db, slip.work_order_id, org_id)

    lines_by_id = {line.id: line for line in slip.lines}
    issue_lines = issue_data.get("lines", [])
    issue_note = issue_data.get("note")

    for issue_line in issue_lines:
        line_id = issue_line["line_id"]
        issued_qty = issue_line["issued_qty"]
        line = lines_by_id.get(line_id)
        if not line:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Slip line {line_id} not found",
            )
        line.issued_qty = issued_qty

        if issued_qty > 0:
            location_id = issue_line.get("location_id") or line.location_id
            prod_result = await db.execute(
                select(Product).where(Product.id == line.product_id)
            )
            product = prod_result.scalar_one_or_none()
            unit_cost = product.cost if product else Decimal("0.00")

            if slip.withdrawal_type == WithdrawalType.WO_CONSUME:
                movement = await create_movement(
                    db, product_id=line.product_id, movement_type="CONSUME",
                    quantity=issued_qty, unit_cost=unit_cost,
                    reference=f"SW {slip.slip_number} line #{line.line_number}",
                    note=issue_note or line.note, created_by=issued_by,
                    org_id=org_id, location_id=location_id,
                    work_order_id=slip.work_order_id,
                )
            elif slip.withdrawal_type == WithdrawalType.CC_ISSUE:
                movement = await create_movement(
                    db, product_id=line.product_id, movement_type="ISSUE",
                    quantity=issued_qty, unit_cost=unit_cost,
                    reference=f"SW {slip.slip_number} line #{line.line_number}",
                    note=issue_note or line.note, created_by=issued_by,
                    org_id=org_id, location_id=location_id,
                    cost_center_id=slip.cost_center_id,
                    cost_element_id=slip.cost_element_id,
                )
            line.movement_id = movement.id

    slip.status = WithdrawalStatus.ISSUED
    slip.issued_by = issued_by
    slip.issued_at = datetime.now(timezone.utc)
    await db.commit()
    return await get_withdrawal_slip(db, slip_id, org_id=org_id)


# ============================================================
# ENRICHMENT HELPERS (batch-fetch related names for list/detail)
# ============================================================

async def get_slip_enrichment_info(
    db: AsyncSession, slips: list[StockWithdrawalSlip],
) -> dict:
    """Batch-fetch related entity names for a list of slips.
    Returns dict keyed by slip.id with enrichment data."""
    if not slips:
        return {}

    wo_ids = {s.work_order_id for s in slips if s.work_order_id}
    cc_ids = {s.cost_center_id for s in slips if s.cost_center_id}
    ce_ids = {s.cost_element_id for s in slips if s.cost_element_id}
    emp_ids = {s.requested_by for s in slips if s.requested_by}
    user_ids = {s.issued_by for s in slips if s.issued_by}

    wo_names: dict[UUID, str] = {}
    cc_names: dict[UUID, str] = {}
    ce_names: dict[UUID, str] = {}
    emp_names: dict[UUID, str] = {}
    user_names: dict[UUID, str] = {}

    if wo_ids:
        result = await db.execute(
            select(WorkOrder.id, WorkOrder.wo_number).where(WorkOrder.id.in_(wo_ids))
        )
        wo_names = {row[0]: row[1] for row in result.all()}
    if cc_ids:
        result = await db.execute(
            select(CostCenter.id, CostCenter.name).where(CostCenter.id.in_(cc_ids))
        )
        cc_names = {row[0]: row[1] for row in result.all()}
    if ce_ids:
        result = await db.execute(
            select(CostElement.id, CostElement.name).where(CostElement.id.in_(ce_ids))
        )
        ce_names = {row[0]: row[1] for row in result.all()}
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
    for s in slips:
        enrichment[s.id] = {
            "work_order_number": wo_names.get(s.work_order_id) if s.work_order_id else None,
            "cost_center_name": cc_names.get(s.cost_center_id) if s.cost_center_id else None,
            "cost_element_name": ce_names.get(s.cost_element_id) if s.cost_element_id else None,
            "requester_name": emp_names.get(s.requested_by) if s.requested_by else None,
            "issuer_name": user_names.get(s.issued_by) if s.issued_by else None,
        }
    return enrichment


async def get_line_enrichment_info(
    db: AsyncSession, lines: list[StockWithdrawalSlipLine],
) -> dict:
    """Batch-fetch product + location info for slip lines.
    Returns dict keyed by line.id with enrichment data."""
    if not lines:
        return {}

    product_ids = {l.product_id for l in lines}
    location_ids = {l.location_id for l in lines if l.location_id}

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

    location_info: dict[UUID, dict] = {}
    if location_ids:
        result = await db.execute(
            select(Location.id, Location.name, Warehouse.name)
            .join(Warehouse, Location.warehouse_id == Warehouse.id)
            .where(Location.id.in_(location_ids))
        )
        for row in result.all():
            location_info[row[0]] = {
                "location_name": row[1],
                "warehouse_name": row[2],
            }

    enrichment = {}
    for l in lines:
        p = product_info.get(l.product_id, {})
        loc = location_info.get(l.location_id, {}) if l.location_id else {}
        enrichment[l.id] = {
            "product_sku": p.get("product_sku"),
            "product_name": p.get("product_name"),
            "product_unit": p.get("product_unit"),
            "location_name": loc.get("location_name"),
            "warehouse_name": loc.get("warehouse_name"),
        }
    return enrichment
