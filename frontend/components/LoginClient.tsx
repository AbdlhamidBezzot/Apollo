"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { classifyError } from "@/lib/errors";
import { ApiError, post } from "@/lib/http";

export function LoginClient() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [accountAction, setAccountAction] = useState<"login" | "register" | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setError(null);
    setAccountAction(null);
  };

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
    setAccountAction(null);
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
    } catch (err: unknown) {
      if (err instanceof ApiError && mode === "register" && err.status === 409) {
        setError("An account with this email already exists.");
        setAccountAction("login");
      } else if (err instanceof ApiError && mode === "login" && err.status === 401) {
        setError("Incorrect password. Please try again.");
      } else if (err instanceof ApiError && mode === "login" && err.status === 404) {
        setError("This account doesn't exist yet.");
        setAccountAction("register");
      } else {
        setError(classifyError(err).message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading || user) {
    return null;
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)] font-black text-xl shadow-brand-glow">
            A
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="mt-1 text-sm text-[#A1A1AA]">
            {mode === "login" ? "Sign in to continue streaming" : "Start watching in seconds"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121215]/60 p-6 backdrop-blur-xl shadow-2xl">
          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <input
                name="name"
                required
                placeholder="Display name"
                className="w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A1AA] focus:border-[var(--brand-accent)]/50 transition"
              />
            )}
            <input
              name="email"
              type="email"
              required
              placeholder="Email address"
              className="w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A1AA] focus:border-[var(--brand-accent)]/50 transition"
            />
            <input
              name="password"
              type="password"
              required
              minLength={mode === "register" ? 8 : 1}
              placeholder={mode === "register" ? "Password (min 8 chars)" : "Password"}
              className="w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A1AA] focus:border-[var(--brand-accent)]/50 transition"
            />
            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400" role="alert">
                {error}
                {accountAction && (
                  <button type="button" onClick={() => switchMode(accountAction)} className="ml-1 font-bold underline hover:text-red-300">
                    {accountAction === "login" ? "Sign in instead" : "Create an account"}
                  </button>
                )}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[var(--brand-accent)] py-2.5 text-sm font-extrabold text-[var(--brand-accent-text)] shadow-brand-glow transition hover:bg-[var(--brand-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#A1A1AA]">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              className="font-semibold text-[var(--brand-accent)] hover:underline"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
