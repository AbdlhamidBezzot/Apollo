export interface HealthPayload {
  status: "ok" | "degraded";
  database: boolean;
  redis: boolean;
  tmdb: boolean;
  version?: string;
  environment?: string;
}

export interface HealthResult {
  ok: boolean;
  payload?: HealthPayload;
  issueCode: string;
}

/** Fetch /health with a short timeout. Prefer cached results to avoid hammering. */
export async function checkBackendHealth(
  apiBase: string,
  timeoutMs = 4000
): Promise<HealthResult> {
  const base = apiBase.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, issueCode: "server_error" };
    }
    const payload = (await res.json()) as HealthPayload;
    const ok = payload.status === "ok" && payload.database && payload.tmdb;
    return { ok, payload, issueCode: ok ? "ok" : "degraded" };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, issueCode: "timeout" };
    }
    return { ok: false, issueCode: "backend_unreachable" };
  } finally {
    clearTimeout(timer);
  }
}