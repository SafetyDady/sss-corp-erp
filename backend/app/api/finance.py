"""
SSS Corp ERP — Finance API Routes
Phase 3: Reports + export
Phase 8.5: Finance Dashboard
Phase 8.6: Dashboard Charts (Inventory + Stock Movement)

Endpoints (from CLAUDE.md):
  GET    /api/finance/reports                    finance.report.read
  GET    /api/finance/reports/finance-dashboard  finance.report.read  (Phase 8.5)
  GET    /api/finance/reports/dashboard-charts   finance.report.read  (Phase 8.6)
  GET    /api/finance/reports/export             finance.report.export
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.models.inventory import StockMovement
from app.models.purchasing import PurchaseOrder
from app.models.sales import SalesOrder, SOStatus
from app.models.workorder import WorkOrder, WOStatus

import csv
import io

finance_router = APIRouter(prefix="/api/finance", tags=["finance"])


@finance_router.get(
    "/reports",
    dependencies=[Depends(require("finance.report.read"))],
)
async def api_finance_reports(
    period_start: Optional[date] = Query(default=None),
    period_end: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Generate finance summary report."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID

    # Work Orders summary
    wo_query = select(
        func.count().label("total"),
        func.count().filter(WorkOrder.status == WOStatus.OPEN).label("open"),
        func.count().filter(WorkOrder.status == WOStatus.CLOSED).label("closed"),
    ).where(WorkOrder.is_active == True, WorkOrder.org_id == org_id)
    wo_result = await db.execute(wo_query)
    wo_row = wo_result.one()

    # Purchase Orders summary
    po_query = select(
        func.count().label("total"),
        func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("total_amount"),
    ).where(PurchaseOrder.is_active == True, PurchaseOrder.org_id == org_id)
    if period_start:
        po_query = po_query.where(PurchaseOrder.order_date >= period_start)
    if period_end:
        po_query = po_query.where(PurchaseOrder.order_date <= period_end)
    po_result = await db.execute(po_query)
    po_row = po_result.one()

    # Sales Orders summary
    so_query = select(
        func.count().label("total"),
        func.coalesce(func.sum(SalesOrder.total_amount), 0).label("total_amount"),
    ).where(SalesOrder.is_active == True, SalesOrder.org_id == org_id)
    if period_start:
        so_query = so_query.where(SalesOrder.order_date >= period_start)
    if period_end:
        so_query = so_query.where(SalesOrder.order_date <= period_end)
    so_result = await db.execute(so_query)
    so_row = so_result.one()

    # Stock movements cost summary
    movement_query = select(
        func.coalesce(func.sum(StockMovement.quantity * StockMovement.unit_cost), 0),
    ).where(StockMovement.is_reversed == False, StockMovement.org_id == org_id)
    if period_start:
        movement_query = movement_query.where(func.date(StockMovement.created_at) >= period_start)
    if period_end:
        movement_query = movement_query.where(func.date(StockMovement.created_at) <= period_end)
    movement_result = await db.execute(movement_query)
    inventory_value = float(movement_result.scalar() or 0)

    return {
        "work_orders": {
            "total": wo_row.total,
            "open": wo_row.open,
            "closed": wo_row.closed,
        },
        "purchasing": {
            "total_orders": po_row.total,
            "total_amount": float(po_row.total_amount),
        },
        "sales": {
            "total_orders": so_row.total,
            "total_amount": float(so_row.total_amount),
        },
        "inventory_movement_value": inventory_value,
    }


@finance_router.get(
    "/reports/finance-dashboard",
    dependencies=[Depends(require("finance.report.read"))],
)
async def api_finance_dashboard(
    months: int = Query(default=6, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Finance Dashboard — comprehensive financial overview (Phase 8.5)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    from app.services.finance import get_finance_dashboard
    return await get_finance_dashboard(db, org_id=org_id, months=months)


@finance_router.get(
    "/reports/dashboard-charts",
    dependencies=[Depends(require("finance.report.read"))],
)
async def api_dashboard_charts(
    months: int = Query(default=6, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Dashboard charts — inventory value by type + monthly stock movements (Phase 8.6)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    from app.services.finance import get_dashboard_charts
    return await get_dashboard_charts(db, org_id=org_id, months=months)


@finance_router.get(
    "/reports/export",
    dependencies=[Depends(require("finance.report.export"))],
)
async def api_finance_export(
    request: Request,
    period_start: Optional[date] = Query(default=None),
    period_end: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Export finance report as CSV."""
    # Reuse the report logic
    report = await api_finance_reports(
        period_start=period_start, period_end=period_end, db=db, token=token
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Category", "Metric", "Value"])
    writer.writerow(["Work Orders", "Total", report["work_orders"]["total"]])
    writer.writerow(["Work Orders", "Open", report["work_orders"]["open"]])
    writer.writerow(["Work Orders", "Closed", report["work_orders"]["closed"]])
    writer.writerow(["Purchasing", "Total Orders", report["purchasing"]["total_orders"]])
    writer.writerow(["Purchasing", "Total Amount", report["purchasing"]["total_amount"]])
    writer.writerow(["Sales", "Total Orders", report["sales"]["total_orders"]])
    writer.writerow(["Sales", "Total Amount", report["sales"]["total_amount"]])
    writer.writerow(["Inventory", "Movement Value", report["inventory_movement_value"]])

    output.seek(0)

    # Phase 13.7: Export audit log
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    from app.api._helpers import get_client_ip
    from app.services.security import log_export
    await log_export(
        db, user_id=UUID(token["sub"]), org_id=org_id,
        endpoint=request.url.path, resource_type="finance_reports",
        record_count=8, file_format="csv",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        filters_used=dict(request.query_params),
    )

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=finance_report.csv"},
    )


@finance_router.get(
    "/reports/monthly-summary",
    dependencies=[Depends(require("finance.report.read"))],
)
async def api_monthly_summary(
    months: int = Query(default=6, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Monthly summary for dashboard charts (SO revenue, PO spend, WO closed)."""
    org_id = UUID(token["org_id"]) if "org_id" in token else DEFAULT_ORG_ID
    today = date.today()

    from app.services.finance import build_month_buckets, format_thai_month_label
    buckets, start_date = build_month_buckets(today, months)

    # SO revenue per month
    so_period = func.date_trunc(text("'month'"), SalesOrder.order_date).label("period")
    so_query = (
        select(
            so_period,
            func.coalesce(func.sum(SalesOrder.total_amount), 0).label("amount"),
        )
        .where(
            SalesOrder.is_active == True,
            SalesOrder.org_id == org_id,
            SalesOrder.status == SOStatus.APPROVED,
            SalesOrder.order_date >= start_date,
        )
        .group_by(so_period)
    )
    so_result = await db.execute(so_query)
    so_map = {str(r.period.date())[:7]: float(r.amount) for r in so_result}

    # PO spend per month
    po_period = func.date_trunc(text("'month'"), PurchaseOrder.order_date).label("period")
    po_query = (
        select(
            po_period,
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("amount"),
        )
        .where(
            PurchaseOrder.is_active == True,
            PurchaseOrder.org_id == org_id,
            PurchaseOrder.order_date >= start_date,
        )
        .group_by(po_period)
    )
    po_result = await db.execute(po_query)
    po_map = {str(r.period.date())[:7]: float(r.amount) for r in po_result}

    # WO closed per month
    wo_period = func.date_trunc(text("'month'"), WorkOrder.closed_at).label("period")
    wo_query = (
        select(
            wo_period,
            func.count().label("cnt"),
        )
        .where(
            WorkOrder.is_active == True,
            WorkOrder.org_id == org_id,
            WorkOrder.status == WOStatus.CLOSED,
            WorkOrder.closed_at.isnot(None),
            WorkOrder.closed_at >= start_date,
        )
        .group_by(wo_period)
    )
    wo_result = await db.execute(wo_query)
    wo_map = {str(r.period.date())[:7]: r.cnt for r in wo_result}

    result = []
    for b in buckets:
        key = b.strftime("%Y-%m")
        result.append({
            "period": key,
            "label": format_thai_month_label(b),
            "so_amount": so_map.get(key, 0.0),
            "po_amount": po_map.get(key, 0.0),
            "wo_closed": wo_map.get(key, 0),
        })

    return {"months": result}
