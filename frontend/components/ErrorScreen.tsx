"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface ErrorScreenProps {
  title?: string;
  message?: string;
  onRetry?: () => void | Promise<void>;
  homeHref?: string;
}

export function ErrorScreen({
  title = "Something went wrong",
  message = "We couldn't load this page right now. Please try again in a moment.",
  onRetry,
  homeHref = "/",
}: ErrorScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    // Focus heading on mount for screen readers & keyboard navigation
    headingRef.current?.focus();
  }, []);

  const handleRetry = async () => {
    if (retrying || !onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } catch {
      /* ignore */
    } finally {
      // Prevent rapid duplicate clicks with slight cooldown
      setTimeout(() => setRetrying(false), 500);
    }
  };

  return (
    <main
      role="alert"
      aria-live="assertive"
      className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div className="glass animate-draw-in relative w-full overflow-hidden rounded-3xl p-8 sm:p-10 shadow-glass border border-white/10">
        {/* Subtle radial glow background */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-brand/15 blur-3xl"
          aria-hidden="true"
        />

        {/* Elegant, Apple HIG-inspired warning/exclamation icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-inner">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="text-brand-soft"
            aria-hidden="true"
          >
            <path
              d="M12 9v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-vivid outline-none"
        >
          {title}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          {message}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              disabled={retrying}
              onClick={handleRetry}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50"
            >
              {retrying ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span>Retrying…</span>
                </>
              ) : (
                <span>Try Again</span>
              )}
            </button>
          )}

          <Link
            href={homeHref}
            className="flex w-full sm:w-auto items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-text-vivid transition hover:bg-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
