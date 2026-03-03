"""Quick test: payroll release flow"""
import httpx

BASE = "http://localhost:8000/api"
r = httpx.post(f"{BASE}/auth/login", json={"email": "owner@sss-corp.com", "password": "owner123"})
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

# List existing payroll runs
r = httpx.get(f"{BASE}/hr/payroll", headers=H)
runs = r.json().get("items", [])
print("Existing payroll runs:")
for rn in runs:
    rid = str(rn["id"])[:8]
    print(f"  {rid}... {rn['period_start']} - {rn['period_end']} status={rn['status']} emp={rn.get('employee_count', 0)}")

executed = [rn for rn in runs if rn["status"] in ("EXECUTED", "EXPORTED")]
draft = [rn for rn in runs if rn["status"] == "DRAFT"]

# If we have a DRAFT, execute it first
if draft and not executed:
    did = draft[0]["id"]
    print(f"\nExecuting DRAFT run {str(did)[:8]}...")
    # Need the execute endpoint — check what's available
    # From CLAUDE.md: POST /api/hr/payroll/run is create, not execute
    # Let me check the actual endpoint
    r = httpx.get(f"{BASE}/hr/payroll", headers=H)
    print(f"Payroll list: {r.status_code}")

if not executed and not draft:
    # Create new payroll (POST /hr/payroll with body)
    body = {"period_start": "2026-01-01", "period_end": "2026-01-31"}
    r = httpx.post(f"{BASE}/hr/payroll", headers=H, json=body)
    print(f"\nCreate payroll: {r.status_code}")
    if r.status_code in (200, 201):
        run = r.json()
        rid = run["id"]
        print(f"  id={str(rid)[:8]}... status={run['status']}")
        if run["status"] == "DRAFT":
            # Execute: POST /hr/payroll/run?payroll_id=...
            r2 = httpx.post(f"{BASE}/hr/payroll/run", headers=H, params={"payroll_id": rid})
            print(f"  Execute: {r2.status_code}")
            if r2.status_code == 200:
                run = r2.json()
                print(f"  status={run['status']} emp={run.get('employee_count', 0)}")
                executed = [run]
    else:
        print(f"  Error: {r.text[:300]}")

if executed:
    pid = executed[0]["id"]
    print(f"\nUsing run: {str(pid)[:8]}...")

    # GET payslips for run
    r = httpx.get(f"{BASE}/hr/payroll/{pid}/payslips", headers=H)
    print(f"GET payslips: {r.status_code}")
    ps = r.json()
    print(f"  total: {ps['total']}")
    for s in ps.get("items", [])[:3]:
        print(f"  name={s.get('employee_name','?')} base={s['base_salary']} net={s['net_amount']} status={s['status']}")

    # Release
    r = httpx.post(f"{BASE}/hr/payroll/{pid}/release", headers=H)
    print(f"\nRelease: {r.status_code} -> {r.json()}")

    # My payslips
    r = httpx.get(f"{BASE}/hr/payslips/me", headers=H)
    print(f"\nMy payslips: {r.status_code} total={r.json()['total']}")
    for s in r.json().get("items", [])[:2]:
        print(f"  period={s.get('period_start','')} net={s['net_amount']} status={s['status']}")
else:
    print("\nNo EXECUTED payroll runs available — skipping release test")
