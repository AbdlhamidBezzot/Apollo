const DEFAULT_DEV_API_URL = "http://localhost:8000";
const PRODUCTION_API_URL = "https://apollo-makx.onrender.com";

export const API_URL = resolveApiUrl();
export const TMDB_IMAGE_BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p";

export function getResolvedApiUrl(): string {
  if (typeof window !== "undefined") {
    const explicit = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
    if (explicit) return explicit;

    const { hostname, protocol } = window.location;

    // LAN IP local testing (e.g. testing phone on Wi-Fi at http://192.168.1.50:3000)
    if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.0\.0\.1)/.test(hostname)) {
      return `${protocol}//${hostname}:8000`;
    }

    if (hostname === "localhost") {
      return DEFAULT_DEV_API_URL;
    }

    return PRODUCTION_API_URL;
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