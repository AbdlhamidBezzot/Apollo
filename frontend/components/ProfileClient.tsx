"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { del, get, put } from "@/lib/http";

interface UserProfile {
  id: number;
  display_name: string;
  avatar: string | null;
  is_kids: boolean;
}

export function ProfileClient() {
  const { user, loading, refresh, signOut } = useAuth();
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Avatar states
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");

  useEffect(() => {
    if (user) {
      if (user.avatar) setAvatarUrl(user.avatar);
      get<UserProfile[]>("/api/v1/me/profiles")
        .then((profiles) => {
          if (profiles && profiles.length > 0 && profiles[0].avatar) {
            setAvatarUrl(profiles[0].avatar);
          }
        })
        .catch(() => {});
    }
  }, [user]);

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

  const handleSaveAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!avatarUrl.trim()) return;
    setSavingAvatar(true);
    setAvatarMessage("");
    try {
      const savedProfile = await put<UserProfile>("/api/v1/me/avatar", { avatar: avatarUrl.trim() });
      setAvatarUrl(savedProfile.avatar || avatarUrl.trim());
      setAvatarMessage("Profile picture saved successfully!");
      setTimeout(() => setAvatarMessage(""), 3000);
      // A successful save must not be reported as failed if refreshing the
      // separate shared session request happens to fail.
      void refresh();
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "Could not save profile picture.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setAvatarMessage("Image must be smaller than 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setAvatarUrl(resizedDataUrl);
          setAvatarMessage("Image ready! Click 'Save Profile Picture' below to confirm.");
        }
      };
      if (typeof event.target?.result === "string") {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
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
    <div className="mx-auto max-w-xl px-4 py-12 space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-text-vivid">Account Settings</h1>

      {/* Profile Picture Section */}
      <div className="glass space-y-4 rounded-3xl p-6 shadow-glass border border-white/10">
        <h2 className="text-lg font-bold text-text-vivid">Profile Picture</h2>
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand/50 bg-gradient-to-tr from-brand to-purple-600 shadow-md">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-white">{user.name?.[0]?.toUpperCase() || "U"}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs text-text-muted">
              Add your image URL or upload a photo to display alongside your comments and reviews.
            </p>
            <label className="inline-block cursor-pointer rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20">
              <span>Choose Image File...</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        <form onSubmit={handleSaveAvatar} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs uppercase tracking-wide text-text-muted mb-1">Or paste Avatar Image URL</label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/my-photo.jpg"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-sm text-text-vivid outline-none focus:border-brand"
            />
          </div>
          {avatarMessage && (
            <p className="text-xs font-semibold text-brand-soft">{avatarMessage}</p>
          )}
          <button
            type="submit"
            disabled={savingAvatar || !avatarUrl.trim()}
            className="rounded-full bg-brand px-6 py-2 text-xs font-bold text-white shadow-brand-glow transition hover:bg-brand-soft disabled:opacity-50"
          >
            {savingAvatar ? "Saving..." : "Save Profile Picture"}
          </button>
        </form>
      </div>

      {/* Account Info Section */}
      <div className="glass space-y-4 rounded-3xl p-6 shadow-glass border border-white/10">
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

      {/* Danger Zone */}
      <div>
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
                {deleting ? "DeletingÃ¢â‚¬Â¦" : "Yes, delete permanently"}
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
