"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { MovieCard } from "@/components/MovieCard";
import { del, get } from "@/lib/http";
import type { Title } from "@/lib/types";

export function MyListClient() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Title[]>([]);
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
        const resolved = details.filter((d): d is Title => d !== null).map((d) => ({
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

  if (status === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="mb-4 text-[#A1A1AA]">Sign in to see your list.</p>
        <Link href="/login" className="inline-block cinema-btn-accent px-6 py-2 text-sm font-extrabold shadow-brand-glow">
          Sign in
        </Link>
      </div>
    );
  }

  const removeItem = async (item: Title) => {
    const mediaType = item.media_type === "tv" ? "tv" : "movie";
    try {
      await del(`/api/v1/me/watchlist/${mediaType}/${item.id}`);
    } catch {
      /* ignore */
    }
    setItems((current) => current.filter((t) => t.id !== item.id));
    setStatus(items.length - 1 <= 0 ? "empty" : "loaded");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-black tracking-tight text-white">My List</h1>
      {status === "empty" ? (
        <p className="text-[#A1A1AA]">Your list is empty. Add titles from their detail pages.</p>
      ) : status !== "loaded" ? (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-32 rounded-2xl border border-white/10 bg-[#121215]/60 animate-pulse sm:w-40" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {items.map((item) => (
            <MovieCard key={item.id} item={item} onRemove={removeItem} />
          ))}
        </div>
      )}
    </div>
  );
}
