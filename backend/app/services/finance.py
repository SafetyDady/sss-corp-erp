"""
SSS Corp ERP — Finance Dashboard Service
Phase 8.5: Comprehensive financial overview aggregation

Provides:
  - Revenue vs Expenses summary (AR/AP)
  - AP/AR Aging analysis (current, 1-30, 31-60, 61-90, 90+ overdue)
  - Monthly Cash Flow (payments in/out over N months)
  - Top 5 outstanding customers/suppliers
  - Cost Center performance summary
"""

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ar import CustomerInvoice, CustomerInvoicePayment, CustomerInvoiceStatus
from app.models.customer import Customer
from app.models.invoice import InvoicePayment, InvoiceStatus, SupplierInvoice
from app.models.master import CostCenter, Supplier
from app.services.recharge import get_cost_center_summary


# ── Thai month labels (reuse pattern from finance API) ───────
THAI_MONTHS = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
]


def _zero_dec() -> Decimal:
    return Decimal("0.00")


def _float_or_zero(v) -> float:
    """Convert Decimal/None to float safely."""
    if v is None:
        return 0.0
    return float(v)


async def get_finance_dashboard(
    db: AsyncSession,
    *,
    org_id: UUID,
    months: int = 6,
) -> dict:
    """
    Aggregate financial data for the Finance Dashboard.

    Returns dict with:
      revenue, expenses, net_position,
      ap_aging, ar_aging,
      monthly_cashflow,
      top_customers, top_suppliers,
      cost_centers
    """
    today = date.today()

    # ── 1. Revenue Summary (Customer Invoices / AR) ─────────
    ar_active_statuses = [
        CustomerInvoiceStatus.PENDING,
        CustomerInvoiceStatus.APPROVED,
        CustomerInvoiceStatus.PAID,
    ]
    ar_summary_q = (
        select(
            func.coalesce(func.sum(CustomerInvoice.total_amount), 0).label("total_invoiced"),
            func.coalesce(func.sum(CustomerInvoice.received_amount), 0).label("total_collected"),
        )
        .where(
            CustomerInvoice.org_id == org_id,
            CustomerInvoice.is_active == True,  # noqa: E712
            CustomerInvoice.status.in_(ar_active_statuses),
        )
    )
    ar_result = await db.execute(ar_summary_q)
    ar_row = ar_result.one()
    ar_invoiced = Decimal(str(ar_row.total_invoiced))
    ar_collected = Decimal(str(ar_row.total_collected))

    # AR overdue
    ar_overdue_q = (
        select(
            func.count().label("cnt"),
            func.coalesce(
                func.sum(CustomerInvoice.total_amount - CustomerInvoice.received_amount), 0
            ).label("amount"),
        )
        .where(
            CustomerInvoice.org_id == org_id,
            CustomerInvoice.is_active == True,  # noqa: E712
            CustomerInvoice.status == CustomerInvoiceStatus.APPROVED,
            CustomerInvoice.due_date < today,
            CustomerInvoice.received_amount < CustomerInvoice.total_amount,
        )
    )
    ar_overdue_result = await db.execute(ar_overdue_q)
    ar_overdue = ar_overdue_result.one()

    revenue = {
        "total_invoiced": _float_or_zero(ar_invoiced),
        "total_collected": _float_or_zero(ar_collected),
        "outstanding": _float_or_zero(ar_invoiced - ar_collected),
        "overdue_count": ar_overdue.cnt or 0,
        "overdue_amount": _float_or_zero(ar_overdue.amount),
    }

    # ── 2. Expenses Summary (Supplier Invoices / AP) ────────
    ap_active_statuses = [
        InvoiceStatus.PENDING,
        InvoiceStatus.APPROVED,
        InvoiceStatus.PAID,
    ]
    ap_summary_q = (
        select(
            func.coalesce(func.sum(SupplierInvoice.net_payment), 0).label("total_invoiced"),
            func.coalesce(func.sum(SupplierInvoice.paid_amount), 0).label("total_paid"),
        )
        .where(
            SupplierInvoice.org_id == org_id,
            SupplierInvoice.is_active == True,  # noqa: E712
            SupplierInvoice.status.in_(ap_active_statuses),
        )
    )
    ap_result = await db.execute(ap_summary_q)
    ap_row = ap_result.one()
    ap_invoiced = Decimal(str(ap_row.total_invoiced))
    ap_paid = Decimal(str(ap_row.total_paid))

    # AP overdue
    ap_overdue_q = (
        select(
            func.count().label("cnt"),
            func.coalesce(
                func.sum(SupplierInvoice.net_payment - SupplierInvoice.paid_amount), 0
            ).label("amount"),
        )
        .where(
            SupplierInvoice.org_id == org_id,
            SupplierInvoice.is_active == True,  # noqa: E712
            SupplierInvoice.status == InvoiceStatus.APPROVED,
            SupplierInvoice.due_date < today,
            SupplierInvoice.paid_amount < SupplierInvoice.net_payment,
        )
    )
    ap_overdue_result = await db.execute(ap_overdue_q)
    ap_overdue = ap_overdue_result.one()

    expenses = {
        "total_invoiced": _float_or_zero(ap_invoiced),
        "total_paid": _float_or_zero(ap_paid),
        "outstanding": _float_or_zero(ap_invoiced - ap_paid),
        "overdue_count": ap_overdue.cnt or 0,
        "overdue_amount": _float_or_zero(ap_overdue.amount),
    }

    net_position = _float_or_zero(ar_collected - ap_paid)

    # ── 3. AP Aging (APPROVED invoices with outstanding balance) ──
    ap_aging = await _compute_aging(
        db,
        model=SupplierInvoice,
        amount_col=SupplierInvoice.net_payment,
        paid_col=SupplierInvoice.paid_amount,
        status_col=SupplierInvoice.status,
        status_value=InvoiceStatus.APPROVED,
        org_id=org_id,
        today=today,
    )

    # ── 4. AR Aging (APPROVED invoices with outstanding balance) ──
    ar_aging = await _compute_aging(
        db,
        model=CustomerInvoice,
        amount_col=CustomerInvoice.total_amount,
        paid_col=CustomerInvoice.received_amount,
        status_col=CustomerInvoice.status,
        status_value=CustomerInvoiceStatus.APPROVED,
        org_id=org_id,
        today=today,
    )

    # ── 5. Monthly Cash Flow (last N months) ─────────────────
    monthly_cashflow = await _compute_monthly_cashflow(db, org_id=org_id, months=months, today=today)

    # ── 6. Top 5 Outstanding Customers ───────────────────────
    top_customers = await _top_outstanding_customers(db, org_id=org_id)

    # ── 7. Top 5 Outstanding Suppliers ───────────────────────
    top_suppliers = await _top_outstanding_suppliers(db, org_id=org_id)

    # ── 8. Cost Center Summary ───────────────────────────────
    try:
        cc_rows = await get_cost_center_summary(db, org_id=org_id)
        cost_centers = [
            {
                "cost_center_name": r.get("cost_center_name", ""),
                "cost_center_code": r.get("cost_center_code", ""),
                "actual_total": _float_or_zero(r.get("actual_total")),
                "fixed_recharge": _float_or_zero(r.get("fixed_recharge")),
                "grand_total": _float_or_zero(r.get("grand_total")),
            }
            for r in cc_rows
        ]
    except Exception:
        cost_centers = []

    return {
        "revenue": revenue,
        "expenses": expenses,
        "net_position": net_position,
        "ap_aging": ap_aging,
        "ar_aging": ar_aging,
        "monthly_cashflow": monthly_cashflow,
        "top_customers": top_customers,
        "top_suppliers": top_suppliers,
        "cost_centers": cost_centers,
    }


# ── Aging Calculation Helper ─────────────────────────────────

async def _compute_aging(
    db: AsyncSession,
    *,
    model,
    amount_col,
    paid_col,
    status_col,
    status_value,
    org_id: UUID,
    today: date,
) -> list[dict]:
    """
    Compute aging brackets for outstanding invoices.
    Brackets: current (not due), 1-30, 31-60, 61-90, 90+ overdue days.
    """
    days_overdue = func.greatest(func.date(text("CURRENT_DATE")) - func.date(model.due_date), 0)

    bracket_expr = case(
        (model.due_date >= today, "current"),
        (days_overdue <= 30, "1-30"),
        (days_overdue <= 60, "31-60"),
        (days_overdue <= 90, "61-90"),
        else_="90+",
    )

    outstanding_expr = amount_col - paid_col

    q = (
        select(
            bracket_expr.label("bracket"),
            func.count().label("count"),
            func.coalesce(func.sum(outstanding_expr), 0).label("amount"),
        )
        .where(
            model.org_id == org_id,
            model.is_active == True,  # noqa: E712
            status_col == status_value,
            paid_col < amount_col,  # has outstanding balance
        )
        .group_by(bracket_expr)
    )

    result = await db.execute(q)
    rows = {r.bracket: {"count": r.count, "amount": _float_or_zero(r.amount)} for r in result}

    # Return all brackets in order (even if zero)
    brackets = ["current", "1-30", "31-60", "61-90", "90+"]
    return [
        {
            "bracket": b,
            "count": rows.get(b, {}).get("count", 0),
            "amount": rows.get(b, {}).get("amount", 0.0),
        }
        for b in brackets
    ]


# ── Monthly Cash Flow Helper ─────────────────────────────────

async def _compute_monthly_cashflow(
    db: AsyncSession,
    *,
    org_id: UUID,
    months: int,
    today: date,
) -> list[dict]:
    """
    Monthly cash in (AR payments) vs cash out (AP payments) for last N months.
    """
    # Build month buckets
    buckets = []
    y, m = today.year, today.month
    for _ in range(months):
        buckets.append(date(y, m, 1))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    buckets.reverse()
    start_date = buckets[0]

    # Cash IN — AR payments received
    ci_period = func.date_trunc(text("'month'"), CustomerInvoicePayment.payment_date).label("period")
    ci_q = (
        select(
            ci_period,
            func.coalesce(func.sum(CustomerInvoicePayment.amount), 0).label("total"),
        )
        .where(
            CustomerInvoicePayment.org_id == org_id,
            CustomerInvoicePayment.payment_date >= start_date,
        )
        .group_by(ci_period)
    )
    ci_result = await db.execute(ci_q)
    ci_map = {str(r.period.date())[:7]: float(r.total) for r in ci_result}

    # Cash OUT — AP payments made
    ap_period = func.date_trunc(text("'month'"), InvoicePayment.payment_date).label("period")
    ap_q = (
        select(
            ap_period,
            func.coalesce(func.sum(InvoicePayment.amount), 0).label("total"),
        )
        .where(
            InvoicePayment.org_id == org_id,
            InvoicePayment.payment_date >= start_date,
        )
        .group_by(ap_period)
    )
    ap_result = await db.execute(ap_q)
    ap_map = {str(r.period.date())[:7]: float(r.total) for r in ap_result}

    # Assemble result
    result = []
    for b in buckets:
        key = b.strftime("%Y-%m")
        thai_year = str(b.year + 543)[2:]
        label = f"{THAI_MONTHS[b.month - 1]} {thai_year}"
        cash_in = ci_map.get(key, 0.0)
        cash_out = ap_map.get(key, 0.0)
        result.append({
            "period": key,
            "label": label,
            "cash_in": cash_in,
            "cash_out": cash_out,
        })

    return result


# ── Top Outstanding Customers ────────────────────────────────

async def _top_outstanding_customers(
    db: AsyncSession,
    *,
    org_id: UUID,
    limit: int = 5,
) -> list[dict]:
    """Top N customers with highest outstanding AR balance."""
    outstanding = (CustomerInvoice.total_amount - CustomerInvoice.received_amount)

    q = (
        select(
            Customer.name.label("name"),
            func.coalesce(func.sum(CustomerInvoice.total_amount), 0).label("total_invoiced"),
            func.coalesce(func.sum(outstanding), 0).label("outstanding"),
        )
        .join(Customer, CustomerInvoice.customer_id == Customer.id)
        .where(
            CustomerInvoice.org_id == org_id,
            CustomerInvoice.is_active == True,  # noqa: E712
            CustomerInvoice.status.in_([
                CustomerInvoiceStatus.APPROVED,
                CustomerInvoiceStatus.PAID,
            ]),
        )
        .group_by(Customer.id, Customer.name)
        .having(func.sum(outstanding) > 0)
        .order_by(func.sum(outstanding).desc())
        .limit(limit)
    )

    result = await db.execute(q)
    return [
        {
            "name": r.name,
            "total_invoiced": _float_or_zero(r.total_invoiced),
            "outstanding": _float_or_zero(r.outstanding),
        }
        for r in result
    ]


# ── Top Outstanding Suppliers ────────────────────────────────

async def _top_outstanding_suppliers(
    db: AsyncSession,
    *,
    org_id: UUID,
    limit: int = 5,
) -> list[dict]:
    """Top N suppliers with highest outstanding AP balance."""
    outstanding = (SupplierInvoice.net_payment - SupplierInvoice.paid_amount)

    q = (
        select(
            Supplier.name.label("name"),
            func.coalesce(func.sum(SupplierInvoice.net_payment), 0).label("total_invoiced"),
            func.coalesce(func.sum(outstanding), 0).label("outstanding"),
        )
        .join(Supplier, SupplierInvoice.supplier_id == Supplier.id)
        .where(
            SupplierInvoice.org_id == org_id,
            SupplierInvoice.is_active == True,  # noqa: E712
            SupplierInvoice.status.in_([
                InvoiceStatus.APPROVED,
                InvoiceStatus.PAID,
            ]),
        )
        .group_by(Supplier.id, Supplier.name)
        .having(func.sum(outstanding) > 0)
        .order_by(func.sum(outstanding).desc())
        .limit(limit)
    )

    result = await db.execute(q)
    return [
        {
            "name": r.name,
            "total_invoiced": _float_or_zero(r.total_invoiced),
            "outstanding": _float_or_zero(r.outstanding),
        }
        for r in result
    ]
