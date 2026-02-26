from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.inventory import product_router, movement_router
from app.api.warehouse import warehouse_router
from app.api.workorder import workorder_router
from app.api.master import master_router
from app.api.hr import hr_router
from app.api.tools import tools_router

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
]
