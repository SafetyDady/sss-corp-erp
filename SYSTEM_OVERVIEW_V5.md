# SSS Corp ERP — Product Requirements Document V5

> **เอกสารนี้คือ "ความจริงเดียว" (Single Source of Truth) ของ project**
> ตรวจสอบกับ codebase จริง commit `bc1e092` เมื่อ 2026-03-02
> V5 รวม feedback รอบ 2 จาก Product Owner

---

## วิธีใช้เอกสารนี้

เอกสารนี้ออกแบบมาเพื่อให้ทั้งคนและ AI เข้าใจตรงกัน แบ่งเป็น 4 ส่วน:

| ส่วน | ชื่อ | เนื้อหา |
|------|------|---------|
| **A** | ระบบปัจจุบัน | สิ่งที่ทำเสร็จแล้ว + สถานะ UX + Owner Decisions |
| **B** | แผนที่วางไว้ | Phase 8-14 ที่ยังไม่ได้เริ่ม |
| **C** | ช่องว่างที่พบ | สิ่งที่ระบบยังขาด (C1-C13) |
| **D** | ลำดับความสำคัญ | ลำดับการทำงานที่ปรับตาม feedback |

**สัญลักษณ์ในเอกสาร:**
- `Owner Decision:` = การตัดสินใจที่ยืนยันแล้วจาก Product Owner
- 🆕 = เนื้อหาใหม่หรือเปลี่ยนแปลงจาก V3

---

## สารบัญ

**ส่วน A — ระบบที่ทำเสร็จแล้ว**
- [A1. ภาพรวม + สถิติ](#a1-ภาพรวม--สถิติ)
- [A2. สถาปัตยกรรมระบบ](#a2-สถาปัตยกรรมระบบ)
- [A3. สถานะแต่ละ Module + Owner Decisions](#a3-สถานะแต่ละ-module--owner-decisions)
- [A4. จุดเชื่อมต่อระหว่าง Module](#a4-จุดเชื่อมต่อระหว่าง-module)
- [A5. ปัญหา UX ทั่วทั้งระบบ + Department-based Menu](#a5-ปัญหา-ux-ทั่วทั้งระบบ--department-based-menu)
- [A6. Business Flows หลัก](#a6-business-flows-หลัก)
- [A7. สถานะเอกสาร (10 State Machines)](#a7-สถานะเอกสาร)
- [A8. แผนที่หน้าจอ + ภาพร่าง](#a8-แผนที่หน้าจอ--ภาพร่าง)
- [A9. ระบบสิทธิ์ (RBAC + Data Scope)](#a9-ระบบสิทธิ์)
- [A10. กฎธุรกิจสำคัญ](#a10-กฎธุรกิจสำคัญ)
- [A11. ข้อบังคับเด็ดขาด (Hard Constraints)](#a11-ข้อบังคับเด็ดขาด)
- [A12. Progress Summary](#a12-progress-summary)

**ส่วน B — แผนที่วางไว้แล้ว (Phase 8-14)**
- [B1. Dashboard & Analytics](#b1-dashboard--analytics-phase-8)
- [B2. Notification Center](#b2-notification-center-phase-9)
- [B3. Export & Print](#b3-export--print-phase-10)
- [B4. Inventory Enhancement](#b4-inventory-enhancement-phase-11--ส่วนที่เหลือ)
- [B5. Mobile Responsive](#b5-mobile-responsive-phase-12)
- [B6. Audit & Security](#b6-audit--security-phase-13)
- [B7. AI Performance Monitoring](#b7-ai-powered-performance-monitoring-phase-14)

**ส่วน C — ช่องว่างที่พบ (C1-C13)**
- [C1-C8: Invoice, DO, AP, Budget, Tax, Multi-currency, Gantt, Self-service](#ส่วน-c--ช่องว่างที่พบ)
- [C9. Internal Recharge (Cost Allocation)](#c9-internal-recharge-cost-allocation-🆕)
- [C10. Maintenance Module](#c10-maintenance-module-🆕)
- [C11. Multi-Company](#c11-multi-company-🆕)
- [C12. Quotation Module (ใบเสนอราคา)](#c12-quotation-module-ใบเสนอราคา-🆕) 🆕
- [C13. Fixed Asset / Depreciation (สินทรัพย์ถาวร)](#c13-fixed-asset--depreciation-สินทรัพย์ถาวร-🆕) 🆕

**ส่วน D — ลำดับความสำคัญ**
- [ลำดับที่แนะนำ (ปรับตาม feedback)](#ส่วน-d--ลำดับความสำคัญที่แนะนำ)
- [D1 Detail: Go-Live Gate](#d1-detail-go-live-gate-🆕) 🆕 — 7 features + scope freeze + GR spec + Sourcer + Direct PO Cost

**ส่วน E — Engineering Risks & Pre-Deployment Checklist** 🆕
- [E1. CRITICAL — ต้องแก้ก่อน Deploy](#e1-critical--ต้องแก้ก่อน-deploy)
- [E2. HIGH — ควรแก้ก่อน Go-Live](#e2-high--ควรแก้ก่อน-go-live)
- [E3. MEDIUM — แก้หลัง Go-Live ได้](#e3-medium--แก้หลัง-go-live-ได้)
- [Pre-Deployment Checklist](#pre-deployment-checklist)

**สรุป + คำศัพท์**
- [สรุป Owner Decisions ทั้งหมด](#สรุป-owner-decisions-ทั้งหมด)
- [คำศัพท์ (Glossary)](#คำศัพท์-glossary)

---

# ส่วน A — ระบบปัจจุบัน

---

## A1. ภาพรวม + สถิติ

SSS Corp ERP คือระบบบริหารจัดการสำหรับธุรกิจ Manufacturing/Trading ขนาดเล็ก-กลาง ครอบคลุมตั้งแต่คลังสินค้า, สั่งงาน, จัดซื้อ, ขาย, บุคคล, ไปจนถึงการคิดต้นทุนงาน (Job Costing) ระบบรองรับหลายองค์กรในฐานข้อมูลเดียว (Multi-tenant) โดยแยกข้อมูลด้วย org_id ระบบรองรับทั้งธุรกิจ Service และ Product Manufacturing

| รายการ | ตัวเลข |
|--------|--------|
| Modules | 12 |
| DB Tables | 47 |
| API Endpoints | 182 |
| Frontend Pages | 96 JSX files |
| Backend Files (.py) | 71 ไฟล์ |
| Permissions | 133 |
| Business Rules | 88+ |
| Roles | 5 (Owner, Manager, Supervisor, Staff, Viewer) |
| Total LOC | ~40,300 (Frontend ~19,800 + Backend ~20,500) |
| Database Migrations | 20 revisions |
| Git Commits | 44 commits |
| State Machines | 10 |
| Frontend Routes | 29+ |
| Frontend Tabs | 35+ |
| Backend Routers | 19 |

**Tech Stack:** FastAPI + SQLAlchemy (Backend) | React 18 + Vite + Ant Design + Zustand (Frontend) | PostgreSQL 16 + Redis 7 | JWT Auth | Lucide Icons

---

## A2. สถาปัตยกรรมระบบ

```mermaid
graph TB
    subgraph "ผู้ใช้งาน"
        U1["Owner<br/>(เจ้าของ)"]
        U2["Manager<br/>(ผู้จัดการ)"]
        U3["Supervisor<br/>(หัวหน้างาน)"]
        U4["Staff<br/>(พนักงาน)"]
        U5["Viewer<br/>(ผู้ดูข้อมูล)"]
    end

    subgraph "Frontend — หน้าจอ"
        FE["React 18 + Ant Design<br/>29+ หน้า, 35+ แท็บ<br/>Deploy: Vercel"]
    end

    subgraph "Backend — ประมวลผล"
        BE["FastAPI (Python)<br/>19 Routers, 88 กฎธุรกิจ<br/>Deploy: Railway"]
        AUTH["JWT Authentication<br/>133 สิทธิ์ x 5 บทบาท"]
    end

    subgraph "Database — เก็บข้อมูล"
        DB["PostgreSQL 16<br/>47 ตาราง<br/>20 migrations"]
        REDIS["Redis<br/>Rate Limiting"]
    end

    subgraph "Monitoring"
        SENTRY["Sentry<br/>Error Tracking"]
    end

    U1 & U2 & U3 & U4 & U5 --> FE
    FE <-->|"REST API<br/>(JSON)"| BE
    BE <--> AUTH
    BE <-->|"SQL Queries"| DB
    BE <--> REDIS
    BE -.-> SENTRY
    FE -.-> SENTRY
```

### เทคโนโลยีที่ใช้

| ชั้น | เทคโนโลยี | หน้าที่ |
|------|----------|--------|
| หน้าจอ (Frontend) | React 18 + Vite + Ant Design | แสดงผล + รับข้อมูลจากผู้ใช้ |
| ไอคอน | Lucide React | ไอคอนทั้งระบบ (ห้ามใช้ emoji / Ant Design Icons) |
| State Management | Zustand | จัดการ state ฝั่ง frontend |
| ประมวลผล (Backend) | FastAPI (Python 3.12) | ตรวจสอบกฎ + คำนวณ + จัดการข้อมูล |
| ฐานข้อมูล | PostgreSQL 16 + SQLAlchemy 2.0 (async) | เก็บข้อมูลทั้งหมด |
| Cache | Redis | Rate limiting + session cache |
| ยืนยันตัวตน | JWT Token (Access 15min + Refresh 7d) | Login + สิทธิ์การเข้าถึง |
| Deploy หน้าจอ | Vercel | เว็บไซต์ออนไลน์ |
| Deploy ประมวลผล | Railway | เซิร์ฟเวอร์ออนไลน์ |

---

## A3. สถานะแต่ละ Module + Owner Decisions

### แผนภาพความสัมพันธ์ 12 โมดูล

```mermaid
graph LR
    subgraph "ข้อมูลหลัก (Master)"
        MASTER["Master Data<br/>Cost Center, Cost Element<br/>OT Type, Shift, Supplier<br/>Department, Leave Type"]
        ADMIN["Admin<br/>Users, Roles<br/>Permissions, Config"]
    end

    subgraph "ซื้อ (Purchasing)"
        PR["PR<br/>ใบขอซื้อ"]
        PO["PO<br/>ใบสั่งซื้อ"]
    end

    subgraph "คลัง (Supply Chain)"
        INV["Inventory<br/>สินค้า + สต็อก"]
        WH["Warehouse<br/>คลัง + ตำแหน่ง"]
        WD["Withdrawal<br/>ใบเบิกของ"]
    end

    subgraph "ผลิต (Production)"
        WO["Work Order<br/>ใบสั่งงาน"]
        PLAN["Planning<br/>แผนงาน + จองวัสดุ"]
        TOOL["Tools<br/>เครื่องมือ"]
    end

    subgraph "บุคคล (HR)"
        HR["HR<br/>พนักงาน + Timesheet<br/>ลา + Payroll + กะ"]
    end

    subgraph "ขาย + การเงิน"
        SALES["Sales<br/>ใบสั่งขาย"]
        CUST["Customer<br/>ลูกค้า"]
        FIN["Finance<br/>รายงานการเงิน"]
    end

    PR -->|"Convert"| PO
    PO -->|"รับของ (GR)"| INV
    PO -->|"Direct GR → WO/CC"| WO
    WD -->|"ตัดสต็อก"| INV
    INV <-->|"ตำแหน่ง"| WH
    INV -->|"เบิกวัสดุ (CONSUME)"| WO
    INV -->|"คืนวัสดุ (RETURN)"| WO
    HR -->|"Timesheet → ManHour"| WO
    TOOL -->|"Check-in → Recharge"| WO
    PLAN -->|"จัดคน+เครื่องมือ"| WO
    PLAN -->|"จองวัสดุ"| INV
    CUST -->|"ลูกค้า"| SALES
    CUST -->|"ลูกค้า"| WO
    MASTER -.->|"Cost Center"| WO & HR & PR & INV
    MASTER -.->|"OT Type"| HR
    MASTER -.->|"Supplier"| PO
    ADMIN -.->|"สิทธิ์"| PR & PO & INV & WO & HR & SALES & TOOL
    WO & SALES & HR -->|"ข้อมูลต้นทุน"| FIN
```

---

### Module 1: Inventory (สินค้า + Stock) — ✅ Feature Complete

ระบบจัดการสินค้าพร้อม stock tracking แบบ real-time ที่ระดับ product และ location รองรับ 8 ประเภท movement (RECEIVE, ISSUE, CONSUME, RETURN, TRANSFER, ADJUST, REVERSAL, **PRODUCE** 🆕) โดย stock movement เป็น immutable — แก้ไขได้ผ่าน REVERSAL เท่านั้น มีการแจ้งเตือนเมื่อ stock ต่ำกว่า min_stock (แถวเหลือง + stat card)

**Owner Decision:** สินค้ามี 5 ประเภท — MATERIAL, CONSUMABLE, SPAREPART, **FINISHED_GOODS** (🆕 สินค้าสำเร็จรูป/ผลผลิตจาก WO), SERVICE โดย SPAREPART แยกจาก MATERIAL เพื่อให้จัดการ critical parts ได้ง่ายขึ้น และ FINISHED_GOODS คือผลผลิตที่ได้จากกระบวนการผลิต (Work Order)

**Owner Decision: FINISHED_GOODS + PRODUCE Movement** 🆕
- WO ปิดงาน → ระบบสร้าง **PRODUCE movement** → FINISHED_GOODS เข้า stock ที่ Actual Cost (Unit Cost = Total WO Cost / actual_qty)
- **1 WO = 1 primary output product** (FINISHED_GOODS)
- PRODUCE movement เพิ่ม stock เหมือน RECEIVE แต่ต้องระบุ WO ที่ CLOSED

**Owner Decision:** สินค้าต้องบันทึก **Model** และ **Serial Number (SN)** ได้ โดยใช้โครงสร้าง Serial Number sub-table: 1 SKU สามารถมีหลาย SN (เช่น เครื่องปั๊มรุ่น A มี SN-001, SN-002, SN-003)

**UX ที่ดี:** มี search/filter, stock quantity display ชัดเจน, low stock alert ด้วยสีเหลือง

**UX ที่ต้องปรับปรุง:**
- ไม่มี Stock Count/Adjustment UI — ต้องทำผ่าน movement ซึ่งไม่ตรงกับ workflow จริงของคลัง
- ไม่มี Stock Transfer ระหว่าง warehouse — ต้องทำ manual
- ไม่มี Import/Export สำหรับ bulk update สินค้า
- การค้นหาด้วย SKU, Model, SN ยังไม่ครบถ้วน — ต้องเพิ่ม filter/sort สำหรับ available items

---

### Module 2: Warehouse (คลัง + ตำแหน่ง) — ✅ Feature Complete (ต้องขยาย)

ระบบจัดการคลังสินค้าปัจจุบันเป็น 2 ระดับ (Warehouse → Location) รองรับ zone type (STORAGE, RECEIVING, SHIPPING, QUARANTINE)

**Owner Decision:** ขยายเป็น **3 ระดับ: Warehouse → Location → Bin** โดย Bin คือตำแหน่ง rack ที่เก็บสินค้าจริง ช่วยให้ระบุตำแหน่งได้แม่นยำขึ้น

**Owner Decision:** ระบบต้องรองรับ **หลาย site** ทั้ง fixed site (คลังถาวร) และ temporary site (คลังชั่วคราวที่หน้างาน) UI ต้องช่วยให้คนเบิก **ไม่หลง site** — แสดง site/warehouse ให้ชัดเจนในทุกหน้าที่เกี่ยวข้อง

**Owner Decision:** **ฝากของ (Consignment storage)** — เก็บเข้า Stock ปกติ แต่ **ห้ามคนอื่นเบิกนอกจากเจ้าของ** 🆕 สินค้า consignment อยู่ในคลังเดียวกัน แต่ระบบต้องควบคุมสิทธิ์การเบิก (owner-only withdrawal)

**UX ที่ดี:** โครงสร้าง hierarchical ชัดเจน, CRUD ครบ

**UX ที่ต้องปรับปรุง:**
- ไม่มี visual map ของ warehouse layout — เป็นแค่ list
- ไม่มี stock summary per location
- ยังไม่มี Bin level

---

### Module 3: Work Order (ใบสั่งงาน) — ✅ Feature Complete (ต้องขยาย) 🆕

ระบบใบสั่งงานพร้อม Job Costing สถานะ DRAFT → OPEN → CLOSED ไปข้างหน้าเท่านั้น เบิก/คืนวัสดุได้เฉพาะ WO ที่ OPEN

**Owner Decision: WO Output Product (FINISHED_GOODS)** 🆕
- WO สามารถกำหนด **output product** (ประเภท FINISHED_GOODS) พร้อม planned_qty และ actual_qty
- เมื่อ WO ปิดงาน (CLOSED) → ระบบสร้าง **PRODUCE movement** → FINISHED_GOODS เข้า stock ที่ Actual Unit Cost (= Total WO Cost / actual_qty)
- 1 WO = 1 primary output product

**Owner Decision:** WO สามารถ **trigger PO สำหรับสั่งของพิเศษ** (direct purchase) โดยไม่ผ่านคลัง รวมถึง Service PO ด้วย เช่น WO ต้องการชิ้นส่วนพิเศษที่ไม่มีในสต็อก → สร้าง PR/PO อ้างอิง WO → ของส่งตรงไปที่ WO → charge cost เข้า WO โดยตรง

**Owner Decision:** **Subcontractor manhour** บันทึกเป็น PO cost เข้า WO โดยตรง (ไม่ผ่าน timesheet) เนื่องจากผู้รับเหมาช่วงไม่อยู่ในองค์กร PO มี cost_element แยกอยู่แล้ว ต้องปรับปรุงการแสดงผลต้นทุนให้เห็นชัด

**Owner Decision:** Job Costing อัปเดตเป็น **5 องค์ประกอบ**:
1. Material Cost = CONSUME - RETURN
2. ManHour Cost = (Regular + OT x Factor) x Rate
3. Tools Recharge = Hours x Tool Rate
4. Admin Overhead = ManHour Cost x Overhead Rate % (ดูรายละเอียดเพิ่มที่ [C9. Internal Recharge](#c9-internal-recharge-cost-allocation-🆕) — P'Hot ยืนยันเข้าใจ 2-type recharge model แล้ว) 🆕
5. **Direct PO Cost** (ใหม่) = PO ที่อ้างอิง WO โดยตรง (subcontractor + special purchase)

**UX ที่ดี:** Popconfirm ก่อน action สำคัญ, summary cards แสดงต้นทุนรวม, status flow ชัดเจน

**UX ที่ต้องปรับปรุง:**
- Select สินค้า/คลัง โหลดทั้งหมด (limit:500) — ต้องเปลี่ยนเป็น search-as-you-type
- **ปุ่มเบิก/คืนวัสดุเล็กเกินไป สังเกตได้ยาก** — ต้อง redesign ให้ชัดเจนขึ้น
- total_manhours ใน Master Plan เป็น manual input — ควรคำนวณจาก manpower lines อัตโนมัติ
- ไม่มี print view สำหรับ WO detail/cost summary
- ยังไม่มี Direct PO Cost component ในหน้า cost summary

---

### Module 4: Supply Chain (คลังสินค้า + ใบเบิก) — ✅ Feature Complete (ต้อง redesign) 🆕

ระบบใบเบิกของ (Withdrawal Slip) แบบ multi-line พร้อม status flow (DRAFT → PENDING → ISSUED → CANCELLED) เมื่อจ่ายของจะสร้าง StockMovement อัตโนมัติ

**Owner Decision:** Supply Chain module ต้อง **เป็น module เฉพาะสำหรับเจ้าหน้าที่แผนกคลังสินค้า** คนแผนกอื่นที่ต้องการเบิกของ/ยืมเครื่องมือ ควรทำจาก UI หน้าอื่น (เช่น หน้า WO หรือหน้า My Tasks)

**Owner Decision:** การค้นหาด้วย **SKU, Model, SN** สำคัญมาก รวมถึง Filter/Sort ข้อมูลที่ available

**Owner Decision:** ใบเบิกของ/ใบยืมเครื่องมือที่เป็น **hardcopy ต้องมีการเก็บหลักฐานในระบบ** ต้องบันทึกหมายเลขใบเบิก/ใบยืมที่สามารถย้อนกลับมาได้ (reference number traceability)

**Owner Decision:** การนำเครื่องมือมาคืน **ไม่จำเป็นต้องมี hardcopy** เป็นความรับผิดชอบของเจ้าหน้าที่คลังในการบันทึกในระบบ

**Owner Decision:** เครื่องมือที่เสีย → **สร้าง WO เพื่อซ่อม** ส่วนจะ charge cost center ใครแล้วแต่ตกลงกันระหว่างผู้ยืมกับคลัง

**Owner Decision: GR มี 2 โหมด** 🆕
- **Stock GR**: PR จากแผนกคลัง → RECEIVE เข้า stock (สร้าง stock movement)
- **Direct GR**: PR จากแผนกอื่นที่ระบุ WO/CC → charge WO/CC โดยตรง (ไม่สร้าง stock movement)
- ระบบ auto-detect จาก context ของ PR แต่ GR operator สามารถ override ได้
- GR ที่ไม่ได้ระบุคลังเก็บ — practical สำหรับ Direct GR แต่ถ้าเป็นของที่ต้องเข้าคลัง ต้องมีกระบวนการนำเข้าคลังภายหลัง

**UX ที่ดี:** Print view สำหรับใบเบิก, Issue modal สำหรับคลังจ่ายของ, status flow ชัดเจน

**UX ที่ต้องปรับปรุง:**
- ไม่มี Barcode/QR scanning สำหรับจ่ายของ (เลื่อนไปคุยรอบถัดไป)
- Complex multi-step process อาจสับสนสำหรับผู้ใช้ใหม่
- ยังไม่มี UI แยกสำหรับ "คนเบิก" กับ "เจ้าหน้าที่คลัง"

---

### Module 5: Purchasing (จัดซื้อ) — ✅ Feature Complete (ต้อง redesign flow) 🆕

ระบบจัดซื้อแบบ 2 ขั้น: PR → PO → Goods Receipt มี Supplier master, PO QR code, delivery note

**Owner Decision:** PR **ไม่จำเป็นต้องเลือกจาก SKU list เท่านั้น** แผนกอื่นสามารถอธิบายสิ่งที่ต้องการซื้อได้อิสระ (free text) เพราะบางครั้งไม่รู้ว่ามี SKU อะไรในระบบ

**Owner Decision:** คนออก PR สามารถ **แนะนำ supplier จาก vendor list ได้ แต่ไม่บังคับ** สุดท้ายฝ่ายจัดซื้อเป็นผู้ตัดสินใจเลือก supplier

**Owner Decision:** GR ควรทำโดย **บุคคลที่ 3** ที่ไม่ใช่คนออก PR/PO — กำหนดเป็น option ของระบบได้ (configurable)

**Owner Decision: Procurement Flow ต้องมี Sourcer role** 🆕


กระบวนการจัดซื้อที่ถูกต้อง:
1. ผู้ขอ (Requester) สร้าง PR + อาจแนะนำ supplier
2. **Sourcer (ผู้จัดหา)** ค้นหา vendor + pricing → นำข้อมูลที่เกือบ final มาประกอบ
3. ผู้จัดการแผนก/คนสูงกว่า **อนุมัติ PR** (พร้อมข้อมูล vendor+pricing ที่ Sourcer เตรียม)
4. ฝ่ายจัดซื้อ **Convert approved PR → PO**
5. Sourcer กับคน Convert อาจเป็นคนเดียวกันก็ได้ (แต่ละองค์กรไม่เหมือนกัน)
6. **ระบบต้องบันทึกและย้อนกลับได้ว่าใครทำอะไร** — สำคัญเพราะ track performance ได้

```mermaid
flowchart LR
    A["Requester<br/>สร้าง PR<br/>+ แนะนำ supplier"] -->|"ส่งต่อ"| B["Sourcer<br/>ค้นหา vendor<br/>+ pricing info"]
    B -->|"Submit with<br/>vendor+price"| C["Manager<br/>อนุมัติ PR"]
    C -->|"Approved"| D["Purchasing<br/>Convert PR → PO<br/>(อาจเป็น Sourcer คนเดียวกัน)"]
    D -->|"PO Created"| E["3rd Party<br/>ทำ GR<br/>(configurable)"]

    style A fill:#3b82f6,color:#fff
    style B fill:#8b5cf6,color:#fff
    style C fill:#f59e0b,color:#fff
    style D fill:#10b981,color:#fff
    style E fill:#ef4444,color:#fff
```

**UX ที่ดี:** Status progression ชัดเจน, PR detail page มี timeline/history, QR Code สำหรับ PO

**UX ที่ต้องปรับปรุง:**
- ConvertToPOModal โหลด supplier ทั้งหมด — ควรเปลี่ยนเป็น search
- ไม่มี partial conversion — ต้อง convert ทั้ง PR
- ไม่มี PO amendment/revision flow
- ไม่มีการส่ง PO ให้ supplier (email/print)
- ยังไม่มี Sourcer role tracking ในระบบ
- ยังไม่มี free text description บน PR line (ต้องเลือก product_id)

---

### Module 6: Sales (ขาย) — ⚠️ พื้นฐาน

ระบบขายมี SO (Sales Order) CRUD + approve เท่านั้น ยังไม่มี flow หลัง approve (ไม่มี Invoice, Delivery Order, Payment tracking)

**Owner Decision: SO รองรับ Product + Service** 🆕
- SO ต้องรองรับทั้ง **Product line items** และ **Service line items** (เหมือน PR ที่มี GOODS/SERVICE)

**Owner Decision: Quotation (QT) Module** 🆕
- ระบบใบเสนอราคา — **ไม่เร่งด่วนแต่ต้องมี** (ดูรายละเอียดที่ [C12. Quotation Module](#c12-quotation-module-ใบเสนอราคา-🆕))
- QT อาจผูกหรือไม่ผูกกับ SO ก็ได้
- QT เป็นข้อมูลลับ — เฉพาะผู้เกี่ยวข้อง + Owner เท่านั้นที่ดูได้
- QT เก็บประวัติ win/loss + ราคาเสนอ vs ราคาขายจริง
- QT มี cost estimation + margin breakdown
- งานประมูล = ศิลปะการเสนอราคา ไว้คนรุ่นหลังศึกษา (โดยเฉพาะงาน Service/ก่อสร้าง)

**UX ที่ต้องปรับปรุง:**
- SO ที่ approved แล้วไม่มี next step — เป็น dead-end
- ไม่มี Invoice generation จาก SO
- ไม่มี Delivery Order / ใบส่งของ
- ไม่มี Payment tracking
- เรียบง่ายเกินไปเมื่อเทียบกับ Purchasing module

---

### Module 7: HR (บุคคล) — ✅ Feature Complete 🆕

ระบบ HR ครบทุก sub-module: Employee management, Timesheet (3-step approve), Leave (quota-based), Payroll, Daily Report, Shift Management (FIXED + ROTATING), Standard Timesheet

**Owner Decision:** พนักงาน **ดู Payslip ของตัวเองได้** — ยืนยันแล้ว

**Owner Decision:** พนักงาน **แก้ไขข้อมูลส่วนตัวเองได้** (เบอร์โทร, ที่อยู่) — ยืนยันแล้ว

**Owner Decision:** Roster UX ต้อง **ทำให้ง่าย** ไม่ต้องมานั่งทำ form ทีละวัน ให้ available สำหรับ bulk edit

**Owner Decision:** Timesheet objective คือ **track manhour เข้า WO** ดังนั้นใช้ **Daily Work Report เพื่อบันทึก timesheet ไปพร้อมกัน** (ลดขั้นตอนซ้ำซ้อน)

**Owner Decision: Timesheet ไม่บังคับกรอก** 🆕
- เป็น **department discipline policy** — แต่ละแผนกกำหนดเองได้ว่า mandatory หรือ optional
- Config ต่อ department ว่า timesheet เป็น mandatory/optional

**Owner Decision: Payroll loosely coupled กับ Timesheet** 🆕
- Payroll คำนวณ **base salary โดยไม่ต้องพึ่ง timesheet** — ถ้ามี timesheet จะเสริม OT/deduction ถ้าไม่มี = base salary เท่านั้น
- Config ต่อ department ว่า mandatory/optional

**Owner Decision: HR Final Approve = Optional** 🆕
- Config `hr_final_required` per org: true = ต้องผ่าน HR Final ก่อนเข้า Payroll, false = Supervisor approve แล้วเข้า Payroll ได้เลย

**UX ที่ดี:** Comprehensive employee management, leave balance tracking, payroll calculation with OT/deductions

**UX ที่ต้องปรับปรุง:**
- Modal ซ้อน Modal — บาง flow มี form ลึกหลายชั้น
- Timesheet stat card ใน MePage แสดง "—" แทนข้อมูลจริง
- ยังไม่มีหน้า Employee self-service (payslip view, profile edit) — ทำ basic (payslip view, profile edit) ไม่ต้อง over-engineer แต่ควรเปิดช่องพัฒนาต่อ 🆕

---

### Module 8: Tools (เครื่องมือ) — ✅ Feature Complete

ระบบจัดการเครื่องมือ/อุปกรณ์ พร้อม checkout/checkin tracking, recharge rate (ค่าเสื่อม), คำนวณ cost เข้า WO อัตโนมัติเมื่อคืน

**Owner Decision:** Maintenance scheduling ควรมี แต่ **ไปอยู่กับ Maintenance Module แยกต่างหาก** (ดู C10)

**Owner Decision: Fixed Asset / Depreciation** 🆕
- Asset บางอย่างไม่ใช่ tool แต่มีค่าเสื่อมตามกฎหมาย — ต้องพิจารณา **Fixed Asset Management** (ดู [C13. Fixed Asset](#c13-fixed-asset--depreciation-สินทรัพย์ถาวร-🆕))

**UX ที่ดี:** Checkout/return tracking ชัดเจน, status tracking (available/checked-out/maintenance)

---

### Module 9: Planning (วางแผน) — ✅ Feature Complete

**Owner Decision:** WO Plan / Project Plan มีไว้เพื่อ **forecast resources** และเป็น **performance indicator เทียบกับ result**

**Owner Decision:** Daily Plan มีไว้เพื่อ **จัดการ resources ให้มีประสิทธิภาพ** ตาราง Daily Plan ควรดูภาพได้ **14 วันข้างหน้า** และทำให้ง่ายเหมือน Excel (ยอมรับว่าเป็นความท้าทายของการออกแบบ)

**Owner Decision:** Gantt chart — **ทำระดับง่ายก่อน** 🆕 แท่ง WO timeline (start → end) แสดงภาพรวม ยังไม่ต้อง drag & drop

**Owner Decision:** ERP ต้อง support ทั้ง **ธุรกิจ Service และ Product Manufacturing** ทำอย่างไรก็ได้ที่สะท้อนภาพรวม คาดการณ์ล่วงหน้าได้ ลด conflict ภายในองค์กร

**UX ที่ดี:** Date-based planning, links to WO and products

**UX ที่ต้องปรับปรุง:**
- Daily Plan เป็นแค่ตาราง — ไม่มี drag-and-drop หรือ calendar view
- ไม่มี auto-reservation จาก WO Master Plan
- 14-day lookahead ยังไม่มี

---

### Module 10: Customer (ลูกค้า) — ✅ Feature Complete

ระบบจัดการข้อมูลลูกค้า CRUD + export

**UX ที่ต้องปรับปรุง:**
- ไม่มี contact management — ผู้ติดต่อหลายคนต่อลูกค้า
- ไม่มี communication history
- ไม่มี customer dashboard (ยอดสั่งซื้อรวม, SO history)

---

### Module 11: Finance (การเงิน) — ⚠️ พื้นฐานมาก

ระบบช่วยส่งข้อมูลให้บัญชีได้ แต่ **ไม่ใช่ Module ทางบัญชีตามกฎหมาย** มีเพียง summary report + CSV export เท่านั้น ยังไม่มี financial reports จริง 🆕

**Owner Decision: Finance = Management Information** 🆕
- Owner สามารถประเมินภาพรวมสถานะการเงินได้
- ช่วยวางแผนทางภาษีได้
- กำหนดคนทำและคนเห็นได้ (permission + data scope)
- Export data สำหรับนักบัญชีภายนอก

**UX ที่ต้องปรับปรุง:**
- หน้าจอแทบว่างเปล่า — แค่ตัวเลขรวม
- ไม่มี chart หรือ graph
- ไม่มี drill-down จากตัวเลขรวมไปรายการ
- ไม่มี date range filter ที่ยืดหยุ่น

---

### Module 12: Admin (จัดการระบบ) — ✅ Feature Complete 🆕

**Owner Decision: Owner / SysAdmin แยกได้** 🆕
- Admin Module ปัจจุบัน = Owner role แต่สามารถ **แยก SysAdmin** ได้ โดย Owner assign admin.* permissions ให้คนอื่น
- SysAdmin จัดการ Users/Roles/Config ได้ แต่ไม่เห็น Finance / ไม่อนุมัติเอกสาร / ไม่ลบข้อมูล

ระบบจัดการ Users, Roles (view-only — roles hardcoded), Org Settings, Approval Bypass config, Setup Wizard

**UX ที่ดี:** User management with role assignment, audit log, setup wizard

**UX ที่ต้องปรับปรุง:**
- **Role management ใช้งานยากมาก** — เป็น view-only ไม่สามารถ customize permission per role ต้อง redesign ให้ customize ได้จากหน้าจอ 🆕
- ไม่มี login history / session management
- ไม่มี password policy configuration

---

### Cross-cutting Features (ทำเสร็จแล้ว)

| Feature | สถานะ | หมายเหตุ |
|---------|--------|----------|
| RBAC (133 permissions, 5 roles) | ✅ | ทุกหน้าตรวจสิทธิ์ |
| Data Scope (Staff=own, Supervisor=dept, Manager/Owner=all) | ✅ | HR + Purchasing endpoints |
| Staff Portal (ของฉัน) | ✅ | My Daily Report, My Leave, My Timesheet, My Tasks |
| Approval Center (6 tabs) | ✅ | DailyReport, PR, Timesheet, Leave, PO, SO + Badge Count |
| Approval Bypass | ✅ | OrgApprovalConfig — auto-approve เมื่อเปิด |
| Setup Wizard | ✅ | First-time org setup |
| Multi-tenant | ✅ | org_id filter ทุก query |

---

## A4. จุดเชื่อมต่อระหว่าง Module 🆕

| จาก | ไป | ประเภทการเชื่อม | ตัวอย่าง |
|------|-----|----------------|---------|
| PR | PO | เปลี่ยนสถานะ | PR อนุมัติแล้ว → กดแปลงเป็น PO |
| PO (Stock GR) | Inventory | สร้าง movement | รับของ → RECEIVE movement → stock เพิ่ม |
| PO (Direct GR) | Work Order/CC | charge ตรง | รับของ → charge cost เข้า WO/CC โดยตรง (ไม่ผ่าน stock) |
| Inventory | Work Order | เบิก/คืนวัสดุ | CONSUME → stock ลด + cost เข้า WO / RETURN → stock เพิ่ม |
| Withdrawal | Inventory | ตัดสต็อก | Issue ใบเบิก → สร้าง CONSUME/ISSUE movement ต่อรายการ |
| Inventory | Warehouse | ตำแหน่งจัดเก็บ | สินค้าอยู่ location/bin ไหน, stock ต่อ location |
| HR (Timesheet) | Work Order | ค่าแรง | HR final approve → ManHour Cost เข้า WO |
| Tools | Work Order | ค่าเครื่องมือ | Check-in → คำนวณชั่วโมง x อัตรา → Tools Recharge เข้า WO |
| Planning | Work Order | จัดคน/เครื่องมือ | Daily Plan → จัดพนักงาน + เครื่องมือ ลง WO ต่อวัน |
| Planning | Inventory | จองวัสดุ | Material Reservation → กัน stock ไว้ให้ WO |
| Master Data | ทุก module | ข้อมูลอ้างอิง | Cost Center, Cost Element, OT Type, Supplier, Department |
| Customer | Sales + WO | ลูกค้า | SO ต้องมีลูกค้า, WO อ้างอิง SO |
| WO + Sales + HR | Finance | ต้นทุน/รายได้ | รายงานการเงินรวมจากทุกแหล่ง |
| WO | PO (ใหม่) | สั่งของพิเศษ | WO trigger PR/PO สำหรับ direct purchase → charge WO |
| Internal Recharge | Finance (ใหม่) | cost allocation | แผนกเบิกของ → charge cost ข้ามแผนก |

---

## A5. ปัญหา UX ทั่วทั้งระบบ + Department-based Menu 🆕

### ปัญหา UX ทั่วระบบ

| ปัญหา | ผลกระทบ | ระดับ |
|--------|---------|-------|
| **Select โหลดข้อมูลทั้งหมด (limit:500)** | หน้าจอจะช้ามากเมื่อมีข้อมูลเยอะ ต้องเปลี่ยนเป็น search-as-you-type | สูง |
| **ไม่มี Mobile Responsive** | ใช้งานจากมือถือไม่ได้เลย — desktop only | สูง |
| **ไม่มี Notification** | ต้อง "เข้าไปดู" เองว่ามีอะไรรออนุมัติ | สูง |
| **Error handling เงียบ** | หลายหน้า catch error แล้วไม่แสดงอะไร | กลาง |
| **Bulk actions จำกัด** | มีแค่ Daily Report approval ที่ทำ batch ได้ | กลาง |
| **Search ไม่สม่ำเสมอ** | บางหน้ามี search, บางหน้าไม่มี | กลาง |
| **ไม่มี Print view** | มีแค่ Withdrawal Slip ที่ print ได้ | กลาง |
| **ปุ่มเบิก/คืนวัสดุเล็ก** | สังเกตได้ยาก ต้อง redesign ให้ชัดเจน | กลาง |
| **Role management ใช้งานยากมาก** 🆕 | view-only, ไม่ customize ได้ ต้อง redesign | สูง |
| **Loading state ไม่สม่ำเสมอ** | บางหน้าแสดง Spin, บางหน้าไม่แสดง | ต่ำ |
| **ไม่มี Keyboard shortcuts** | ทุกอย่างต้องใช้เมาส์ | ต่ำ |
| **Login page แสดง test accounts** | ต้องเอาออกก่อน production | ต่ำ |

### Owner Decision: Department-based Menu UI 🆕

**ออกแบบ UI/UX เป็นกลุ่มแผนก** แต่ละกลุ่มมี Menu ไม่เหมือนกัน การเข้าถึงเป็นไปตาม permission

**วิธีทำ: Hybrid Approach**

| Layer | วิธีการ | คำอธิบาย |
|-------|---------|----------|
| **Layer 1: Permission-driven (auto)** | ระบบกรอง menu อัตโนมัติตาม permission ของ user | เมนูแสดงเฉพาะสิ่งที่ user มีสิทธิ์เข้าถึง |
| **Layer 2: Department Preset (template)** | Admin กำหนด menu template ต่อแผนก | ลำดับเมนู, pinned items, กลุ่มเมนูที่เน้น |

**ผลลัพธ์:** Menu ที่แสดง = Permission (filter) + Dept Template (ordering/highlighting)

```
┌─────────────────────────────────────────┐
│ ตัวอย่าง: แผนกคลัง (Store)              │
│ ┌───────────────────────────────┐       │
│ │ ★ Supply Chain (pinned)       │       │
│ │   ★ Withdrawal Slips (pinned)  │       │
│ │   Inventory                    │       │
│ │   Warehouse                    │       │
│ │   Tools                        │       │
│ │ ─────────────────────         │       │
│ │ Purchasing                     │       │
│ │ Work Orders                    │       │
│ └───────────────────────────────┘       │
├─────────────────────────────────────────┤
│ ตัวอย่าง: แผนกผลิต (Production)         │
│ ┌───────────────────────────────┐       │
│ │ ★ Work Orders (pinned)        │       │
│ │ ★ Planning (pinned)           │       │
│ │ ─────────────────────         │       │
│ │ Supply Chain                   │       │
│ │ HR                             │       │
│ └───────────────────────────────┘       │
└─────────────────────────────────────────┘
```
**Owner Decision: แผนก Admin ส่วนกลาง** 🆕
- ต้องมี Department Template สำหรับ **แผนก Admin ส่วนกลาง** ที่บริหารค่าใช้จ่ายส่วนกลางที่ใช้ร่วมกัน (ค่าน้ำ ค่าไฟ ค่าเช่าอาคาร)
- ผู้รับผิดชอบทำ Internal Recharge = แผนก Admin/บัญชี (ดู [C9. Internal Recharge](#c9-internal-recharge-cost-allocation-🆕))

## A6. Business Flows หลัก

ระบบมี 6 flow หลัก (เพิ่ม 1 flow ใหม่จาก feedback):

### Flow 1: จัดซื้อ (Procurement) 🆕

```mermaid
flowchart LR
    A["Requester<br/>สร้าง PR<br/>(free text/SKU)"] -->|"Submit"| B["Sourcer<br/>ค้นหา vendor<br/>+ pricing info"]
    B -->|"Submit with<br/>vendor+price"| C["Manager<br/>อนุมัติ PR"]
    C -->|"Approve"| D["Purchasing<br/>Convert PR → PO"]
    D -->|"PO สร้าง"| E{"GR Mode?"}
    E -->|"Stock GR"| F["3rd Party<br/>กดรับของ<br/>→ RECEIVE stock"]
    E -->|"Direct GR"| G["3rd Party<br/>กดรับของ<br/>→ Charge WO/CC"]

    style A fill:#3b82f6,color:#fff
    style B fill:#8b5cf6,color:#fff
    style C fill:#f59e0b,color:#fff
    style D fill:#10b981,color:#fff
    style F fill:#ef4444,color:#fff
    style G fill:#ec4899,color:#fff
```

**สรุป:** Requester ขอซื้อ → Sourcer หา vendor+ราคา → Manager อนุมัติ → Convert PO → GR (2 modes: เข้า stock หรือ charge ตรง)

**กฎสำคัญ:**
- PO ต้องมาจาก PR เท่านั้น, 1 PR = 1 PO
- PR ไม่จำเป็นต้องเลือก SKU — กรอก free text ได้
- Supplier แนะนำได้แต่ไม่บังคับ
- GR ควรเป็นบุคคลที่ 3 (configurable)
- ระบบต้อง track ว่าใครเป็น Sourcer, ใครเป็น Converter

---

### Flow 2: คำนวณต้นทุนงาน (Job Costing — 5 องค์ประกอบ) 🆕

```mermaid
flowchart TB
    WO["Work Order<br/>(ใบสั่งงาน)<br/>สถานะ: OPEN"]

    subgraph "1. ค่าวัสดุ (Material Cost)"
        M1["เบิกวัสดุ (CONSUME)<br/>จำนวน x ราคาต่อหน่วย"]
        M2["คืนวัสดุ (RETURN)<br/>จำนวน x ราคาต่อหน่วย"]
        MC["Material Cost<br/>= CONSUME - RETURN"]
        M1 --> MC
        M2 --> MC
    end

    subgraph "2. ค่าแรง (ManHour Cost)"
        H1["พนักงานกรอก<br/>Daily Report"]
        H2["Supervisor อนุมัติ"]
        H3["HR Final Approve<br/>(Optional — config per org)"]
        HC["ManHour Cost<br/>= (ปกติ + OT x Factor) x อัตรา"]
        H1 --> H2 --> H3 --> HC
    end

    subgraph "3. ค่าเครื่องมือ (Tools Recharge)"
        T1["Check-out เครื่องมือ"]
        T2["Check-in เครื่องมือ"]
        TC["Tools Recharge<br/>= ชั่วโมงใช้งาน x อัตราบาท/ชม."]
        T1 --> T2 --> TC
    end

    subgraph "4. ค่าบริหาร (Admin Overhead)"
        OC["Overhead<br/>= ManHour Cost x Overhead Rate %<br/>(ต่อ Cost Center)"]
    end

    subgraph "5. ค่า PO ตรง (Direct PO Cost) 🆕"
        PC["Direct PO Cost<br/>= PO ที่อ้างอิง WO<br/>(subcontractor + special purchase)"]
    end

    WO --> MC & HC & TC & PC
    HC --> OC

    TOTAL["ต้นทุนรวม WO<br/>= Material + ManHour + Tools + Overhead + Direct PO"]
    MC & HC & TC & OC & PC --> TOTAL

    style WO fill:#3b82f6,color:#fff
    style TOTAL fill:#ef4444,color:#fff
    style MC fill:#10b981,color:#fff
    style HC fill:#f59e0b,color:#fff
    style TC fill:#8b5cf6,color:#fff
    style OC fill:#ec4899,color:#fff
    style PC fill:#06b6d4,color:#fff
```

**สรุป:** ต้นทุนงาน = วัสดุ (เบิก-คืน) + แรงงาน (ชม. x อัตรา) + เครื่องมือ (ชม. x อัตรา) + ค่าบริหาร (% ของค่าแรง) + **PO ตรง (subcontractor + สั่งพิเศษ)**

---

### Flow 3: รายงานประจำวัน → Timesheet → Payroll

```mermaid
flowchart LR
    A["พนักงาน<br/>กรอก Daily Report<br/>(= timesheet ไปด้วย)"] -->|"Submit"| B["Supervisor<br/>ตรวจ + อนุมัติ"]
    B -->|"Approve"| C["ระบบสร้าง<br/>WO Time Entry<br/>อัตโนมัติ"]
    C --> D["Timesheet<br/>รวมชั่วโมงต่อ WO"]
    D -->|"HR Final<br/>(Optional)"| E["HR ยืนยัน<br/>(Final Approve)<br/>config per org"]
    E --> F["ระบบคำนวณ<br/>ManHour Cost<br/>เข้า WO"]
    E --> G["Payroll<br/>สรุปเงินเดือน"]

    style A fill:#3b82f6,color:#fff
    style B fill:#f59e0b,color:#fff
    style E fill:#ef4444,color:#fff
    style F fill:#10b981,color:#fff
    style G fill:#8b5cf6,color:#fff
```

**สรุป:** พนักงานกรอก Daily Report (= timesheet) → หัวหน้าอนุมัติ → สร้าง Timesheet อัตโนมัติ → HR ตรวจ → คำนวณต้นทุนแรงงาน + Payroll

**กฎสำคัญ:** 1 ชั่วโมง = 1 WO (ห้ามซ้อน), กรอกย้อนหลังได้ 7 วัน (เป็นเรื่อง discipline — configurable), OT Factor <= Max Ceiling 🆕

---

### Flow 4: ใบเบิกของ (Stock Withdrawal Slip)

```mermaid
flowchart LR
    A["เจ้าหน้าที่ Store<br/>สร้างใบเบิก<br/>(หลายรายการ)"] -->|"บันทึก"| B["DRAFT<br/>(แก้ไขได้)"]
    B -->|"Submit"| C["PENDING<br/>(พร้อมจ่าย)"]
    C -->|"Print"| D["พิมพ์ใบเบิก<br/>เตรียมของ<br/>(แสดง Site ชัดเจน)"]
    D --> E["คนเบิก<br/>มารับ + เซ็นรับ"]
    E --> F["เจ้าหน้าที่กลับ<br/>กด Issue<br/>ปรับจำนวนจ่ายจริง"]
    F -->|"Issue"| G["ISSUED<br/>ระบบตัด stock<br/>ต่อรายการ"]

    B -.->|"Cancel"| X["CANCELLED"]
    C -.->|"Cancel"| X

    style A fill:#3b82f6,color:#fff
    style C fill:#f59e0b,color:#fff
    style D fill:#8b5cf6,color:#fff
    style G fill:#10b981,color:#fff
    style X fill:#6b7280,color:#fff
```

Hardcopy ใบเบิก/ใบยืมต้องมี reference number ที่ย้อนกลับได้ในระบบ ใบเบิก print ต้อง **แสดง Site/Warehouse ชัดเจน** เพื่อไม่ให้ print ผิด site 🆕

**หมายเหตุ:** ต้องพิจารณาเรื่องเครื่อง print ที่ใช้ในแต่ละ site — ให้ระบบรองรับ print ผ่าน browser ได้ (@media print) 🆕
---

### Flow 5: การเคลื่อนไหวสต็อก (8 ประเภท) 🆕

```mermaid
flowchart TB
    subgraph "Stock เพิ่ม (+)"
        R["RECEIVE<br/>รับเข้า<br/>(จาก Stock GR)"]
        RT["RETURN<br/>คืนของจาก WO<br/>(stock เพิ่ม)"]
        AI["ADJUST (INCREASE)<br/>ปรับเพิ่ม<br/>(Owner เท่านั้น)"]
        PR["PRODUCE 🆕<br/>ผลผลิตจาก WO<br/>(FINISHED_GOODS)"]
    end

    subgraph "Stock ลด (-)"
        I["ISSUE<br/>เบิกจ่ายตาม<br/>Cost Center"]
        C["CONSUME<br/>เบิกเข้า WO<br/>(ตัดเป็นต้นทุน)"]
        AD["ADJUST (DECREASE)<br/>ปรับลด<br/>(Owner เท่านั้น)"]
    end

    subgraph "Stock ไม่เปลี่ยน (0)"
        T["TRANSFER<br/>ย้ายตำแหน่ง<br/>(ต้นทาง → ปลายทาง)"]
    end

    STOCK["Product Stock<br/>(on_hand)"]
    R & RT & AI & PR -->|"+qty"| STOCK
    I & C & AD -->|"-qty"| STOCK
    T -->|"0"| STOCK

    style R fill:#10b981,color:#fff
    style RT fill:#10b981,color:#fff
    style AI fill:#10b981,color:#fff
    style PR fill:#10b981,color:#fff
    style I fill:#ef4444,color:#fff
    style C fill:#ef4444,color:#fff
    style AD fill:#ef4444,color:#fff
    style T fill:#3b82f6,color:#fff
```

| ประเภท | ทิศทาง | ต้องระบุ | ใครทำได้ |
|--------|--------|---------|---------|
| RECEIVE | +stock | Product + จำนวน + ราคา | Staff+ |
| RETURN | +stock | Work Order (OPEN) + Product (วัสดุ) | Staff+ |
| **PRODUCE** 🆕 | +stock | Work Order (CLOSED) + FINISHED_GOODS product | ระบบสร้างอัตโนมัติเมื่อ WO ปิด |
| ISSUE | -stock | Cost Center + Product + จำนวน | Staff+ |
| CONSUME | -stock | Work Order (OPEN) + Product (วัสดุ) | Staff+ |
| TRANSFER | 0 | ตำแหน่งต้นทาง + ปลายทาง (ต่างกัน) | Staff+ |
| ADJUST | +/- | ทิศทาง (เพิ่ม/ลด) + Product + จำนวน | **Owner เท่านั้น** |
| REVERSAL | +/- | อ้างอิง movement เดิม | Owner เท่านั้น |

**Owner Decision: Stock ADJUST Request Flow** 🆕
- ADJUST ปัจจุบัน Owner เท่านั้นทำได้ แต่ควรมี **request flow**: Staff/Supervisor ขอ request → Owner approve → execute
- เป็น flow ใหญ่ที่ต้อง implement แยก

หมายเหตุ: Direct GR ไม่สร้าง stock movement — charge WO/CC โดยตรง

---

### Flow 6: Internal Recharge (Cost Allocation — 2 ประเภท) 🆕

**Owner Decision: Internal Recharge มี 2 ประเภท** 🆕

**Type 1: Actual Cost Recharge (= Job Costing ที่มีอยู่แล้ว)**
```mermaid
flowchart LR
    A["แผนกคลัง<br/>ซื้อวัสดุมาเก็บ"] -->|"RECEIVE"| B["Stock เพิ่ม<br/>(charge CC คลัง)"]
    B --> C["แผนกผลิต<br/>เบิกวัสดุ"]
    C -->|"ISSUE/CONSUME"| D["ระบบ charge cost<br/>ไปที่ CC แผนกผลิต"]
    D --> E["Actual Recharge<br/>คลัง → ผลิต<br/>(ต้นทุนจริง)"]

    style A fill:#3b82f6,color:#fff
    style D fill:#ef4444,color:#fff
    style E fill:#8b5cf6,color:#fff
```

**Type 2: Fixed Recharge (Budget-based Monthly Allocation) 🆕**
```mermaid
flowchart LR
    A["Admin กำหนด<br/>Annual Budget<br/>per CC"] --> B["ระบบคำนวณ<br/>Allocation<br/>ตาม headcount"]
    B --> C["Auto-generate<br/>Monthly Recharge<br/>Entry"]
    C --> D["แต่ละแผนก<br/>รับ charge<br/>ตาม allocation"]

    style A fill:#3b82f6,color:#fff
    style B fill:#f59e0b,color:#fff
    style C fill:#10b981,color:#fff
    style D fill:#8b5cf6,color:#fff
```

**ตัวอย่าง Fixed Recharge:** Admin spending 1M/year / 100 employees = 10K/person → Production 50 people = 500K/year = 42K/month

ดูรายละเอียดเพิ่มที่ [C9. Internal Recharge](#c9-internal-recharge-cost-allocation-🆕)

---

## A7. สถานะเอกสาร

### ตารางสรุป 10 ประเภท

| เอกสาร | สถานะที่เป็นไปได้ | ย้อนกลับได้ไหม |
|--------|-----------------|--------------|
| Work Order | DRAFT → OPEN → CLOSED | ไม่ได้ |
| PR (ใบขอซื้อ) | DRAFT → SUBMITTED → APPROVED → PO_CREATED (+ REJECTED / CANCELLED) | REJECTED กลับแก้ไขได้ |
| PO (ใบสั่งซื้อ) | APPROVED → PARTIAL → RECEIVED (+ CANCELLED) | ไม่ได้ |
| SO (ใบสั่งขาย) | DRAFT → SUBMITTED → APPROVED → IN_PROGRESS → COMPLETED (+ REJECTED / CANCELLED) | ไม่ได้ |
| Timesheet | DRAFT → SUBMITTED → APPROVED → FINAL (+ REJECTED) | ไม่ได้ |
| Leave (ใบลา) | PENDING → APPROVED / REJECTED | ไม่ได้ |
| Daily Work Report | DRAFT → SUBMITTED → APPROVED / REJECTED | REJECTED → DRAFT ได้ |
| Withdrawal Slip | DRAFT → PENDING → ISSUED (+ CANCELLED) | ไม่ได้ |
| Tool | AVAILABLE ↔ CHECKED_OUT | สลับได้ |
| Payroll | DRAFT → FINAL | ไม่ได้ |

### State Diagrams (4 เอกสารหลัก)

**Work Order:**
```mermaid
stateDiagram-v2
    [*] --> DRAFT : สร้างใหม่
    DRAFT --> OPEN : กด Open (เริ่มงาน)
    OPEN --> CLOSED : กด Close (ปิดงาน)
    note right of OPEN : เบิกวัสดุ, กรอกชั่วโมง, Check-out เครื่องมือ, สร้าง PR/PO พิเศษ
```

**Purchase Requisition:**
```mermaid
stateDiagram-v2
    [*] --> DRAFT : สร้างใหม่
    DRAFT --> SUBMITTED : Submit (Sourcer เตรียม vendor+price)
    SUBMITTED --> APPROVED : Manager อนุมัติ
    SUBMITTED --> REJECTED : ปฏิเสธ
    APPROVED --> PO_CREATED : แปลงเป็น PO
    DRAFT --> CANCELLED : ยกเลิก
    SUBMITTED --> CANCELLED : ยกเลิก
```

**Withdrawal Slip:**
```mermaid
stateDiagram-v2
    [*] --> DRAFT : สร้างใบเบิก
    DRAFT --> PENDING : Submit (พร้อมจ่าย)
    PENDING --> ISSUED : Issue (จ่ายของ + ตัด stock)
    DRAFT --> CANCELLED : ยกเลิก
    PENDING --> CANCELLED : ยกเลิก
    note right of ISSUED : แก้ไขไม่ได้ — ต้อง Reverse movement
```

**กฎสำคัญ:** กรณีจ่ายของไม่ครบตามที่ขอ — การตัด Stock ต้องตรงตาม **จำนวนที่จ่ายจริง (issued_qty)** ไม่ใช่จำนวนที่ขอ (requested_qty) รวมถึง Cost Recharge ต้องคิดจาก actual ที่จ่ายเท่านั้น

**Timesheet:**
```mermaid
stateDiagram-v2
    [*] --> DRAFT : กรอก Daily Report
    DRAFT --> SUBMITTED : Submit
    SUBMITTED --> APPROVED : Supervisor อนุมัติ
    APPROVED --> FINAL : HR Final Approve
    note right of FINAL : คำนวณต้นทุนแรงงาน + เข้า Payroll
```

---

## A8. แผนที่หน้าจอ + ภาพร่าง

### Sidebar — 3 กลุ่ม (ปรับตาม Department Template)

**กลุ่ม 1: ของฉัน (ME)**

| เมนู | Route | แท็บย่อย |
|------|-------|---------|
| ของฉัน | /me | รายงานประจำวัน, ใบลา, Timesheet, งานของฉัน, Payslip (ใหม่), ข้อมูลส่วนตัว (ใหม่) |

**กลุ่ม 2: อนุมัติ**

| เมนู | Route | แท็บย่อย |
|------|-------|---------|
| อนุมัติ | /approval | รายงาน(N), PR(N), Timesheet(N), ลา(N), PO(N), SO(N) |

**กลุ่ม 3: ระบบงาน** (ลำดับปรับตาม Department Template)

| เมนู | Route | แท็บย่อย |
|------|-------|---------|
| Dashboard | / | stat cards + recent activity |
| Supply Chain | /supply-chain | Inventory, Stock Movements, Warehouse, Locations, เครื่องมือ, ใบเบิกของ |
| Work Orders | /work-orders | list + detail page |
| Purchasing | /purchasing | ใบขอซื้อ (PR), ใบสั่งซื้อ (PO) |
| Sales | /sales | list + detail page |
| HR | /hr | พนักงาน, Timesheet, Standard Timesheet, ลาหยุด, โควต้าลา, Payroll, ตารางกะ, อนุมัติรายงาน |
| Customer | /customers | list |
| Planning | /planning | Daily Plan (14-day view), Reservation |
| Master Data | /master | แผนก, Cost Center, Cost Element, ประเภท OT, ประเภทลา, ประเภทกะ, ตารางกะ, ซัพพลายเออร์ |
| Finance | /finance | summary report |
| Admin | /admin | Roles, Users, Audit Log, Org Config, **Dept Menu Template (ใหม่)** |

**Detail Pages:**

| หน้า | Route | เข้าจาก |
|------|-------|---------|
| Work Order Detail | /work-orders/:id | รายการ WO |
| PR Detail | /purchasing/pr/:id | รายการ PR |
| PO Detail | /purchasing/po/:id | รายการ PO |
| SO Detail | /sales/:id | รายการ SO |
| Withdrawal Slip Detail | /withdrawal-slips/:id | รายการใบเบิก |

### ภาพร่างหน้าจอหลัก

**Dashboard:**
```
┌─────────────────────────────────────────────────────────┐
│  SSS Corp ERP                          [User] [Logout]  │
├────────┬────────────────────────────────────────────────┤
│  MENU  │  Dashboard                                     │
│        │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ ของฉัน  │  │ WO เปิด   │ │ PR รอ    │ │ Stock    │       │
│ อนุมัติ  │  │    12     │ │ อนุมัติ 3  │ │ ต่ำ  5  │       │
│        │  └──────────┘ └──────────┘ └──────────┘       │
│ ระบบงาน │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ ★ pinned│  │ PO รอรับ  │ │ Timesheet│ │ ใบเบิก   │       │
│ Dashboard│ │ ของ  4   │ │ รอ  8   │ │ PENDING 2│       │
│ Supply..│  └──────────┘ └──────────┘ └──────────┘       │
│ Work O..│  [ตาราง: รายการล่าสุด / กิจกรรมวันนี้]          │
│ ...     │                                               │
└────────┴────────────────────────────────────────────────┘
```

**Work Order Detail (อัปเดต: 5 cost components):**
```
┌────────────────────────────────────────────────────────┐
│  ← Work Order: WO-2026-0015          [StatusBadge:OPEN]│
│  ┌─ ข้อมูลทั่วไป ───────────────────────────────┐       │
│  │ เลขที่: WO-2026-0015    ลูกค้า: ABC Co.       │       │
│  │ ชื่องาน: ผลิตชิ้นส่วน A   Cost Center: ผลิต-1   │       │
│  └──────────────────────────────────────────────┘       │
│  ┌─ สรุปต้นทุน (5 ส่วน) ──────────────────────────┐     │
│  │ ค่าวัสดุ:      15,000    ค่าแรง:    42,500      │     │
│  │ ค่าเครื่องมือ:   3,200    ค่าบริหาร:  8,500      │     │
│  │ ค่า PO ตรง:   12,000                           │     │
│  │                       รวม:  81,200 บาท          │     │
│  └──────────────────────────────────────────────┘       │
│  ┌─ วัสดุที่เบิก ─────────────────────────────────┐      │
│  │ [เบิกวัสดุ (ปุ่มใหญ่)]  [คืนวัสดุ (ปุ่มใหญ่)]    │      │
│  │ วันที่ | สินค้า  | ประเภท  | จำนวน | ต้นทุน       │      │
│  │ 01/03 | เหล็ก  | CONSUME | 50   | 7,500       │      │
│  │ 02/03 | เหล็ก  | RETURN  | -5   | -750        │      │
│  └──────────────────────────────────────────────┘      │
│  ┌─ PO ที่อ้างอิง WO ──────────────────────────────┐    │
│  │ PO-0012 | ผู้รับเหมาช่วง XYZ | 12,000 | RECEIVED│    │
│  └──────────────────────────────────────────────┘      │
│  [กดปิดงาน]                                            │
└────────────────────────────────────────────────────────┘
```

---

## A9. ระบบสิทธิ์

### 5 บทบาทในระบบ

| บทบาท | คำอธิบาย | จำนวนสิทธิ์ | ขอบเขตข้อมูล |
|--------|---------|-----------|-------------|
| **Owner** | เจ้าของ/Admin | 133 (ทั้งหมด) | ทั้งองค์กร |
| **Manager** | ผู้จัดการ | ~81 | ทั้งองค์กร |
| **Supervisor** | หัวหน้างาน | ~65 | ทั้งแผนก |
| **Staff** | พนักงาน | ~39 | ของตัวเอง |
| **Viewer** | ผู้ดูข้อมูล | ~26 | ทั้งองค์กร |

### สิทธิ์ต่อ Module

| Module | Owner | Manager | Supervisor | Staff | Viewer |
|--------|:-----:|:-------:|:----------:|:-----:|:------:|
| Inventory (สินค้า) | CRUD+Export | CRU+Export | CRU+Export | R | R+Export |
| Stock Movement | CRD+Export | CR+Export | CR+Export | CR+Export | R |
| Withdrawal (ใบเบิก) | CRUD+Approve+Export | CR+Approve+Export | CR+Approve+Export | CR | R+Export |
| Warehouse (คลัง) | CRUD | CRU | CRU | CR | R |
| Work Order | CRUD+Approve+Export | CRU+Approve+Export | CRU+Approve+Export | CRU+Export | R |
| Planning (แผนงาน) | CRUD | CRU | R | R | R |
| Purchasing PR | CRUD+Approve | CRU+Approve | CRU+Approve | CR | R |
| Purchasing PO | CRUD+Approve+Export | CRU+Approve | CRU+Approve | CR | R+Export |
| Sales (ขาย) | CRUD+Approve+Export | CRU+Approve+Export | CRU+Approve+Export | CR | R+Export |
| HR (บุคคล) | Full | Most | Dept scope | Own data | - |
| Tools (เครื่องมือ) | CRUD+Execute+Export | CRU+Execute+Export | CRU+Execute+Export | R+Execute | R+Export |
| Master Data | CRUD | CRU | CRU | R | R |
| Customer | CRUD+Export | CRU+Export | CRU+Export | R | R+Export |
| Finance | R+Export | R | R | R | R |
| Admin | Full | - | - | - | - |

*C=Create, R=Read, U=Update, D=Delete*

### ขอบเขตข้อมูลตามบทบาท (Data Scope)

```mermaid
graph TB
    subgraph "Owner / Manager"
        ALL["เห็นข้อมูลทั้งองค์กร"]
    end
    subgraph "Supervisor"
        DEPT["เห็นข้อมูลทั้งแผนก"]
    end
    subgraph "Staff"
        OWN["เห็นเฉพาะข้อมูลตัวเอง"]
    end
    ALL --> DEPT --> OWN
    style ALL fill:#10b981,color:#fff
    style DEPT fill:#8b5cf6,color:#fff
    style OWN fill:#06b6d4,color:#fff
```

| ข้อมูล | Staff | Supervisor | Manager/Owner |
|--------|-------|------------|---------------|
| Timesheet, ใบลา, รายงานประจำวัน | ของตัวเอง | ทั้งแผนก | ทั้งองค์กร |
| พนักงาน | ไม่มีสิทธิ์ | ทั้งแผนก | ทั้งองค์กร |
| ใบขอซื้อ (PR) | ของตัวเอง | ทั้งแผนก | ทั้งองค์กร |
| Payslip (ใหม่) | ของตัวเอง | ไม่มีสิทธิ์ | ทั้งองค์กร |
| Inventory, WO, อื่นๆ | ทั้งองค์กร | ทั้งองค์กร | ทั้งองค์กร |
| Payroll, Finance | ไม่มีสิทธิ์ | ไม่มีสิทธิ์ | ทั้งองค์กร |

---

## A10. กฎธุรกิจสำคัญ

กฎที่ระบบบังคับใช้อัตโนมัติ — 88+ ข้อ สรุปเป็นภาษาคน:

### สต็อก (Inventory)

| กฎ | อธิบาย |
|-----|--------|
| ห้ามติดลบ | จำนวนสินค้าในสต็อกต้อง >= 0 เสมอ |
| เบิกไม่เกิน | เบิกหรือจ่ายสินค้าได้ไม่เกินจำนวนที่มี (ทั้ง product level และ location level) |
| ห้ามแก้ movement | การเคลื่อนไหว stock แก้ไขไม่ได้ ต้องทำ Reversal |
| SKU ห้ามซ้ำ | รหัสสินค้าต้องไม่ซ้ำกัน ถ้ามี movement แล้วห้ามเปลี่ยน |
| SERVICE ไม่มี stock | สินค้าประเภท SERVICE ไม่นับ stock, ห้ามสร้าง movement |
| Stock ต่ำ | ถ้า on_hand <= min_stock → แจ้งเตือน (แถวเหลือง + นับบน stat card) |
| ราคาวัสดุ | สินค้าประเภท MATERIAL ต้องมีราคา >= 1.00 บาท |
| SPAREPART (ใหม่) | ประเภทสินค้าใหม่สำหรับอะไหล่สำคัญ — มี stock เหมือน MATERIAL |
| **FINISHED_GOODS (ใหม่)** 🆕 | ประเภทสินค้าสำเร็จรูป — ผลผลิตจาก WO, PRODUCE movement เข้า stock |
| **PRODUCE movement** 🆕 | WO ปิดงาน → ระบบสร้าง PRODUCE → FINISHED_GOODS เข้า stock ที่ Actual Cost |

### ใบสั่งงาน (Work Order)

| กฎ | อธิบาย |
|-----|--------|
| สถานะไปข้างหน้าเท่านั้น | DRAFT → OPEN → CLOSED ห้ามย้อนกลับ |
| ปิดงานต้องมีสิทธิ์ | ต้องเป็น Supervisor+ ถึงปิด WO ได้ |
| ลบได้เฉพาะ DRAFT | ลบ WO ได้เฉพาะสถานะ DRAFT + ไม่มี movement + เจ้าของเท่านั้น |
| เบิกวัสดุต้อง WO เปิด | CONSUME/RETURN ได้เฉพาะ WO ที่สถานะ OPEN |
| เบิกได้เฉพาะวัสดุ | CONSUME/RETURN ได้เฉพาะ MATERIAL, CONSUMABLE, SPAREPART |
| ต้นทุนรวม 5 ส่วน (ใหม่) | Material + ManHour + Tools Recharge + Admin Overhead + Direct PO Cost |
| ค่าวัสดุ = เบิก - คืน | Material Cost = CONSUME - RETURN (ต่ำสุด = 0) |
| WO trigger PO (ใหม่) | WO สามารถ trigger PR/PO สำหรับ direct purchase |
| **WO Output Product** 🆕 | WO กำหนด output product (FINISHED_GOODS) + planned_qty + actual_qty |
| **PRODUCE movement** 🆕 | WO ปิดงาน → auto PRODUCE movement → FINISHED_GOODS เข้า stock |
| **Actual Costing** 🆕 | Unit Cost = Total WO Cost / actual_qty |

### เบิกของ (Stock Movement — 8 ประเภท) 🆕

| กฎ | อธิบาย |
|-----|--------|
| CONSUME ต้องมี WO | ต้องระบุ Work Order ที่สถานะ OPEN |
| RETURN ต้องมี WO | ต้องระบุ Work Order ที่สถานะ OPEN |
| ISSUE ต้องมี Cost Center | ต้องระบุ Cost Center ที่ active |
| TRANSFER ต้องคนละที่ | ต้องมีตำแหน่งต้นทาง + ปลายทาง และต้องต่างกัน |
| TRANSFER stock คงที่ | ต้นทาง -qty, ปลายทาง +qty, จำนวนรวมไม่เปลี่ยน |
| ADJUST Owner เท่านั้น | เฉพาะ Owner ปรับ stock ได้ (เพิ่ม/ลด) |
| **PRODUCE ต้องมี WO (CLOSED)** 🆕 | ระบบสร้างอัตโนมัติเมื่อ WO ปิด, product ต้องเป็น FINISHED_GOODS |
| **ADJUST Request Flow** 🆕 | Staff/Supervisor ขอ request → Owner approve → execute (flow ใหญ่) |

### ใบเบิกของ (Withdrawal Slip)

| กฎ | อธิบาย |
|-----|--------|
| สถานะ: DRAFT → PENDING → ISSUED | ห้ามย้อน, Cancel ได้จาก DRAFT/PENDING |
| จ่ายน้อยกว่าขอได้ | issued_qty สามารถ < quantity |
| WO ต้อง OPEN | ถ้าเบิกเข้า WO, WO ต้องสถานะ OPEN ตอน Issue |
| ห้ามสินค้า SERVICE | ทุกรายการต้องเป็น MATERIAL, CONSUMABLE หรือ SPAREPART |
| ISSUED แก้ไม่ได้ | ถ้าผิดต้อง Reverse movement ทีละรายการ |
| Hardcopy traceability (ใหม่) | หมายเลขใบเบิก hardcopy ต้องบันทึกในระบบ ย้อนกลับได้ |

### ชั่วโมงทำงาน (Timesheet)

| กฎ | อธิบาย |
|-----|--------|
| 1 ชั่วโมง = 1 งาน | ชั่วโมงเดียวกันกรอกให้ WO ได้แค่ 1 ใบ (ห้ามซ้อน) |
| กรอกย้อนหลังได้ถึงรอบที่ยังไม่ตัด 🆕 | ย้อนหลังไม่เกินเดือนที่ตัดรอบแล้ว (เช่น ตัดรอบสิ้นเดือน → เดือนก่อนแก้ไม่ได้) HR ปลดล็อคได้ |
| ชั่วโมงไม่เกินวัน | ชั่วโมงรวมต่อวัน <= ชั่วโมงทำงานปกติของวันนั้น |
| หัวหน้ากรอกแทนได้ | ถ้าพนักงานไม่กรอก Supervisor กรอกแทนได้ |
| 3 ขั้นอนุมัติ | กรอก → Supervisor อนุมัติ → HR Final (ก่อนเข้า Payroll) |
| OT Factor ห้ามเกิน Ceiling | OT Factor พิเศษต้อง <= ค่าสูงสุดที่ Admin กำหนด |
| Daily Report = Timesheet (ใหม่) | ใช้ Daily Report บันทึก timesheet ไปพร้อมกัน |
| **Timesheet ไม่บังคับ** 🆕 | เป็น department discipline policy — config ต่อ department (mandatory/optional) |
| **Payroll loose coupling** 🆕 | Payroll คำนวณ base salary โดยไม่พึ่ง timesheet, ถ้ามี timesheet เสริม OT/deduction |
| **HR Final = Optional** 🆕 | Config `hr_final_required` per org: true = ต้องผ่าน HR Final, false = Supervisor approve แล้วเข้า Payroll |

### ลางาน (Leave)

| กฎ | อธิบาย |
|-----|--------|
| ลาเกินโควต้าไม่ได้ | จำนวนวันลาใช้ + ขอลาใหม่ <= โควต้า |
| ลาได้เงิน = 8 ชม. | วันลาที่ได้เงิน → Timesheet คิด 8 ชม. ปกติ |
| ลาไม่ได้เงิน = 0 ชม. | วันลาไม่ได้เงิน → Timesheet คิด 0 ชม. (หัก payroll) |
| วันลาห้ามกรอก WO | วันที่ลา ห้ามกรอกชั่วโมงให้ Work Order |

### เครื่องมือ (Tools)

| กฎ | อธิบาย |
|-----|--------|
| 1 คน ต่อ 1 เครื่อง | เครื่องมือถูก checkout ได้ 1 คน ณ เวลาเดียว |
| คิดเงินตอน check-in | ค่าเครื่องมือคำนวณเมื่อคืน (ชั่วโมง x อัตรา) |
| เครื่องมือเสีย → WO ซ่อม (ใหม่) | สร้าง WO เพื่อซ่อม, charge CC ตามตกลง |

### Internal Recharge 🆕

| กฎ | อธิบาย |
|-----|--------|
| **Recharge 2 ประเภท** 🆕 | Type 1: Actual Cost Recharge (Job Costing) + Type 2: Fixed Recharge (Budget-based monthly allocation) |
| **Actual Recharge** 🆕 | track ต้นทุนจริงที่เกิดขึ้นใน WO (= Job Costing ที่มีอยู่) |
| **Fixed Recharge** 🆕 | Budget Planning based — Auto-generate monthly recharge entries ตาม headcount/driver |

### จัดซื้อ (Purchasing)

| กฎ | อธิบาย |
|-----|--------|
| PO ต้องมาจาก PR ก่อน | ห้ามสร้าง PO ตรง ต้องผ่าน PR ก่อนเสมอ |
| 1 PR = 1 PO | แต่ละ PR แปลงเป็น PO ได้ 1 ใบ |
| PR ต้องมี Cost Center | ทุก PR ต้องระบุ Cost Center |
| PR line ต้องมี Cost Element | ทุกรายการใน PR ต้องระบุ Cost Element |
| GOODS ต้องมีสินค้า/คำอธิบาย | รายการ GOODS เลือก SKU หรือ free text |
| SERVICE ต้องมีคำอธิบาย | รายการ SERVICE ต้องกรอกคำอธิบาย |
| GR 2 modes 🆕 | **Mode 1:** Stock GR = สร้าง RECEIVE movement (เข้าสต็อก) / **Mode 2:** Direct GR = ไม่สร้าง movement (charge WO/CC ตรง) **Exit criteria:** ทุก movement immutable + REVERSAL เท่านั้น, Direct GR ไม่ทำให้ stock เพี้ยน (ไม่มี movement แต่ cost ต้องถูก) |
| GR บุคคลที่ 3 (ใหม่) | GR operator ไม่ควรเป็นคนเดียวกับ PR/PO creator (configurable) |
| Track Sourcer (ใหม่) | ระบบต้องบันทึกว่าใครเป็น Sourcer, ใครเป็น Converter |


### การวางแผน (Planning)

| กฎ | อธิบาย |
|-----|--------|
| 1 คน = 1 งาน/วัน | จัดคนเข้างานได้ 1 WO ต่อวัน |
| 1 เครื่องมือ = 1 งาน/วัน | จัดเครื่องมือเข้างานได้ 1 WO ต่อวัน |
| คนลาจัดงานไม่ได้ | วันที่พนักงานลา ห้ามจัดลงงาน |
| จองวัสดุหัก stock | Available = on_hand - จำนวนจองแล้ว |
| จองเครื่องมือห้ามซ้อน | ห้ามจองเครื่องมือซ้อนช่วงวันเดียวกัน |

### ระบบ (Admin)

| กฎ | อธิบาย |
|-----|--------|
| Owner ลดตัวเองไม่ได้ | เจ้าของระบบห้ามลด role ตัวเอง |
| สิทธิ์ต้องอยู่ในรายการ | Permission ต้องอยู่ในรายการที่กำหนด (133 ตัว) |
| Action ต้องถูกต้อง | ต้องเป็น 1 ใน 7: create/read/update/delete/approve/export/execute |
| ทุก query ต้อง filter org | Multi-tenant: ข้อมูลแยกตามองค์กร |
| เงินห้ามใช้ Float | ตัวเลขเงินต้องใช้ Numeric(12,2) เท่านั้น |

---

## A11. ข้อบังคับเด็ดขาด (Hard Constraints)

ข้อบังคับเหล่านี้ต้องรักษาไว้ตลอด ไม่ว่าจะ implement อะไรเพิ่ม:

| # | ข้อบังคับ |
|---|----------|
| 1 | Permission format: `module.resource.action` (3 ส่วนเสมอ) |
| 2 | Stock movements เป็น immutable — แก้ผ่าน REVERSAL เท่านั้น |
| 3 | Financial fields ใช้ Numeric(12,2) — ห้ามใช้ Float |
| 4 | on_hand >= 0 ตลอดเวลา |
| 5 | Multi-tenant: ทุก query ต้องมี org_id filter |
| 6 | Data Scope: HR endpoints ต้อง filter ตาม role |
| 7 | WO Status: DRAFT→OPEN→CLOSED ห้ามย้อน |
| 8 | Timesheet: 1 employee/WO/date = unique (ห้าม overlap) |
| 9 | OT Factor <= Maximum Ceiling ที่ Admin กำหนด |
| 10 | PO ต้องสร้างจาก PR เท่านั้น |
| 11 | Icons: ใช้ Lucide React เท่านั้น — ห้ามใช้ emoji / Ant Design Icons |
| 12 | Token: เก็บใน Zustand (memory) เท่านั้น — ห้าม localStorage |
| 13 | Job Costing = 5 components (Material + ManHour + Tools + Overhead + Direct PO) |
| 14 | Warehouse = 3 levels (Warehouse → Location → Bin) |
| 15 | Product types = 5 (MATERIAL, CONSUMABLE, SPAREPART, **FINISHED_GOODS**, SERVICE) 🆕 |
| 16 | Internal Recharge = 2 types (Actual Job Costing + Fixed Budget Allocation) 🆕 |
| 17 | Stock Movement = 8 types (RECEIVE, ISSUE, CONSUME, RETURN, TRANSFER, ADJUST, REVERSAL, PRODUCE) 🆕 |

---

## A12. Progress Summary

| Phase | ชื่อ | สถานะ |
|-------|------|--------|
| 0 | Foundation | ✅ 100% |
| 1 | Core Modules (Inventory, Master, Warehouse) | ✅ 100% |
| 2 | HR + Job Costing | ✅ 100% |
| 3 | Business Flow + Frontend | ✅ 100% |
| 4 | Organization, Planning & Production | ✅ 100% |
| 5 | Staff Portal & Daily Report | ✅ 100% |
| 6 | Data Scope | ✅ 100% |
| 7 | Approval Center + PR/PO Redesign | ✅ 100% |
| 11 (partial) | Stock-Location, Supplier, QR, Withdrawal | ✅ 100% |
| 8 | Dashboard & Analytics | ❌ ยังไม่เริ่ม |
| 9 | Notification Center | ❌ ยังไม่เริ่ม |
| 10 | Export & Print | ❌ ยังไม่เริ่ม |
| 11 (remaining) | Inventory Enhancement | ❌ ยังไม่เริ่ม |
| 12 | Mobile Responsive | ❌ ยังไม่เริ่ม |
| 13 | Audit & Security | ❌ ยังไม่เริ่ม |
| 14 | AI Performance Monitoring | ❌ ยังไม่เริ่ม |

**สรุป: Core operations ครบ 100% — ต้อง implement feedback จาก Owner (SPAREPART, Bin, Direct PO Cost, Sourcer, GR 2 modes, Dept Menu, Employee Self-service) ก่อน production**

---

# ส่วน B — แผนที่วางไว้แล้ว (Phase 8-14)

---

## B1. Dashboard & Analytics (Phase 8)

เปลี่ยน Dashboard จาก basic stats เป็น KPI dashboard ที่มี charts, trends, และ actionable insights

| Feature | รายละเอียด |
|---------|-----------|
| KPI Dashboard | Stat cards: ยอดขาย, ต้นทุน WO, สถานะ stock, pending approvals |
| Charts | WO Cost Trend, Inventory Turnover, Revenue (Recharts/Ant Charts) |
| Manager Dashboard v2 | Department comparison, cost center breakdown, employee productivity |
| Staff Dashboard v2 | Personal KPIs: WO assigned, hours logged, leave balance |
| Finance Dashboard | P&L summary, cost analysis, budget vs actual |
| Internal Recharge Dashboard (ใหม่) | แสดง cost allocation ระหว่างแผนก |
| Aggregation APIs | Backend endpoints สำหรับ aggregate data |

---

## B2. Notification Center (Phase 9)

ระบบแจ้งเตือน In-app + Email (optional) ลดการ "เข้าไปดู" เอง

| Feature | รายละเอียด |
|---------|-----------|
| Notification Model | user_id, type, title, message, is_read, link |
| Event Triggers | แจ้งเตือนเมื่อ: มีงานรออนุมัติ, สถานะเปลี่ยน, stock ต่ำ |
| Bell Icon | Header dropdown + unread badge count |
| Real-time Push | WebSocket/SSE หรือ polling |
| Email Channel | ส่ง email ควบคู่กับ in-app |
| User Preferences | เลือกได้ว่าจะรับแจ้งเตือนช่องทางไหน |

---

## B3. Export & Print (Phase 10)

PDF generation + Excel export + Print-friendly layouts

| Feature | รายละเอียด |
|---------|-----------|
| PDF Engine | สร้าง PDF จากข้อมูลในระบบ |
| WO Report PDF | Cost summary (5 components), material list, manhour breakdown |
| PO/SO PDF | Document header, line items, totals, approval signatures |
| Payroll PDF / Payslip | Employee payslip — พนักงานดูเองได้ |
| Excel Export | ทุก list page สามารถ export Excel ได้ |
| Print CSS | @media print styles สำหรับหน้าสำคัญ |
| Report Templates | Admin กำหนด header (logo, ที่อยู่บริษัท) |

---

## B4. Inventory Enhancement (Phase 11 — ส่วนที่เหลือ) 🆕

| Feature | รายละเอียด |
|---------|-----------|
| **Serial Number sub-table** | 1 SKU = many SN, track SN per movement |
| **Model field on Product** | เพิ่ม field Model สำหรับค้นหา |
| **SPAREPART product type** | ประเภทสินค้าใหม่สำหรับอะไหล่สำคัญ |
| **Bin level** | Warehouse → Location → Bin (rack position) |
| **Multi-site** | Fixed site + Temporary site, ช่วยคนเบิกระบุ site |
| **Consignment storage** | สินค้าฝากในคลัง — เก็บเข้า stock ปกติ, ห้ามผู้อื่นเบิก (owner-only) 🆕 |
| Stock Aging Report | รายงานมูลค่าสินค้าตามอายุ (0-30, 31-60, 61-90, 90+ วัน) |
| Batch/Lot Tracking | batch_number บน StockMovement, FIFO/LIFO costing |
| Barcode/QR for SKU | Generate barcode สำหรับ SKU + print label |
| Stock Take | Cycle count workflow: count → variance → adjust |
| Multi-warehouse Transfer | TRANSFER ระหว่าง warehouse พร้อม approval |

---

## B5. Mobile Responsive (Phase 12)

| Feature | รายละเอียด |
|---------|-----------|
| Responsive Layout | Ant Design Grid breakpoints, collapsible sidebar |
| Mobile Staff Portal | Daily Report create/edit จากมือถือ |
| Mobile Tool Check-in/out | Simplified form สำหรับ field workers |
| Mobile Approval | Swipe approve/reject |
| PWA | Offline-first สำหรับ read |

---

## B6. Audit & Security (Phase 13)

| Feature | รายละเอียด |
|---------|-----------|
| Enhanced Audit Trail | Model-level event logging (who, what, when, before/after values) |
| Login History | Device, IP, location, timestamp per user |
| Session Management | Active sessions list, remote logout |
| Password Policy | Min length, complexity, expiry, history |
| Two-Factor Auth (2FA) | TOTP (Google Authenticator) |
| Per-user Rate Limiting | Different limits per role |
| Data Export Audit | Log all export/download actions |

---

## B7. AI-Powered Performance Monitoring (Phase 14)

| Feature | รายละเอียด |
|---------|-----------|
| Performance Middleware | Response time tracking, slow request detection |
| DB Query Profiler | Slow query logging, N+1 detection |
| Frontend Performance | Web Vitals (LCP/FID/CLS) |
| AI Analysis Engine | Claude API วิเคราะห์ + แนะนำเป็นภาษาไทย |
| Performance Dashboard | Stat cards + AI card + charts |
| Natural Language Query | ถามเป็นภาษาคน → AI ตอบ |
| Scheduled AI Report | Daily background job + email digest |

---

# ส่วน C — ช่องว่างที่พบ

จากการวิเคราะห์ codebase + feedback จาก Owner พบช่องว่าง 13 รายการ:

| # | Feature | ปัญหาปัจจุบัน | ผลกระทบ |
|---|---------|--------------|---------|
| C1 | **Invoice / Billing** | SO approved แล้วไม่มี Invoice | สูง |
| C2 | **Delivery Order** | SO approved แล้วไม่มีใบส่งของ | สูง |
| C3 | **Accounts Payable** | PO รับของแล้วไม่มี track การจ่ายเงิน | กลาง |
| C4 | **Budget Management** | ไม่มี budget allocation per CC | กลาง |
| C5 | **Tax Calculation (VAT 7%)** | ไม่มีการคำนวณ VAT | สูง |
| C6 | **Multi-currency** | รองรับเฉพาะ THB | ต่ำ |
| C7 | **WO Gantt Chart** | ไม่มี visual timeline → **ทำระดับง่ายก่อน** 🆕 | กลาง |
| C8 | **Employee Self-service** | พนักงานดู payslip/แก้ข้อมูลไม่ได้ | กลาง |
| C9 | **Internal Recharge** 🆕 | ไม่มี cost allocation ข้ามแผนก (2 ประเภท) | สูง |
| C10 | **Maintenance Module** 🆕 | ไม่มีระบบ maintenance scheduling | กลาง |
| C11 | **Multi-Company** 🆕 | ไม่รองรับหลายนิติบุคคล | ต่ำ (อนาคต) |
| C12 | **Quotation Module** 🆕 | ไม่มีระบบใบเสนอราคา | กลาง |
| C13 | **Fixed Asset / Depreciation** 🆕 | ไม่มีระบบสินทรัพย์ถาวร + ค่าเสื่อม | กลาง |

---

## C1. Invoice / Billing (ใบแจ้งหนี้)

**ปัญหา:** SO ที่ approved แล้ว ไม่มีทางสร้าง Invoice — ขาด revenue tracking ทั้งหมด

| Feature | รายละเอียด |
|---------|-----------|
| Invoice จาก SO | สร้าง Invoice จาก Sales Order ที่ approved |
| Invoice Status | DRAFT → SENT → PAID → CANCELLED |
| Payment Tracking | บันทึกการชำระเงิน (partial/full) |
| Accounts Receivable | ลูกหนี้การค้า — ยอดค้างชำระ per customer |

---

## C2. Delivery Order (ใบส่งของ)

**ปัญหา:** SO ที่ approved แล้ว ไม่มีทางสร้างใบส่งของ

| Feature | รายละเอียด |
|---------|-----------|
| DO จาก SO | สร้าง Delivery Order จาก SO |
| DO Status | DRAFT → SHIPPED → DELIVERED |
| Stock Deduction | ตัด stock เมื่อ ship |

---

## C3. Accounts Payable (เจ้าหนี้การค้า)

**ปัญหา:** PO ที่รับของแล้ว ไม่มีที่ track ว่าจ่ายเงินแล้วหรือยัง

| Feature | รายละเอียด |
|---------|-----------|
| Payment Record | บันทึกการจ่ายเงินต่อ PO |
| AP Aging | รายงานเจ้าหนี้ตามอายุ |
| Payment Status on PO | UNPAID → PARTIAL → PAID |

---

## C4. Budget Management (งบประมาณ)

| Feature | รายละเอียด |
|---------|-----------|
| Budget per Cost Center | กำหนดงบประมาณต่อ Cost Center ต่อปี/ไตรมาส |
| Budget vs Actual | เปรียบเทียบงบกับค่าใช้จ่ายจริง |
| Budget Alert | แจ้งเตือนเมื่อใช้งบเกิน threshold |

---

## C5. Tax Calculation (ภาษี)

| Feature | รายละเอียด |
|---------|-----------|
| VAT 7% | คำนวณ VAT อัตโนมัติบน PO, SO, Invoice |
| Tax Report | รายงานภาษีซื้อ-ภาษีขาย |
| Withholding Tax | หัก ณ ที่จ่าย |

---

## C6. Multi-currency (หลายสกุลเงิน)

| Feature | รายละเอียด |
|---------|-----------|
| Currency Master | สกุลเงิน + อัตราแลกเปลี่ยน |
| PO/SO Currency | เลือกสกุลเงินต่อ document |
| Auto Convert | แปลงเป็น THB ตามอัตราแลกเปลี่ยน |

---

## C7. WO Gantt Chart / Visual Timeline

**Owner Decision: Gantt ระดับง่ายก่อน** 🆕

| ระดับ | Feature | สถานะ |
|-------|---------|-------|
| **ง่าย (ทำก่อน)** | แท่ง WO timeline (planned_start → planned_end) + สีตาม status | 🆕 ยืนยัน |
| กลาง (ทีหลัง) | + แสดงคนทำ + conflict highlight | อนาคต |
| **ยาก (เป้าหมาย)** | + Drag & Drop + dependency → **MS Project-like** | อนาคต — ถ้า endpoint รองรับและไม่กระทบระบบ 🆕 |

---

## C8. Employee Self-service 🆕

**Owner Decision:** ยืนยันแล้ว — พนักงานต้องทำได้

| Feature | รายละเอียด | สถานะ |
|---------|-----------|--------|
| View Payslip | ดู payslip ของตัวเอง | **ยืนยันแล้ว** |
| Edit Profile | แก้ไขข้อมูลส่วนตัว (เบอร์โทร, ที่อยู่) | **ยืนยันแล้ว** |
| Change Password | เปลี่ยนรหัสผ่านเอง | ต้องทำ |

---

## C9. Internal Recharge (Cost Allocation) 🆕

**Owner Decision: Internal Recharge มี 2 ประเภท** 🆕

### Type 1: Actual Cost Recharge (= Job Costing ที่มีอยู่แล้ว)

Track ต้นทุนจริงที่เกิดขึ้นใน WO — ระบบ Job Costing ปัจจุบันทำหน้าที่นี้อยู่แล้ว

**ตัวอย่าง:**
- แผนกคลังซื้อวัสดุมาเก็บ (charge CC คลัง)
- แผนกผลิตเบิกวัสดุ → ระบบ charge cost ไปที่ CC แผนกผลิต (CONSUME/ISSUE movement)
- ผลลัพธ์: เห็นต้นทุนจริงที่แต่ละแผนกใช้

### Type 2: Fixed Recharge (Budget-based Monthly Allocation) 🆕

ค่าใช้จ่ายส่วนกลางที่ไม่สามารถ track per-transaction ได้ → จัดสรรตาม budget

**ตัวอย่าง:**
- Admin spending 1,000,000 บาท/ปี (ค่าน้ำ ค่าไฟ ค่าเช่าอาคาร)
- องค์กรมี 100 คน → 10,000 บาท/คน/ปี
- แผนกผลิต 50 คน = 500,000 บาท/ปี = **41,667 บาท/เดือน**
- ระบบ auto-generate monthly recharge entry ให้แต่ละแผนก

| Feature | รายละเอียด |
|---------|-----------|
| **Type 1: Actual Recharge** | = Job Costing ที่มีอยู่ — track ต้นทุนจริง per movement/WO |
| **Type 2: Fixed Recharge** 🆕 | Budget Planning based — annual budget per CC → monthly allocation |
| Budget Setup | Admin กำหนด annual budget per CC (Central Admin CC สำหรับค่าใช้จ่ายส่วนกลาง) |
| Allocation Driver | คำนวณ allocation ตาม headcount (or other driver ในอนาคต) |
| Auto-generate | ระบบสร้าง monthly recharge entries อัตโนมัติ |
| Department Cost Report | แสดง cost per department: Actual + Fixed allocation |
| Internal Invoice (optional) | สร้างเอกสาร recharge ภายใน (ไม่ใช่ tax invoice) |
| Dashboard Integration | รวมใน Management Accounting dashboard |
| **ผู้รับผิดชอบ** 🆕 | แผนก Admin/บัญชี เป็นผู้ดูแล Internal Recharge |

**ลักษณะสำคัญ:**
- ทั้ง 2 ประเภท **coexist** กัน — ใช้สำหรับวัตถุประสงค์ต่างกัน
- เป็น **ตัวเลขภายใน** (internal numbers) ไม่ผูกพันทางกฎหมาย
- แยกจาก Financial Accounting (เงินจริงเข้า-ออก)
- ใช้ Cost Center เป็นหลัก — track ว่า CC ไหน produce/consume อะไร
- **Central Admin CC** สำหรับค่าใช้จ่ายส่วนกลาง (ค่าน้ำ ค่าไฟ ค่าเช่า) 🆕

**ความแตกต่าง: Management Accounting vs Financial Accounting**

| ด้าน | Management Accounting | Financial Accounting |
|------|----------------------|---------------------|
| วัตถุประสงค์ | ดูต้นทุนภายใน, ประสิทธิภาพ | จ่ายเงินจริง, ภาษี, กฎหมาย |
| ขอบเขต | Per CC, per dept, internal recharge (Actual + Fixed) | AP/AR, VAT, cash flow |
| ผูกพัน | ไม่ผูกพันทางกฎหมาย | ผูกพันทางกฎหมาย |
| ใครดู | Manager, Owner | Owner, นักบัญชี |
| ระบบปัจจุบัน | Job Costing (Actual Recharge) | Finance Report (basic) |

---

## C10. Maintenance Module 🆕

**Owner Decision:** Maintenance scheduling ควรเป็น module แยกต่างหาก

| Feature | รายละเอียด |
|---------|-----------|
| Maintenance Schedule | กำหนดตาราง maintenance ตามเวลา/ชั่วโมงใช้งาน |
| Maintenance WO | สร้าง WO สำหรับซ่อม/บำรุงรักษา |
| Broken Tool → WO | เครื่องมือเสีย → auto สร้าง WO ซ่อม |
| Cost Allocation | charge CC ตามตกลงระหว่างผู้ยืมกับคลัง |
| Alert System | แจ้งเตือนเมื่อถึงกำหนด maintenance |
| History Tracking | ประวัติการซ่อม/บำรุงรักษาต่อเครื่องมือ |

---

## C11. Multi-Company 🆕

**Owner Decision:** ต้องพิจารณาในอนาคต — ต้องมีผู้เชี่ยวชาญบัญชี

**สถานการณ์:** หลายนิติบุคคลอยู่ใน physical site เดียวกัน ใช้ resources ร่วมกัน

| Feature | รายละเอียด |
|---------|-----------|
| Company Entity | หลาย legal entity ใน site เดียว |
| Inter-company Invoice | ออก invoice ข้ามบริษัท — ใช้ Fixed Internal Recharge เป็นฐาน 🆕 |
| Transfer Pricing | กำหนดราคาโอนระหว่างบริษัท |
| Shared Resources | ใช้คลัง/เครื่องมือ/พนักงานร่วมกัน |
| Accounting Separation | แยกบัญชีตามนิติบุคคล |
| **Monthly Reconciliation** 🆕 | CC คนละ Company → ดึงข้อมูลมาสรุปทุกเดือน → reconcile ระหว่างบริษัท |

**Owner Decision: Cross-Company CC Reconciliation** 🆕 กรณี Cost Center อยู่คนละ Company — ต้องมีกระบวนการดึงข้อมูลต้นทุนข้าม company มาสรุปทุกเดือน แล้ว reconcile ให้ตรงกัน (เชื่อมกับ Fixed Internal Recharge ใน C9)

**หมายเหตุ:** สถาปัตยกรรมปัจจุบัน (org_id, cost center) ไม่ปิดกั้นการขยายในอนาคต แต่ต้องวางแผนร่วมกับผู้เชี่ยวชาญบัญชี

---

## C12. Quotation Module (ใบเสนอราคา) 🆕

**Owner Decision:** ต้องมีระบบ QT — ไม่เร่งด่วนแต่ต้องมี

| Feature | รายละเอียด |
|---------|-----------|
| QT CRUD | สร้าง/แก้ไข/ลบ ใบเสนอราคา |
| QT → SO (optional) | แปลงเป็น SO ได้ แต่ไม่บังคับ |
| Confidentiality | เฉพาะผู้เกี่ยวข้อง + Owner เท่านั้นดูได้ |
| Win/Loss Tracking | เก็บประวัติ ได้งาน/ไม่ได้งาน + เหตุผล |
| Price Comparison | ราคาเสนอ vs ราคาขายจริง — track ย้อนหลัง |
| Cost Estimation | ประเมินต้นทุนต่อ item + breakdown + margin |
| QT Template/Draft | แบบฟอร์มร่างใบเสนอราคา |
| Bid Knowledge Base | งานประมูล = ศิลปะ ไว้คนรุ่นหลังศึกษา (โดยเฉพาะ Service/ก่อสร้าง) |

**หมายเหตุ:** QT Form/perfect module ไม่เร่งด่วน — ออกแบบ basic ก่อน แล้วพัฒนาต่อ

---

## C13. Fixed Asset / Depreciation (สินทรัพย์ถาวร) 🆕

**Owner Decision:** Asset บางอย่างไม่ใช่ tool แต่มีค่าเสื่อมตามกฎหมาย — ต้องพิจารณา

| Feature | รายละเอียด |
|---------|-----------|
| Asset Register | ทะเบียนสินทรัพย์ถาวร (เครื่องจักร อาคาร ยานพาหนะ) |
| Depreciation Calculation | คำนวณค่าเสื่อมตามกฎหมายบัญชี (สูตรเส้นตรง/ลดลง) |
| Asset Lifecycle | ซื้อ → ใช้งาน → ซ่อม → จำหน่าย |
| Link to Tools | เครื่องมือที่เป็น asset → คำนวณค่าเสื่อมด้วย |
| Legal Compliance | รายงานสินทรัพย์ตามกฎหมายบัญชี |

---

# ส่วน D — ลำดับความสำคัญที่แนะนำ

ปรับลำดับตาม feedback รอบ 2 จาก Owner: 🆕

| ลำดับ | Feature | เหตุผล |
|-------|---------|--------|
| 1 | **🔒 Go-Live Gate (D1)** | 7 features + Engineering fixes — **scope freeze จนกว่าจะเสร็จ** (ดู D1 detail ด้านล่าง) |
| 2 | **Export & Print (B3)** | ผู้ใช้ต้องการ print PO/SO/Payslip ทุกวัน — เป็น daily need |
| 3 | **Cross-cutting UX Fix (A5)** | แก้ Select limit:500, error handling, ปุ่มเบิก/คืนเล็ก, loading states, **Role Management redesign** 🆕 |
| 4 | **Internal Recharge (C9)** | Owner ให้ความสำคัญกับ cost visibility ระหว่างแผนก — **2 ประเภท (Actual + Fixed)** 🆕 |
| 5 | **Tax Calculation (C5)** | VAT 7% จำเป็นก่อน production |
| 6 | **Dashboard & Analytics (B1)** | มีข้อมูลครบแล้ว ยังไม่มี visualization |
| 7 | **Notification Center (B2)** | ลดการ "เข้าไปดู" ว่ามีอะไรรอ |
| 8 | **Invoice/Billing (C1) + Delivery Order (C2)** | ปิด revenue cycle (SO → DO → Invoice → Payment) |
| 9 | **Quotation Module (C12)** 🆕 | Owner ยืนยันต้องมี — ไม่เร่งด่วนแต่ต้องมี |
| 10 | **Maintenance Module (C10)** | Owner ยืนยันว่าต้องมี |
| 11 | **Inventory Enhancement (B4)** | SN sub-table, Bin, Multi-site, Consignment (stock ปกติ + owner-only) 🆕 |
| 12 | **Fixed Asset / Depreciation (C13)** 🆕 | สินทรัพย์ถาวร + ค่าเสื่อมตามกฎหมาย |
| 13 | **Mobile Responsive (B5)** | Staff ต้องกรอก Daily Report จากหน้างาน |
| 14 | **Security (B6)** | สำคัญก่อน production scale |
| 15 | **Multi-Company (C11)** | อนาคต — ต้องมีผู้เชี่ยวชาญ |
| 16 | **AI Performance (B7)** | Nice-to-have, ทำทีหลังได้ |

---

## D1 Detail: Go-Live Gate 🆕

> **Scope Freeze:** ห้ามเพิ่ม feature อื่นจนกว่า 7 features + engineering fixes ด้านล่างจะเสร็จ
> **Owner Sign-off:** ห้าม deploy production จนกว่า P'Hot จะ approve ทุก gate item

### 7 Go-Live Features

| # | Feature | รายละเอียด | Exit Criteria |
|---|---------|-----------|---------------|
| G1 | **SPAREPART** | product_type enum เพิ่มค่า + min_stock logic | สร้าง/ค้นหา SPAREPART product ได้ + low stock alert ทำงาน |
| G2 | **Bin (3-level warehouse)** | เพิ่ม `bins` table (Warehouse → Location → Bin) | RECEIVE/ISSUE/CONSUME ระบุ Bin ได้ + stock_by_bin ถูกต้อง |
| G3 | **Direct PO Cost** | GR mode 2 (Direct GR) + cost เข้า WO/CC | PO charge WO ได้ + WO Cost Summary แสดง 5 components |
| G4 | **Sourcer Tracking** | `PR.sourcer_id` FK → User | ดูได้ว่าใครจัดหา + report per sourcer |
| G5 | **GR 2 Modes** | Stock GR vs Direct GR (ดู spec ด้านล่าง) | ทั้ง 2 mode ทำงาน + audit ครบ + reversal ได้ |
| G6 | **Dept Menu Template** | Admin กำหนด menu template per department | แต่ละแผนกเห็น menu ต่างกัน + permission filter ยังทำงาน |
| G7 | **Self-service MVP** | Payslip view + Profile edit | พนักงานดู payslip + แก้เบอร์โทร/ที่อยู่ได้ |

### GR 2 Modes — Spec เปรียบเทียบ 🆕

| | Stock GR (Mode 1) | Direct GR (Mode 2) |
|---|-------------------|---------------------|
| **ใช้เมื่อ** | ซื้อของเข้าคลัง (MATERIAL, CONSUMABLE, SPAREPART) | ซื้อ service หรือของส่งตรงหน้างาน |
| **Stock Movement** | สร้าง RECEIVE → on_hand เพิ่ม | **ไม่สร้าง movement** → stock ไม่เปลี่ยน |
| **Cost Allocation** | Cost เข้า product (weighted avg) | Cost เข้า WO หรือ CC โดยตรง (= Direct PO Cost) |
| **Audit Trail** | movement record + GR timestamp + location | PO record + GR confirm timestamp + cost allocation record |
| **Reversal** | REVERSAL movement (ลด stock + reverse cost) | Reverse cost allocation (stock ไม่กระทบเพราะไม่เคยเข้า) |
| **UI** | เลือก Warehouse/Location/Bin + qty | ยืนยันรับงาน/ของ + ระบุ WO หรือ CC ปลายทาง |

### Direct PO Cost — Job Costing Component ที่ 5 🆕

```
WO Total Cost (5 components)
├── Material Cost       = Σ(CONSUME − RETURN) x unit_cost
├── ManHour Cost        = Σ((Regular + OT x Factor) x Rate)
├── Tools Recharge      = Σ(Hours x Tool Rate)
├── Admin Overhead      = ManHour Cost x Overhead Rate %
└── Direct PO Cost 🆕   = Σ(PO lines ที่ charge ตรงเข้า WO via Direct GR)
```

**Mapping:** PO ที่มี `work_order_id` + GR mode = Direct → aggregate cost เข้า WO
**Reversal:** PO cancel/GR reverse → reverse cost ออกจาก WO automatically

### Sourcer — Field Design 🆕

ไม่ต้องสร้าง model ใหม่ — เพิ่ม field บน PR/PO:
- `PR.sourcer_id` (FK → User) = คนค้นหา vendor + pricing
- `PO.converted_by_id` (มีอยู่แล้ว) = คนที่ convert PR → PO
- **Report:** query by sourcer_id → จำนวน PR, มูลค่ารวม, lead time เฉลี่ย, conversion rate

### Post-Go-Live Backlog (D2-D16)

> สิ่งต่อไปนี้ **ห้ามทำก่อน Go-Live Gate เสร็จ** — เก็บไว้ sprint ถัดไป:
> Export & Print, UX Fix, Internal Recharge, Tax, Dashboard, Notification,
> Invoice/DO, Quotation, Maintenance, Inventory Enhancement, Fixed Asset,
> Mobile, Security, Multi-Company, AI Performance

---

# ส่วน E — Engineering Risks & Pre-Deployment Checklist 🆕

> วิเคราะห์จาก codebase จริง — ปัญหาที่ต้องแก้ก่อน deploy + go-live

## E1. CRITICAL — ต้องแก้ก่อน Deploy

### E1.1 Stock Race Condition (inventory.py)
**ปัญหา:** `create_movement()` อ่าน balance แล้วลด โดยไม่ lock row — ถ้า 2 คนเบิกของพร้อมกัน balance ผิด
**ตัวอย่าง:** stock=100, คน A เบิก 50 + คน B เบิก 60 → ทั้งคู่สำเร็จ → stock ติดลบ
**แก้ไข:** เพิ่ม `select(...).with_for_update()` (row-level lock) ใน `create_movement()` + `reverse_movement()`
**ไฟล์:** `backend/app/services/inventory.py` (~5 บรรทัด)

### E1.2 Database Backup Strategy
**ปัญหา:** ไม่มี backup อัตโนมัติ — ถ้า DB พัง ข้อมูลหายทั้งหมด
**แก้ไข:** เปิด Railway PostgreSQL daily backup + weekly pg_dump ไป S3 + เขียน restore procedure
**ไฟล์:** Railway dashboard config + documentation

### E1.3 Rate Limiting ไม่ทำงาน (auth.py)
**ปัญหา:** `@limiter.limit()` decorator ไม่ได้ใส่บน endpoint ใดเลย — brute force login ได้ไม่จำกัด
**แก้ไข:** ใส่ `@limiter.limit("5/minute")` บน login, `@limiter.limit("10/minute")` บน refresh, `@limiter.limit("3/hour")` บน register
**ไฟล์:** `backend/app/api/auth.py` (~3 บรรทัด)

## E2. HIGH — ควรแก้ก่อน Go-Live

### E2.1 DB Connection Pool Config (database.py)
**ปัญหา:** ไม่มี `pool_recycle` + `pool_pre_ping` → connection ค้าง → random error ช่วงพีค
**แก้ไข:** เพิ่ม `pool_recycle=600, pool_pre_ping=True, pool_size=30, max_overflow=20`
**ไฟล์:** `backend/app/core/database.py` (~2 บรรทัด)

### E2.2 Migration Timeout (railway.toml)
**ปัญหา:** `healthcheckTimeout=30s` แต่ migration อาจนานกว่า → service ไม่ขึ้น
**แก้ไข:** เพิ่มเป็น `healthcheckTimeout=120`
**ไฟล์:** `backend/railway.toml`

### E2.3 CORS Production Config
**ปัญหา:** default `CORS_ORIGINS=http://localhost:5173` → Frontend Vercel เรียก API ไม่ได้
**แก้ไข:** ตั้ง Railway env var `CORS_ORIGINS=https://sss-corp-erp.vercel.app` + tighten `allow_methods`
**ไฟล์:** Railway env + `backend/app/main.py`

### E2.4 Missing Database Indexes
**ปัญหา:** ไม่มี composite index `(org_id, status)` บน 7 ตาราง → list/approval pages ช้าเมื่อข้อมูลเยอะ
**แก้ไข:** สร้าง Alembic migration เพิ่ม 7 indexes (stock_movements, timesheets, leaves, PRs, POs, SOs, WOs)
**ไฟล์:** สร้าง migration file ใหม่ 1 ไฟล์

### E2.5 API Timeout (api.js)
**ปัญหา:** axios ไม่มี timeout → backend ช้า/ค้าง = หน้าจอ loading ไม่หยุด
**แก้ไข:** เพิ่ม `timeout: 30000` ใน axios config
**ไฟล์:** `frontend/src/services/api.js` (~1 บรรทัด)

## E3. MEDIUM — แก้หลัง Go-Live ได้

### E3.1 N+1 Queries (planning.py)
**ปัญหา:** planning service โหลด plan + lines แยก 2 query → WO Detail ช้าเมื่อ plan มีหลาย lines
**แก้ไข:** ใช้ `selectinload()` eager loading

### E3.2 Withdrawal Issue Loop (withdrawal.py)
**ปัญหา:** issue slip 10 บรรทัด = 10 movement queries แยก → ช้า ~2-3 วินาที
**แก้ไข:** batch movement creation หรือ optimize transaction

### E3.3 CSP Header Missing (vercel.json)
**ปัญหา:** ไม่มี Content-Security-Policy → XSS attack มีโอกาสสำเร็จมากขึ้น
**แก้ไข:** เพิ่ม CSP header ใน `vercel.json`

### E3.4 Redis ไม่ได้ใช้จริง
**ปัญหา:** config แล้วแต่ไม่มี code เรียกใช้ → เสียค่า Railway ~$5/เดือน
**แก้ไข:** ตัดออก หรือเก็บไว้ทำ cache ทีหลัง

---

## Pre-Deployment Checklist

- [ ] E1.1 — Row-level lock ใน create_movement() + reverse_movement()
- [ ] E1.2 — เปิด Railway backup + เขียน restore procedure
- [ ] E1.3 — Rate limiting บน auth endpoints
- [ ] E2.1 — DB pool config (pool_recycle, pool_pre_ping)
- [ ] E2.2 — Migration timeout 30→120s
- [ ] E2.3 — CORS_ORIGINS = production domain
- [ ] E2.4 — Missing indexes migration
- [ ] E2.5 — Axios timeout 30s
- [ ] E3.1 — N+1 fix (post-launch OK)
- [ ] E3.2 — Withdrawal batch (post-launch OK)
- [ ] E3.3 — CSP header (post-launch OK)
- [ ] E3.4 — Redis decision (post-launch OK)

---

# สรุป Owner Decisions ทั้งหมด

| # | หัวข้อ | การตัดสินใจ |
|---|--------|-----------|
| 1 | Product Types | 5 ประเภท: MATERIAL, CONSUMABLE, SPAREPART, **FINISHED_GOODS** 🆕, SERVICE |
| 2 | Serial Number | SN sub-table: 1 SKU = many SN |
| 3 | Product Model | เพิ่ม Model field สำหรับค้นหา |
| 4 | Warehouse Levels | 3 ระดับ: Warehouse → Location → **Bin** |
| 5 | Multi-site | รองรับ fixed + temporary site |
| 6 | GR Modes | 2 modes: **Stock GR** (เข้าสต็อก) vs **Direct GR** (charge WO/CC) |
| 7 | GR Operator | บุคคลที่ 3 (configurable) |
| 8 | Job Costing | 5 components: Material + ManHour + Tools + Overhead + **Direct PO Cost** |
| 9 | Subcontractor | PO cost → WO direct (ไม่ผ่าน timesheet) |
| 10 | WO → PO | WO trigger PR/PO สำหรับ direct purchase |
| 11 | PR Free Text | ไม่ต้องเลือก SKU — กรอกอธิบายได้อิสระ |
| 12 | Supplier Suggest | แนะนำได้ไม่บังคับ — จัดซื้อตัดสินใจ |
| 13 | Sourcer Role | ต้อง track ว่าใครจัดหา ใคร convert — performance tracking |
| 14 | Supply Chain UI | module เฉพาะแผนกคลัง — คนอื่นเบิกจาก UI อื่น |
| 15 | Hardcopy Tracking | ใบเบิก hardcopy ต้องมี reference number ในระบบ |
| 16 | Tool Return | ไม่ต้องมี hardcopy — คลังรับผิดชอบบันทึก |
| 17 | Broken Tool | สร้าง WO ซ่อม, charge CC ตามตกลง |
| 18 | Payslip | พนักงานดูเองได้ — ยืนยันแล้ว |
| 19 | Profile Edit | พนักงานแก้ข้อมูลส่วนตัวเองได้ — ยืนยันแล้ว |
| 20 | Roster UX | ต้องง่าย ไม่ต้อง form ทีละวัน, bulk edit |
| 21 | Timesheet = Daily Report | ใช้ Daily Report บันทึก timesheet ไปด้วย |
| 22 | Maintenance | แยกเป็น Maintenance Module ต่างหาก |
| 23 | Menu UI | Hybrid: Permission (filter) + Dept Template (ordering) |
| 24 | Gantt Chart | **ระดับง่ายก่อน** — แท่ง WO timeline + สีตาม status 🆕 |
| 25 | Daily Plan 14-day | ดูภาพ 14 วัน, ง่ายเหมือน Excel |
| 26 | ERP Scope | รองรับทั้ง Service business + Product manufacturing |
| 27 | Internal Recharge | ต้องมี cost allocation ข้ามแผนก (management accounting) |
| 28 | Multi-Company | อนาคต — ต้องมีผู้เชี่ยวชาญบัญชี + **CC ข้าม company ต้อง reconcile ทุกเดือน** 🆕 |
| 29 | Consignment | เก็บเข้า stock ปกติ, **ห้ามผู้อื่นเบิก** (owner-only withdrawal) 🆕 |
| 30 | Barcode Scanner | **2 แบบ: Bluetooth (keyboard input) + Camera (กล้องมือถือ)** + Print Label 🆕 |
| 31 | Search | SKU + Model + SN ค้นหาได้ + Filter/Sort available items |
| 32 | **FINISHED_GOODS** 🆕 | ประเภทที่ 5 — Actual Costing, PRODUCE movement, 1 WO = 1 output |
| 33 | **Internal Recharge 2 แบบ** 🆕 | Actual (Job Costing) + Fixed (Budget-based monthly allocation) |
| 34 | **Owner / SysAdmin** 🆕 | แยกได้ผ่าน permission assignment — SysAdmin ไม่เห็น finance |
| 35 | **HR Final Optional** 🆕 | Config `hr_final_required` per org |
| 36 | **Stock Adjust Request** 🆕 | Flow ใหญ่: request → Owner approve → execute |
| 37 | **Timesheet + Payroll** 🆕 | Loose coupling — Payroll = base salary, timesheet เสริม OT |
| 38 | **SO = Product + Service** 🆕 | SO line items รองรับทั้ง GOODS และ SERVICE |
| 39 | **Quotation Module** 🆕 | ต้องมี QT — ไม่เร่งด่วน ดู C12 |
| 40 | **Fixed Asset** 🆕 | สินทรัพย์ + ค่าเสื่อมตามกฎหมาย ดู C13 |
| 41 | **Finance = Management Info** 🆕 | ช่วยบัญชี แต่ไม่ใช่ Accounting Module ตามกฎหมาย |
| 42 | **Role Management Redesign** 🆕 | UX ใช้งานยากมาก ต้อง redesign |
| 43 | **Print Site Display** 🆕 | ใบเบิก print ต้องแสดง Site/Warehouse ชัดเจน |
| 44 | **Timesheet Lockback = Period Cutoff** 🆕 | ย้อนหลังได้ถึงรอบที่ยังไม่ตัด (เช่น สิ้นเดือน) ไม่ใช่ 7 วัน |
| 45 | **GR Exit Criteria** 🆕 | ทุก movement immutable + REVERSAL, Direct GR ไม่กระทบ stock |
| 46 | **Inter-company = Fixed Recharge** 🆕 | Invoice ข้ามบริษัทใช้ Fixed Internal Recharge เป็นฐาน |
| 47 | **Consignment = Stock ปกติ** 🆕 | เก็บเข้า stock ปกติ, ห้ามผู้อื่นเบิก (owner-only withdrawal) |
| 48 | **Barcode Scanner 2 แบบ** 🆕 | Bluetooth (keyboard input) + Camera (กล้องมือถือ) + Print Label |
| 49 | **Multi-Company Reconciliation** 🆕 | CC คนละ company → ดึงข้อมูลสรุปทุกเดือน → reconcile (เชื่อม Fixed Recharge) |
| 50 | **Gantt = ง่ายก่อน** 🆕 | แท่ง WO timeline (start→end) + สีตาม status, ยังไม่ต้อง drag & drop |

---

# คำศัพท์ (Glossary)

| คำ | ความหมาย |
|----|----------|
| PR | Purchase Requisition — ใบขอซื้อ |
| PO | Purchase Order — ใบสั่งซื้อ |
| SO | Sales Order — ใบสั่งขาย |
| GR | Goods Receipt — การรับของ |
| WO | Work Order — ใบสั่งงาน/ใบสั่งผลิต |
| DO | Delivery Order — ใบส่งของ |
| BR | Business Rule — กฎเกณฑ์ทางธุรกิจ |
| RBAC | Role-Based Access Control — การควบคุมสิทธิ์ตามบทบาท |
| Data Scope | ขอบเขตข้อมูลที่แต่ละ role เห็น |
| Job Costing | การคำนวณต้นทุนต่อ Work Order (5 components) |
| Approval Bypass | ข้ามขั้นตอนอนุมัติ (auto-approve) ตาม OrgApprovalConfig |
| Standard Timesheet | Timesheet ที่ระบบ generate อัตโนมัติตาม Shift Roster |
| Shift Roster | ตารางกะการทำงานรายวันต่อพนักงาน |
| CC | Cost Center — ศูนย์ต้นทุน |
| CE | Cost Element — หมวดต้นทุน |
| VAT | Value Added Tax — ภาษีมูลค่าเพิ่ม 7% |
| AP | Accounts Payable — เจ้าหนี้การค้า |
| AR | Accounts Receivable — ลูกหนี้การค้า |
| PWA | Progressive Web App — เว็บแอปที่ทำงานคล้าย native app |
| UX | User Experience — ประสบการณ์การใช้งาน |
| KPI | Key Performance Indicator — ตัวชี้วัดผลงาน |
| SN | Serial Number — หมายเลขเครื่อง/ชิ้นส่วน |
| Bin | ตำแหน่ง rack ในคลัง (ระดับ 3 ของ warehouse hierarchy) |
| Stock GR | การรับของเข้าสต็อก (สร้าง stock movement) |
| Direct GR | การรับของ charge ตรงเข้า WO/CC (ไม่สร้าง stock movement) |
| Internal Recharge | การ charge cost ข้ามแผนกภายในองค์กร (management accounting) |
| Sourcer | ผู้จัดหา — ค้นหา vendor + pricing ก่อนอนุมัติ PR |
| Management Accounting | บัญชีบริหาร — ดูต้นทุนภายใน ไม่ผูกพันทางกฎหมาย |
| Financial Accounting | บัญชีการเงิน — เงินจริงเข้า-ออก ผูกพันทางกฎหมาย |
| Consignment | การฝากของไว้ในคลัง — เก็บเข้า stock ปกติ แต่ห้ามผู้อื่นเบิก (owner-only) 🆕 |
| SPAREPART | ประเภทสินค้าใหม่สำหรับอะไหล่สำคัญ (critical parts) |
| Direct PO Cost | ต้นทุน PO ที่ charge เข้า WO โดยตรง (subcontractor, special purchase) |
| Dept Template | เทมเพลตเมนูตามแผนก — Admin กำหนดลำดับ/pinned items |
| FINISHED_GOODS 🆕 | สินค้าสำเร็จรูป — ผลผลิตจาก Work Order |
| PRODUCE 🆕 | ประเภท movement ใหม่ — สินค้าสำเร็จรูปเข้า stock เมื่อ WO ปิด |
| Actual Recharge 🆕 | การ charge ต้นทุนจริงที่เกิดขึ้นใน WO (= Job Costing) |
| Fixed Recharge 🆕 | การ charge ต้นทุนคงที่ต่อเดือนจาก Budget Planning |
| QT 🆕 | Quotation — ใบเสนอราคา |
| Fixed Asset 🆕 | สินทรัพย์ถาวร — เครื่องจักร อาคาร มีค่าเสื่อมตามกฎหมาย |
| SysAdmin 🆕 | System Administrator — จัดการระบบแต่ไม่เห็นข้อมูลการเงิน |
| DN 🆕 | Delivery Note — ใบนำส่งของ |
---

*SSS Corp ERP — PRD V5 | Integrated Round 2 Owner Feedback | 2026-03-03*
*เอกสารนี้เป็น living document — จะ update เมื่อมีการเปลี่ยนแปลง*