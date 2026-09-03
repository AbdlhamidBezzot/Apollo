"""SSRF Guard for untrusted add-on URL fetching.

Rules (Step 3 safeguard):
1. Scheme validation: HTTPS required in production (http:// allowed for localhost/dev testing).
2. DNS Resolution & IP Range Blocking: Loopback, RFC 1918, link-local, multicast, IPv6 private.
3. Redirect Protection: Inspect target URL and resolve IP at each redirect step.
4. Response Limits: 5s timeout, 200 KB max response size for manifests (1 MB for streams).
"""

import ipaddress
import logging
import socket
from urllib.parse import urlparse

import httpx

logger = logging.getLogger("app.ssrf_guard")

BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


class SSRFValidationError(Exception):
    """Raised when a URL fails SSRF security checks."""
    pass


def is_ip_blocked(ip_str: str, allow_localhost_dev: bool = True) -> bool:
    """Check if an IP address falls into a private/loopback/link-local network block."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # Invalid IP representation

    if allow_localhost_dev and ip.is_loopback:
        return False

    if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved or ip.is_multicast:
        return True

    for net in BLOCKED_NETWORKS:
        if ip in net:
            return True

    return False


def validate_url_security(url: str, allow_localhost_dev: bool = True) -> None:
    """Validate protocol, resolve hostname to IP, and enforce SSRF safeguards."""
    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()

    if scheme not in ("https", "http"):
        raise SSRFValidationError(f"Invalid URL scheme '{scheme}'. Only HTTPS is allowed.")

    if scheme == "http" and not allow_localhost_dev:
        hostname = (parsed.hostname or "").lower()
        if hostname not in ("localhost", "127.0.0.1"):
            raise SSRFValidationError("HTTP protocol is restricted to local development endpoints.")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFValidationError("Missing hostname in URL.")

    port = parsed.port or (443 if scheme == "https" else 80)

    try:
        addr_info = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise SSRFValidationError(f"Could not resolve hostname '{hostname}'") from exc

    for family, socktype, proto, canonname, sockaddr in addr_info:
        ip_str = sockaddr[0]
        if is_ip_blocked(ip_str, allow_localhost_dev=allow_localhost_dev):
            logger.warning("SSRF Guard blocked request to hostname='%s' resolving to private IP='%s'", hostname, ip_str)
            raise SSRFValidationError(f"Access to private/local IP address '{ip_str}' is forbidden.")


async def safe_http_get(
    url: str,
    max_bytes: int = 204800,  # 200 KB
    timeout_seconds: float = 5.0,
    allow_localhost_dev: bool = True,
) -> bytes:
    """Safely fetch content from an external URL with SSRF guards and size limits."""
    current_url = url
    max_redirects = 5

    for _ in range(max_redirects):
        validate_url_security(current_url, allow_localhost_dev=allow_localhost_dev)

        async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=False) as client:
            try:
                resp = await client.get(current_url, headers={"User-Agent": "Apollo-AddonFetcher/1.0"})
            except httpx.HTTPError as exc:
                raise SSRFValidationError(f"HTTP request failed: {exc}") from exc

            if resp.status_code in (301, 302, 303, 307, 308):
                redirect_target = resp.headers.get("Location")
                if not redirect_target:
                    raise SSRFValidationError("Redirect response missing Location header.")
                # Resolve relative redirect URLs
                current_url = httpx.URL(current_url).join(redirect_target).raw.decode("ascii")
                continue

            if resp.status_code >= 400:
                raise SSRFValidationError(f"Remote server returned HTTP status {resp.status_code}")

            # Check Content-Length header if present
            cl_header = resp.headers.get("Content-Length")
            if cl_header and cl_header.isdigit() and int(cl_header) > max_bytes:
                raise SSRFValidationError(f"Response size exceeds limit of {max_bytes} bytes.")

            content = resp.content
            if len(content) > max_bytes:
                raise SSRFValidationError(f"Response size exceeds limit of {max_bytes} bytes.")

            return content

    raise SSRFValidationError("Too many HTTP redirects.")
