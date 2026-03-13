"""
LINE Login Service — OAuth 2.0 + Link Code + Profile
"""

import secrets
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID, get_settings
from app.models.user import User

settings = get_settings()

# Characters for link code (exclude ambiguous: O, I, L, 0, 1)
_LINK_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_LINK_CODE_LENGTH = 6
_LINK_CODE_TTL_HOURS = 24

# LINE API endpoints
_LINE_AUTH_URL = "https://access.line.me/oauth2/v2.1/authorize"
_LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token"
_LINE_PROFILE_URL = "https://api.line.me/v2/profile"


def is_line_login_enabled() -> bool:
    """Check if LINE Login is configured."""
    return bool(settings.LINE_CHANNEL_ID)


def generate_authorize_url(state: str) -> str:
    """Build LINE OAuth 2.0 authorization URL."""
    params = {
        "response_type": "code",
        "client_id": settings.LINE_CHANNEL_ID,
        "redirect_uri": settings.LINE_CALLBACK_URL,
        "state": state,
        "scope": "profile openid",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{_LINE_AUTH_URL}?{query}"


async def exchange_code_for_token(code: str) -> dict:
    """Exchange authorization code for LINE access token."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            _LINE_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.LINE_CALLBACK_URL,
                "client_id": settings.LINE_CHANNEL_ID,
                "client_secret": settings.LINE_CHANNEL_SECRET,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_line_profile(access_token: str) -> dict:
    """Get LINE user profile (userId, displayName, pictureUrl)."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            _LINE_PROFILE_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()


def generate_link_code() -> str:
    """Generate a 6-character link code (uppercase alphanumeric, no ambiguous chars)."""
    return "".join(secrets.choice(_LINK_CODE_CHARS) for _ in range(_LINK_CODE_LENGTH))


async def find_user_by_line_id(
    db: AsyncSession, line_user_id: str, org_id=None,
) -> User | None:
    """Find user by LINE user ID. If org_id is None, search DEFAULT_ORG_ID."""
    oid = org_id or DEFAULT_ORG_ID
    result = await db.execute(
        select(User).where(
            User.line_user_id == line_user_id,
            User.org_id == oid,
            User.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def verify_and_link(
    db: AsyncSession,
    link_code: str,
    line_user_id: str,
    org_id=None,
) -> User | None:
    """Verify link code and bind LINE user ID to the user.

    Returns the User on success, None if code invalid/expired.
    """
    oid = org_id or DEFAULT_ORG_ID
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(User).where(
            User.line_link_code == link_code.upper(),
            User.org_id == oid,
            User.is_active == True,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        return None

    # Check expiry
    if user.line_link_code_expires_at and user.line_link_code_expires_at < now:
        return None

    # Check not already linked to another LINE account
    if user.line_user_id:
        return None

    # Link LINE ID and clear code
    user.line_user_id = line_user_id
    user.line_link_code = None
    user.line_link_code_expires_at = None
    await db.flush()
    return user


async def set_link_code(db: AsyncSession, user_id, org_id=None) -> tuple[str, datetime]:
    """Generate and store a link code for user. Returns (code, expires_at)."""
    from uuid import UUID

    oid = org_id or DEFAULT_ORG_ID
    uid = UUID(str(user_id)) if not isinstance(user_id, UUID) else user_id

    result = await db.execute(
        select(User).where(User.id == uid, User.org_id == oid, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        return None, None

    code = generate_link_code()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_LINK_CODE_TTL_HOURS)
    user.line_link_code = code
    user.line_link_code_expires_at = expires_at
    await db.flush()
    return code, expires_at


async def unlink_line(db: AsyncSession, user_id) -> bool:
    """Remove LINE binding from user. Returns True if unlinked."""
    from uuid import UUID

    uid = UUID(str(user_id)) if not isinstance(user_id, UUID) else user_id
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user or not user.line_user_id:
        return False

    user.line_user_id = None
    await db.flush()
    return True
