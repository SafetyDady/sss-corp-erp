# SSS Corp ERP — Mock UI

Interactive mock UI prototype for the SSS Corp ERP system. Built with **React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui**.

## Design: Industrial Control Room

Dark theme with cyan (#06b6d4) accent, IBM Plex Mono for data, and a control-panel aesthetic.

## Pages (12 total)

| Sidebar Item | Page | Tabs |
|---|---|---|
| **ME** | `/me` | My Tasks, Timesheet, Leave, Daily Report |
| **Dashboard** | `/` | Overview with stats, recent activity, alerts |
| **Supply Chain** | `/supply-chain` | Inventory, Warehouse, Tools |
| **Work Orders** | `/work-orders` | WO list with cost tracking |
| **Purchasing** | `/purchasing` | PO list with stats |
| **Sales** | `/sales` | Sales Orders, Quotations |
| **Finance** | `/finance` | General Ledger, AP, AR, Cost Center, Cost Element |
| **HR** | `/hr` | Employees, Leave Mgmt, Attendance, Daily Report Approval, Leave Balance |
| **Customers** | `/customers` | Customer list with tier system |
| **Planning** | `/planning` | Production Plan, Master Plan, Capacity Planning |
| **Master Data** | `/master-data` | UoM, Product Categories, Departments, OT Types, Leave Types, Locations |
| **Admin** | `/admin` | Users, Roles & Permissions, Audit Log, System Settings |

## Getting Started

```bash
cd mock-ui
pnpm install
pnpm dev
```

Open `http://localhost:3000` in your browser.

## Stack

- React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui components
- Wouter (routing)
- Lucide React (icons)
- Vite (build tool)

## Notes

- All data is **mock/static** — no backend connection
- Financial terms (Cost Center, Cost Element, GL, AP, AR) use **English** to avoid confusion
- UI labels use a mix of Thai and English matching the real ERP design
- This mock UI is for **design reference and stakeholder review** only
