const DEFAULT_DEV_API_URL = "http://localhost:8000";
const PRODUCTION_API_URL = "https://apollo-makx.onrender.com";

export const API_URL = resolveApiUrl();
export const TMDB_IMAGE_BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p";

export function getResolvedApiUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
    const explicit = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

    // 1. Mobile or remote browser connection (e.g. phone browsing at 192.168.x.x:3000 or production domain)
    if (!isLocalHost) {
      if (explicit && !isLocalhostUrl(explicit)) {
        return explicit;
      }
      return PRODUCTION_API_URL;
    }

    // 2. Desktop dev mode (localhost/127.0.0.1)
    if (explicit) {
      return explicit;
    }
    return DEFAULT_DEV_API_URL;
  }
  return API_URL;
}

function resolveApiUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  if (explicit) {
    if (isLocalhostUrl(explicit) && process.env.NODE_ENV === "production") {
      return PRODUCTION_API_URL;
    }
    return explicit;
  }
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_VERCEL_ENV) {
    return PRODUCTION_API_URL;
  }
  return DEFAULT_DEV_API_URL;
}

export function warnIfProductionPointsAtLocalhost(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!isLocalhostUrl(API_URL)) return;
  // eslint-disable-next-line no-console
  console.error(
    `[Apollo] NEXT_PUBLIC_API_URL is "${API_URL}" in a production build. Set it to the ` +
      "deployed backend URL (e.g. https://your-api.onrender.com)."
  );
}

function isLocalhostUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function posterUrl(path: string | null, size = "w342"): string {
  if (!path) return "/placeholder-poster.svg";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(path: string | null, size = "w1280"): string {
  if (!path) return "/placeholder-backdrop.svg";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function titleName(item: { title?: string; name?: string }): string {
  return item.title || item.name || "Untitled";
}

export function releaseYear(item: { release_date?: string; first_air_date?: string }): string {
  const d = item.release_date || item.first_air_date || "";
  return d ? d.slice(0, 4) : "";
}