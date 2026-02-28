"""
SSS Corp ERP — Finance API Routes
Phase 3: Reports + export

Endpoints (from CLAUDE.md):
  GET    /api/finance/reports                 finance.report.read
  GET    /api/finance/reports/export          finance.report.export
"""

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.models.hr import Timesheet, TimesheetStatus, PayrollRun
from app.models.inventory import StockMovement
from app.models.purchasing import PurchaseOrder, POStatus
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
    "/reports/export",
    dependencies=[Depends(require("finance.report.export"))],
)
async def api_finance_export(
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
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=finance_report.csv"},
    )
