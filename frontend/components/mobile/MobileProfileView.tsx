"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { THEME_PRESETS, useTheme } from "@/components/ThemeContext";
import { put } from "@/lib/http";

interface UserProfile {
  id: number;
  display_name: string;
  avatar: string | null;
  is_kids: boolean;
}

export function MobileProfileView() {
  const { user, loading, refresh, signOut } = useAuth();
  const { theme, setThemeId } = useTheme();
  const router = useRouter();

  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || "");
  const [savingAvatar, setSavingAvatar] = useState(false);

  const initials = (user?.name || user?.email || "A").charAt(0).toUpperCase();

  const doSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingAvatar(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 250;
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
          const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
          try {
            await put<UserProfile>("/api/v1/me/avatar", { avatar: resizedDataUrl });
            setAvatarUrl(resizedDataUrl);
            void refresh();
          } catch {
            /* ignore */
          }
        }
        setSavingAvatar(false);
      };
      if (typeof event.target?.result === "string") {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] p-6 space-y-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        <div className="h-20 w-20 rounded-full bg-white/10 animate-pulse mx-auto" />
        <div className="h-6 w-36 bg-white/10 rounded mx-auto animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#09090B] pb-24 px-4 pt-[calc(env(safe-area-inset-top)+24px)] text-white">
        <div className="my-12 max-w-sm mx-auto rounded-3xl border border-white/10 bg-white/5 p-6 text-center space-y-4 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-accent)]/20 text-2xl text-[var(--brand-accent)]">
            👤
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black uppercase text-white">Apollo Account</h1>
            <p className="text-xs text-white/60">
              Sign in to manage your profile, sync your watchlist across devices, and customize settings.
            </p>
          </div>
          <Link
            href="/login"
            className="flex h-11 w-full items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)] text-xs font-extrabold shadow-brand-glow transition active:scale-95"
          >
            Sign In to Apollo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] pb-24 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#09090B]/95 backdrop-blur-xl border-b border-white/10 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 px-4">
        <h1 className="text-xl font-black uppercase tracking-tight text-white">Profile & Account</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* User Card */}
        <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <label className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-[var(--brand-accent)] bg-[#09090B] shadow-md">
            {avatarUrl || user.avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarUrl || user.avatar || ""} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-black text-[var(--brand-accent)]">{initials}</span>
            )}
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            {savingAvatar && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
          </label>

          <div className="flex-1 min-w-0 space-y-0.5">
            <h2 className="truncate text-base font-extrabold text-white">{user.name || "Apollo User"}</h2>
            <p className="truncate font-mono text-xs text-white/60">{user.email}</p>
            <p className="text-[10px] text-[var(--brand-accent)] font-semibold pt-0.5">Tap avatar to change photo</p>
          </div>
        </div>

        {/* Theme Accent Selector */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">Accent Color Theme</h3>
          <div className="grid grid-cols-3 gap-2">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setThemeId(p.id)}
                className={`flex items-center gap-2 rounded-xl border p-2.5 transition active:scale-95 ${
                  theme.id === p.id
                    ? "border-white bg-white/15 shadow-md"
                    : "border-white/5 bg-white/5 text-white/70"
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-white/30"
                  style={{ backgroundColor: p.primary }}
                />
                <span className="truncate text-xs font-semibold text-white">
                  {p.name.split(" ")[1] || p.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Account Links */}
        <div className="rounded-3xl border border-white/10 bg-white/5 divide-y divide-white/5 overflow-hidden">
          {[
            { label: "My Watchlist", href: "/my-list", icon: "♡" },
            { label: "Viewing History", href: "/history", icon: "🕒" },
            { label: "Add-ons & Extensions", href: "/settings/addons", icon: "🧩" },
            { label: "About Apollo & Help", href: "/about", icon: "ℹ️" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between p-4 text-xs font-semibold text-white transition active:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              <span className="text-white/40">›</span>
            </Link>
          ))}
        </div>

        {/* Sign Out CTA */}
        <button
          onClick={doSignOut}
          className="flex h-12 w-full items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-extrabold text-white transition active:scale-95 shadow-md"
        >
          Sign Out of Apollo
        </button>
      </div>
    </div>
  );
}
