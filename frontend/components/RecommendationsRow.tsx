"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { MovieCard } from "@/components/MovieCard";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

export function RecommendationsRow() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Title[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await get<ContentListResponse>("/api/v1/content/recommend?limit=12");
        if (!cancelled) setItems(data.results || []);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (loading || items === null || items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-text-vivid">Because you watched</h2>
        <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
      </div>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {items.map((item) => (
          <MovieCard key={`${item.media_type || "movie"}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}
