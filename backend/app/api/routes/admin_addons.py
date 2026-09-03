"""Admin-only Add-on Catalog Management Routes.

All endpoints require is_admin == True on the current user.
- POST   /api/v1/admin/addons        → add addon to catalog (validates manifest)
- PATCH  /api/v1/admin/addons/{id}   → edit tag/description/status/is_default_enabled
- DELETE /api/v1/admin/addons/{id}   → remove from catalog
"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import CurrentUser, DbDep
from app.models import AddonCatalog, User, utcnow
from app.schemas import AdminAddonCreate, AdminAddonUpdate, CatalogAddonOut
from app.services.addon_fetcher import ManifestValidationError, fetch_and_validate_manifest

router = APIRouter(prefix="/admin/addons", tags=["admin-addons"])


def _require_admin(user: CurrentUser) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


AdminUser = Annotated[User, Depends(_require_admin)]


@router.post("", response_model=CatalogAddonOut, status_code=201)
async def admin_add_catalog_addon(
    req: AdminAddonCreate,
    user: AdminUser,
    db: DbDep,
) -> CatalogAddonOut:
    """Validate manifest URL and add addon to global catalog."""
    try:
        manifest = await fetch_and_validate_manifest(req.manifest_url, force_refresh=True)
    except ManifestValidationError as exc:
        raise HTTPException(status_code=400, detail=f"Manifest validation failed: {exc}")

    existing = (
        db.query(AddonCatalog)
        .filter(AddonCatalog.manifest_url == req.manifest_url)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This manifest URL is already in the catalog.")

    now = utcnow()
    addon = AddonCatalog(
        addon_id=manifest["id"],
        name=manifest["name"],
        description=req.description or manifest.get("description", ""),
        manifest_url=req.manifest_url,
        resources=manifest["resources"],
        types=manifest["types"],
        tag=req.tag,
        status="active",
        is_default_enabled=req.is_default_enabled,
        last_validated_at=now,
        created_at=now,
    )
    db.add(addon)
    db.commit()
    db.refresh(addon)

    return CatalogAddonOut(
        id=addon.id,
        addon_id=addon.addon_id,
        name=addon.name,
        description=addon.description,
        manifest_url=addon.manifest_url,
        resources=addon.resources,
        types=addon.types,
        tag=addon.tag,
        status=addon.status,
        is_default_enabled=addon.is_default_enabled,
        last_validated_at=addon.last_validated_at,
        user_enabled=addon.is_default_enabled,
    )


@router.patch("/{catalog_id}", response_model=CatalogAddonOut)
def admin_update_catalog_addon(
    catalog_id: int,
    req: AdminAddonUpdate,
    user: AdminUser,
    db: DbDep,
) -> CatalogAddonOut:
    """Update addon metadata: tag, description, status, is_default_enabled."""
    addon = db.get(AddonCatalog, catalog_id)
    if not addon:
        raise HTTPException(status_code=404, detail="Addon not found.")

    if req.tag is not None:
        addon.tag = req.tag
    if req.description is not None:
        addon.description = req.description
    if req.is_default_enabled is not None:
        addon.is_default_enabled = req.is_default_enabled
    if req.status is not None:
        addon.status = req.status

    db.commit()
    db.refresh(addon)

    return CatalogAddonOut(
        id=addon.id,
        addon_id=addon.addon_id,
        name=addon.name,
        description=addon.description,
        manifest_url=addon.manifest_url,
        resources=addon.resources,
        types=addon.types,
        tag=addon.tag,
        status=addon.status,
        is_default_enabled=addon.is_default_enabled,
        last_validated_at=addon.last_validated_at,
        user_enabled=addon.is_default_enabled,
    )


@router.delete("/{catalog_id}", status_code=204)
def admin_delete_catalog_addon(
    catalog_id: int,
    user: AdminUser,
    db: DbDep,
) -> None:
    """Remove an addon from the catalog (cascades user preferences)."""
    addon = db.get(AddonCatalog, catalog_id)
    if not addon:
        raise HTTPException(status_code=404, detail="Addon not found.")

    db.delete(addon)
    db.commit()
