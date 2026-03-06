from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.inventory import product_router, movement_router
from app.api.warehouse import warehouse_router
from app.api.workorder import workorder_router
from app.api.master import master_router
from app.api.hr import hr_router
from app.api.tools import tools_router
from app.api.customer import customer_router
from app.api.purchasing import purchasing_router
from app.api.sales import sales_router
from app.api.delivery import delivery_router
from app.api.finance import finance_router
from app.api.admin import admin_router
from app.api.planning import master_plan_router, planning_router
from app.api.setup import router as setup_router
from app.api.daily_report import daily_report_router
from app.api.withdrawal import withdrawal_router
from app.api.recharge import recharge_router
from app.api.invoice import invoice_router
from app.api.ar import ar_router
from app.api.tool_checkout_slip import tool_checkout_slip_router

all_routers = [
    auth_router,
    health_router,
    product_router,
    movement_router,
    warehouse_router,
    workorder_router,
    master_router,
    hr_router,
    tool_checkout_slip_router,  # Must be before tools_router (checkout-slips vs {tool_id})
    tools_router,
    customer_router,
    purchasing_router,
    sales_router,
    delivery_router,
    finance_router,
    admin_router,
    master_plan_router,
    planning_router,
    setup_router,
    daily_report_router,
    withdrawal_router,
    recharge_router,
    invoice_router,
    ar_router,
]
