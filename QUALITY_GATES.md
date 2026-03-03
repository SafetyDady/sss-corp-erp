# QUALITY_GATES.md — SSS Corp ERP

> Engineering quality gates, testing requirements, and regression checklist
> อ้างอิง: SYSTEM_OVERVIEW_V5.md (Section E) + Third-party review feedback
> สร้าง: 2026-03-03

---

## 1. Automated Test Requirements

### 1.1 Movement Immutability Test
```
ทดสอบว่า stock movement ไม่มี UPDATE/DELETE endpoint
- [ ] ไม่มี PUT /api/stock/movements/{id}
- [ ] ไม่มี DELETE /api/stock/movements/{id}
- [ ] มีเฉพาะ POST /api/stock/movements/{id}/reverse
- [ ] REVERSAL movement ถูกสร้างเมื่อ reverse
- [ ] Original movement ไม่ถูกแก้ไขหลัง reverse
```

### 1.2 Multi-tenant org_id Filter Test
```
ทดสอบว่าทุก service function มี org_id filter
- [ ] Scan ทุก query ใน services/*.py → ต้องมี .where(Model.org_id == org_id)
- [ ] User จาก org A ดูข้อมูล org B ไม่ได้
- [ ] ทุก list endpoint return เฉพาะ data ของ org ตัวเอง
- [ ] Setup wizard สร้าง org ใหม่ → ไม่เห็น data ของ org อื่น
```

### 1.3 Numeric(12,2) Financial Fields Test
```
ทดสอบว่า field เงินทุกตัวเป็น Numeric(12,2) ไม่ใช่ Float
- [ ] Product.cost = Numeric(12,2)
- [ ] StockMovement.unit_cost = Numeric(12,2)
- [ ] PO/PR line unit_price = Numeric(12,2)
- [ ] Employee.hourly_rate = Numeric(12,2)
- [ ] Tool.rate_per_hour = Numeric(12,2)
- [ ] CostCenter.overhead_rate = Numeric(12,2)
- [ ] Rounding test: 100.00 / 3 = 33.33 (ไม่ใช่ 33.333333...)
- [ ] Job Costing total = sum of 5 components (no floating point drift)
```

### 1.4 Stock Race Condition Test
```
ทดสอบ concurrent stock movements
- [ ] 2 users เบิกของพร้อมกัน → balance ถูกต้อง
- [ ] Stock ไม่ติดลบ (DB CHECK constraint)
- [ ] FOR UPDATE lock ทำงาน (no race condition)
- [ ] StockByLocation lock ทำงานพร้อม Product lock
```

---

## 2. Local Test Harness

### 2.1 Reset DB Script
```bash
# 1 คำสั่ง: drop + recreate + migrate + seed
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d db
sleep 3
cd backend && alembic upgrade head && python -m app.seed
cd ../frontend && npm run dev
```

### 2.2 Seed Data มาตรฐาน
```
Organization: SSS Corp (DEFAULT_ORG_ID)
├── 3 Departments: Production, Admin, Warehouse
├── 5 Users: owner/manager/supervisor/staff/viewer
├── 5 Employees: linked to users + departments
├── 5 Products: 3 MATERIAL + 1 CONSUMABLE + 1 SERVICE
├── 3 Tools: Drill, Welder, Lathe
├── 5 Suppliers
├── 1 Warehouse + 3 Locations (RECEIVING/STORAGE/SHIPPING)
├── 3 OT Types + 3 Leave Types + Leave Balances
└── Cost Centers per department + Cost Elements
```

### 2.3 Sentry/Metrics
- Local/staging: ใช้ได้ — ช่วย debug
- Production: ห้าม deploy จน Owner sign-off + ผ่านทุก quality gates

---

## 3. E2E Test Flows (25 scenarios)

### Stock Movement Flows (8 types)
```
Flow 1:  RECEIVE → product on_hand เพิ่ม + stock_by_location เพิ่ม
Flow 2:  ISSUE → on_hand ลด + cost_center charge
Flow 3:  CONSUME → on_hand ลด + WO material cost เพิ่ม
Flow 4:  RETURN → on_hand เพิ่ม + WO material cost ลด (cap 0)
Flow 5:  TRANSFER → source ลด + dest เพิ่ม + product on_hand ไม่เปลี่ยน
Flow 6:  ADJUST INCREASE → on_hand เพิ่ม (owner only)
Flow 7:  ADJUST DECREASE → on_hand ลด (owner only)
Flow 8:  REVERSAL → reverse movement + balance กลับ
```

### WO Lifecycle
```
Flow 9:  WO DRAFT → OPEN → CONSUME materials → CLOSE
Flow 10: WO CLOSE → PRODUCE → FINISHED_GOODS เข้า stock (Actual Costing)
Flow 11: WO Cost Summary = 5 components ถูกต้อง (Material + ManHour + Tools + Overhead + Direct PO)
Flow 12: WO delete DRAFT ที่ไม่มี movements → สำเร็จ
Flow 13: WO delete OPEN/CLOSED → ล้มเหลว
```

### Purchasing Flows
```
Flow 14: PR create → submit → approve → convert to PO
Flow 15: PO + Stock GR → RECEIVE movement + stock เพิ่ม
Flow 16: PO + Direct GR → no movement + cost เข้า WO/CC
Flow 17: PO GR → partial receive → ยังไม่เปลี่ยน status จน receive ครบ
Flow 18: PR reject → PO ไม่ถูกสร้าง
```

### HR Flows
```
Flow 19: Daily Report → submit → approve → auto-create Timesheet
Flow 20: Leave request → approve → balance ลด + timesheet = LEAVE_PAID/UNPAID
Flow 21: Timesheet → supervisor approve → HR final → charge WO ManHour
Flow 22: OT request → factor ≤ max ceiling → approve → payroll
```

### Withdrawal Slip
```
Flow 23: Create slip → submit → issue → stock movements สร้างตาม issued_qty
Flow 24: Issue partial (บาง line issued_qty = 0) → skip line ที่ 0
Flow 25: Issued slip → แก้ไขไม่ได้ → ต้องใช้ REVERSAL
```

---

## 4. Regression Checklist (ก่อน merge ทุกครั้ง)

### Hard Constraints
- [ ] Stock movement immutable (no UPDATE/DELETE)
- [ ] on_hand >= 0 ตลอดเวลา (product + stock_by_location)
- [ ] WO status flow: DRAFT → OPEN → CLOSED (ไม่ย้อน)
- [ ] Numeric(12,2) สำหรับ money ทุกที่ (ไม่มี Float)
- [ ] org_id filter ทุก query (multi-tenant)
- [ ] Permission check ทุก endpoint

### Business Rules
- [ ] CONSUME ต้อง WO OPEN + product MATERIAL/CONSUMABLE
- [ ] ISSUE ต้องมี cost_center_id (active)
- [ ] TRANSFER ต้อง atomic 2 ฝั่ง
- [ ] Tool checkout 1 คน ณ เวลาเดียว
- [ ] Timesheet ไม่ overlap (1 ชม. = 1 WO)
- [ ] Leave ไม่เกิน quota
- [ ] OT factor ≤ max ceiling

### Data Scope
- [ ] Staff เห็นเฉพาะของตัวเอง (HR data)
- [ ] Supervisor เห็นเฉพาะแผนก
- [ ] Manager/Owner เห็นทั้ง org

### Security
- [ ] JWT token 15 min expiry + 7 day refresh
- [ ] Rate limiting on auth endpoints
- [ ] No console.log in committed code
- [ ] No hardcoded secrets

---

## 5. DB-First Migration Strategy

> เมื่อเริ่ม implement Go-Live Gate (D1) ให้ทำ schema migration รวม 1 ตัวก่อน:

```
Migration: "go_live_gate_schema"

1. Product model:
   - เพิ่ม SPAREPART ใน ProductType enum
   - (FINISHED_GOODS + PRODUCE อยู่ใน plan แล้ว)

2. Warehouse hierarchy:
   - สร้าง bins table (location_id FK, code, name, is_active)
   - เพิ่ม bin_id FK บน StockMovement (nullable, backward compatible)
   - สร้าง stock_by_bin table (product_id + bin_id → on_hand)

3. Purchasing:
   - เพิ่ม sourcer_id FK บน PurchaseRequisition
   - เพิ่ม gr_mode enum (STOCK_GR, DIRECT_GR) บน PO line
   - เพิ่ม direct_cost_allocation fields (work_order_id / cost_center_id per PO line)

4. Indexes:
   - (org_id, status) composite index บน 7 ตาราง
   - bin_id indexes
```

> ทำ migration นี้ก่อน แล้วค่อย implement feature ทีละข้อ — ไม่ต้องแก้ schema ซ้ำ

---

*QUALITY_GATES.md — SSS Corp ERP | Created 2026-03-03*
*อ้างอิง SYSTEM_OVERVIEW_V5.md Section D1 + E*
