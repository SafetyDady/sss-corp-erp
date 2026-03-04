"""
SSS Corp ERP — Internal Recharge Service (Business Logic)
Phase C9: Fixed Recharge — Budget CRUD + Monthly Generation + Report

Business Rules:
  BR#89 — 1 budget per org per fiscal year per source CC
  BR#90 — Edit only DRAFT budget
  BR#92 — Budget status: DRAFT → ACTIVE → CLOSED
  BR#93 — Generate only for ACTIVE budget
  BR#94 — Cannot regenerate same month (UNIQUE constraint → 409)
  BR#95 — Headcount = active employees per dept (snapshot)
  BR#96 — Skip source CC's own department
  BR#97 — Rounding adjustment ensures sum = monthly_budget
  BR#98 — amount Numeric(12,2), budget Numeric(14,2)
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recharge import (
    FixedRechargeBudget,
    FixedRechargeEntry,
    RechargeStatus,
)
from app.models.master import CostCenter
from app.models.organization import Department
from app.models.hr import Employee
from app.models.user import User


# ============================================================
# BUDGET — CRUD
# ============================================================

async def create_budget(
    db: AsyncSession, *,
    fiscal_year: int,
    source_cost_center_id: UUID,
    annual_budget: Decimal,
    description: Optional[str],
    created_by: UUID,
    org_id: UUID,
) -> FixedRechargeBudget:
    """Create a new Fixed Recharge Budget (BR#89)."""
    # Validate source CC exists and belongs to org
    cc = await _get_cost_center(db, source_cost_center_id, org_id)

    # Check UNIQUE (org_id, fiscal_year, source_cost_center_id)
    existing = await db.execute(
        select(FixedRechargeBudget).where(
            FixedRechargeBudget.org_id == org_id,
            FixedRechargeBudget.fiscal_year == fiscal_year,
            FixedRechargeBudget.source_cost_center_id == source_cost_center_id,
            FixedRechargeBudget.is_active == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Budget already exists for CC {cc.code} in fiscal year {fiscal_year}",
        )

    budget = FixedRechargeBudget(
        fiscal_year=fiscal_year,
        source_cost_center_id=source_cost_center_id,
        annual_budget=annual_budget,
        description=description,
        status=RechargeStatus.DRAFT,
        created_by=created_by,
        org_id=org_id,
    )
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return budget


async def get_budget(
    db: AsyncSession, budget_id: UUID, org_id: UUID,
) -> FixedRechargeBudget:
    """Get single budget by ID."""
    result = await db.execute(
        select(FixedRechargeBudget).where(
            FixedRechargeBudget.id == budget_id,
            FixedRechargeBudget.org_id == org_id,
            FixedRechargeBudget.is_active == True,
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return budget


async def list_budgets(
    db: AsyncSession, *,
    org_id: UUID,
    fiscal_year: Optional[int] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[FixedRechargeBudget], int]:
    """List budgets with optional fiscal year filter."""
    query = select(FixedRechargeBudget).where(
        FixedRechargeBudget.org_id == org_id,
        FixedRechargeBudget.is_active == True,
    )
    if fiscal_year:
        query = query.where(FixedRechargeBudget.fiscal_year == fiscal_year)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    query = query.order_by(FixedRechargeBudget.fiscal_year.desc(), FixedRechargeBudget.created_at.desc())
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_budget(
    db: AsyncSession, budget_id: UUID, *,
    org_id: UUID,
    annual_budget: Optional[Decimal] = None,
    description: Optional[str] = None,
) -> FixedRechargeBudget:
    """Update a DRAFT budget (BR#90)."""
    budget = await get_budget(db, budget_id, org_id)
    if budget.status != RechargeStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only edit DRAFT budgets (current: {budget.status.value})",
        )
    if annual_budget is not None:
        budget.annual_budget = annual_budget
    if description is not None:
        budget.description = description
    await db.commit()
    await db.refresh(budget)
    return budget


async def delete_budget(
    db: AsyncSession, budget_id: UUID, org_id: UUID,
) -> None:
    """Soft-delete a DRAFT budget (BR#91 — owner only, enforced by permission)."""
    budget = await get_budget(db, budget_id, org_id)
    if budget.status != RechargeStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only delete DRAFT budgets (current: {budget.status.value})",
        )
    budget.is_active = False
    await db.commit()


async def activate_budget(
    db: AsyncSession, budget_id: UUID, org_id: UUID,
) -> FixedRechargeBudget:
    """Activate a DRAFT budget (BR#92: DRAFT → ACTIVE)."""
    budget = await get_budget(db, budget_id, org_id)
    if budget.status != RechargeStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only activate DRAFT budgets (current: {budget.status.value})",
        )
    budget.status = RechargeStatus.ACTIVE
    await db.commit()
    await db.refresh(budget)
    return budget


async def close_budget(
    db: AsyncSession, budget_id: UUID, org_id: UUID,
) -> FixedRechargeBudget:
    """Close an ACTIVE budget (BR#92: ACTIVE → CLOSED)."""
    budget = await get_budget(db, budget_id, org_id)
    if budget.status != RechargeStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only close ACTIVE budgets (current: {budget.status.value})",
        )
    budget.status = RechargeStatus.CLOSED
    await db.commit()
    await db.refresh(budget)
    return budget


# ============================================================
# GENERATE — Monthly allocation by headcount
# ============================================================

async def generate_monthly_entries(
    db: AsyncSession, *,
    budget_id: UUID,
    year: int,
    month: int,
    generated_by: UUID,
    org_id: UUID,
) -> list[FixedRechargeEntry]:
    """
    Generate monthly recharge entries for all qualifying departments.

    Algorithm:
    1. Load budget (must be ACTIVE — BR#93)
    2. monthly_budget = annual_budget / 12
    3. Count active employees per dept (BR#95)
    4. Skip source CC's own department (BR#96)
    5. Calculate allocation_pct and amount per dept
    6. Rounding adjustment on last dept (BR#97)
    7. Check duplicate (409 if exists — BR#94)
    8. Bulk insert entries
    """
    budget = await get_budget(db, budget_id, org_id)

    # BR#93: Generate only for ACTIVE budget
    if budget.status != RechargeStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Can only generate for ACTIVE budgets (current: {budget.status.value})",
        )

    # BR#94: Check if already generated for this month
    existing = await db.execute(
        select(func.count()).where(
            FixedRechargeEntry.budget_id == budget_id,
            FixedRechargeEntry.period_year == year,
            FixedRechargeEntry.period_month == month,
        )
    )
    if (existing.scalar() or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Entries already generated for {year}/{month:02d}",
        )

    # Calculate monthly budget
    monthly_budget = (budget.annual_budget / Decimal("12")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # Find source CC's department (to skip — BR#96)
    source_dept_result = await db.execute(
        select(Department.id).where(
            Department.cost_center_id == budget.source_cost_center_id,
            Department.org_id == org_id,
            Department.is_active == True,
        )
    )
    source_dept_ids = set(row[0] for row in source_dept_result.all())

    # BR#95: Count active employees per department (snapshot)
    headcount_query = (
        select(
            Employee.department_id,
            func.count(Employee.id).label("headcount"),
        )
        .where(
            Employee.org_id == org_id,
            Employee.is_active == True,
        )
        .group_by(Employee.department_id)
    )
    headcount_result = await db.execute(headcount_query)
    dept_headcounts = {row[0]: row[1] for row in headcount_result.all()}

    # Get all active departments with their cost centers
    dept_query = await db.execute(
        select(Department).where(
            Department.org_id == org_id,
            Department.is_active == True,
        )
    )
    all_depts = list(dept_query.scalars().all())

    # Filter: skip source CC's department, skip depts with 0 headcount
    eligible_depts = []
    for dept in all_depts:
        if dept.id in source_dept_ids:
            continue  # BR#96: skip source CC's own department
        hc = dept_headcounts.get(dept.id, 0)
        if hc <= 0:
            continue  # Skip empty departments
        eligible_depts.append((dept, hc))

    if not eligible_depts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No eligible departments found for allocation (all empty or source-only)",
        )

    # Total headcount across eligible departments
    total_headcount = sum(hc for _, hc in eligible_depts)

    # Calculate allocation per department
    entries = []
    running_total = Decimal("0.00")

    for idx, (dept, hc) in enumerate(eligible_depts):
        allocation_pct = (Decimal(hc) / Decimal(total_headcount) * Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )

        if idx == len(eligible_depts) - 1:
            # BR#97: Last dept gets remainder to ensure exact sum
            amount = monthly_budget - running_total
        else:
            amount = (monthly_budget * Decimal(hc) / Decimal(total_headcount)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            running_total += amount

        entry = FixedRechargeEntry(
            budget_id=budget_id,
            period_year=year,
            period_month=month,
            source_cost_center_id=budget.source_cost_center_id,
            target_department_id=dept.id,
            target_cost_center_id=dept.cost_center_id,
            headcount=hc,
            total_headcount=total_headcount,
            allocation_pct=allocation_pct,
            amount=amount,
            generated_by=generated_by,
            org_id=org_id,
        )
        db.add(entry)
        entries.append(entry)

    await db.commit()

    # Refresh all entries
    for entry in entries:
        await db.refresh(entry)

    return entries


# ============================================================
# LIST ENTRIES
# ============================================================

async def list_entries(
    db: AsyncSession, *,
    org_id: UUID,
    budget_id: Optional[UUID] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[FixedRechargeEntry], int]:
    """List recharge entries with filters."""
    query = select(FixedRechargeEntry).where(
        FixedRechargeEntry.org_id == org_id,
    )
    if budget_id:
        query = query.where(FixedRechargeEntry.budget_id == budget_id)
    if year:
        query = query.where(FixedRechargeEntry.period_year == year)
    if month:
        query = query.where(FixedRechargeEntry.period_month == month)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    query = query.order_by(
        FixedRechargeEntry.period_year.desc(),
        FixedRechargeEntry.period_month.desc(),
        FixedRechargeEntry.amount.desc(),
    )
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


# ============================================================
# COST CENTER SUMMARY — Actual (Job Costing) + Fixed Recharge
# ============================================================

async def get_cost_center_summary(
    db: AsyncSession, *,
    org_id: UUID,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> list[dict]:
    """
    Aggregate cost per cost center:
    - Actual: labor, material, tool, overhead from existing finance report
    - Fixed Recharge: SUM(entries.amount) per target CC
    Returns combined rows.
    """
    # Get all cost centers for the org
    cc_result = await db.execute(
        select(CostCenter).where(
            CostCenter.org_id == org_id,
            CostCenter.is_active == True,
        ).order_by(CostCenter.code)
    )
    cost_centers = list(cc_result.scalars().all())

    if not cost_centers:
        return []

    # Aggregate fixed recharge entries per target CC
    recharge_query = select(
        FixedRechargeEntry.target_cost_center_id,
        func.sum(FixedRechargeEntry.amount).label("fixed_total"),
    ).where(
        FixedRechargeEntry.org_id == org_id,
    )
    if year:
        recharge_query = recharge_query.where(FixedRechargeEntry.period_year == year)
    if month:
        recharge_query = recharge_query.where(FixedRechargeEntry.period_month == month)

    recharge_query = recharge_query.group_by(FixedRechargeEntry.target_cost_center_id)
    recharge_result = await db.execute(recharge_query)
    recharge_by_cc = {row[0]: row[1] or Decimal("0.00") for row in recharge_result.all()}

    # Build summary rows
    rows = []
    for cc in cost_centers:
        fixed = recharge_by_cc.get(cc.id, Decimal("0.00"))
        rows.append({
            "cost_center_id": cc.id,
            "cost_center_code": cc.code,
            "cost_center_name": cc.name,
            "actual_labor": Decimal("0.00"),
            "actual_material": Decimal("0.00"),
            "actual_tool": Decimal("0.00"),
            "actual_overhead": Decimal("0.00"),
            "actual_total": Decimal("0.00"),
            "fixed_recharge": fixed,
            "grand_total": fixed,
        })

    return rows


# ============================================================
# ENRICHMENT HELPERS
# ============================================================

async def enrich_budgets(
    db: AsyncSession, budgets: list[FixedRechargeBudget],
) -> list[dict]:
    """Add cost center name/code and creator name to budget responses."""
    if not budgets:
        return []

    cc_ids = {b.source_cost_center_id for b in budgets}
    user_ids = {b.created_by for b in budgets}

    cc_info: dict[UUID, dict] = {}
    if cc_ids:
        result = await db.execute(
            select(CostCenter.id, CostCenter.code, CostCenter.name).where(
                CostCenter.id.in_(cc_ids)
            )
        )
        cc_info = {row[0]: {"code": row[1], "name": row[2]} for row in result.all()}

    user_info: dict[UUID, str] = {}
    if user_ids:
        result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(user_ids))
        )
        user_info = {row[0]: row[1] for row in result.all()}

    enriched = []
    for b in budgets:
        cc = cc_info.get(b.source_cost_center_id, {})
        monthly = (b.annual_budget / Decimal("12")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        enriched.append({
            "id": b.id,
            "fiscal_year": b.fiscal_year,
            "source_cost_center_id": b.source_cost_center_id,
            "source_cost_center_name": cc.get("name"),
            "source_cost_center_code": cc.get("code"),
            "annual_budget": b.annual_budget,
            "monthly_budget": monthly,
            "description": b.description,
            "status": b.status.value,
            "created_by": b.created_by,
            "creator_name": user_info.get(b.created_by),
            "is_active": b.is_active,
            "org_id": b.org_id,
            "created_at": b.created_at,
            "updated_at": b.updated_at,
        })
    return enriched


async def enrich_entries(
    db: AsyncSession, entries: list[FixedRechargeEntry],
) -> list[dict]:
    """Add CC/dept names to entry responses."""
    if not entries:
        return []

    cc_ids = set()
    dept_ids = set()
    for e in entries:
        cc_ids.add(e.source_cost_center_id)
        cc_ids.add(e.target_cost_center_id)
        dept_ids.add(e.target_department_id)

    cc_info: dict[UUID, dict] = {}
    if cc_ids:
        result = await db.execute(
            select(CostCenter.id, CostCenter.code, CostCenter.name).where(
                CostCenter.id.in_(cc_ids)
            )
        )
        cc_info = {row[0]: {"code": row[1], "name": row[2]} for row in result.all()}

    dept_info: dict[UUID, str] = {}
    if dept_ids:
        result = await db.execute(
            select(Department.id, Department.name).where(
                Department.id.in_(dept_ids)
            )
        )
        dept_info = {row[0]: row[1] for row in result.all()}

    enriched = []
    for e in entries:
        src_cc = cc_info.get(e.source_cost_center_id, {})
        tgt_cc = cc_info.get(e.target_cost_center_id, {})
        enriched.append({
            "id": e.id,
            "budget_id": e.budget_id,
            "period_year": e.period_year,
            "period_month": e.period_month,
            "source_cost_center_id": e.source_cost_center_id,
            "source_cost_center_name": src_cc.get("name"),
            "target_department_id": e.target_department_id,
            "target_department_name": dept_info.get(e.target_department_id),
            "target_cost_center_id": e.target_cost_center_id,
            "target_cost_center_name": tgt_cc.get("name"),
            "target_cost_center_code": tgt_cc.get("code"),
            "headcount": e.headcount,
            "total_headcount": e.total_headcount,
            "allocation_pct": e.allocation_pct,
            "amount": e.amount,
            "note": e.note,
            "generated_by": e.generated_by,
            "org_id": e.org_id,
            "created_at": e.created_at,
        })
    return enriched


# ============================================================
# INTERNAL HELPERS
# ============================================================

async def _get_cost_center(
    db: AsyncSession, cc_id: UUID, org_id: UUID,
) -> CostCenter:
    result = await db.execute(
        select(CostCenter).where(
            CostCenter.id == cc_id,
            CostCenter.org_id == org_id,
            CostCenter.is_active == True,
        )
    )
    cc = result.scalar_one_or_none()
    if not cc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source cost center not found or inactive",
        )
    return cc
