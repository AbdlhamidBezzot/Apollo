"""Addon Catalog Revalidation Cron.

Runs every 6 hours as an asyncio background task started in app lifespan.
For each active/broken catalog entry, re-fetches the manifest and updates
the status field accordingly. Broken addons are hidden from stream results
but remain visible in the UI with an "Unavailable" badge.
"""

import asyncio
import logging
from datetime import UTC, datetime

from app.db import SessionLocal
from app.models import AddonCatalog
from app.services.addon_fetcher import ManifestValidationError, fetch_and_validate_manifest

logger = logging.getLogger("app.addon_cron")

REVALIDATION_INTERVAL_SECONDS = 6 * 3600  # 6 hours


async def _revalidate_all() -> None:
    """One revalidation pass over the full catalog."""
    db = SessionLocal()
    try:
        addons = (
            db.query(AddonCatalog)
            .filter(AddonCatalog.status.in_(["active", "broken"]))
            .all()
        )
        logger.info("Addon cron: revalidating %d catalog entries.", len(addons))

        for addon in addons:
            try:
                await fetch_and_validate_manifest(addon.manifest_url, force_refresh=True)
                addon.status = "active"
                addon.last_validated_at = datetime.now(UTC)
                logger.debug("Addon '%s' revalidated OK.", addon.name)
            except ManifestValidationError as exc:
                addon.status = "broken"
                logger.warning(
                    "Addon '%s' failed revalidation — marking broken: %s", addon.name, exc
                )
            except Exception as exc:
                logger.warning(
                    "Addon '%s' unexpected error during revalidation: %s", addon.name, exc
                )

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Addon cron: unhandled error during revalidation pass.")
    finally:
        db.close()


async def run_addon_revalidation_cron() -> None:
    """Infinite loop: wait 6h, revalidate, repeat. Designed to be started via asyncio.create_task."""
    logger.info("Addon revalidation cron started (interval=%ds).", REVALIDATION_INTERVAL_SECONDS)
    while True:
        try:
            await asyncio.sleep(REVALIDATION_INTERVAL_SECONDS)
            await _revalidate_all()
        except asyncio.CancelledError:
            logger.info("Addon revalidation cron cancelled.")
            break
        except Exception:
            logger.exception("Addon cron: unexpected top-level error, will retry next cycle.")
