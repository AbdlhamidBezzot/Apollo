"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { MobileProfileView } from "@/components/mobile/MobileProfileView";
import { useIsMobile } from "@/lib/useIsMobile";
import { del, get, put } from "@/lib/http";

interface UserProfile {
  id: number;
  display_name: string;
  avatar: string | null;
  is_kids: boolean;
}

export function ProfileClient() {
  const { isMobile, mounted } = useIsMobile();
  const { user, loading, refresh, signOut } = useAuth();
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (mounted && isMobile) {
    return <MobileProfileView />;
  }

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

  const saveAvatar = async (urlToSave: string) => {
    if (!urlToSave.trim()) return;
    setSavingAvatar(true);
    setAvatarMessage("");
    try {
      const savedProfile = await put<UserProfile>("/api/v1/me/avatar", { avatar: urlToSave.trim() });
      setAvatarUrl(savedProfile.avatar || urlToSave.trim());
      setAvatarMessage("Profile picture saved successfully!");
      setTimeout(() => setAvatarMessage(""), 3500);
      void refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not save profile picture.";
      setAvatarMessage(msg);
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSaveAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveAvatar(avatarUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setAvatarMessage("Image must be smaller than 10MB.");
      return;
    }
    setSavingAvatar(true);
    setAvatarMessage("Processing image...");
    const reader = new FileReader();
    reader.onerror = () => {
      setSavingAvatar(false);
      setAvatarMessage("Failed to read image file.");
    };
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        setSavingAvatar(false);
        setAvatarMessage("Invalid image format.");
      };
      img.onload = async () => {
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
          await saveAvatar(resizedDataUrl);
        } else {
          setSavingAvatar(false);
          setAvatarMessage("Could not process image.");
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
      <div>
        <p className="cinema-label text-[10px]">Account</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#FAFAFA]">Account Settings</h1>
      </div>

      {/* Profile Picture Section */}
      <div className="rounded-3xl border border-white/10 bg-[#09090B]/60 p-6 shadow-glass backdrop-blur-xl space-y-4">
        <h2 className="text-lg font-bold text-[#FAFAFA]">Profile Picture</h2>
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--brand-accent)] bg-[#09090B] shadow-md">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-[var(--brand-accent)]">{user.name?.[0]?.toUpperCase() || "U"}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs text-[#A1A1AA]">
              Add your image URL or upload a photo to display alongside your comments and reviews.
            </p>
            <label className="cinema-btn-pill cursor-pointer px-4 py-1.5 text-xs font-semibold">
              <span>Choose Image File...</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        <form onSubmit={handleSaveAvatar} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-[#A1A1AA] mb-1">Or paste Avatar Image URL</label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/my-photo.jpg"
              className="w-full rounded-full border border-white/15 bg-[#09090B] px-4 py-2 text-sm text-[#FAFAFA] outline-none focus:border-[var(--brand-accent)]"
            />
          </div>
          {avatarMessage && (
            <p className="text-xs font-semibold text-[var(--brand-accent)]">{avatarMessage}</p>
          )}
          <button
            type="submit"
            disabled={savingAvatar || !avatarUrl.trim()}
            className="cinema-btn-gold py-2 px-6 text-xs font-bold shadow-brand-glow disabled:opacity-50"
          >
            {savingAvatar ? "Saving..." : "Save Profile Picture"}
          </button>
        </form>
      </div>

      {/* Account Info Section */}
      <div className="rounded-3xl border border-white/10 bg-[#09090B]/60 p-6 shadow-glass backdrop-blur-xl space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-[#A1A1AA]">Display name</p>
          <p className="mt-1 text-lg font-semibold text-[#FAFAFA]">{user.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-[#A1A1AA]">Email</p>
          <p className="mt-1 font-mono text-sm text-[#A1A1AA]">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.is_admin ? (
            <span className="rounded-full border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/15 px-3 py-0.5 text-[11px] font-bold text-[var(--brand-accent)]">Admin</span>
          ) : null}
        </div>
        <button
          onClick={doSignOut}
          className="cinema-btn-gold mt-2 w-full py-2.5 font-bold shadow-brand-glow"
        >
          Sign out
        </button>
      </div>

      {/* Danger Zone */}
      <div>
        {confirmingDelete ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-6">
            <h2 className="mb-1 text-lg font-bold text-red-400">Delete your account?</h2>
            <p className="mb-4 text-sm text-[#A1A1AA]">
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
                className="cinema-btn-pill px-5 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-[#09090B]/60 p-6 backdrop-blur-xl">
            <h2 className="mb-1 text-lg font-bold text-[#FAFAFA]">Danger zone</h2>
            <p className="mb-4 text-sm text-[#A1A1AA]">Permanently delete this account and all of its data.</p>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="rounded-full border border-red-500/40 bg-red-500/10 px-5 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500/20"
            >
              Delete account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
