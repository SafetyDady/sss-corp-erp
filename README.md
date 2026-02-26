# SSS Corp ERP

Smart ERP system for manufacturing/trading businesses.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Ant Design + Zustand |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 16 |
| Cache | Redis |
| ORM | SQLAlchemy 2.0 + Alembic |
| Auth | JWT Bearer Token (Access + Refresh) |
| Deploy | Vercel (Frontend) + Railway (Backend) |

## Quick Start (Local Dev)

```bash
# 1. Clone
git clone https://github.com/your-org/sss-corp-erp.git
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
├── frontend/              ← Vercel deploys this
│   ├── src/
│   │   ├── components/    # Shared UI components
│   │   ├── pages/         # Route pages
│   │   ├── hooks/         # Custom hooks (useAuth, usePermission)
│   │   ├── stores/        # Zustand stores
│   │   ├── services/      # API client
│   │   └── utils/         # Helpers
│   ├── package.json
│   └── vite.config.ts
├── backend/               ← Railway deploys this
│   ├── app/
│   │   ├── api/           # Route handlers
│   │   ├── core/          # Auth, RBAC, config
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # Business logic
│   ├── alembic/           # DB migrations
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.dev.yml
└── README.md
```

## Test Credentials (Dev)

| Email | Password | Role |
|-------|----------|------|
| owner@sss-corp.com | owner123 | owner |
| manager@sss-corp.com | manager123 | manager |
| supervisor@sss-corp.com | supervisor123 | supervisor |
| staff@sss-corp.com | staff123 | staff |
| viewer@sss-corp.com | viewer123 | viewer |

## Design Reference

Based on SmartERP Master Document v2 — 11 modules, 89 permissions, Job Costing system.
