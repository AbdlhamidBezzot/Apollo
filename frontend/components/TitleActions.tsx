"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { del, get, post, put } from "@/lib/http";

interface Props {
  tmdbId: number;
  mediaType: "movie" | "tv";
  hidePlay?: boolean;
}

export function TitleActions({ tmdbId, mediaType, hidePlay }: Props) {
  const { user } = useAuth();
  const [inList, setInList] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [list, ratings] = await Promise.all([
          get<{ tmdb_id: number; media_type: string }[]>("/api/v1/me/watchlist"),
          get<{ tmdb_id: number; media_type: string; rating: number }[]>("/api/v1/me/ratings"),
        ]);
        setInList(list.some((i) => i.tmdb_id === tmdbId && i.media_type === mediaType));
        const mine = ratings.find((r) => r.tmdb_id === tmdbId && r.media_type === mediaType);
        setRating(mine ? mine.rating : null);
      } catch {
        /* ignore */
      }
    })();
  }, [user, tmdbId, mediaType]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {user ? (
        <>
          <button
            onClick={async () => {
              if (inList) {
                await del(`/api/v1/me/watchlist/${mediaType}/${tmdbId}`);
                setInList(false);
              } else {
                await post("/api/v1/me/watchlist", { tmdb_id: tmdbId, media_type: mediaType });
                setInList(true);
              }
            }}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-text-vivid transition hover:border-brand/50"
          >
            {inList ? "− Remove from My List" : "+ My List"}
          </button>
          {!hidePlay && (
            <Link
              href={`/watch/${mediaType}/${tmdbId}`}
              className="rounded-full bg-brand px-6 py-2 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft"
            >
              ▶ Play
            </Link>
          )}
          <div className="flex items-center gap-1 text-lg">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={async () => {
                  await put("/api/v1/me/ratings", { tmdb_id: tmdbId, media_type: mediaType, rating: n });
                  setRating(n);
                }}
                className={`${rating !== null && n <= rating ? "text-badge-rating" : "text-white/20 transition hover:text-white/40"}`}
                aria-label={`Rate ${n}`}
              >
                ★
              </button>
            ))}
          </div>
        </>
      ) : (
        <Link
          href="/login"
          className="rounded-full bg-brand px-6 py-2 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft"
        >
          Sign in to play
        </Link>
      )}
    </div>
  );
}
