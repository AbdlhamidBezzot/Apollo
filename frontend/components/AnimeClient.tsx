"use client";

import { useCallback, useEffect, useState } from "react";

import { AnimeHubPrefs } from "@/components/AnimeHubPrefs";
import { MovieRow } from "@/components/MovieRow";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AnimeClient() {
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movies, setMovies] = useState<Title[]>([]);
  const [series, setSeries] = useState<Title[]>([]);

  const loadAnimeData = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setRetrying(true);
    } else {
      setLoading(true);
    }
    setError(null);

    async function fetchAnimeWithRetry(mediaType: "movie" | "tv", attempts = 2): Promise<Title[]> {
      const path = `/api/v1/content/discover?media_type=${mediaType}&genre=16&sort_by=popularity.desc`;
      for (let i = 0; i < attempts; i++) {
        try {
          const data = await get<ContentListResponse>(path, 1800);
          if (data && Array.isArray(data.results)) {
            return data.results.map((t) => ({ ...t, media_type: mediaType }));
          }
        } catch {
          if (i < attempts - 1) {
            await sleep(1500);
          }
        }
      }
      return [];
    }

    try {
      const [resMovies, resSeries] = await Promise.all([
        fetchAnimeWithRetry("movie"),
        fetchAnimeWithRetry("tv"),
      ]);

      setMovies(resMovies);
      setSeries(resSeries);

      if (resMovies.length === 0 && resSeries.length === 0) {
        setError("Anime catalog server is warming up.");
      }
    } catch {
      setError("Unable to reach anime stream server.");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    loadAnimeData();
  }, [loadAnimeData]);

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-brand-soft">Discover</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tightest text-text-vivid">Anime</h1>
      </div>
      <AnimeHubPrefs />

      {/* Movies Row */}
      {movies.length > 0 ? (
        <MovieRow title="Anime movies" items={movies} seeAllHref="/browse?media_type=movie&genre=16" />
      ) : loading || retrying ? (
        <div className="space-y-3">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-surface-dark animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-surface-dark/60 p-6 text-center backdrop-blur">
          <p className="text-sm font-semibold text-text-vivid">Anime movies</p>
          <p className="mt-1 text-xs text-text-muted">
            {error || "Anime stream server is starting up or temporarily offline."}
          </p>
          <button
            onClick={() => loadAnimeData(true)}
            disabled={retrying}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-xs font-bold text-white shadow-brand-glow hover:bg-brand-soft disabled:opacity-50"
          >
            {retrying ? "Connecting…" : "Retry Loading Anime ▶"}
          </button>
        </div>
      )}

      {/* Series Row */}
      {series.length > 0 ? (
        <MovieRow title="Anime series" items={series} seeAllHref="/browse?media_type=tv&genre=16" />
      ) : loading || retrying ? (
        <div className="space-y-3">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-surface-dark animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-surface-dark/60 p-6 text-center backdrop-blur">
          <p className="text-sm font-semibold text-text-vivid">Anime series</p>
          <p className="mt-1 text-xs text-text-muted">
            {error || "Anime stream server is starting up or temporarily offline."}
          </p>
          <button
            onClick={() => loadAnimeData(true)}
            disabled={retrying}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-xs font-bold text-white shadow-brand-glow hover:bg-brand-soft disabled:opacity-50"
          >
            {retrying ? "Connecting…" : "Retry Loading Anime ▶"}
          </button>
        </div>
      )}
    </div>
  );
}
