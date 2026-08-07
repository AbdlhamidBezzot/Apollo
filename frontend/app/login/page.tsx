"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { classifyError } from "@/lib/errors";
import { ApiError, post } from "@/lib/http";

export default function LoginPage() {
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
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="glass rounded-3xl p-7 shadow-glass">
        <h1 className="mb-6 text-center text-3xl font-extrabold tracking-tightest text-text-vivid">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>

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
          {error && (
            <p className="text-xs text-brand-soft" role="alert">
              {error}
              {accountAction && (
                <button type="button" onClick={() => switchMode(accountAction)} className="ml-1 font-bold underline hover:text-white">
                  {accountAction === "login" ? "Sign in instead" : "Create an account"}
                </button>
              )}
            </p>
          )}
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
          <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")} className="text-brand-soft hover:underline">
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
