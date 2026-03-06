"""
SSS Corp ERP — Tool Checkout Slip Service (Business Logic)
Multi-line tool checkout document with workflow:
  1. Create slip (DRAFT) → Submit (PENDING)
  2. Store officer issues (PENDING → CHECKED_OUT) → creates ToolCheckout per line
  3. Per-line return (CHECKED_OUT → PARTIAL_RETURN/RETURNED) → auto-charge

Reuses existing checkout_tool() and checkin_tool() from services/tools.py
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tools import (
    Tool,
    ToolCheckout,
    ToolCheckoutSlip,
    ToolCheckoutSlipLine,
    ToolCheckoutSlipStatus,
    ToolStatus,
)
from app.models.workorder import WorkOrder, WOStatus
from app.models.hr import Employee
from app.models.user import User
from app.services.tools import checkout_tool, checkin_tool


# ============================================================
# SLIP NUMBER GENERATOR
# ============================================================

async def _next_slip_number(db: AsyncSession, org_id: UUID) -> str:
    """Generate next slip number in format TCS-{YYYY}-{NNNN}."""
    year = datetime.now(timezone.utc).year
    prefix = f"TCS-{year}-"
    result = await db.execute(
        select(func.count()).where(
            ToolCheckoutSlip.org_id == org_id,
            ToolCheckoutSlip.slip_number.like(f"{prefix}%"),
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


async def _validate_tools(
    db: AsyncSession, tool_ids: list[UUID], org_id: UUID,
) -> dict[UUID, Tool]:
    """Validate all tools exist, are active, and belong to org."""
    result = await db.execute(
        select(Tool).where(
            Tool.id.in_(tool_ids),
            Tool.org_id == org_id,
        )
    )
    tools = {t.id: t for t in result.scalars().all()}

    for tid in tool_ids:
        if tid not in tools:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tool {tid} not found",
            )
        t = tools[tid]
        if not t.is_active:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Tool {t.code} is inactive",
            )
    return tools


async def _validate_tools_available(tools: dict[UUID, Tool]) -> None:
    """Check that all tools are AVAILABLE (not already checked out)."""
    for tid, t in tools.items():
        if t.status != ToolStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Tool {t.code} is not available (status: {t.status.value})",
            )


async def _validate_employees(
    db: AsyncSession, employee_ids: list[UUID], org_id: UUID,
) -> dict[UUID, Employee]:
    """Validate all employees exist and belong to org."""
    if not employee_ids:
        return {}
    result = await db.execute(
        select(Employee).where(
            Employee.id.in_(employee_ids),
            Employee.org_id == org_id,
            Employee.is_active == True,
        )
    )
    employees = {e.id: e for e in result.scalars().all()}

    for eid in employee_ids:
        if eid not in employees:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee {eid} not found",
            )
    return employees


# ============================================================
# CREATE
# ============================================================

async def create_tool_checkout_slip(
    db: AsyncSession,
    *,
    body: dict,
    created_by: UUID,
    org_id: UUID,
) -> ToolCheckoutSlip:
    """Create a new tool checkout slip with lines."""
    # Validate WO is OPEN
    await _validate_work_order(db, body["work_order_id"], org_id)

    # Validate tools
    tool_ids = [line["tool_id"] for line in body["lines"]]
    await _validate_tools(db, tool_ids, org_id)

    # Validate employees
    employee_ids = [line["employee_id"] for line in body["lines"]]
    await _validate_employees(db, employee_ids, org_id)

    slip_number = await _next_slip_number(db, org_id)

    slip = ToolCheckoutSlip(
        slip_number=slip_number,
        status=ToolCheckoutSlipStatus.DRAFT,
        work_order_id=body["work_order_id"],
        requested_by=body.get("requested_by"),
        note=body.get("note"),
        reference=body.get("reference"),
        created_by=created_by,
        org_id=org_id,
    )
    db.add(slip)
    await db.flush()

    for idx, line_data in enumerate(body["lines"], 1):
        line = ToolCheckoutSlipLine(
            slip_id=slip.id,
            line_number=idx,
            tool_id=line_data["tool_id"],
            employee_id=line_data["employee_id"],
            note=line_data.get("note"),
        )
        db.add(line)

    await db.commit()
    return await get_tool_checkout_slip(db, slip.id, org_id=org_id)


# ============================================================
# READ
# ============================================================

async def get_tool_checkout_slip(
    db: AsyncSession, slip_id: UUID, org_id: UUID,
) -> ToolCheckoutSlip:
    """Get a single tool checkout slip with lines loaded."""
    result = await db.execute(
        select(ToolCheckoutSlip)
        .options(selectinload(ToolCheckoutSlip.lines))
        .where(
            ToolCheckoutSlip.id == slip_id,
            ToolCheckoutSlip.org_id == org_id,
            ToolCheckoutSlip.is_active == True,
        )
    )
    slip = result.scalar_one_or_none()
    if not slip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool checkout slip not found",
        )
    return slip


async def list_tool_checkout_slips(
    db: AsyncSession, *, limit: int = 20, offset: int = 0,
    search: Optional[str] = None, slip_status: Optional[str] = None,
    requested_by: Optional[UUID] = None,
    org_id: UUID,
) -> tuple[list[ToolCheckoutSlip], int]:
    """List tool checkout slips with pagination, search, and filters."""
    query = select(ToolCheckoutSlip).where(
        ToolCheckoutSlip.org_id == org_id,
        ToolCheckoutSlip.is_active == True,
    )
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            ToolCheckoutSlip.slip_number.ilike(pattern),
            ToolCheckoutSlip.reference.ilike(pattern),
            ToolCheckoutSlip.note.ilike(pattern),
        ))
    if slip_status:
        # Support comma-separated multi-status filter (e.g. "CHECKED_OUT,PARTIAL_RETURN")
        statuses = [s.strip() for s in slip_status.split(",")]
        if len(statuses) == 1:
            query = query.where(ToolCheckoutSlip.status == statuses[0])
        else:
            query = query.where(ToolCheckoutSlip.status.in_(statuses))
    if requested_by:
        query = query.where(ToolCheckoutSlip.requested_by == requested_by)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.options(selectinload(ToolCheckoutSlip.lines))
        .order_by(ToolCheckoutSlip.created_at.desc())
        .limit(limit).offset(offset)
    )
    result = await db.execute(query)
    items = list(result.scalars().unique().all())
    return items, total


# ============================================================
# UPDATE (DRAFT only)
# ============================================================

async def update_tool_checkout_slip(
    db: AsyncSession, slip_id: UUID, *, body: dict, org_id: UUID,
) -> ToolCheckoutSlip:
    """Update a DRAFT tool checkout slip. Replace lines if provided."""
    slip = await get_tool_checkout_slip(db, slip_id, org_id=org_id)
    if slip.status != ToolCheckoutSlipStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only edit DRAFT slips (current: {slip.status.value})",
        )

    new_lines = body.pop("lines", None)

    # Validate WO if changed
    if "work_order_id" in body and body["work_order_id"]:
        await _validate_work_order(db, body["work_order_id"], org_id)

    for field, value in body.items():
        if value is not None:
            setattr(slip, field, value)

    if new_lines is not None:
        # Validate tools & employees
        tool_ids = [line["tool_id"] for line in new_lines]
        await _validate_tools(db, tool_ids, org_id)
        employee_ids = [line["employee_id"] for line in new_lines]
        await _validate_employees(db, employee_ids, org_id)

        # Replace lines
        for old_line in slip.lines:
            await db.delete(old_line)
        await db.flush()
        for idx, line_data in enumerate(new_lines, 1):
            line = ToolCheckoutSlipLine(
                slip_id=slip.id, line_number=idx,
                tool_id=line_data["tool_id"],
                employee_id=line_data["employee_id"],
                note=line_data.get("note"),
            )
            db.add(line)

    await db.commit()
    return await get_tool_checkout_slip(db, slip_id, org_id=org_id)


# ============================================================
# DELETE (DRAFT only)
# ============================================================

async def delete_tool_checkout_slip(
    db: AsyncSession, slip_id: UUID, org_id: UUID,
) -> None:
    """Soft-delete a DRAFT tool checkout slip."""
    slip = await get_tool_checkout_slip(db, slip_id, org_id=org_id)
    if slip.status != ToolCheckoutSlipStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only delete DRAFT slips (current: {slip.status.value})",
        )
    slip.is_active = False
    await db.commit()


# ============================================================
# STATUS TRANSITIONS
# ============================================================

async def submit_tool_checkout_slip(
    db: AsyncSession, slip_id: UUID, org_id: UUID,
) -> ToolCheckoutSlip:
    """Submit a DRAFT slip for issuing (DRAFT → PENDING)."""
    slip = await get_tool_checkout_slip(db, slip_id, org_id=org_id)
    if slip.status != ToolCheckoutSlipStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only submit DRAFT slips (current: {slip.status.value})",
        )
    slip.status = ToolCheckoutSlipStatus.PENDING
    await db.commit()
    return await get_tool_checkout_slip(db, slip_id, org_id=org_id)


async def cancel_tool_checkout_slip(
    db: AsyncSession, slip_id: UUID, org_id: UUID,
) -> ToolCheckoutSlip:
    """Cancel a DRAFT or PENDING slip."""
    slip = await get_tool_checkout_slip(db, slip_id, org_id=org_id)

    if slip.status not in (ToolCheckoutSlipStatus.DRAFT, ToolCheckoutSlipStatus.PENDING):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only cancel DRAFT or PENDING slips (current: {slip.status.value})",
        )
    slip.status = ToolCheckoutSlipStatus.CANCELLED
    await db.commit()
    return await get_tool_checkout_slip(db, slip_id, org_id=org_id)


# ============================================================
# ISSUE (PENDING → CHECKED_OUT) — creates ToolCheckout per selected line
# ============================================================

async def issue_tool_checkout_slip(
    db: AsyncSession, slip_id: UUID, *,
    issue_data: dict, issued_by: UUID, org_id: UUID,
) -> ToolCheckoutSlip:
    """
    Issue selected lines of a PENDING slip — cut off at issue time.
    Only selected lines get issued. Un-selected lines are skipped (no future issue).
    If more tools needed later, create a new slip.
    """
    slip = await get_tool_checkout_slip(db, slip_id, org_id=org_id)
    if slip.status != ToolCheckoutSlipStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only issue PENDING slips (current: {slip.status.value})",
        )

    # Validate WO is still OPEN
    await _validate_work_order(db, slip.work_order_id, org_id)

    lines_by_id = {line.id: line for line in slip.lines}
    issue_lines = issue_data.get("lines", [])
    issue_note = issue_data.get("note")

    if not issue_lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one line must be selected for issue",
        )

    # Pre-validate all tools are AVAILABLE before issuing any
    issue_tool_ids = []
    for issue_line in issue_lines:
        line_id = issue_line["line_id"]
        line = lines_by_id.get(line_id)
        if not line:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Slip line {line_id} not found",
            )
        issue_tool_ids.append(line.tool_id)

    tools = await _validate_tools(db, issue_tool_ids, org_id)
    await _validate_tools_available(tools)

    # Issue each line — reuse checkout_tool()
    for issue_line in issue_lines:
        line_id = issue_line["line_id"]
        line = lines_by_id[line_id]

        checkout = await checkout_tool(
            db, line.tool_id,
            employee_id=line.employee_id,
            work_order_id=slip.work_order_id,
            checked_out_by=issued_by,
            org_id=org_id,
        )
        line.checkout_id = checkout.id

    # Always CHECKED_OUT — cut off at issue time
    slip.status = ToolCheckoutSlipStatus.CHECKED_OUT
    slip.issued_by = issued_by
    slip.issued_at = datetime.now(timezone.utc)
    if issue_note:
        slip.note = (slip.note + "\n" + issue_note) if slip.note else issue_note

    await db.commit()
    return await get_tool_checkout_slip(db, slip_id, org_id=org_id)


# ============================================================
# RETURN (per-line) — CHECKED_OUT/PARTIAL_RETURN/PARTIAL_ISSUED → status depends on state
# ============================================================

async def return_tool_checkout_slip_lines(
    db: AsyncSession, slip_id: UUID, *,
    return_data: dict, returned_by: UUID, org_id: UUID,
) -> ToolCheckoutSlip:
    """
    Return selected lines — reuses existing checkin_tool() from services/tools.py.
    Auto-charges hours × rate_per_hour on each return (BR#28).
    Status after return depends on whether all lines issued and all issued lines returned.
    """
    slip = await get_tool_checkout_slip(db, slip_id, org_id=org_id)
    if slip.status not in (
        ToolCheckoutSlipStatus.CHECKED_OUT,
        ToolCheckoutSlipStatus.PARTIAL_RETURN,
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only return tools from CHECKED_OUT or PARTIAL_RETURN slips (current: {slip.status.value})",
        )

    lines_by_id = {line.id: line for line in slip.lines}
    return_lines = return_data.get("lines", [])
    return_note = return_data.get("note")

    if not return_lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one line must be selected for return",
        )

    for return_line in return_lines:
        line_id = return_line["line_id"]
        line = lines_by_id.get(line_id)
        if not line:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Slip line {line_id} not found",
            )
        if line.is_returned:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Line {line.line_number} is already returned",
            )
        if not line.checkout_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Line {line.line_number} has not been issued yet",
            )

        # Reuse checkin_tool() — handles auto-charge (BR#28) + tool status
        checkout = await checkin_tool(
            db, line.tool_id,
            checked_in_by=returned_by,
        )

        # Update slip line with return info
        line.is_returned = True
        line.returned_at = datetime.now(timezone.utc)
        line.returned_by = returned_by
        line.charge_amount = checkout.charge_amount

    # Determine new slip status based on line states
    all_lines_issued = all(line.checkout_id is not None for line in slip.lines)
    all_issued_returned = all(
        line.is_returned for line in slip.lines if line.checkout_id is not None
    )

    if all_issued_returned:
        # All issued lines returned → RETURNED (un-issued lines = skipped)
        slip.status = ToolCheckoutSlipStatus.RETURNED
    else:
        # Some issued lines still checked out
        slip.status = ToolCheckoutSlipStatus.PARTIAL_RETURN

    if return_note:
        slip.note = (slip.note + "\n" + return_note) if slip.note else return_note

    await db.commit()
    return await get_tool_checkout_slip(db, slip_id, org_id=org_id)


# ============================================================
# ENRICHMENT HELPERS (batch-fetch related names for list/detail)
# ============================================================

async def get_slip_enrichment_info(
    db: AsyncSession, slips: list[ToolCheckoutSlip],
) -> dict:
    """Batch-fetch related entity names for a list of slips.
    Returns dict keyed by slip.id with enrichment data."""
    if not slips:
        return {}

    wo_ids = {s.work_order_id for s in slips if s.work_order_id}
    emp_ids = {s.requested_by for s in slips if s.requested_by}
    user_ids = {s.issued_by for s in slips if s.issued_by}

    wo_names: dict[UUID, str] = {}
    emp_names: dict[UUID, str] = {}
    user_names: dict[UUID, str] = {}

    if wo_ids:
        result = await db.execute(
            select(WorkOrder.id, WorkOrder.wo_number).where(WorkOrder.id.in_(wo_ids))
        )
        wo_names = {row[0]: row[1] for row in result.all()}
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
            "requester_name": emp_names.get(s.requested_by) if s.requested_by else None,
            "issuer_name": user_names.get(s.issued_by) if s.issued_by else None,
        }
    return enrichment


async def get_line_enrichment_info(
    db: AsyncSession, lines: list[ToolCheckoutSlipLine],
) -> dict:
    """Batch-fetch tool + employee info for slip lines.
    Returns dict keyed by line.id with enrichment data."""
    if not lines:
        return {}

    tool_ids = {l.tool_id for l in lines}
    employee_ids = {l.employee_id for l in lines}
    returned_by_ids = {l.returned_by for l in lines if l.returned_by}

    tool_info: dict[UUID, dict] = {}
    if tool_ids:
        result = await db.execute(
            select(Tool.id, Tool.code, Tool.name, Tool.rate_per_hour).where(
                Tool.id.in_(tool_ids)
            )
        )
        for row in result.all():
            tool_info[row[0]] = {
                "tool_code": row[1],
                "tool_name": row[2],
                "rate_per_hour": row[3],
            }

    emp_info: dict[UUID, str] = {}
    all_emp_ids = employee_ids | returned_by_ids
    if all_emp_ids:
        result = await db.execute(
            select(Employee.id, Employee.full_name).where(
                Employee.id.in_(all_emp_ids)
            )
        )
        emp_info = {row[0]: row[1] for row in result.all()}

    # Also check users table for returned_by (could be user, not employee)
    user_info: dict[UUID, str] = {}
    missing_returned_by = returned_by_ids - set(emp_info.keys())
    if missing_returned_by:
        result = await db.execute(
            select(User.id, User.full_name).where(
                User.id.in_(missing_returned_by)
            )
        )
        user_info = {row[0]: row[1] for row in result.all()}

    enrichment = {}
    for l in lines:
        t = tool_info.get(l.tool_id, {})
        enrichment[l.id] = {
            "tool_code": t.get("tool_code"),
            "tool_name": t.get("tool_name"),
            "rate_per_hour": t.get("rate_per_hour"),
            "employee_name": emp_info.get(l.employee_id),
            "returned_by_name": (
                emp_info.get(l.returned_by)
                or user_info.get(l.returned_by)
            ) if l.returned_by else None,
        }
    return enrichment
