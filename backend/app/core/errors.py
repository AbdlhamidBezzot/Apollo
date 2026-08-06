"""Safe, consistent API error responses.

Server logs retain the original exception details; responses never expose
provider configuration, URLs, credentials, or implementation details.
"""

from fastapi import HTTPException


_SAFE_MESSAGES: dict[int, str] = {
    400: "The request could not be processed.",
    401: "You need to sign in to continue.",
    403: "You do not have permission to do that.",
    404: "The requested resource was not found.",
    409: "This request conflicts with the current state.",
    422: "Some of the submitted information is invalid.",
    429: "Too many requests. Please try again shortly.",
    502: "The content service is temporarily unavailable. Please try again.",
    503: "This service is temporarily unavailable. Please try again.",
}

_GENERIC_MESSAGE = "Something went wrong. Please try again."


class UserFacingError(HTTPException):
    """An intentionally authored, reviewed message that may be shown to users."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(status_code=status_code, detail=detail)


def sanitize_detail(exc: Exception, status_code: int) -> str:
    """Return safe client copy, preserving only explicitly approved messages."""
    if isinstance(exc, UserFacingError):
        return str(exc.detail)
    return _SAFE_MESSAGES.get(status_code, _GENERIC_MESSAGE)