export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const TMDB_IMAGE_BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p";

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
