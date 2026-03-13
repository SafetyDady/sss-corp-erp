"""
SSS Corp ERP — LINE Login API Routes

Endpoints:
  GET    /api/auth/line/authorize-url       (no auth) — get LINE OAuth URL
  POST   /api/auth/line/callback            (no auth) — handle LINE callback
  POST   /api/auth/line/link                (no auth, temp_token) — link LINE to user
  POST   /api/auth/line/2fa-verify          (no auth, temp_token) — 2FA after LINE
  POST   /api/auth/line/generate-link-code  admin.user.update — admin generates code
  DELETE /api/auth/line/unlink              (JWT, self) — remove LINE binding
"""

import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_ORG_ID, get_settings
from app.core.database import get_db
from app.core.permissions import require
from app.core.security import get_token_payload
from app.schemas.line_auth import (
    GenerateLinkCodeRequest,
    Line2FAVerifyRequest,
    LineAuthorizeResponse,
    LineCallbackRequest,
    LineCallbackResponse,
    LineLinkRequest,
    LineUnlinkResponse,
    LinkCodeResponse,
)
from app.services.line_auth import (
    exchange_code_for_token,
    find_user_by_line_id,
    generate_authorize_url,
    is_line_login_enabled,
    get_line_profile,
    set_link_code,
    unlink_line,
    verify_and_link,
)
from app.services.security import (
    create_temp_token,
    verify_temp_token,
    verify_2fa_code,
    record_login_attempt,
)
from app.models.security import LoginStatus

line_auth_router = APIRouter(prefix="/api/auth/line", tags=["line-auth"])
settings = get_settings()


def _require_line_enabled():
    """Guard: LINE Login must be configured."""
    if not is_line_login_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="LINE Login is not configured",
        )


@line_auth_router.get("/status")
async def api_line_status():
    """Check if LINE Login is configured (always 200)."""
    return {"enabled": is_line_login_enabled()}


@line_auth_router.get("/authorize-url", response_model=LineAuthorizeResponse)
async def api_line_authorize_url():
    """Generate LINE OAuth 2.0 authorization URL with CSRF state."""
    _require_line_enabled()

    # Use a signed JWT as the state parameter (self-verifying, no Redis needed)
    nonce = secrets.token_urlsafe(16)
    state = create_temp_token(nonce, "line", "line_state")

    url = generate_authorize_url(state)
    return LineAuthorizeResponse(url=url, state=state)


@line_auth_router.post("/callback", response_model=LineCallbackResponse)
async def api_line_callback(
    body: LineCallbackRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle LINE OAuth callback: exchange code, find/link user."""
    _require_line_enabled()

    # Verify state (CSRF protection) — decode the signed JWT
    state_payload = verify_temp_token(body.state, "line_state")
    if not state_payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired state parameter",
        )

    # Exchange code for LINE access token
    try:
        token_data = await exchange_code_for_token(body.code)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange LINE authorization code",
        )

    line_access_token = token_data.get("access_token")
    if not line_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LINE did not return an access token",
        )

    # Get LINE profile
    try:
        profile = await get_line_profile(line_access_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to get LINE profile",
        )

    line_user_id = profile.get("userId")
    display_name = profile.get("displayName", "")

    if not line_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LINE profile missing userId",
        )

    # Try to find existing user linked to this LINE ID
    user = await find_user_by_line_id(db, line_user_id)

    if user:
        # User found — check 2FA
        ip, user_agent = _get_client_info(request)
        org_id = user.org_id or DEFAULT_ORG_ID

        if user.is_2fa_enabled:
            temp_token = create_temp_token(
                str(user.id), str(org_id), "line_2fa_pending"
            )
            await record_login_attempt(
                db, user.email, user.id, org_id, ip, user_agent,
                LoginStatus.SUCCESS, "LINE Login — 2FA required",
            )
            await db.commit()
            return LineCallbackResponse(
                action="2fa_required",
                temp_token=temp_token,
            )

        # No 2FA — issue tokens directly
        from app.api.auth import _create_tokens_and_refresh

        access_token, refresh_token, db_refresh, sid = _create_tokens_and_refresh(
            user, ip, user_agent, login_method="line",
        )
        db.add(db_refresh)
        await record_login_attempt(
            db, user.email, user.id, org_id, ip, user_agent,
            LoginStatus.SUCCESS, "LINE Login",
        )
        await db.commit()
        return LineCallbackResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            login_method="line",
        )

    # User not found — need link code
    temp_token = create_temp_token(
        line_user_id, str(DEFAULT_ORG_ID), "line_link"
    )
    return LineCallbackResponse(
        action="link_required",
        temp_token=temp_token,
        line_display_name=display_name,
    )


@line_auth_router.post("/link", response_model=LineCallbackResponse)
async def api_line_link(
    body: LineLinkRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Link LINE account using a link code."""
    _require_line_enabled()

    payload = verify_temp_token(body.temp_token, "line_link")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired temp token",
        )

    line_user_id = payload["sub"]  # LINE user ID stored in sub
    org_id = UUID(payload.get("org_id", str(DEFAULT_ORG_ID)))

    user = await verify_and_link(db, body.link_code, line_user_id, org_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รหัสเชื่อมต่อไม่ถูกต้องหรือหมดอายุ",
        )

    ip, user_agent = _get_client_info(request)

    # Check 2FA
    if user.is_2fa_enabled:
        temp_token = create_temp_token(
            str(user.id), str(org_id), "line_2fa_pending"
        )
        await db.commit()
        return LineCallbackResponse(
            action="2fa_required",
            temp_token=temp_token,
        )

    # No 2FA — issue tokens
    from app.api.auth import _create_tokens_and_refresh

    access_token, refresh_token, db_refresh, sid = _create_tokens_and_refresh(
        user, ip, user_agent
    )
    db.add(db_refresh)
    await record_login_attempt(
        db, user.email, user.id, org_id, ip, user_agent,
        LoginStatus.SUCCESS, "LINE Login (linked)",
    )
    await db.commit()
    return LineCallbackResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        login_method="line",
    )


@line_auth_router.post("/2fa-verify", response_model=LineCallbackResponse)
async def api_line_2fa_verify(
    body: Line2FAVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Complete 2FA verification after LINE login."""
    payload = verify_temp_token(body.temp_token, "line_2fa_pending")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired temp token",
        )

    from sqlalchemy import select as sa_select
    from app.models.user import User

    user_id = payload["sub"]
    result = await db.execute(sa_select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not await verify_2fa_code(db, user, body.code):
        raise HTTPException(status_code=401, detail="Invalid verification code")

    ip, user_agent = _get_client_info(request)

    from app.api.auth import _create_tokens_and_refresh

    access_token, refresh_token, db_refresh, sid = _create_tokens_and_refresh(
        user, ip, user_agent, login_method="line",
    )
    db.add(db_refresh)
    await db.commit()

    return LineCallbackResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        login_method="line",
    )


@line_auth_router.post(
    "/generate-link-code",
    response_model=LinkCodeResponse,
    dependencies=[Depends(require("admin.user.update"))],
)
async def api_generate_link_code(
    body: GenerateLinkCodeRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Admin: generate a 6-char link code for a user (24h expiry)."""
    org_id = UUID(token.get("org_id", str(DEFAULT_ORG_ID)))

    code, expires_at = await set_link_code(db, body.user_id, org_id)
    if not code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await db.commit()
    return LinkCodeResponse(link_code=code, expires_at=expires_at)


@line_auth_router.delete("/unlink", response_model=LineUnlinkResponse)
async def api_line_unlink(
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(get_token_payload),
):
    """Self-service: remove LINE binding from current user."""
    user_id = token["sub"]
    success = await unlink_line(db, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LINE account not linked",
        )
    await db.commit()
    return LineUnlinkResponse(success=True, message="LINE account unlinked")


def _get_client_info(request: Request) -> tuple[str | None, str | None]:
    """Extract IP and user agent from request."""
    ip = None
    if request.client:
        ip = request.client.host
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    user_agent = request.headers.get("user-agent")
    return ip, user_agent
