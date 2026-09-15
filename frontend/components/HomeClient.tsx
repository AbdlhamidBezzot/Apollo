"use client";

import { useCallback, useEffect, useState } from "react";

import { Ad300x250 } from "@/components/Ad300x250";
import { ContinueWatchingRow } from "@/components/ContinueWatchingRow";
import { HeroBillboard } from "@/components/HeroBillboard";
import { DiscoveryHub, ProviderMarquee, Top10Carousel } from "@/components/HomeEnhancements";
import { MovieRow } from "@/components/MovieRow";
import { PokePingsAd } from "@/components/PokePingsAd";
import { RecommendationsRow } from "@/components/RecommendationsRow";
import { SignInNotice } from "@/components/SignInNotice";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function HomeClient() {
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trending, setTrending] = useState<Title[]>([]);
  const [topStreaming, setTopStreaming] = useState<Title[]>([]);
  const [popularMovies, setPopularMovies] = useState<Title[]>([]);
  const [popularTv, setPopularTv] = useState<Title[]>([]);
  const [topRated, setTopRated] = useState<Title[]>([]);

  const loadData = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setRetrying(true);
    } else {
      setLoading(true);
    }
    setError(null);

    async function fetchListWithRetry(path: string, attempts = 2): Promise<Title[]> {
      for (let i = 0; i < attempts; i++) {
        try {
          const data = await get<ContentListResponse>(path, 1800);
          if (data && Array.isArray(data.results)) {
            return data.results.map((t) => ({ ...t, media_type: t.media_type || "movie" }));
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
      const [resTrending, resTopStreaming, resPopularMovies, resPopularTv, resTopRated] =
        await Promise.all([
          fetchListWithRetry("/api/v1/content/trending?time_window=week"),
          fetchListWithRetry("/api/v1/content/top-streaming?media_type=movie"),
          fetchListWithRetry("/api/v1/content/popular?media_type=movie"),
          fetchListWithRetry("/api/v1/content/popular?media_type=tv"),
          fetchListWithRetry("/api/v1/content/top-rated?media_type=movie"),
        ]);

      setTrending(resTrending);
      setTopStreaming(resTopStreaming);
      setPopularMovies(resPopularMovies);
      setPopularTv(resPopularTv);
      setTopRated(resTopRated);

      const totalItems =
        resTrending.length +
        resTopStreaming.length +
        resPopularMovies.length +
        resPopularTv.length +
        resTopRated.length;

      if (totalItems === 0) {
        setError("Stream catalog server is warming up.");
      }
    } catch {
      setError("Unable to reach stream server.");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = [
    { title: "Trending this week", items: trending, seeAllHref: "/browse?kind=trending" },
    { title: "Popular movies", items: popularMovies, seeAllHref: "/browse?media_type=movie&sort_by=popularity.desc" },
    { title: "Popular series", items: popularTv, seeAllHref: "/browse?media_type=tv&sort_by=popularity.desc" },
    { title: "Top rated", items: topRated, seeAllHref: "/browse?media_type=movie&sort_by=vote_average.desc" },
  ];

  const hasAnyItems = trending.length > 0 || popularMovies.length > 0 || popularTv.length > 0 || topRated.length > 0;

  return (
    <div className="space-y-10 pb-4">
      {/* Hero Billboard */}

      {trending.length > 0 ? (
        <HeroBillboard slides={trending} />
      ) : loading ? (
        <section className="relative mx-auto mt-6 flex h-[400px] w-full max-w-7xl items-end overflow-hidden rounded-3xl border border-white/10 bg-bg-surface px-5 pb-14 sm:h-[520px] sm:px-8"><div className="max-w-2xl"><p className="mb-2 text-sm font-semibold text-white/90">Discover what to watch next</p><h1 className="text-4xl font-extrabold leading-[1.1] text-text-vivid sm:text-6xl">Find your next great watch.</h1><p className="mt-4 max-w-lg text-base leading-relaxed text-white/85">Browse movies and series across the streaming services you already use.</p><div className="mt-6 h-11 w-36 animate-pulse rounded-full bg-white/15" aria-label="Loading featured title" /></div></section>
      ) : null}

      <ContinueWatchingRow />

      {topStreaming.length > 0 || trending.length > 0 ? (
        <Top10Carousel items={topStreaming.length ? topStreaming : trending} />
      ) : null}

      <Ad300x250 />

      <DiscoveryHub />
      <ProviderMarquee />
      <SignInNotice />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 my-6">
        <PokePingsAd />
      </div>

      <RecommendationsRow />

      <Ad300x250 />

      {/* Catalog Rows or Inline Retry Widget */}
      {rows.map((row, idx) => (
        <div key={row.title} className="space-y-12">
          {row.items.length > 0 ? (
            <MovieRow title={row.title} items={row.items} seeAllHref={row.seeAllHref} />
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
              <p className="text-sm font-semibold text-text-vivid">{row.title}</p>
              <p className="mt-1 text-xs text-text-muted">
                {error || "Stream servers are starting up or temporarily offline."}
              </p>
              <button
                onClick={() => loadData(true)}
                disabled={retrying}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-xs font-bold text-white shadow-brand-glow hover:bg-brand-soft disabled:opacity-50"
              >
                {retrying ? "Connecting…" : "Retry Loading Catalog ▶"}
              </button>
            </div>
          )}

        </div>
      ))}

      {!loading && !hasAnyItems && error && (
        <div className="mx-auto max-w-xl rounded-2xl border border-brand/30 bg-brand/10 p-6 text-center shadow-glass">
          <p className="text-sm font-bold text-text-vivid">Backend Service Notice</p>
          <p className="mt-1 text-xs text-text-muted">
            The Render backend API is currently waking up from a cold start. Click below to refresh content.
          </p>
          <button
            onClick={() => loadData(true)}
            disabled={retrying}
            className="mt-4 rounded-full bg-brand px-6 py-2.5 text-xs font-bold text-white shadow-brand-glow hover:bg-brand-soft disabled:opacity-50"
          >
            {retrying ? "Connecting…" : "Refresh Stream Catalog 🔄"}
          </button>
        </div>
      )}
    </div>
  );
}
