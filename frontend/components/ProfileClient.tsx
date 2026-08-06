"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { del } from "@/lib/http";

export function ProfileClient() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const doSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const doDeleteAccount = async () => {
    setDeleting(true);
    try {
      await del("/api/v1/auth/account");
      await signOut();
      router.push("/");
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-16">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-24 rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="mb-4 text-text-muted">Sign in to manage your account.</p>
        <Link href="/login" className="rounded-full bg-brand px-6 py-2 text-sm font-bold text-white shadow-brand-glow">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-text-vivid">Account Settings</h1>
      <div className="glass space-y-4 rounded-3xl p-6 shadow-glass">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Display name</p>
          <p className="mt-1 text-lg font-semibold text-text-vivid">{user.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Email</p>
          <p className="mt-1 font-mono text-sm text-text-muted">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.is_admin ? (
            <span className="rounded-full bg-badge-rating/15 px-2.5 py-0.5 text-[11px] font-bold text-badge-rating">Admin</span>
          ) : null}
        </div>
        <button
          onClick={doSignOut}
          className="mt-2 w-full rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft"
        >
          Sign out
        </button>
      </div>

      <div className="mt-8">
        {confirmingDelete ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-6">
            <h2 className="mb-1 text-lg font-bold text-red-400">Delete your account?</h2>
            <p className="mb-4 text-sm text-text-muted">
              This permanently removes your account, profiles, watchlist, history and chat. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={doDeleteAccount}
                disabled={deleting}
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete permanently"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-text-muted transition hover:border-white/30 hover:text-text-vivid"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 p-6">
            <h2 className="mb-1 text-lg font-bold text-text-vivid">Danger zone</h2>
            <p className="mb-4 text-sm text-text-muted">Permanently delete this account and all of its data.</p>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="rounded-full border border-red-500/40 px-5 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500/10"
            >
              Delete account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
