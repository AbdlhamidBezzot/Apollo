"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MobileMovieCard } from "./MobileMovieCard";
import { MobileGridSkeleton } from "./MobileSkeleton";
import { useAuth } from "@/components/AuthContext";
import { del, get } from "@/lib/http";
import type { Title } from "@/lib/types";

export function MobileWatchlistView() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Title[]>([]);
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
  const [status, setStatus] = useState<"loading" | "loaded" | "empty" | "error">("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const list = await get<{ tmdb_id: number; media_type: string }[]>("/api/v1/me/watchlist");
        const details = await Promise.all(
          list.map(async (i) => {
            try {
              return await get<Title>(`/api/v1/content/${i.media_type}/${i.tmdb_id}`);
            } catch {
              return null;
            }
          })
        );
        const resolved = details
          .filter((d): d is Title => d !== null)
          .map((d) => ({
            ...d,
            media_type: list.find((i) => i.tmdb_id === d.id)?.media_type || "movie",
          }));
        setItems(resolved);
        setStatus(resolved.length ? "loaded" : "empty");
      } catch {
        setStatus("error");
      }
    })();
  }, [user, loading]);

  const removeItem = async (item: Title) => {
    const mediaType = item.media_type === "tv" ? "tv" : "movie";
    try {
      await del(`/api/v1/me/watchlist/${mediaType}/${item.id}`);
    } catch {
      /* ignore */
    }
    setItems((current) => current.filter((t) => t.id !== item.id));
  };

  const filteredItems = items.filter((i) => (filter === "all" ? true : i.media_type === filter));

  return (
    <div className="min-h-screen bg-[#09090B] pb-24 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#09090B]/95 backdrop-blur-xl border-b border-white/10 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 px-4 space-y-3">
        <h1 className="text-xl font-black uppercase tracking-tight text-white">My Watchlist</h1>

        {user && (
          <div className="flex items-center gap-2">
            {[
              { value: "all", label: "All Titles" },
              { value: "movie", label: "Movies" },
              { value: "tv", label: "TV Shows" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value as any)}
                className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
                  filter === f.value
                    ? "bg-[var(--brand-accent)] text-[var(--brand-accent-text)] shadow-brand-glow"
                    : "border border-white/10 bg-white/5 text-white/70"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {loading || (user && status === "loading") ? (
          <MobileGridSkeleton count={6} />
        ) : !user || status === "error" ? (
          <div className="mx-auto my-12 max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-accent)]/20 text-[var(--brand-accent)] text-2xl">
              ♡
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-black text-white">Your Watchlist</h2>
              <p className="text-xs text-white/60 leading-relaxed">
                Sign in to save movies and TV shows to your personal list and access them anywhere.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)] text-xs font-extrabold shadow-brand-glow transition active:scale-95"
            >
              Sign In to Apollo
            </Link>
          </div>
        ) : status === "empty" || filteredItems.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <span className="text-3xl">🎬</span>
            <p className="text-sm font-bold text-white">Your list is empty</p>
            <p className="text-xs text-white/60 max-w-xs mx-auto">
              Browse movies or TV shows and tap the bookmark button to save them here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filteredItems.map((item) => (
              <MobileMovieCard key={item.id} item={item} onRemove={removeItem} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
