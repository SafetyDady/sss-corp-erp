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
from app.api.finance import finance_router
from app.api.admin import admin_router
from app.api.planning import master_plan_router, planning_router
from app.api.setup import router as setup_router

all_routers = [
    auth_router,
    health_router,
    product_router,
    movement_router,
    warehouse_router,
    workorder_router,
    master_router,
    hr_router,
    tools_router,
    customer_router,
    purchasing_router,
    sales_router,
    finance_router,
    admin_router,
    master_plan_router,
    planning_router,
    setup_router,
]
