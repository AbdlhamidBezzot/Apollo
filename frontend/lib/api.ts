const DEFAULT_API_URL = "http://localhost:8000";

export const API_URL = resolveApiUrl();
export const TMDB_IMAGE_BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p";

function resolveApiUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  if (process.env.NEXT_PUBLIC_VERCEL_ENV && process.env.NODE_ENV === "production") {
    // Deployed on Vercel without NEXT_PUBLIC_API_URL: there is no proxy, so a
    // relative URL would silently 404. Surface the misconfiguration loudly.
    // eslint-disable-next-line no-console
    console.error(
      "[Apollo] NEXT_PUBLIC_API_URL is not set on Vercel. The frontend cannot reach the " +
        "production backend. Set NEXT_PUBLIC_API_URL to your deployed API root."
    );
  }
  return DEFAULT_API_URL;
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