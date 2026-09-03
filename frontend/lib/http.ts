import { API_URL, warnIfProductionPointsAtLocalhost } from "./api";

const GENERIC_ERROR_MESSAGE = "We couldn't load this page right now. Please try again in a moment.";

function sanitizeApiErrorMessage(message: unknown): string {
  if (typeof message !== "string" || !message.trim()) return GENERIC_ERROR_MESSAGE;
  const looksTechnical =
    /(?:\btraceback\b|stack trace|\bat\s+\w+\s*\(|api[_ -]?key\s*=|secret\s*=|https?:\/\/\S+:\d+|backend|vercel|next_public|tmdb|failed to fetch|econnrefused)/i;
  return looksTechnical.test(message) ? GENERIC_ERROR_MESSAGE : message.trim();
}

export class ApiError extends Error {
  status: number;
  technicalDetail: string;
  url?: string;
  retryAfter?: number;

  constructor(status: number, message: string, url?: string, retryAfter?: number) {
    super(sanitizeApiErrorMessage(message));
    this.name = "ApiError";
    this.status = status;
    this.technicalDetail = String(message || "");
    this.url = url;
    this.retryAfter = typeof retryAfter === "number" && Number.isFinite(retryAfter) ? Math.max(0, Math.round(retryAfter)) : undefined;
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : undefined;
}

// How long the HTTP client will wait (max) before auto-retrying a rate-limited
// read. Longer Retry-After values surface as a friendly 429 to the UI instead.
const MAX_AUTO_RETRY_AFTER_S = 5;

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("apollo:access_token");
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem("apollo:access_token", token);
    } else {
      localStorage.removeItem("apollo:access_token");
    }
  } catch {
    /* ignore */
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("apollo:refresh_token");
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem("apollo:refresh_token", token);
    } else {
      localStorage.removeItem("apollo:refresh_token");
    }
  } catch {
    /* ignore */
  }
}

export function clearTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

// Access tokens expire (~15 min). Single shared in-flight refresh so concurrent
// 401s don't fire multiple refresh requests, and dedupe the retry.
let refreshPromise: Promise<boolean> | null = null;

/** Expose a direct one-shot refresh (used to hydrate tokens from httpOnly cookies). */
export async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function refreshTokens(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (refreshToken) {
    headers["Authorization"] = `Bearer ${refreshToken}`;
  }
  return fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers,
    credentials: "include",
  })
    .then(async (r) => {
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) clearTokens();
        return false;
      }
      try {
        const data = await r.json();
        if (data.access_token) setAccessToken(data.access_token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
      } catch {
        /* keep existing tokens */
      }
      return true;
    })
    .catch(() => {
      return false;
    });
}

function canRetryAfter401(path: string): boolean {
  if (path === "/api/v1/auth/me") return true;
  return !path.startsWith("/api/v1/auth/");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function api<T>(path: string, init: RequestInit = {}, revalidate?: number): Promise<T> {
  warnIfProductionPointsAtLocalhost();
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };

  const fullUrl = `${API_URL}${path}`;
  const isReadMethod = !init.method || init.method.toUpperCase() === "GET" || init.method.toUpperCase() === "HEAD";

  const doFetch = () =>
    fetch(fullUrl, {
      ...init,
      headers,
      credentials: "include",
      ...(revalidate ? { next: { revalidate } } : { cache: "no-store" }),
    });

  let res: Response;
  let attempt = 0;
  const maxAttempts = isReadMethod ? 2 : 1; // Automatic single-retry with backoff for GET operations
  let rateLimitRetried = false;

  while (true) {
    try {
      res = await doFetch();
      // Rate-limit (429) comes with a Retry-After hint: for quick reads, back
      // off and retry once instead of bouncing the user to an error screen.
      if (
        isReadMethod &&
        res.status === 429 &&
        !rateLimitRetried
      ) {
        const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
        if (retryAfter !== undefined && retryAfter <= MAX_AUTO_RETRY_AFTER_S) {
          rateLimitRetried = true;
          await sleep(Math.max(400, retryAfter * 1000));
          continue;
        }
      }
      // Retry transient server gateway/unavailable errors (502, 503, 504) once
      if (isReadMethod && attempt < maxAttempts - 1 && (res.status === 502 || res.status === 503 || res.status === 504)) {
        attempt++;
        await sleep(350 * attempt);
        continue;
      }
      break;
    } catch (err) {
      if (isReadMethod && attempt < maxAttempts - 1) {
        attempt++;
        await sleep(350 * attempt);
        continue;
      }
      throw err;
    }
  }

  if (res.status === 401 && canRetryAfter401(path)) {
    if (await refreshTokens()) {
      const newToken = getAccessToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
      }
      res = await doFetch();
    }
  }

  if (res.status === 204) {
    if (path.includes("/logout")) {
      clearTokens();
    }
    return undefined as T;
  }

  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* keep statusText */
    }
    const rawDetailStr = typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new ApiError(res.status, rawDetailStr, fullUrl, parseRetryAfter(res.headers.get("Retry-After")));
  }

  const data = (await res.json()) as T;
  if (data && typeof data === "object") {
    const pair = data as unknown as { access_token?: string; refresh_token?: string };
    if (pair.access_token) setAccessToken(pair.access_token);
    if (pair.refresh_token) setRefreshToken(pair.refresh_token);
  }

  return data;
}

export const get = <T>(path: string, revalidate?: number) => api<T>(path, {}, revalidate);
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
export const put = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
export const patch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });


