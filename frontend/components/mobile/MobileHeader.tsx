"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthContext";

export function MobileHeader({
  onSearchClick,
}: {
  onSearchClick?: () => void;
}) {
  const { user } = useAuth();
  const initials = (user?.name || user?.email || "A").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#09090B]/90 backdrop-blur-xl pt-[env(safe-area-inset-top)] transition-all">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2" aria-label="Apollo mobile home">
          <span className="relative flex h-7 w-7 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[var(--brand-accent)]/25 blur-sm" aria-hidden="true" />
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="relative">
              <circle cx="16" cy="16" r="14" stroke="var(--brand-accent)" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="6" fill="var(--brand-accent)" />
              <path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="var(--brand-accent)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-base font-black tracking-tight text-white">
            APOLLO<span style={{ color: "var(--brand-accent)" }}>.</span>
          </span>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            onClick={onSearchClick}
            aria-label="Search movies and TV shows"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition active:scale-95 hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>

          <Link
            href="/profile"
            aria-label="Account Profile"
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-xs font-bold text-white transition active:scale-95"
          >
            {user?.avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={user.avatar} alt={user.name || "User"} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-accent-text)" }}>
                {initials}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
