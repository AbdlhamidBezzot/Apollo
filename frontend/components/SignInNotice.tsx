"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthContext";

export function SignInNotice() {
  const { user, loading } = useAuth();
  if (loading || user) return null;

  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="glass rounded-2xl border border-white/10 bg-bg-card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold tracking-tight text-text-vivid">Unlock more with an account</h2>
        <p className="mt-1 text-sm text-text-muted">
          Sign in to see your{" "}
          <span className="font-semibold text-text-vivid">watching history</span>, the{" "}
          <span className="font-semibold text-text-vivid">Continue Watching</span> row, and to use{" "}
          <span className="font-semibold text-text-vivid">CineBot</span> and{" "}
          <span className="font-semibold text-text-vivid">Movie Night rooms</span>.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-full bg-brand px-6 py-2 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft"
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}