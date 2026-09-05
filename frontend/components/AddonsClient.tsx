"use client";

import { useEffect, useState } from "react";
import { get, patch } from "@/lib/http";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import type { CatalogAddonOut } from "@/lib/types";

function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function TorrentioConfigModal({
  addon,
  onClose,
  onSave,
}: {
  addon: CatalogAddonOut;
  onClose: () => void;
  onSave: (manifestUrl: string) => Promise<void>;
}) {
  const [debridProvider, setDebridProvider] = useState<string>("none");
  const [debridApiKey, setDebridApiKey] = useState<string>("");
  const [customUrlInput, setCustomUrlInput] = useState<string>(
    addon.custom_manifest_url || ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let finalUrl = customUrlInput.trim();
      if (!finalUrl && debridProvider !== "none" && debridApiKey.trim()) {
        const key = debridApiKey.trim();
        finalUrl = `https://torrentio.strem.fun/lite/${debridProvider}=${key}/manifest.json`;
      }
      if (!finalUrl) {
        finalUrl = "https://torrentio.strem.fun/lite/manifest.json";
      }
      await onSave(finalUrl);
      onClose();
    } catch (err: unknown) {
      const detail =
        (err as { detail?: string })?.detail ||
        "Impossible de sauvegarder la configuration.";
      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-text-vivid flex items-center gap-2">
              ⚙️ Configurer Torrentio Lite
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Personnalise tes options ou ajoute une clé Debrid pour du streaming instantané.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-text-muted hover:text-text-vivid"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 py-5">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Option A: Quick Debrid configuration */}
          <div className="rounded-2xl border border-white/5 bg-white/2 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-soft">
              1. Service Debrid (Optionnel - Buffer gratuit/ultra rapide)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "none", label: "Aucun (P2P direct)" },
                { id: "realdebrid", label: "RealDebrid" },
                { id: "alldebrid", label: "AllDebrid" },
                { id: "premiumize", label: "Premiumize" },
                { id: "torbox", label: "TorBox" },
                { id: "debridlink", label: "Debrid-Link" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDebridProvider(p.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                    debridProvider === p.id
                      ? "border-brand bg-brand/15 text-white"
                      : "border-white/10 text-text-muted hover:border-white/20"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {debridProvider !== "none" && (
              <div className="mt-2">
                <label className="block text-xs text-text-muted mb-1 font-medium">
                  Clé API {debridProvider.toUpperCase()} :
                </label>
                <input
                  type="password"
                  value={debridApiKey}
                  onChange={(e) => setDebridApiKey(e.target.value)}
                  placeholder="Colle ta clé API Debrid ici..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-text-vivid outline-none focus:border-brand/60"
                />
              </div>
            )}
          </div>

          {/* Option B: Direct Configured Manifest URL */}
          <div className="rounded-2xl border border-white/5 bg-white/2 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-soft">
                2. Ou colle une URL configurée directement
              </h3>
              <a
                href="https://torrentio.strem.fun/lite/configure"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-brand-soft hover:underline flex items-center gap-1"
              >
                Ouvrir torrentio.strem.fun ↗
              </a>
            </div>
            <p className="text-[11px] text-text-muted">
              Si tu as généré une URL personnalisée sur{" "}
              <span className="font-mono text-text-vivid">torrentio.strem.fun/lite/configure</span>, colle-la ci-dessous :
            </p>
            <input
              type="text"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              placeholder="https://torrentio.strem.fun/lite/providers=yts,eztv/manifest.json"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-text-vivid outline-none focus:border-brand/60 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-text-muted hover:text-text-vivid"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white shadow-brand-glow hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
            Enregistrer la configuration
          </button>
        </div>
      </div>
    </div>
  );
}

function CatalogCard({
  addon,
  onToggle,
  onConfigure,
}: {
  addon: CatalogAddonOut;
  onToggle: (id: number, enabled: boolean) => Promise<void>;
  onConfigure: (addon: CatalogAddonOut) => void;
}) {
  const [busy, setBusy] = useState(false);
  const isBroken = addon.status === "broken";
  const isTorrentio = addon.addon_id === "com.stremio.torrentio";

  const handleToggle = async () => {
    if (isBroken || busy) return;
    setBusy(true);
    await onToggle(addon.id, !addon.user_enabled);
    setBusy(false);
  };

  const getTagBadge = () => {
    switch (addon.tag) {
      case "official":
        return "bg-brand/15 text-brand-soft border-brand/30";
      case "dev":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "community":
      default:
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    }
  };

  return (
    <div
      className={`glass group relative rounded-2xl border p-5 transition-all duration-300 ${
        isBroken
          ? "border-red-500/20 bg-red-500/5 opacity-60"
          : addon.user_enabled
          ? "border-brand/40 bg-brand/5 shadow-brand-glow/10"
          : "border-white/10 opacity-80 hover:border-white/20 hover:opacity-100"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="font-semibold text-text-vivid text-base truncate">{addon.name}</h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${getTagBadge()}`}
            >
              {addon.tag}
            </span>
            {addon.custom_manifest_url && (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                Personnalisé
              </span>
            )}
            {isBroken && (
              <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">
                Indisponible
              </span>
            )}
          </div>

          <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{addon.description}</p>

          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            {addon.resources.map((r) => (
              <span key={r} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-text-vivid">
                {r}
              </span>
            ))}
            {addon.types.map((t) => (
              <span key={t} className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-text-muted uppercase">
                {t}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[10px] text-text-muted/60">
              Dernière vérification : {formatDate(addon.last_validated_at)}
            </p>

            {isTorrentio && (
              <button
                onClick={() => onConfigure(addon)}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-brand-soft transition hover:border-brand/40 hover:bg-brand/10 flex items-center gap-1"
              >
                ⚙️ Configurer Torrentio
              </button>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <button
            onClick={handleToggle}
            disabled={isBroken || busy}
            title={
              isBroken
                ? "Addon indisponible (manifest broken)"
                : addon.user_enabled
                ? "Désactiver l'addon"
                : "Activer l'addon"
            }
            aria-label={addon.user_enabled ? "Disable addon" : "Enable addon"}
            className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${
              isBroken
                ? "bg-white/5 cursor-not-allowed"
                : addon.user_enabled
                ? "bg-brand"
                : "bg-white/15 hover:bg-white/25"
            } ${busy ? "opacity-50" : ""}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
                addon.user_enabled ? "translate-x-[22px]" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddonsClient() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [addons, setAddons] = useState<CatalogAddonOut[]>([]);
  const [fetching, setFetching] = useState(true);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [configuringAddon, setConfiguringAddon] = useState<CatalogAddonOut | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    get<CatalogAddonOut[]>("/api/v1/addons/catalog")
      .then((res) => setAddons(res))
      .catch(() => setAddons([]))
      .finally(() => setFetching(false));
  }, [user]);

  const handleToggle = async (id: number, enabled: boolean) => {
    setToggleError(null);
    setAddons((prev) =>
      prev.map((a) => (a.id === id ? { ...a, user_enabled: enabled } : a))
    );

    try {
      const updated = await patch<CatalogAddonOut>(`/api/v1/addons/catalog/${id}`, {
        enabled,
      });
      setAddons((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err: unknown) {
      setAddons((prev) =>
        prev.map((a) => (a.id === id ? { ...a, user_enabled: !enabled } : a))
      );
      const detail =
        (err as { detail?: string })?.detail ||
        "Impossible de modifier cet addon.";
      setToggleError(detail);
    }
  };

  const handleSaveConfig = async (manifestUrl: string) => {
    if (!configuringAddon) return;
    const id = configuringAddon.id;
    const updated = await patch<CatalogAddonOut>(`/api/v1/addons/catalog/${id}`, {
      enabled: true,
      custom_manifest_url: manifestUrl,
    });
    setAddons((prev) => prev.map((a) => (a.id === id ? updated : a)));
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 lg:pl-[calc(72px+2rem)]">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-text-vivid">Add-ons</h1>
        <p className="mt-2 text-sm text-text-muted leading-relaxed max-w-2xl">
          Active et personnalise tes addons (Torrentio Lite, Debrid API, etc.). Apollo les interroge automatiquement quand tu lances un film ou une série.
        </p>
      </div>

      {toggleError && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          {toggleError}
        </div>
      )}

      {/* Catalog Grid */}
      <section>
        {fetching ? (
          <div className="flex items-center gap-3 text-sm text-text-muted py-12">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            Chargement du catalogue d'add-ons…
          </div>
        ) : addons.length === 0 ? (
          <div className="glass rounded-2xl border border-white/5 px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <svg className="h-8 w-8 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-text-muted">Aucun addon disponible pour le moment</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            {addons.map((addon) => (
              <CatalogCard
                key={addon.id}
                addon={addon}
                onToggle={handleToggle}
                onConfigure={(a) => setConfiguringAddon(a)}
              />
            ))}
          </div>
        )}
      </section>

      {configuringAddon && (
        <TorrentioConfigModal
          addon={configuringAddon}
          onClose={() => setConfiguringAddon(null)}
          onSave={handleSaveConfig}
        />
      )}

      {/* Security notice */}
      <div className="mt-10 rounded-2xl border border-white/5 bg-white/2 px-5 py-4">
        <p className="text-xs text-text-muted/70 leading-relaxed">
          <span className="font-semibold text-text-muted">🔒 Sécurité & Confidentialité :</span>{" "}
          Tous les add-ons du catalogue sont validés par Apollo et sécurisés contre les attaques SSRF.
          Les requêtes d'addons sont exécutées directement par le serveur backend Apollo de manière isolée.
        </p>
      </div>
    </main>
  );
}
