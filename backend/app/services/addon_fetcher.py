"""Add-on Manifest Fetcher and Validator.

Fetches add-on manifests via SSRF Guard, validates strict Stremio schema rules,
and caches validated manifests in Redis.
"""

import hashlib
import json
import logging
from typing import Any

from app.core.cache import get_cache
from app.services.ssrf_guard import SSRFValidationError, safe_http_get

logger = logging.getLogger("app.addon_fetcher")

MANIFEST_CACHE_TTL = 3600  # 1 hour cache


class ManifestValidationError(Exception):
    """Raised when an add-on manifest fails schema or content validation."""
    pass


def validate_manifest_schema(data: Any) -> dict[str, Any]:
    """Validate a parsed JSON payload against the Stremio Add-on Manifest specification."""
    if not isinstance(data, dict):
        raise ManifestValidationError("Manifest payload must be a JSON object.")

    addon_id = data.get("id")
    if not addon_id or not isinstance(addon_id, str):
        raise ManifestValidationError("Manifest must contain a valid string 'id'.")

    name = data.get("name")
    if not name or not isinstance(name, str):
        raise ManifestValidationError("Manifest must contain a valid string 'name'.")

    version = data.get("version")
    if not version or not isinstance(version, str):
        raise ManifestValidationError("Manifest must contain a valid string 'version'.")

    resources = data.get("resources", [])
    if not isinstance(resources, list):
        raise ManifestValidationError("Manifest 'resources' must be a list.")

    # Convert list of resource items (which can be strings or dict objects in Stremio spec)
    parsed_resources = []
    for r in resources:
        if isinstance(r, str):
            parsed_resources.append(r.lower())
        elif isinstance(r, dict) and "name" in r and isinstance(r["name"], str):
            parsed_resources.append(r["name"].lower())

    types = data.get("types", [])
    if not isinstance(types, list) or not all(isinstance(t, str) for t in types):
        raise ManifestValidationError("Manifest 'types' must be a list of strings.")

    parsed_types = [t.lower() for t in types]

    return {
        "id": str(addon_id).strip()[:120],
        "name": str(name).strip()[:120],
        "version": str(version).strip()[:32],
        "description": str(data.get("description", "")).strip()[:500],
        "resources": parsed_resources,
        "types": parsed_types,
        "idPrefixes": data.get("idPrefixes", []),
        "behaviorHints": data.get("behaviorHints", {}),
    }


async def fetch_and_validate_manifest(manifest_url: str, force_refresh: bool = False) -> dict[str, Any]:
    """Fetch, validate, and cache an add-on manifest URL."""
    cache = get_cache()
    url_hash = hashlib.sha256(manifest_url.encode("utf-8")).hexdigest()
    cache_key = f"addon:manifest:{url_hash}"

    if not force_refresh:
        cached = cache.get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except (ValueError, TypeError):
                pass

    try:
        raw_bytes = await safe_http_get(manifest_url, max_bytes=204800, timeout_seconds=5.0)
    except SSRFValidationError as exc:
        logger.warning("Manifest SSRF validation failed for url='%s': %s", manifest_url, str(exc))
        raise ManifestValidationError(f"Invalid or unsafe manifest URL: {exc}") from exc

    try:
        json_data = json.loads(raw_bytes.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ManifestValidationError("Manifest response is not valid UTF-8 JSON.") from exc

    validated = validate_manifest_schema(json_data)

    try:
        cache.set(cache_key, json.dumps(validated), MANIFEST_CACHE_TTL)
    except Exception as exc:
        logger.warning("Failed to cache manifest in Redis: %s", str(exc))

    return validated
