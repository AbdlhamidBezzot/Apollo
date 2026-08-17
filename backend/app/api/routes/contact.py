"""Contact & Support submission endpoint.

POST /api/v1/contact — public, rate-limited, no auth required.

Persists the submission to the `contact_submissions` table and, if
RESEND_API_KEY is configured, forwards a notification email via the
Resend REST API (no extra pip dependency — uses the bundled httpx client).
"""

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.ratelimit import rate_limited
from app.db import get_db
from app.models import ContactSubmission
from app.schemas import ContactSubmissionCreate, ContactSubmissionOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contact", tags=["contact"])

_settings = get_settings()
_rl_contact = rate_limited("contact", "10/hour")

DbDep = Annotated[Session, Depends(get_db)]


async def _send_resend_notification(submission: ContactSubmission) -> None:
    """Fire-and-forget: forward the submission to the configured inbox via Resend."""
    settings = get_settings()
    if not settings.resend_api_key:
        return

    subject_labels = {
        "general": "General Support",
        "dmca": "DMCA / Copyright Takedown",
        "editorial": "Editorial & Review Feedback",
        "bug": "Bug Report / Issue",
    }
    subject_label = subject_labels.get(submission.subject, submission.subject.title())

    html_body = f"""
    <h2 style="font-family:sans-serif;color:#1a1a2e">
      New Apollo Contact Submission #{submission.id}
    </h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">
      <tr><td style="padding:8px;font-weight:bold;color:#555">Name</td>
          <td style="padding:8px">{submission.name}</td></tr>
      <tr style="background:#f7f7f7"><td style="padding:8px;font-weight:bold;color:#555">Email</td>
          <td style="padding:8px"><a href="mailto:{submission.email}">{submission.email}</a></td></tr>
      <tr><td style="padding:8px;font-weight:bold;color:#555">Category</td>
          <td style="padding:8px">{subject_label}</td></tr>
      <tr style="background:#f7f7f7"><td style="padding:8px;font-weight:bold;color:#555;vertical-align:top">Message</td>
          <td style="padding:8px;white-space:pre-wrap">{submission.message}</td></tr>
    </table>
    <p style="font-family:sans-serif;font-size:12px;color:#999;margin-top:24px">
      Submitted at {submission.submitted_at.strftime("%Y-%m-%d %H:%M UTC")} &middot; Apollo Contact Portal
    </p>
    """

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "Apollo Contact <noreply@apollo-stream.com>",
                    "to": [settings.contact_notify_email],
                    "reply_to": submission.email,
                    "subject": f"[Apollo] {subject_label} — #{submission.id}",
                    "html": html_body,
                },
            )
            if resp.status_code not in (200, 201):
                logger.warning(
                    "Resend email delivery failed (status %s): %s",
                    resp.status_code,
                    resp.text[:300],
                )
            else:
                logger.info("Contact notification email sent for submission #%s", submission.id)
    except Exception:
        # Email failure must never break the API response.
        logger.exception("Failed to send contact notification email for submission #%s", submission.id)


@router.post("", response_model=ContactSubmissionOut, status_code=201)
async def submit_contact(
    payload: ContactSubmissionCreate,
    background_tasks: BackgroundTasks,
    db: DbDep,
    _rl=Depends(_rl_contact),
):
    """Accept a Contact & Support form submission.

    - Persists the record to the database.
    - Schedules a background email notification if RESEND_API_KEY is set.
    - Rate-limited to 10 submissions per hour per IP.
    """
    submission = ContactSubmission(
        name=payload.name,
        email=payload.email,
        subject=payload.subject,
        message=payload.message,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Fire email in the background so the HTTP response is instant.
    background_tasks.add_task(_send_resend_notification, submission)

    logger.info(
        "Contact submission #%s received from %s (category: %s)",
        submission.id,
        submission.email,
        submission.subject,
    )
    return submission
