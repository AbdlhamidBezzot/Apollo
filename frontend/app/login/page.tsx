"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { API_URL } from "@/lib/api";
import { post } from "@/lib/http";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [googleAccountError, setGoogleAccountError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setError(null);
    setGoogleAccountError(false);
    setBusy(true);
    try {
      if (mode === "register") {
        const name = String(form.get("name"));
        await post("/api/v1/auth/register", { email, password, name });
      } else {
        await post("/api/v1/auth/login", { email, password });
      }
      await refresh();
      router.push("/");
    } catch (err: any) {
      if (err.status === 403 && err.message === "google_account") {
        setGoogleAccountError(true);
      } else {
        setError(err.message || "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = () => {
    // Navigate the browser directly to the backend authorize endpoint. It issues
    // a 302 to Google with a SameSite/secure state cookie set on the same
    // top-level navigation — no cross-origin fetch() that could drop the cookie.
    setError(null);
    window.location.assign(`${API_URL}/api/v1/auth/google/authorize`);
  };

  if (loading || user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="glass rounded-3xl p-7 shadow-glass">
        <h1 className="mb-6 text-center text-3xl font-extrabold tracking-tightest text-text-vivid">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>

        <button
          type="button"
          onClick={googleSignIn}
          disabled={busy}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 disabled:opacity-40"
        >
          <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden>
            <path
              fill="#FFC107"
              d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C41.3 36.4 44 30.6 44 24c0-1.3-.1-2.6-.4-3.9z"
            />
          </svg>
          {mode === "login" ? "Sign in with Google" : "Sign up with Google"}
        </button>

        <div className="mb-4 flex items-center gap-3 text-xs text-text-muted">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
          or continue with email
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <input
              name="name"
              required
              placeholder="Display name"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-text-vivid outline-none placeholder:text-text-muted focus:border-brand/50"
            />
          )}
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-text-vivid outline-none placeholder:text-text-muted focus:border-brand/50"
          />
          <input
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : 1}
            placeholder={mode === "register" ? "Password (min 8 chars)" : "Password"}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-text-vivid outline-none placeholder:text-text-muted focus:border-brand/50"
          />
          {googleAccountError && (
            <div className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm">
              <p className="font-semibold text-text-vivid">This email is linked to a Google account.</p>
              <p className="mt-0.5 text-xs text-text-muted">Please use Google Sign-In to continue.</p>
              <button
                type="button"
                onClick={googleSignIn}
                disabled={busy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 disabled:opacity-40"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 48 48" aria-hidden>
                  <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C41.3 36.4 44 30.6 44 24c0-1.3-.1-2.6-.4-3.9z" />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}
          {error && <p className="text-xs text-brand-soft">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft disabled:opacity-40"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-text-muted">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-brand-soft hover:underline">
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
