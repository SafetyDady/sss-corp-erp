"""
LINE Login Pydantic Schemas
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class LineAuthorizeResponse(BaseModel):
    url: str
    state: str


class LineCallbackRequest(BaseModel):
    code: str = Field(..., description="LINE authorization code from redirect")
    state: str = Field(..., description="CSRF state parameter")


class LineCallbackResponse(BaseModel):
    """Multi-purpose response for LINE callback."""
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    action: Optional[str] = None  # "link_required" | "2fa_required"
    temp_token: Optional[str] = None
    line_display_name: Optional[str] = None
    login_method: Optional[str] = None  # "line"


class LineLinkRequest(BaseModel):
    temp_token: str
    link_code: str = Field(..., min_length=6, max_length=6)


class Line2FAVerifyRequest(BaseModel):
    temp_token: str
    code: str = Field(..., min_length=6, max_length=6)


class GenerateLinkCodeRequest(BaseModel):
    user_id: str


class LinkCodeResponse(BaseModel):
    link_code: str
    expires_at: datetime


class LineUnlinkResponse(BaseModel):
    success: bool
    message: str
