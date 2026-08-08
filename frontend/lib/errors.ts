import { ApiError } from "./http";

export type ApiIssueCode =
  | "backend_unreachable"
  | "invalid_api_url"
  | "timeout"
  | "missing_tmdb"
  | "auth_unavailable"
  | "server_error"
  | "rate_limited"
  | "unauthorized"
  | "unknown";

export interface ApiIssue {
  code: ApiIssueCode;
  title: string;
  message: string;
  /** Technical detail that is logged for developers only. */
  detail: string;
  status?: number;
  url?: string;
  stack?: string;
  /** Seconds the client should wait before retrying (from the Retry-After header). */
  retryAfter?: number;
}

export const DEFAULT_USER_TITLE = "Something went wrong";
export const DEFAULT_USER_MESSAGE = "We couldn't load this page right now. Please try again in a moment.";
export const CONNECTION_USER_MESSAGE = "We couldn't connect right now. Please try again.";

const DEFAULT_ISSUE: ApiIssue = {
  code: "unknown",
  title: DEFAULT_USER_TITLE,
  message: DEFAULT_USER_MESSAGE,
  detail: "",
};

const CONNECTION_ISSUE: ApiIssue = {
  code: "backend_unreachable",
  title: DEFAULT_USER_TITLE,
  message: CONNECTION_USER_MESSAGE,
  detail: "",
};

const TECHNICAL_PATTERNS = [
  /backend/i,
  /vercel/i,
  /next_public/i,
  /env/i,
  /tmdb/i,
  /failed to fetch/i,
  /networkerror/i,
  /load failed/i,
  /econnrefused/i,
  /timeout/i,
  /aborted/i,
  /500 internal server error/i,
  /http:\/\//i,
  /https:\/\//i,
  /stack trace/i,
  /traceback/i,
];

/** Check if a string contains technical or internal developer terminology. */
export function isTechnicalMessage(msg: string): boolean {
  if (!msg) return false;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(msg));
}

/** Sanitize any error message for end users. */
export function sanitizeUserMessage(msg: string | undefined | null, defaultMsg = DEFAULT_USER_MESSAGE): string {
  if (!msg || typeof msg !== "string" || !msg.trim()) return defaultMsg;
  if (isTechnicalMessage(msg)) return defaultMsg;
  return msg.trim();
}

export function classifyError(err: unknown): ApiIssue {
  if (err instanceof TypeError) {
    const msg = String(err.message || "");
    if (/failed to fetch|networkerror|load failed|econnrefused/i.test(msg)) {
      return {
        ...CONNECTION_ISSUE,
        code: "backend_unreachable",
        detail: msg,
        stack: err.stack,
      };
    }
  }

  if (err instanceof Error && /timeout|aborted/i.test(err.message)) {
    return {
      ...CONNECTION_ISSUE,
      code: "timeout",
      detail: err.message,
      stack: err.stack,
    };
  }

  if (err instanceof Error && /invalid url|not a valid url|failed to parse url/i.test(err.message)) {
    return {
      ...CONNECTION_ISSUE,
      code: "invalid_api_url",
      detail: err.message,
      stack: err.stack,
    };
  }

  if (err instanceof ApiError) {
    const status = err.status;
    const rawMsg = err.message || "";
    const detail = err.technicalDetail || rawMsg || `API status ${status}`;

    if (status === 401) {
      return {
        code: "unauthorized",
        title: "Sign in required",
        message: "Please sign in to continue.",
        detail,
        status,
        url: err.url,
        stack: err.stack,
      };
    }
    if (status === 403) {
      return {
        code: "auth_unavailable",
        title: DEFAULT_USER_TITLE,
        message: DEFAULT_USER_MESSAGE,
        detail,
        status,
        url: err.url,
        stack: err.stack,
      };
    }
    if (status === 502 || status === 503 || status === 504) {
      return {
        code: "missing_tmdb",
        title: DEFAULT_USER_TITLE,
        message: CONNECTION_USER_MESSAGE,
        detail,
        status,
        url: err.url,
        stack: err.stack,
      };
    }
    if (status >= 500) {
      return {
        code: "server_error",
        title: DEFAULT_USER_TITLE,
        message: DEFAULT_USER_MESSAGE,
        detail,
        status,
        url: err.url,
        stack: err.stack,
      };
    }
    if (status === 429) {
      return {
        code: "rate_limited",
        title: "That was a little too fast",
        message: "You're sending requests a bit quickly. Give it a moment, then try again.",
        detail,
        status,
        url: err.url,
        stack: err.stack,
        retryAfter: err.retryAfter,
      };
    }
    return {
      code: "unknown",
      title: DEFAULT_USER_TITLE,
      message: sanitizeUserMessage(rawMsg),
      detail,
      status,
      url: err.url,
      stack: err.stack,
    };
  }

  if (err instanceof Error) {
    const isNetwork = isTechnicalMessage(err.message);
    return {
      code: "unknown",
      title: DEFAULT_USER_TITLE,
      message: isNetwork ? CONNECTION_USER_MESSAGE : sanitizeUserMessage(err.message),
      detail: err.message,
      stack: err.stack,
    };
  }

  return DEFAULT_ISSUE;
}

/** Log complete technical details to console/logs for developers only. */
export function logTechnicalDetail(issue: ApiIssue, extra?: unknown): void {
  if (process.env.NODE_ENV === "development" || typeof window === "undefined") {
    // eslint-disable-next-line no-console
    console.error(
      `[Apollo Error:${issue.code}]`,
      issue.detail || issue.message,
      issue.status ? `(Status: ${issue.status})` : "",
      issue.url ? `(URL: ${issue.url})` : "",
      extra ?? "",
      issue.stack ? `\nStack: ${issue.stack}` : ""
    );
  }
}

