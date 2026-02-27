# SSS Corp ERP

Smart ERP system for manufacturing/trading businesses — 11 modules, 89 permissions, Job Costing system.

## Project Status

| Layer | Status | Details |
|-------|--------|---------|
| Backend | **100%** ✅ | 80+ API endpoints, 46 business rules, 5 roles × 105 permissions |
| Frontend | **100%** ✅ | 70+ files, all 11 modules + Planning + Setup Wizard |
| Phase 4 | **100%** ✅ | Org, Planning, Leave, Multi-tenant, Deploy |
| Deploy | **Ready** | Vercel (frontend) + Railway (backend) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Ant Design + Zustand |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 16 |
| Cache | Redis (optional — graceful degradation) |
| ORM | SQLAlchemy 2.0 + Alembic |
| Auth | JWT Bearer Token (Access + Refresh) |
| Icons | Lucide React (no emoji, no Ant Design Icons) |
| Deploy | Vercel (Frontend) + Railway (Backend) |
| Monitoring | Sentry (optional) |

## Modules (11)

| Module | Backend | Frontend | Description |
|--------|---------|----------|-------------|
| Inventory | ✅ | ✅ | Products, Stock Movements (RECEIVE/ISSUE/TRANSFER/ADJUST/CONSUME/REVERSAL) |
| Warehouse | ✅ | ✅ | Warehouses, Locations, Zone Types |
| Work Orders | ✅ | ✅ | WO lifecycle (DRAFT→OPEN→CLOSED), Job Costing 4 components |
| Purchasing | ✅ | ✅ | Purchase Orders, Approval, Goods Receipt |
| Sales | ✅ | ✅ | Sales Orders, Approval |
| Customer | ✅ | ✅ | Customer CRUD |
| HR | ✅ | ✅ | Employees, Timesheet (3-tier approval), Leave, Payroll |
| Tools | ✅ | ✅ | Tool CRUD, Check-out/Check-in, Auto Recharge |
| Master Data | ✅ | ✅ | Cost Centers, Cost Elements, OT Types |
| Admin | ✅ | ✅ | Users, Roles & Permissions, Audit Log |
| Finance | ✅ | ✅ | Reports Summary, Cost Breakdown, CSV Export |

## Quick Start (Local Dev)

```bash
# 1. Clone
git clone https://github.com/SafetyDady/sss-corp-erp.git
cd sss-corp-erp

# 2. Copy env files
cp backend/.env.example backend/.env

# 3. Start everything
docker compose -f docker-compose.dev.yml up

# 4. Access
# Frontend:  http://localhost:5173
# Backend:   http://localhost:8000
# API Docs:  http://localhost:8000/docs
# DB:        localhost:5432
```

## Project Structure

```
sss-corp-erp/
├── frontend/                     ← Vercel deploys this
│   ├── src/
│   │   ├── components/           # Shared UI (StatusBadge, EmptyState, PageHeader, SearchInput)
│   │   ├── pages/                # Route pages (organized by module)
│   │   │   ├── inventory/        # ProductList, ProductForm, MovementList, MovementCreate
│   │   │   ├── warehouse/        # WarehouseList/Form, LocationList/Form
│   │   │   ├── workorder/        # WOList, WOForm, WODetail (Job Costing)
│   │   │   ├── purchasing/       # POList, POForm, PODetail (Goods Receipt)
│   │   │   ├── sales/            # SOList, SOForm, SODetail
│   │   │   ├── customer/         # CustomerList, CustomerForm
│   │   │   ├── hr/               # HRPage (tabs: Employee, Timesheet, Leave, Payroll)
│   │   │   ├── tools/            # ToolList, ToolForm, ToolCheckout
│   │   │   ├── master/           # MasterData (tabs: CostCenter, CostElement, OTType)
│   │   │   ├── admin/            # AdminPage (tabs: Users, Roles, AuditLog)
│   │   │   └── finance/          # FinancePage (summary + export)
│   │   ├── hooks/                # usePermission, useAuth
│   │   ├── stores/               # Zustand stores
│   │   ├── services/             # API client (axios + interceptor)
│   │   └── utils/                # constants, formatters
│   ├── package.json
│   └── vite.config.ts
├── backend/                      ← Railway deploys this
│   ├── app/
│   │   ├── api/                  # Route handlers (auth, inventory, warehouse, hr, tools, etc.)
│   │   ├── core/                 # config, database, security, permissions
│   │   ├── models/               # SQLAlchemy models
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── services/             # Business logic
│   │   └── main.py               # FastAPI app entry point
│   ├── alembic/                  # DB migrations
│   ├── Dockerfile
│   └── requirements.txt
├── docs/                         # Progression updates
├── docker-compose.dev.yml
├── CLAUDE.md                     # AI instructions — read before any work
├── UI_GUIDELINES.md              # Theme, colors, icons, layout, language rules
├── BUSINESS_POLICY.md            # Business rules (source of truth)
├── TODO.md                       # Implementation tracker
└── README.md                     # ← This file
```

## Test Credentials (Dev)

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| owner@sss-corp.com | owner123 | owner | ALL 105 |
| manager@sss-corp.com | manager123 | manager | ~57 |
| supervisor@sss-corp.com | supervisor123 | supervisor | ~41 |
| staff@sss-corp.com | staff123 | staff | ~28 |
| viewer@sss-corp.com | viewer123 | viewer | ~18 |

## Optional Services

The following services are **optional** and the system degrades gracefully without them:

| Service | Purpose | Without it |
|---------|---------|------------|
| **Redis** | Rate limiting, session cache | App works normally; rate limiting disabled |
| **Sentry** | Error monitoring | Errors logged locally only |
| **SMTP Email** | Approval notifications | No email sent; approvals still work via UI |

> **Note:** Only PostgreSQL is required. Redis, Sentry, and SMTP are all opt-in via environment variables.

## Key Design Decisions

- **Full Dark Theme** — Ant Design `darkAlgorithm` + custom CSS overrides
- **Lucide React Icons** — no emoji, no Ant Design Icons
- **RBAC-aware UI** — `usePermission()` hook hides/shows elements per role
- **StatusBadge Component** — 28 statuses with consistent color mapping
- **Thai labels + English data** — bilingual UI following UI_GUIDELINES.md
- **Job Costing** — 4 components auto-calculated (Material + ManHour + Tools + Overhead)

## Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI instructions — read before any work |
| `UI_GUIDELINES.md` | Theme, colors, icons, layout, language rules (v4) |
| `BUSINESS_POLICY.md` | Business rules — 46 rules (source of truth) |
| `TODO.md` | Implementation tracker + checklist |
| `docs/PROGRESSION_UPDATE_BATCH4-7.md` | Frontend Batch 4-7 progression |

## Design Reference

Based on SmartERP Master Document v2 — 11 modules, 89 permissions, Job Costing system.
