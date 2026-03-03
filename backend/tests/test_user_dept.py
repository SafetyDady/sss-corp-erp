"""Test: User Department Assignment (Admin API update)"""
import httpx
import sys

BASE = "http://localhost:8000/api"


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


def login():
    r = httpx.post(f"{BASE}/auth/login", json={"email": "owner@sss-corp.com", "password": "owner123"})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_1_user_list_has_dept_fields(token):
    """GET /admin/users returns employee_id, department_id, department_name."""
    r = httpx.get(f"{BASE}/admin/users", headers=hdr(token))
    assert r.status_code == 200
    data = r.json()
    assert data["total"] > 0
    first = data["items"][0]
    assert "employee_id" in first, "Missing employee_id field"
    assert "department_id" in first, "Missing department_id field"
    assert "department_name" in first, "Missing department_name field"


def test_2_update_user_department(token):
    """PATCH /admin/users/{id}/department — assign + unassign."""
    # Get users and departments
    users = httpx.get(f"{BASE}/admin/users", headers=hdr(token)).json()["items"]
    depts = httpx.get(f"{BASE}/master/departments", headers=hdr(token), params={"limit": 10}).json()["items"]

    # Find a user with employee_id (not owner to avoid side effects)
    target = next((u for u in users if u.get("employee_id") and u["role"] != "owner"), None)
    if not target:
        target = next((u for u in users if u.get("employee_id")), None)
    if not target:
        print("  SKIP (no user with employee_id)")
        return

    if not depts:
        print("  SKIP (no departments)")
        return

    user_id = target["id"]
    dept_id = depts[0]["id"]
    dept_name = depts[0]["name"]
    original_dept = target.get("department_id")

    # Assign department
    r = httpx.patch(f"{BASE}/admin/users/{user_id}/department", headers=hdr(token), json={
        "department_id": dept_id,
    })
    assert r.status_code == 200, f"Assign failed: {r.text}"
    result = r.json()
    assert result["department_id"] == dept_id
    assert result["department_name"] == dept_name

    # Unassign (set to null)
    r = httpx.patch(f"{BASE}/admin/users/{user_id}/department", headers=hdr(token), json={
        "department_id": None,
    })
    assert r.status_code == 200, f"Unassign failed: {r.text}"
    assert r.json()["department_id"] is None

    # Restore original
    if original_dept:
        httpx.patch(f"{BASE}/admin/users/{user_id}/department", headers=hdr(token), json={
            "department_id": original_dept,
        })


def test_3_update_dept_invalid_user(token):
    """PATCH with bogus user_id → 404."""
    r = httpx.patch(
        f"{BASE}/admin/users/00000000-0000-0000-0000-ffffffffffff/department",
        headers=hdr(token),
        json={"department_id": None},
    )
    assert r.status_code == 404


def test_4_update_dept_invalid_department(token):
    """PATCH with bogus department_id → 404."""
    users = httpx.get(f"{BASE}/admin/users", headers=hdr(token)).json()["items"]
    target = next((u for u in users if u.get("employee_id")), None)
    if not target:
        print("  SKIP (no user with employee)")
        return

    r = httpx.patch(f"{BASE}/admin/users/{target['id']}/department", headers=hdr(token), json={
        "department_id": "00000000-0000-0000-0000-ffffffffffff",
    })
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def main():
    print("=" * 60)
    print("User Department Assignment Tests")
    print("=" * 60)

    token = login()
    print("✓ Authenticated\n")

    tests = [
        ("user list has dept fields", lambda: test_1_user_list_has_dept_fields(token)),
        ("assign + unassign dept", lambda: test_2_update_user_department(token)),
        ("invalid user → 404", lambda: test_3_update_dept_invalid_user(token)),
        ("invalid dept → 404", lambda: test_4_update_dept_invalid_department(token)),
    ]

    passed = failed = 0
    for i, (name, fn) in enumerate(tests, 1):
        print(f"[{i}/{len(tests)}] {name} ...")
        try:
            fn()
            passed += 1
            print(f"  PASS ✓\n")
        except Exception as e:
            failed += 1
            print(f"  FAIL ✗ — {e}\n")

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed / {len(tests)} total")
    print("=" * 60)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
