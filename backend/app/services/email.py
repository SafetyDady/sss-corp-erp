"""
SSS Corp ERP — Email Notification Service
Phase 4.6: Send approval request emails when documents are submitted.

Disabled by default (EMAIL_ENABLED=False in config).
Configure SMTP settings via environment variables to enable.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger(__name__)


APPROVAL_EMAIL_TEMPLATE = """\
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: 'Segoe UI', Tahoma, sans-serif; color: #333; }}
    .container {{ max-width: 500px; margin: 20px auto; padding: 24px; background: #f9f9f9; border-radius: 8px; }}
    .header {{ color: #06b6d4; font-size: 18px; font-weight: 600; margin-bottom: 16px; }}
    .detail {{ margin: 12px 0; padding: 12px; background: #fff; border-radius: 6px; border-left: 4px solid #06b6d4; }}
    .btn {{ display: inline-block; padding: 10px 24px; background: #06b6d4; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }}
    .footer {{ margin-top: 24px; font-size: 12px; color: #999; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">SSS Corp ERP — รออนุมัติ</div>
    <p>สวัสดีคุณ {approver_name},</p>
    <div class="detail">
      <strong>{document_type}</strong> หมายเลข <strong>{document_number}</strong><br>
      ส่งโดย: {requester_name}
    </div>
    <p>กรุณาตรวจสอบและอนุมัติเอกสารนี้</p>
    <a href="{detail_url}" class="btn">ดูรายละเอียด</a>
    <div class="footer">
      SSS Corp ERP — อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ
    </div>
  </div>
</body>
</html>
"""


async def send_approval_request(
    *,
    to_email: str,
    approver_name: str,
    document_type: str,
    document_number: str,
    requester_name: str,
    detail_url: str,
) -> bool:
    """
    Send an approval request email.
    Returns True if sent successfully, False otherwise.
    Silently returns False if email is disabled.
    """
    settings = get_settings()

    if not settings.EMAIL_ENABLED:
        logger.debug("Email disabled — skipping approval request for %s", document_number)
        return False

    if not settings.SMTP_HOST or not to_email:
        logger.warning("SMTP not configured or no recipient — skipping email")
        return False

    subject = f"[SSS Corp ERP] {document_type} รออนุมัติ: {document_number}"
    html_body = APPROVAL_EMAIL_TEMPLATE.format(
        approver_name=approver_name,
        document_type=document_type,
        document_number=document_number,
        requester_name=requester_name,
        detail_url=detail_url,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            if settings.SMTP_PORT == 587:
                server.starttls()
                server.ehlo()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, [to_email], msg.as_string())
        logger.info("Approval email sent to %s for %s %s", to_email, document_type, document_number)
        return True
    except Exception:
        logger.exception("Failed to send approval email to %s", to_email)
        return False


def build_detail_url(document_type: str, document_id: str) -> str:
    """Build frontend URL for a document."""
    settings = get_settings()
    base = settings.FRONTEND_URL.rstrip("/")

    url_map = {
        "Purchase Order": f"/purchasing/{document_id}",
        "Sales Order": f"/sales/{document_id}",
        "Work Order": f"/work-orders/{document_id}",
        "Timesheet": "/hr",
        "Leave": "/hr",
    }
    path = url_map.get(document_type, "/")
    return f"{base}{path}"
