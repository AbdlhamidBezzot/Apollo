import { API_URL, warnIfProductionPointsAtLocalhost } from "./api";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

function sanitizeApiErrorMessage(message: unknown): string {
  if (typeof message !== "string" || !message.trim()) return GENERIC_ERROR_MESSAGE;
  // Only suppress messages that look like internal technical leaks (stack traces, raw secrets, etc.)
  const looksTechnical = /(?:\btraceback\b|stack trace|\bat\s+\w+\s*\(|api[_ -]?key\s*=|secret\s*=|https?:\/\/\S+:\d+)/i;
  return looksTechnical.test(message) ? GENERIC_ERROR_MESSAGE : message;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(sanitizeApiErrorMessage(message));
    this.status = status;
  }
}

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
  // Guarantee there is an in-flight refresh to await.
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
        // Only a confirmed invalid session should sign the user out. A server
        // restart or short network/CORS failure must not erase a valid login.
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
      // Preserve local tokens for a later retry when the API is reachable.
      return false;
    });
}

function canRetryAfter401(path: string): boolean {
  if (path === "/api/v1/auth/me") return true;
  // Auth endpoints (refresh/logout/login/register) must not retry the refresh loop.
  return !path.startsWith("/api/v1/auth/");
}

export async function api<T>(path: string, init: RequestInit = {}, revalidate?: number): Promise<T> {
  warnIfProductionPointsAtLocalhost();
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> || {}),
  };

  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
      ...(revalidate ? { next: { revalidate } } : { cache: "no-store" }),
    });

  let res = await doFetch();
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
    throw new ApiError(res.status, sanitizeApiErrorMessage(detail));
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
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

