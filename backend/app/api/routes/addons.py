"""Add-on Catalog API Routes.

User endpoints (authenticated):
- GET  /api/v1/addons/catalog        → list catalog with user's enabled state
- PATCH /api/v1/addons/catalog/{id}  → toggle enabled/disabled for current user

Admin endpoints are in admin_addons.py (route prefix /api/v1/admin/addons).
"""

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, DbDep
from app.core.ratelimit import rate_limited
from app.models import AddonCatalog, UserAddonPreference, utcnow
from app.schemas import CatalogAddonOut, UserAddonToggle
from fastapi import Depends

router = APIRouter(prefix="/addons", tags=["addons"])


from app.services.addon_fetcher import ManifestValidationError, fetch_and_validate_manifest


def _build_catalog_out(
    catalog_addon: AddonCatalog,
    user_pref: UserAddonPreference | None,
) -> CatalogAddonOut:
    """Merge catalog row + optional user preference into the API response."""
    user_enabled = (
        user_pref.enabled
        if user_pref is not None
        else catalog_addon.is_default_enabled
    )
    custom_url = user_pref.custom_manifest_url if user_pref else None
    return CatalogAddonOut(
        id=catalog_addon.id,
        addon_id=catalog_addon.addon_id,
        name=catalog_addon.name,
        description=catalog_addon.description,
        manifest_url=catalog_addon.manifest_url,
        resources=catalog_addon.resources,
        types=catalog_addon.types,
        tag=catalog_addon.tag,
        status=catalog_addon.status,
        is_default_enabled=catalog_addon.is_default_enabled,
        last_validated_at=catalog_addon.last_validated_at,
        user_enabled=user_enabled,
        custom_manifest_url=custom_url,
    )


@router.get(
    "/catalog",
    response_model=list[CatalogAddonOut],
    dependencies=[Depends(rate_limited("read", "300/minute"))],
)
def list_catalog(user: CurrentUser, db: DbDep) -> list[CatalogAddonOut]:
    """List all non-disabled catalog addons, annotated with the user's current toggle state."""
    catalog = (
        db.query(AddonCatalog)
        .filter(AddonCatalog.status != "disabled")
        .order_by(AddonCatalog.created_at.asc())
        .all()
    )

    catalog_ids = [a.id for a in catalog]
    prefs = (
        db.query(UserAddonPreference)
        .filter(
            UserAddonPreference.user_id == user.id,
            UserAddonPreference.addon_catalog_id.in_(catalog_ids),
        )
        .all()
    )
    pref_map = {p.addon_catalog_id: p for p in prefs}

    return [_build_catalog_out(a, pref_map.get(a.id)) for a in catalog]


@router.patch(
    "/catalog/{catalog_id}",
    response_model=CatalogAddonOut,
    dependencies=[Depends(rate_limited("me", "180/minute"))],
)
async def toggle_user_addon(
    catalog_id: int,
    body: UserAddonToggle,
    user: CurrentUser,
    db: DbDep,
) -> CatalogAddonOut:
    """Enable, disable or configure custom manifest URL for a catalog addon."""
    catalog_addon = db.get(AddonCatalog, catalog_id)
    if not catalog_addon or catalog_addon.status == "disabled":
        raise HTTPException(status_code=404, detail="Add-on not found in catalog.")

    if catalog_addon.status == "broken" and body.enabled:
        raise HTTPException(
            status_code=409,
            detail="This add-on is currently unavailable (broken manifest). Cannot enable.",
        )

    validated_custom_url = None
    if body.custom_manifest_url:
        clean_url = body.custom_manifest_url.strip()
        if clean_url.startswith("stremio://"):
            clean_url = "https://" + clean_url[10:]
        try:
            await fetch_and_validate_manifest(clean_url, force_refresh=True)
            validated_custom_url = clean_url
        except ManifestValidationError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid custom manifest URL: {exc}")

    pref = (
        db.query(UserAddonPreference)
        .filter(
            UserAddonPreference.user_id == user.id,
            UserAddonPreference.addon_catalog_id == catalog_id,
        )
        .first()
    )

    if pref is None:
        pref = UserAddonPreference(
            user_id=user.id,
            addon_catalog_id=catalog_id,
            enabled=body.enabled,
            custom_manifest_url=validated_custom_url,
            created_at=utcnow(),
        )
        db.add(pref)
    else:
        pref.enabled = body.enabled
        if body.custom_manifest_url is not None:
            pref.custom_manifest_url = validated_custom_url

    db.commit()
    db.refresh(pref)

    return _build_catalog_out(catalog_addon, pref)

