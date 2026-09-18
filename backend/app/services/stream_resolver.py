"""Stream & Subtitle Resolver Service for Apollo Add-ons.

Queries active user add-ons in parallel, isolates errors, maps TMDB IDs to IMDb IDs,
and normalizes outputs into ApolloStream and ApolloSubtitle contracts.
"""

import asyncio
import hashlib
import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.core.cache import get_cache
from app.models import AddonCatalog, UserAddonPreference
from app.services.ssrf_guard import SSRFValidationError, safe_http_get
from app.services.tmdb import tmdb

logger = logging.getLogger("app.stream_resolver")

STREAM_CACHE_TTL = 300  # 5 minutes


async def get_imdb_id(tmdb_id: int, media_type: str) -> str | None:
    """Fetch IMDb ID from TMDB external_ids."""
    try:
        data = await tmdb.external_ids(media_type, tmdb_id)
        imdb_id = data.get("imdb_id")
        if imdb_id and isinstance(imdb_id, str):
            return imdb_id.strip()
    except Exception as exc:
        logger.warning("Could not resolve IMDb ID for tmdb_id=%d media_type='%s': %s", tmdb_id, media_type, str(exc))
    return None


def format_stremio_id(imdb_id: str | None, tmdb_id: int, media_type: str, season: int | None = None, episode: int | None = None) -> str:
    """Format title ID for Stremio add-on specification (e.g. tt1234567 or tt1234567:1:1)."""
    base_id = imdb_id or f"tmdb:{tmdb_id}"
    if media_type == "tv" or (season is not None and episode is not None):
        s = season or 1
        e = episode or 1
        return f"{base_id}:{s}:{e}"
    return base_id


def classify_stream(raw_stream: dict[str, Any], addon_id: str, addon_name: str, index: int) -> dict[str, Any]:
    """Normalize raw Stremio stream object into ApolloStream schema."""
    url = raw_stream.get("url") or ""
    info_hash = raw_stream.get("infoHash")
    magnet = raw_stream.get("magnet") or (url if url.startswith("magnet:") else None)
    if not magnet and info_hash:
        file_idx = raw_stream.get("fileIdx", 0)
        magnet = f"magnet:?xt=urn:btih:{info_hash}"
    if not url and magnet:
        url = magnet

    is_torrent = bool(info_hash or magnet or ".torrent" in url.lower())
    is_direct = bool(url and (url.startswith("http://") or url.startswith("https://")) and not is_torrent)


    title = raw_stream.get("title") or raw_stream.get("name") or f"Source {index + 1}"

    # Extract quality tag if present in title
    quality = None
    title_lower = title.lower()
    if "4k" in title_lower or "2160p" in title_lower:
        quality = "4K"
    elif "1080p" in title_lower or "fhd" in title_lower:
        quality = "1080p"
    elif "720p" in title_lower or "hd" in title_lower:
        quality = "720p"
    elif "480p" in title_lower or "sd" in title_lower:
        quality = "480p"

    stream_id = f"{addon_id}:{index}:{hashlib.md5(title.encode('utf-8')).hexdigest()[:8]}"

    subtitles = []
    if isinstance(raw_stream.get("subtitles"), list):
        for sub in raw_stream["subtitles"]:
            if isinstance(sub, dict) and sub.get("url"):
                subtitles.append({
                    "id": str(sub.get("id") or sub["url"]),
                    "language": str(sub.get("lang") or sub.get("language") or "en"),
                    "url": str(sub["url"]),
                })

    return {
        "id": stream_id,
        "addonId": addon_id,
        "addonName": addon_name,
        "title": title,
        "quality": quality,
        "language": raw_stream.get("language"),
        "url": url,
        "isDirect": is_direct,
        "isTorrent": is_torrent,
        "subtitles": subtitles,
        "metadata": {
            "behaviorHints": raw_stream.get("behaviorHints", {}),
            "format": "mp4" if is_direct else ("torrent" if is_torrent else "other"),
        },
    }


async def fetch_addon_streams(addon: AddonCatalog, media_type: str, stremio_id: str) -> list[dict[str, Any]]:
    """Query a single add-on stream endpoint with isolation, timeout, and mirror fallback."""
    manifest_base = addon.manifest_url.rstrip("/")
    if manifest_base.endswith("/manifest.json"):
        manifest_base = manifest_base[:-14]

    stremio_type = "series" if media_type == "tv" else media_type

    bases = [manifest_base]
    if "torrentio.strem.fun/lite" in manifest_base:
        bases.append(manifest_base.replace("torrentio.strem.fun/lite", "torrentio.strem.fun"))
    elif "torrentio.strem.fun" in manifest_base and "torrentio.strem.fun/lite" not in manifest_base:
        bases.append(manifest_base.replace("torrentio.strem.fun", "torrentio.strem.fun/lite"))

    last_error = None
    for base in bases:
        endpoint_url = f"{base}/stream/{stremio_type}/{stremio_id}.json"
        try:
            raw_bytes = await safe_http_get(endpoint_url, max_bytes=1048576, timeout_seconds=5.0)
            data = json.loads(raw_bytes.decode("utf-8"))
            raw_streams = data.get("streams", [])
            if not isinstance(raw_streams, list) or not raw_streams:
                continue

            normalized = []
            for idx, item in enumerate(raw_streams):
                if isinstance(item, dict):
                    normalized.append(classify_stream(item, addon.addon_id, addon.name, idx))
            if normalized:
                return normalized

        except (SSRFValidationError, json.JSONDecodeError, Exception) as exc:
            last_error = exc
            logger.warning("Addon stream fetch attempt failed for addon_name='%s' url='%s': %s", addon.name, endpoint_url, str(exc))

    if last_error:
        logger.warning("Addon stream fetch permanently failed for addon_name='%s': %s", addon.name, str(last_error))
    return []


async def fetch_addon_subtitles(addon: AddonCatalog, media_type: str, stremio_id: str) -> list[dict[str, Any]]:
    """Query a single add-on subtitles endpoint with isolation, timeout, and mirror fallback."""
    manifest_base = addon.manifest_url.rstrip("/")
    if manifest_base.endswith("/manifest.json"):
        manifest_base = manifest_base[:-14]

    stremio_type = "series" if media_type == "tv" else media_type

    bases = [manifest_base]
    if "torrentio.strem.fun/lite" in manifest_base:
        bases.append(manifest_base.replace("torrentio.strem.fun/lite", "torrentio.strem.fun"))
    elif "torrentio.strem.fun" in manifest_base and "torrentio.strem.fun/lite" not in manifest_base:
        bases.append(manifest_base.replace("torrentio.strem.fun", "torrentio.strem.fun/lite"))

    for base in bases:
        endpoint_url = f"{base}/subtitles/{stremio_type}/{stremio_id}.json"
        try:
            raw_bytes = await safe_http_get(endpoint_url, max_bytes=524288, timeout_seconds=5.0)
            data = json.loads(raw_bytes.decode("utf-8"))
            raw_subs = data.get("subtitles", [])
            if not isinstance(raw_subs, list) or not raw_subs:
                continue

            normalized = []
            for item in raw_subs:
                if isinstance(item, dict) and item.get("url"):
                    sub_id = str(item.get("id") or item["url"])
                    lang = str(item.get("lang") or item.get("language") or "en")
                    normalized.append({
                        "id": f"{addon.addon_id}:{sub_id}",
                        "language": lang,
                        "url": str(item["url"]),
                    })
            if normalized:
                return normalized

        except (SSRFValidationError, json.JSONDecodeError, Exception) as exc:
            logger.warning("Addon subtitle fetch attempt failed for addon_name='%s' url='%s': %s", addon.name, endpoint_url, str(exc))

    return []



async def resolve_streams_for_user(
    user_id: int | None,
    db: Session,
    tmdb_id: int,
    media_type: str,
    season: int | None = None,
    episode: int | None = None,
) -> list[dict[str, Any]]:
    """Aggregate streams across all active user add-ons."""
    cache = get_cache()
    uid = user_id if user_id is not None else 0
    cache_key = f"addon:streams:{uid}:{tmdb_id}:{media_type}:{season or 0}:{episode or 0}"
    cached = cache.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except (ValueError, TypeError):
            pass

    if user_id is not None:
        enabled_catalog_ids_subq = (
            db.query(UserAddonPreference.addon_catalog_id)
            .filter(
                UserAddonPreference.user_id == user_id,
                UserAddonPreference.enabled == True,
            )
        )
        default_enabled_no_pref_subq = (
            db.query(AddonCatalog.id)
            .filter(
                AddonCatalog.is_default_enabled == True,
                AddonCatalog.id.notin_(
                    db.query(UserAddonPreference.addon_catalog_id)
                    .filter(UserAddonPreference.user_id == user_id)
                ),
            )
        )
        addons = (
            db.query(AddonCatalog)
            .filter(
                AddonCatalog.status == "active",
                AddonCatalog.id.in_(enabled_catalog_ids_subq.union(default_enabled_no_pref_subq)),
            )
            .all()
        )
    else:
        addons = (
            db.query(AddonCatalog)
            .filter(
                AddonCatalog.status == "active",
                AddonCatalog.is_default_enabled == True,
            )
            .all()
        )

    custom_url_map = {}
    if user_id is not None:
        user_prefs = (
            db.query(UserAddonPreference)
            .filter(UserAddonPreference.user_id == user_id, UserAddonPreference.custom_manifest_url.isnot(None))
            .all()
        )
        custom_url_map = {p.addon_catalog_id: p.custom_manifest_url for p in user_prefs if p.custom_manifest_url}

    stremio_type = "series" if media_type == "tv" else media_type
    matching_addons = [
        a for a in addons
        if "stream" in a.resources and (media_type in a.types or stremio_type in a.types or not a.types)
    ]

    if not matching_addons:
        return []

    imdb_id = await get_imdb_id(tmdb_id, media_type)
    stremio_id = format_stremio_id(imdb_id, tmdb_id, media_type, season, episode)

    tasks = []
    for addon in matching_addons:
        target = addon
        if addon.id in custom_url_map:
            target = AddonCatalog(
                id=addon.id,
                addon_id=addon.addon_id,
                name=addon.name,
                description=addon.description,
                manifest_url=custom_url_map[addon.id],
                resources=addon.resources,
                types=addon.types,
                tag=addon.tag,
                status=addon.status,
            )
        tasks.append(fetch_addon_streams(target, media_type, stremio_id))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    aggregated_streams = []
    for res in results:
        if isinstance(res, list):
            aggregated_streams.extend(res)

    try:
        cache.set(cache_key, json.dumps(aggregated_streams), STREAM_CACHE_TTL)
    except Exception as exc:
        logger.warning("Failed to cache aggregated streams in Redis: %s", str(exc))

    return aggregated_streams


async def resolve_subtitles_for_user(
    user_id: int | None,
    db: Session,
    tmdb_id: int,
    media_type: str,
    season: int | None = None,
    episode: int | None = None,
) -> list[dict[str, Any]]:
    """Aggregate subtitles across all active user add-ons."""
    cache = get_cache()
    uid = user_id if user_id is not None else 0
    cache_key = f"addon:subtitles:{uid}:{tmdb_id}:{media_type}:{season or 0}:{episode or 0}"
    cached = cache.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except (ValueError, TypeError):
            pass

    if user_id is not None:
        enabled_catalog_ids_subq = (
            db.query(UserAddonPreference.addon_catalog_id)
            .filter(
                UserAddonPreference.user_id == user_id,
                UserAddonPreference.enabled == True,
            )
        )
        default_enabled_no_pref_subq = (
            db.query(AddonCatalog.id)
            .filter(
                AddonCatalog.is_default_enabled == True,
                AddonCatalog.id.notin_(
                    db.query(UserAddonPreference.addon_catalog_id)
                    .filter(UserAddonPreference.user_id == user_id)
                ),
            )
        )
        addons = (
            db.query(AddonCatalog)
            .filter(
                AddonCatalog.status == "active",
                AddonCatalog.id.in_(enabled_catalog_ids_subq.union(default_enabled_no_pref_subq)),
            )
            .all()
        )
    else:
        addons = (
            db.query(AddonCatalog)
            .filter(
                AddonCatalog.status == "active",
                AddonCatalog.is_default_enabled == True,
            )
            .all()
        )

    custom_url_map = {}
    if user_id is not None:
        user_prefs = (
            db.query(UserAddonPreference)
            .filter(UserAddonPreference.user_id == user_id, UserAddonPreference.custom_manifest_url.isnot(None))
            .all()
        )
        custom_url_map = {p.addon_catalog_id: p.custom_manifest_url for p in user_prefs if p.custom_manifest_url}

    stremio_type = "series" if media_type == "tv" else media_type
    matching_addons = [
        a for a in addons
        if "subtitles" in a.resources and (media_type in a.types or stremio_type in a.types or not a.types)
    ]

    if not matching_addons:
        return []

    imdb_id = await get_imdb_id(tmdb_id, media_type)
    stremio_id = format_stremio_id(imdb_id, tmdb_id, media_type, season, episode)

    tasks = []
    for addon in matching_addons:
        target = addon
        if addon.id in custom_url_map:
            target = AddonCatalog(
                id=addon.id,
                addon_id=addon.addon_id,
                name=addon.name,
                description=addon.description,
                manifest_url=custom_url_map[addon.id],
                resources=addon.resources,
                types=addon.types,
                tag=addon.tag,
                status=addon.status,
            )
        tasks.append(fetch_addon_subtitles(target, media_type, stremio_id))

    results = await asyncio.gather(*tasks, return_exceptions=True)


    aggregated_subs = []
    for res in results:
        if isinstance(res, list):
            aggregated_subs.extend(res)

    try:
        cache.set(cache_key, json.dumps(aggregated_subs), STREAM_CACHE_TTL)
    except Exception as exc:
        logger.warning("Failed to cache aggregated subtitles in Redis: %s", str(exc))

    return aggregated_subs

