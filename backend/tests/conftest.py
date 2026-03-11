"""
Shared pytest fixtures for SSS Corp ERP integration tests.
All tests run against the live dev server (http://localhost:8000).
"""

import pytest
import httpx
import time

BASE = "http://localhost:8000"

OWNER = {"email": "owner@sss-corp.com", "password": "owner123"}
MANAGER = {"email": "manager@sss-corp.com", "password": "manager123"}
STAFF = {"email": "staff@sss-corp.com", "password": "staff123"}
VIEWER = {"email": "viewer@sss-corp.com", "password": "viewer123"}

# Cache tokens to avoid rate limiting
_token_cache: dict[str, str] = {}


def _login(creds: dict) -> str:
    key = creds["email"]
    if key in _token_cache:
        return _token_cache[key]
    for attempt in range(5):
        r = httpx.post(f"{BASE}/api/auth/login", json=creds, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("requires_2fa") or data.get("temp_token"):
                pytest.skip("2FA enabled, cannot get token")
            _token_cache[key] = data["access_token"]
            return data["access_token"]
        if r.status_code in (429, 500):
            time.sleep(12)  # Wait for rate limit to reset
            continue
        break
    assert False, f"Login failed for {creds['email']} after retries: {r.status_code} {r.text}"


@pytest.fixture(scope="session")
def token() -> str:
    """Owner token (default for most tests)."""
    return _login(OWNER)


@pytest.fixture(scope="session")
def owner_token() -> str:
    return _login(OWNER)


@pytest.fixture(scope="session")
def manager_token() -> str:
    return _login(MANAGER)


@pytest.fixture(scope="session")
def staff_token() -> str:
    return _login(STAFF)


@pytest.fixture(scope="session")
def viewer_token() -> str:
    return _login(VIEWER)


@pytest.fixture(scope="session")
def bin_id(token: str) -> str | None:
    """Create a bin for tests that need it, return bin_id or None."""
    h = {"Authorization": f"Bearer {token}"}
    r = httpx.get(f"{BASE}/api/warehouse/locations", headers=h, timeout=10)
    if r.status_code == 200:
        items = r.json().get("items", r.json()) if isinstance(r.json(), dict) else r.json()
        if items:
            return items[0]["id"]
    return None


@pytest.fixture(scope="session", autouse=True)
def _fetch_workflow_dynamic_ids(token: str):
    """Auto-fetch dynamic IDs needed by test_workflow_rules.py."""
    try:
        import tests.test_workflow_rules as wf
        wf.fetch_dynamic_ids(token)
    except (ImportError, AttributeError):
        pass
