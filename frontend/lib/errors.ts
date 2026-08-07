import { ApiError } from "./http";

export type ApiIssueCode =
  | "backend_unreachable"
  | "invalid_api_url"
  | "timeout"
  | "missing_tmdb"
  | "auth_unavailable"
  | "server_error"
  | "unauthorized"
  | "unknown";

export interface ApiIssue {
  code: ApiIssueCode;
  title: string;
  message: string;
  /** Technical detail that is only ever logged in development. */
  detail: string;
}

const DEFAULT_ISSUE: ApiIssue = {
  code: "unknown",
  title: "Something went wrong",
  message: "The service is temporarily unavailable. Please try again shortly.",
  detail: "",
};

export function classifyError(err: unknown): ApiIssue {
  // Network-level failures: browser couldn't even reach the API.
  if (err instanceof TypeError) {
    const msg = String(err.message);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return {
        code: "backend_unreachable",
        title: "Backend unreachable",
        message:
          "We couldn't reach the Apollo API. Check that the backend is deployed and that NEXT_PUBLIC_API_URL points to it.",
        detail: msg,
      };
    }
  }

  // Explicit timeout from our fetch wrapper.
  if (err instanceof Error && /timeout|aborted/i.test(err.message)) {
    return {
      code: "timeout",
      title: "Request timed out",
      message: "The backend took too long to respond. Please try again in a moment.",
      detail: err.message,
    };
  }

  // A malformed API URL fails before any request is sent.
  if (err instanceof Error && /invalid url|not a valid url|failed to parse url/i.test(err.message)) {
    return {
      code: "invalid_api_url",
      title: "Invalid API URL",
      message: "The configured backend URL is invalid. Ask the administrator to check NEXT_PUBLIC_API_URL.",
      detail: err.message,
    };
  }

  if (err instanceof ApiError) {
    const status = err.status;
    if (status === 401) {
      return {
        code: "unauthorized",
        title: "Sign in required",
        message: err.message || "You need to sign in to continue.",
        detail: `API returned 401.`,
      };
    }
    if (status === 403) {
      return {
        code: "auth_unavailable",
        title: "Authentication service unavailable",
        message: err.message || "The authentication service is unavailable. Please try again.",
        detail: `API returned 403.`,
      };
    }
    if (status === 502) {
      return {
        code: "missing_tmdb",
        title: "Content service unavailable",
        message:
          err.message ||
          "The content service is unavailable. Check that TMDB_API_KEY is configured on the backend.",
        detail: `API returned 502 (bad gateway).`,
      };
    }
    if (status >= 500) {
      return {
        code: "server_error",
        title: "Backend error",
        message: err.message || "The backend hit an error. Please try again shortly.",
        detail: `API returned ${status}.`,
      };
    }
    if (status === 429) {
      return {
        code: "server_error",
        title: "Too many requests",
        message: "You've been rate limited. Please wait a moment and try again.",
        detail: "API returned 429.",
      };
    }
    return {
      code: "unknown",
      title: "Request failed",
      message: err.message || DEFAULT_ISSUE.message,
      detail: `API returned ${status}.`,
    };
  }

  if (err instanceof Error) {
    return {
      code: "unknown",
      title: "Something went wrong",
      message: err.message || DEFAULT_ISSUE.message,
      detail: err.message,
    };
  }

  return DEFAULT_ISSUE;
}

/** Log technical details to the console only in development. */
export function logTechnicalDetail(issue: ApiIssue, extra?: unknown): void {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug(`[Apollo:${issue.code}]`, issue.detail, extra ?? "");
  }
}
