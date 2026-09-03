"""Seed the addon_catalog table with curated default add-ons.

Called once at startup via init_db(). Idempotent — skips inserts if
the catalog already has entries so re-deploys never duplicate rows.
"""

import json
import logging
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import AddonCatalog

logger = logging.getLogger("app.seed_catalog")

_DEFAULT_ADDONS = [
    {
        "addon_id": "com.stremio.torrentio",
        "name": "Torrentio Lite",
        "description": (
            "Lightweight edition of Torrentio configured for web playback (1080p/4K). "
            "Aggregates streams from public indexes."
        ),
        "manifest_url": "https://torrentio.strem.fun/lite/manifest.json",
        "resources": ["stream"],
        "types": ["movie", "series"],
        "tag": "community",
        "status": "active",
        "is_default_enabled": True,
    },
    {
        "addon_id": "org.stremio.public-domain-test",
        "name": "Public Domain Test Addon",
        "description": (
            "Legal dev addon serving public domain movies (Big Buck Bunny, Elephants Dream). "
            "Requires a local server on port 8005 — for development only."
        ),
        "manifest_url": "http://localhost:8005/manifest.json",
        "resources": ["stream"],
        "types": ["movie"],
        "tag": "dev",
        "status": "active",
        "is_default_enabled": False,
    },
]


def seed_catalog() -> None:
    """Insert default catalog entries if missing or update default_enabled."""
    db: Session = SessionLocal()
    try:
        now = datetime.now(UTC)
        for entry in _DEFAULT_ADDONS:
            existing = db.query(AddonCatalog).filter(AddonCatalog.addon_id == entry["addon_id"]).first()
            if existing:
                if entry["addon_id"] == "com.stremio.torrentio":
                    existing.manifest_url = entry["manifest_url"]
                    existing.name = entry["name"]
                    existing.description = entry["description"]
                    existing.is_default_enabled = True
                    existing.status = "active"
            else:

                addon = AddonCatalog(
                    addon_id=entry["addon_id"],
                    name=entry["name"],
                    description=entry["description"],
                    manifest_url=entry["manifest_url"],
                    resources=entry["resources"],
                    types=entry["types"],
                    tag=entry["tag"],
                    status=entry["status"],
                    is_default_enabled=entry["is_default_enabled"],
                    last_validated_at=now,
                    created_at=now,
                )
                db.add(addon)

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to seed addon catalog.")
    finally:
        db.close()

